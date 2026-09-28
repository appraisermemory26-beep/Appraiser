from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TimeLogViewSet, ActivityLogViewSet, BreakLogViewSet,
    my_attention_summary, my_time_summary, team_time_summary,
)

router = DefaultRouter()
router.register("time-logs", TimeLogViewSet, basename="time-log")
router.register("activity-logs", ActivityLogViewSet, basename="activity-log")
router.register("break-logs", BreakLogViewSet, basename="break-log")

urlpatterns = [
    path("my-summary/", my_attention_summary, name="my-attention-summary"),
    path("my-time-summary/", my_time_summary, name="my-time-summary"),
    path("team-time-summary/", team_time_summary, name="team-time-summary"),
    path("", include(router.urls)),
]
