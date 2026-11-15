from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    database_url: str = 'postgresql+psycopg://empire:empire@localhost:5432/empire'
    environment: str = 'development'
    allowed_origins: str = 'http://127.0.0.1:8000,http://localhost:8000'
    cookie_secure: bool = False
    session_hours: int = 12
    ip_hash_salt: str = ''
    uploads_dir: str = str(ROOT / 'backend' / 'uploads')
    anthropic_api_key: str = ''
    anthropic_api_version: str = '2023-06-01'
    claude_input_usd_per_million: float = 0
    claude_output_usd_per_million: float = 0
    codex_executable: str = ''
    codex_workspace: str = ''
    codex_input_usd_per_million: float = 0
    codex_output_usd_per_million: float = 0
    agent_timeout_seconds: int = 120
    enable_worker: bool = True
    public_base_url: str = ''

    @property
    def origins(self):
        return [s.strip().rstrip('/') for s in self.allowed_origins.split(',') if s.strip()]

settings = Settings()
