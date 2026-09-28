from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TaskViewSet, TaskOutputViewSet, TaskReviewViewSet, TaskStatusChangeViewSet

router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("task-outputs", TaskOutputViewSet, basename="task-output")
router.register("task-reviews", TaskReviewViewSet, basename="task-review")
router.register("task-status-changes", TaskStatusChangeViewSet, basename="task-status-change")

urlpatterns = [
    path("", include(router.urls)),
]
