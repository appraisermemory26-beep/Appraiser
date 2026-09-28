"""Custom JWT authentication that revokes access for non-Active users.

SOW 3.13: a user with a non-Active employment_status must receive a 401 on
their next request, regardless of an unexpired access token.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class ActiveJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active or getattr(user, "employment_status", "ACTIVE") != "ACTIVE":
            raise AuthenticationFailed(
                "User is no longer active.", code="user_inactive"
            )
        return user
