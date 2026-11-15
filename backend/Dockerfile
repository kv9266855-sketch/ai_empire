FROM python:3.13-slim
WORKDIR /site
COPY backend/requirements.lock.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && useradd --create-home empire
COPY --chown=empire:empire . /site
RUN mkdir -p /site/backend/uploads && chown -R empire:empire /site/backend/uploads
USER empire
WORKDIR /site/backend
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.cli seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-proxy-headers"]
