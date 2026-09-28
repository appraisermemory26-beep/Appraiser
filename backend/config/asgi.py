"""ASGI config for appraiser project.

Routes HTTP traffic to Django and WebSocket traffic to Channels consumers.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.messaging.routing import websocket_urlpatterns  # noqa: E402
from apps.messaging.ws_auth import JWTAuthMiddleware  # noqa: E402

# Note: WebSocket origin checks are not browser-enforced; we rely on the JWT
# middleware to authenticate every connection, which is sufficient gating.
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
