from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    OrganisationViewSet, DepartmentViewSet, UnitViewSet, DivisionViewSet,
    ReportingLineViewSet, InstitutionViewSet, my_organisation,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("units", UnitViewSet, basename="unit")
router.register("divisions", DivisionViewSet, basename="division")
router.register("reporting-lines", ReportingLineViewSet, basename="reporting-line")
router.register("institutions", InstitutionViewSet, basename="institution")
router.register("", OrganisationViewSet, basename="organisation")

urlpatterns = [
    path("my-org/", my_organisation, name="my-organisation"),
    path("", include(router.urls)),
]