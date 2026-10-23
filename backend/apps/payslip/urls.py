from rest_framework.routers import DefaultRouter

from .views import PayslipViewSet

router = DefaultRouter()
router.register(r"", PayslipViewSet, basename="payslip")

urlpatterns = router.urls