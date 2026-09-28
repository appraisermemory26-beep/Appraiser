from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    OrganisationViewSet, DepartmentViewSet, UnitViewSet,
    DivisionViewSet, ReportingLineViewSet, my_organisation,
)

router = DefaultRouter()
router.register("organisations", OrganisationViewSet, basename="organisation")
router.register("departments", DepartmentViewSet, basename="department")
router.register("units", UnitViewSet, basename="unit")
router.register("divisions", DivisionViewSet, basename="division")
router.register("reporting-lines", ReportingLineViewSet, basename="reporting-line")

urlpatterns = [
    path("my-org/", my_organisation, name="my-org"),
    path("", include(router.urls)),
]
