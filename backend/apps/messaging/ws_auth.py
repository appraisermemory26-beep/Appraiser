"""WebSocket JWT authentication middleware for Django Channels.

Authenticates WS connections from a `?token=<jwt>` query parameter (browsers
cannot set Authorization headers on WebSocket handshakes). Falls back to the
`Sec-WebSocket-Protocol` subprotocol header if the token is supplied that way.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken


@database_sync_to_async
def _get_user(validated_token):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user_id = validated_token.get("user_id")
    if not user_id:
        return AnonymousUser()
    try:
        user = User.objects.select_related("organisation").get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()
    if not user.is_active or user.employment_status != "ACTIVE":
        return AnonymousUser()
    return user


def _extract_token(scope):
    qs = parse_qs((scope.get("query_string") or b"").decode())
    token = qs.get("token", [None])[0]
    if token:
        return token
    for name, value in scope.get("headers", []):
        if name == b"sec-websocket-protocol":
            parts = [p.strip() for p in value.decode().split(",")]
            for p in parts:
                if p.startswith("bearer."):
                    return p[len("bearer.") :]
    return None


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        token = _extract_token(scope)
        if token:
            try:
                validated = UntypedToken(token)
                scope["user"] = await _get_user(validated)
            except (InvalidToken, TokenError):
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()
        return await super().__call__(scope, receive, send)
