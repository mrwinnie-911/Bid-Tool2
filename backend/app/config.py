import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def _split_csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass
class Settings:
    mysql_host: str = field(default_factory=lambda: os.getenv("MYSQL_HOST", "localhost"))
    mysql_port: int = field(default_factory=lambda: int(os.getenv("MYSQL_PORT", "3306")))
    mysql_user: str = field(default_factory=lambda: os.getenv("MYSQL_USER", "root"))
    mysql_password: str = field(default_factory=lambda: os.getenv("MYSQL_PASSWORD", ""))
    mysql_database: str = field(default_factory=lambda: os.getenv("MYSQL_DATABASE", "avlv_quotes"))
    mysql_pool_min_size: int = field(default_factory=lambda: int(os.getenv("MYSQL_POOL_MIN_SIZE", "1")))
    mysql_pool_max_size: int = field(default_factory=lambda: int(os.getenv("MYSQL_POOL_MAX_SIZE", "10")))

    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", ""))
    jwt_algorithm: str = field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    jwt_expiration_hours: int = field(default_factory=lambda: int(os.getenv("JWT_EXPIRATION_HOURS", "24")))

    cors_origins: List[str] = field(init=False)
    cors_allow_credentials: bool = field(init=False)

    bootstrap_admin_username: str = field(default_factory=lambda: os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin"))
    bootstrap_admin_password: Optional[str] = field(init=False)
    bootstrap_admin_enabled: bool = field(init=False)

    def __post_init__(self) -> None:
        if not self.jwt_secret:
            raise RuntimeError(
                "JWT_SECRET environment variable must be set. "
                "Generate a strong value and export it before starting the API."
            )

        origins = _split_csv(os.getenv("CORS_ORIGINS"))
        allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "false").lower() == "true"
        if not origins:
            # Browsers reject allow_credentials + wildcard; fall back to safe defaults.
            allow_credentials = False
        self.cors_origins = origins
        self.cors_allow_credentials = allow_credentials

        password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD")
        if password:
            self.bootstrap_admin_enabled = True
            self.bootstrap_admin_password = password
        else:
            self.bootstrap_admin_enabled = False
            self.bootstrap_admin_password = None


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
