from __future__ import annotations

import aiomysql
from typing import AsyncGenerator, Optional

from .config import get_settings, Settings

_pool: Optional[aiomysql.Pool] = None


async def get_db_pool(settings: Optional[Settings] = None) -> aiomysql.Pool:
    global _pool
    settings = settings or get_settings()
    if _pool is None:
        _pool = await aiomysql.create_pool(
            host=settings.mysql_host,
            port=settings.mysql_port,
            user=settings.mysql_user,
            password=settings.mysql_password,
            db=settings.mysql_database,
            autocommit=True,
            minsize=settings.mysql_pool_min_size,
            maxsize=settings.mysql_pool_max_size,
        )
    return _pool


async def get_db(settings: Optional[Settings] = None) -> AsyncGenerator[aiomysql.DictCursor, None]:
    pool = await get_db_pool(settings)
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            yield cur


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None
