from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PolicyCategoryViewSet, PolicyViewSet,
    PolicyVersionViewSet, PolicyAcknowledgmentViewSet,
)

router = DefaultRouter()
router.register("policy-categories", PolicyCategoryViewSet, basename="policy-category")
router.register("policies", PolicyViewSet, basename="policy")
router.register("policy-versions", PolicyVersionViewSet, basename="policy-version")
router.register("policy-acknowledgments", PolicyAcknowledgmentViewSet, basename="policy-acknowledgment")

urlpatterns = [
    path("", include(router.urls)),
]
