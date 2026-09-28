from django.urls import include, path

urlpatterns = [
    path("core/", include("apps.core.urls")),
    path("accounts/", include("apps.accounts.urls")),
    path("organisations/", include("apps.organisations.urls")),
    path("tasks/", include("apps.tasks.urls")),
    path("attention/", include("apps.attention.urls")),
    path("messaging/", include("apps.messaging.urls")),
    path("policies/", include("apps.policies.urls")),
    path("projects/", include("apps.projects.urls")),
    path("jd-management/", include("apps.jd_management.urls")),
    path("audit/", include("apps.audit.urls")),
    path("billing/", include("apps.billing.urls")),
    path("ai-tools/", include("apps.ai_tools.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("document-retention/", include("apps.document_retention.urls")),
]
