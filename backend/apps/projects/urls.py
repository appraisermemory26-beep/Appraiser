from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProjectViewSet, ProjectDocumentViewSet,
    ProjectMilestoneViewSet, ProjectReportViewSet,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("project-documents", ProjectDocumentViewSet, basename="project-document")
router.register("project-milestones", ProjectMilestoneViewSet, basename="project-milestone")
router.register("project-reports", ProjectReportViewSet, basename="project-report")

urlpatterns = [
    path("", include(router.urls)),
]
