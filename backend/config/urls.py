from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenVerifyView
from django.views.generic import RedirectView

from apps.accounts.views import (
    AuditedTokenObtainPairView,
    AuditedTokenBlacklistView,
    ActiveTokenRefreshView,
)


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", RedirectView.as_view(url="/admin/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/v1/auth/token/", AuditedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", ActiveTokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/v1/auth/token/blacklist/", AuditedTokenBlacklistView.as_view(), name="token-blacklist"),
    path("api/v1/", include("apps.urls")),
]

if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += [
        path("__debug__/", include("debug_toolbar.urls")),
    ]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
