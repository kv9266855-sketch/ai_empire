"""Integration tests use SQLite only under ENVIRONMENT=test.

Production startup deliberately rejects SQLite and requires PostgreSQL.
"""
import os
from pathlib import Path

os.environ['ENVIRONMENT'] = 'test'
os.environ['DATABASE_URL'] = 'sqlite:///./test-ai-empire.db'
os.environ['ENABLE_WORKER'] = 'false'
os.environ['IP_HASH_SALT'] = 'test-salt-that-is-only-used-in-isolated-tests'
os.environ['ALLOWED_ORIGINS'] = 'http://testserver'

from fastapi.testclient import TestClient
import pytest

from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import Configuration, Lead, Record
from app.security import passwords
from app.models import Owner


VALID_LEAD = {
    'name': 'Ada Lovelace', 'contact': 'ada@example.com', 'service': 'automation',
    'budget': '799-1999', 'message': 'Please help us automate incoming consultation requests.',
    'consent': True, 'lang': 'en', 'page': '/', 'website': '', 'elapsed_ms': 3100,
}


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(Configuration(id=1, monthly_budget_usd=50, automation_enabled=False))
        db.commit()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def count_leads():
    with SessionLocal() as db:
        return len(db.query(Lead).all())


def test_health_and_valid_lead_are_persisted(client):
    assert client.get('/health').json()['status'] == 'ok'
    response = client.post('/api/v1/leads', json=VALID_LEAD)
    assert response.status_code == 201
    assert response.json()['status'] == 'received'
    assert count_leads() == 1


@pytest.mark.parametrize('field,value,code', [
    ('name', 'A', 'too_short'), ('contact', 'bad contact', 'invalid'),
    ('message', 'short', 'too_short'), ('consent', False, 'consent_required'),
])
def test_lead_validation_returns_field_errors(client, field, value, code):
    payload = {**VALID_LEAD, field: value}
    response = client.post('/api/v1/leads', json=payload)
    assert response.status_code == 422
    assert response.json()['errors'][field] == code
    assert count_leads() == 0


@pytest.mark.parametrize('field,value', [('website', 'bot-filled'), ('elapsed_ms', 1000)])
def test_spam_submission_receives_generic_success_without_storage(client, field, value):
    response = client.post('/api/v1/leads', json={**VALID_LEAD, field: value})
    assert response.status_code == 201
    assert response.json()['status'] == 'received'
    assert count_leads() == 0


def test_lead_rate_limit(client):
    for number in range(5):
        payload = {**VALID_LEAD, 'contact': f'ada{number}@example.com'}
        assert client.post('/api/v1/leads', json=payload).status_code == 201
    assert client.post('/api/v1/leads', json=VALID_LEAD).status_code == 429


def test_disallowed_origin_is_rejected(client):
    response = client.post('/api/v1/leads', json=VALID_LEAD, headers={'Origin': 'https://other.example'})
    assert response.status_code == 403
    assert response.json() == {'error': 'origin_not_allowed'}


def test_public_bootstrap_contains_catalog_and_localized_content(client):
    with SessionLocal() as db:
        db.add_all([
            Record(kind='content', data={'lang': 'ru', 'key': 'hero.title', 'value': 'Из базы'}),
            Record(kind='pricing', data={'category': 'web', 'tier': 'start', 'name': 'START', 'price_usd': 299, 'interval': 'once', 'description': '', 'features': [], 'active': True}),
        ])
        db.commit()
    payload = client.get('/api/v1/public/bootstrap').json()
    assert payload['content']['ru']['hero.title'] == 'Из базы'
    assert payload['pricing'][0]['price_usd'] == 299


def test_admin_mutations_require_session_and_csrf(client):
    assert client.get('/api/v1/admin/pricing').status_code == 401
    with SessionLocal() as db:
        db.add(Owner(email='owner@example.com', password_hash=passwords.hash('very-long-test-password')))
        db.commit()
    login = client.post('/api/v1/auth/login', json={'email': 'owner@example.com', 'password': 'very-long-test-password'})
    assert login.status_code == 200
    pricing = {'category': 'web', 'tier': 'start', 'name': 'START', 'price_usd': 299, 'interval': 'once', 'description': '', 'features': [], 'active': True}
    assert client.post('/api/v1/admin/pricing', json=pricing).status_code == 403
    csrf = login.json()['csrf_token']
    response = client.post('/api/v1/admin/pricing', json=pricing, headers={'X-CSRF-Token': csrf})
    assert response.status_code == 201
    assert response.json()['price_usd'] == 299


def test_runtime_script_reports_api_and_default_winter_theme(client):
    response = client.get('/js/runtime.js')
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('application/javascript')
    assert '"api": true' in response.text and '"theme": "winter"' in response.text


def test_owner_can_switch_public_theme_and_invalid_theme_is_rejected(client):
    with SessionLocal() as db:
        db.add(Owner(email='owner@example.com', password_hash=passwords.hash('very-long-test-password')))
        db.commit()
    assert client.patch('/api/v1/admin/settings', json={'public_theme': 'classic'}).status_code == 401
    csrf = client.post('/api/v1/auth/login', json={'email': 'owner@example.com', 'password': 'very-long-test-password'}).json()['csrf_token']
    headers = {'X-CSRF-Token': csrf}
    assert client.patch('/api/v1/admin/settings', json={'public_theme': 'neon'}, headers=headers).status_code == 422
    response = client.patch('/api/v1/admin/settings', json={'public_theme': 'classic'}, headers=headers)
    assert response.status_code == 200 and response.json()['public_theme'] == 'classic'
    assert client.get('/api/v1/admin/settings').json()['public_theme'] == 'classic'
    assert '"theme": "classic"' in client.get('/js/runtime.js').text
