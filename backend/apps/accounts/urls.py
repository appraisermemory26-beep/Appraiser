from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import UserViewSet, signup, password_reset_request, password_reset_confirm

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("signup/", signup, name="signup"),
    path("password-reset/", password_reset_request, name="password-reset"),
    path("password-reset/confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("", include(router.urls)),
]
