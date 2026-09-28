import os

from django.conf import settings
from django.core.mail import send_mail


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def send_password_reset_email(*, user, uid: str, token: str) -> None:
    reset_link = f"{_frontend_url()}/reset-password?uid={uid}&token={token}"
    name = user.first_name.strip() if user.first_name else user.email

    send_mail(
        subject="Reset your Appraiser password",
        message=(
            f"Hello {name},\n\n"
            "We received a request to reset your password for Appraiser.\n\n"
            f"Use this link to set a new password:\n{reset_link}\n\n"
            "If you did not request this, you can safely ignore this email.\n\n"
            "— The Appraiser Team"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
