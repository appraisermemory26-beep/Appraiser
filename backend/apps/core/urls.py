from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("kpi-targets", views.KPITargetViewSet, basename="kpi-target")
router.register(
    "performance-objectives",
    views.InstitutionalPerformanceObjectiveViewSet,
    basename="performance-objective",
)

urlpatterns = [
    path("status/", views.status, name="core-status"),
    path("dashboard/", views.dashboard_stats, name="dashboard-stats"),
    path("accountability/", views.accountability_dashboard, name="accountability-dashboard"),
    path("pmcs/", views.accountability_dashboard, name="pmcs-dashboard"),
    path("", include(router.urls)),
]
