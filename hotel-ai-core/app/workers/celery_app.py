import ssl

from celery import Celery

from app.config import settings

celery = Celery(
    "hotel_ai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.ingest"],
)

# Upstash (rediss://) requires explicit SSL config for Celery
_redis_ssl = settings.REDIS_URL.startswith("rediss://")

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE} if _redis_ssl else None,
    redis_backend_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE} if _redis_ssl else None,
)
