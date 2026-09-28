from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import BillingProfileViewSet

router = DefaultRouter()
router.register("billing-profiles", BillingProfileViewSet, basename="billing-profile")

urlpatterns = [
    path("", include(router.urls)),
]
