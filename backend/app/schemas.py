import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)

    @field_validator('*', mode='before')
    @classmethod
    def reject_controls(cls, v):
        if isinstance(v, str) and re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', v):
            raise ValueError('invalid control characters')
        return v

class LoginIn(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

class LeadIn(Input):
    name: str = Field(min_length=2, max_length=80)
    contact: str = Field(min_length=3, max_length=120)
    service: Literal['automation','web','assistants','leadgen','saas','other']
    budget: Literal['lt299','299-799','799-1999','1999+','unknown']
    message: str = Field(min_length=10, max_length=2000)
    consent: Literal[True]
    lang: Literal['ua','ru','en'] = 'ru'
    page: str = Field(default='/', max_length=200)
    website: str = Field(default='', max_length=200)
    elapsed_ms: int = Field(ge=0, le=86400000)

    @field_validator('contact')
    @classmethod
    def contact_valid(cls, v):
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]{2,}|@?[a-zA-Z0-9_]{5,32}|(?:https?://)?t\.me/[a-zA-Z0-9_]{5,32}', v):
            raise ValueError('invalid contact')
        return v

class LeadPatch(Input):
    status: Literal['new','contacted','qualified','proposal','won','lost'] | None = None
    notes: str | None = Field(default=None, max_length=10000)

class ProjectIn(Input):
    title: str = Field(min_length=2, max_length=150)
    client: str = Field(default='', max_length=150)
    status: Literal['discovery','in_progress','review','completed','paused'] = 'discovery'
    value_usd: float = Field(default=0, ge=0, le=100000000)
    description: str = Field(default='', max_length=5000)

class AgentIn(Input):
    name: str = Field(min_length=2, max_length=100)
    provider: Literal['claude','codex']
    model: str = Field(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9._:-]+$')
    enabled: bool = False
    system_prompt: str = Field(default='Help the owner with the specified business task. Do not contact third parties.', max_length=6000)
    monthly_budget_usd: float = Field(default=25, ge=0, le=100000)
    max_output_tokens: int = Field(default=1024, ge=64, le=8192)

class FinanceIn(Input):
    kind: Literal['income','expense']
    amount_usd: float = Field(gt=0, le=100000000)
    description: str = Field(min_length=2, max_length=500)
    occurred_on: date

class ContentIn(Input):
    key: str = Field(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9_.-]+$')
    value: str = Field(max_length=20000)
    lang: Literal['ru','ua','en','all'] = 'all'

class PricingIn(Input):
    category: Literal['web','assistants','automation','saas']
    tier: Literal['start','growth','custom']
    name: str = Field(min_length=1, max_length=50)
    price_usd: float = Field(ge=0, le=1000000)
    interval: Literal['once','month'] = 'once'
    description: str = Field(default='', max_length=1000)
    features: list[str] = Field(default_factory=list, max_length=20)
    active: bool = True

class WebFields(Input):
    @field_validator('image','url', check_fields=False)
    @classmethod
    def safe_url(cls, v):
        if v and not (v.startswith('/assets/') or v.startswith('/uploads/') or v.startswith('/services/') or v.startswith('/products/') or v.startswith('/portfolio/') or re.match(r'^https://[^\s]+$', v)):
            raise ValueError('Use a local asset/page or an HTTPS URL')
        if '..' in v or '\\' in v: raise ValueError('Invalid URL')
        return v

class ServiceIn(WebFields):
    slug: str = Field(pattern=r'^[a-z0-9-]{2,60}$')
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(max_length=5000)
    features: list[str] = Field(default_factory=list, max_length=20)
    image: str = Field(default='', max_length=500)
    active: bool = True

class ProductIn(WebFields):
    slug: str = Field(pattern=r'^[a-z0-9-]{2,60}$')
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(max_length=5000)
    status: Literal['soon','beta','available'] = 'soon'
    url: str = Field(default='', max_length=500)
    image: str = Field(default='', max_length=500)
    active: bool = True

class PortfolioIn(WebFields):
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(max_length=5000)
    category: str = Field(min_length=1, max_length=50)
    image: str = Field(default='', max_length=500)
    url: str = Field(default='', max_length=500)
    demo: bool = True
    technologies: list[str] = Field(default_factory=list, max_length=20)
    active: bool = True

class SettingsIn(Input):
    monthly_budget_usd: float | None = Field(default=None, ge=0, le=100000)
    automation_enabled: bool | None = None
    public_theme: Literal['winter', 'classic'] | None = None

class TaskIn(Input):
    agent_id: str = Field(min_length=1, max_length=36)
    prompt: str = Field(min_length=5, max_length=10000)
    max_cost_usd: float = Field(gt=0, le=100)

RESOURCE_SCHEMAS = {'projects':ProjectIn, 'agents':AgentIn, 'finance':FinanceIn,
                    'content':ContentIn, 'pricing':PricingIn, 'products':ProductIn,
                    'services':ServiceIn, 'portfolio':PortfolioIn}
