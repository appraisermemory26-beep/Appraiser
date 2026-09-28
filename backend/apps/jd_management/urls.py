from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import JobDescriptionViewSet, JDVersionViewSet, my_jd

router = DefaultRouter()
router.register("job-descriptions", JobDescriptionViewSet, basename="job-description")
router.register("jd-versions", JDVersionViewSet, basename="jd-version")

urlpatterns = [
    path("my-jd/", my_jd, name="my-jd"),
    path("", include(router.urls)),
]
