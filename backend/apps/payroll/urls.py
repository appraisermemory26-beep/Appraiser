from rest_framework.routers import DefaultRouter

from .views import (
    PayrollConfigurationViewSet,
    StatutorySchemeViewSet,
    TaxBracketViewSet,
)

router = DefaultRouter()
router.register(r"configuration", PayrollConfigurationViewSet, basename="payroll-configuration")
router.register(r"statutory-schemes", StatutorySchemeViewSet, basename="statutory-scheme")
router.register(r"tax-brackets", TaxBracketViewSet, basename="tax-bracket")

urlpatterns = router.urls
