from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AIOutputViewSet,
    ChatThreadViewSet,
    ai_chat,
    generate_jd,
    generate_policy_description,
    extract_milestones,
    project_progress_summary,
    draft_project_report,
    coaching_tip,
    task_summary,
    nl_search,
)

router = DefaultRouter()
router.register("ai-outputs", AIOutputViewSet, basename="ai-output")
router.register("chat-threads", ChatThreadViewSet, basename="chat-thread")

urlpatterns = [
    path("chat/", ai_chat, name="ai-chat"),
    path("generate-jd/", generate_jd, name="generate-jd"),
    path(
        "generate-policy-description/",
        generate_policy_description,
        name="generate-policy-description",
    ),
    path("extract-milestones/", extract_milestones, name="ai-extract-milestones"),
    path("project-progress-summary/", project_progress_summary, name="ai-project-progress"),
    path("draft-project-report/", draft_project_report, name="ai-draft-report"),
    path("coaching-tip/", coaching_tip, name="ai-coaching-tip"),
    path("task-summary/", task_summary, name="ai-task-summary"),
    path("nl-search/", nl_search, name="ai-nl-search"),
    path("", include(router.urls)),
]
