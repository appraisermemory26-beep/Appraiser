"""Base settings shared across all environments."""
import os
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR.parent, ".env"))

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost"])

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "daphne",
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
]

LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.organisations",
    "apps.tasks",
    "apps.attention",
    "apps.messaging",
    "apps.policies",
    "apps.projects",
    "apps.jd_management",
    "apps.audit",
    "apps.billing",
    "apps.ai_tools",
    "apps.notifications",
    "apps.document_retention",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="appraiser"),
        "USER": env("POSTGRES_USER", default="appraiser"),
        "PASSWORD": env("POSTGRES_PASSWORD", default=""),
        "HOST": env("POSTGRES_HOST", default="postgres"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": env.int("CONN_MAX_AGE", default=60),
    }
}

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://redis:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# File Storage - S3 / S3-compatible (MinIO) if configured, otherwise local.
# Setting AWS_STORAGE_BUCKET_NAME enables S3 storage. To target MinIO (or any
# S3-compatible service), also set AWS_S3_ENDPOINT_URL and AWS_S3_CUSTOM_DOMAIN.
if env("AWS_STORAGE_BUCKET_NAME", default=""):
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}

    # S3-compatible endpoints (MinIO, R2, Wasabi, etc.)
    _endpoint = env("AWS_S3_ENDPOINT_URL", default="")
    if _endpoint:
        AWS_S3_ENDPOINT_URL = _endpoint
        # MinIO works best with path-style addressing (bucket in URL path).
        AWS_S3_ADDRESSING_STYLE = env("AWS_S3_ADDRESSING_STYLE", default="path")
        AWS_S3_SIGNATURE_VERSION = env("AWS_S3_SIGNATURE_VERSION", default="s3v4")
        AWS_S3_VERIFY = env.bool("AWS_S3_VERIFY", default=True)

    # Public URL hostname returned to clients (for browser-facing download URLs).
    # Use this when the internal endpoint differs from the public hostname,
    # e.g. internal `http://minio:9000` vs public `localhost:9000` or
    # `s3.example.com`.
    _custom_domain = env("AWS_S3_CUSTOM_DOMAIN", default="")
    if _custom_domain:
        AWS_S3_CUSTOM_DOMAIN = _custom_domain
        AWS_S3_URL_PROTOCOL = env("AWS_S3_URL_PROTOCOL", default="https:")

    # Bucket is set to public-read by the MinIO init container, so we don't
    # need signed URLs for browser downloads. Flip back to True if your bucket
    # is private and you want presigned URLs.
    AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH", default=False)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Unfold Admin Configuration
# ---------------------------------------------------------------------------
UNFOLD = {
    "SITE_TITLE": "Appraiser",
    "SITE_HEADER": "Appraiser Admin",
    "SITE_SYMBOL": "assessment",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "THEME": "dark",
    "DASHBOARD_CALLBACK": "apps.core.dashboard.dashboard_callback",
    "STYLES": [
        lambda request: "/static/admin/css/custom.css",
    ],
    "COLORS": {
        "primary": {
            "50": "240 253 244",
            "100": "220 252 231",
            "200": "187 247 208",
            "300": "134 239 172",
            "400": "74 222 128",
            "500": "34 197 94",
            "600": "22 163 74",
            "700": "21 128 61",
            "800": "22 101 52",
            "900": "20 83 45",
            "950": "5 46 22",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Dashboard",
                "separator": True,
                "items": [
                    {
                        "title": "Dashboard",
                        "icon": "dashboard",
                        "link": "/admin/",
                    },
                ],
            },
            {
                "title": "People & Access",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Users",
                        "icon": "people",
                        "link": "/admin/accounts/user/",
                    },
                    {
                        "title": "Groups",
                        "icon": "group_work",
                        "link": "/admin/auth/group/",
                    },
                ],
            },
            {
                "title": "Organisation",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Organisations",
                        "icon": "corporate_fare",
                        "link": "/admin/organisations/organisation/",
                    },
                    {
                        "title": "Departments",
                        "icon": "account_tree",
                        "link": "/admin/organisations/department/",
                    },
                    {
                        "title": "Units",
                        "icon": "workspaces",
                        "link": "/admin/organisations/unit/",
                    },
                    {
                        "title": "Divisions",
                        "icon": "lan",
                        "link": "/admin/organisations/division/",
                    },
                    {
                        "title": "Reporting Lines",
                        "icon": "supervisor_account",
                        "link": "/admin/organisations/reportingline/",
                    },
                ],
            },
            {
                "title": "Projects & Tasks",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Projects",
                        "icon": "folder_open",
                        "link": "/admin/projects/project/",
                    },
                    {
                        "title": "Milestones",
                        "icon": "flag",
                        "link": "/admin/projects/projectmilestone/",
                    },
                    {
                        "title": "Project Documents",
                        "icon": "description",
                        "link": "/admin/projects/projectdocument/",
                    },
                    {
                        "title": "Project Reports",
                        "icon": "summarize",
                        "link": "/admin/projects/projectreport/",
                    },
                    {
                        "title": "Tasks",
                        "icon": "task_alt",
                        "link": "/admin/tasks/task/",
                    },
                    {
                        "title": "Task Outputs",
                        "icon": "output",
                        "link": "/admin/tasks/taskoutput/",
                    },
                    {
                        "title": "Task Reviews",
                        "icon": "rate_review",
                        "link": "/admin/tasks/taskreview/",
                    },
                    {
                        "title": "Status Changes",
                        "icon": "swap_horiz",
                        "link": "/admin/tasks/taskstatuschange/",
                    },
                ],
            },
            {
                "title": "HR & Policies",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Job Descriptions",
                        "icon": "work",
                        "link": "/admin/jd_management/jobdescription/",
                    },
                    {
                        "title": "JD Versions",
                        "icon": "history",
                        "link": "/admin/jd_management/jdversion/",
                    },
                    {
                        "title": "Policy Categories",
                        "icon": "category",
                        "link": "/admin/policies/policycategory/",
                    },
                    {
                        "title": "Policies",
                        "icon": "policy",
                        "link": "/admin/policies/policy/",
                    },
                    {
                        "title": "Policy Versions",
                        "icon": "difference",
                        "link": "/admin/policies/policyversion/",
                    },
                    {
                        "title": "Acknowledgments",
                        "icon": "verified",
                        "link": "/admin/policies/policyacknowledgment/",
                    },
                ],
            },
            {
                "title": "Time & Activity",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Time Logs",
                        "icon": "schedule",
                        "link": "/admin/attention/timelog/",
                    },
                    {
                        "title": "Activity Logs",
                        "icon": "trending_up",
                        "link": "/admin/attention/activitylog/",
                    },
                    {
                        "title": "Break Logs",
                        "icon": "free_breakfast",
                        "link": "/admin/attention/breaklog/",
                    },
                ],
            },
            {
                "title": "Communication",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Conversations",
                        "icon": "forum",
                        "link": "/admin/messaging/conversation/",
                    },
                    {
                        "title": "Participants",
                        "icon": "group_add",
                        "link": "/admin/messaging/conversationparticipant/",
                    },
                    {
                        "title": "Messages",
                        "icon": "chat",
                        "link": "/admin/messaging/message/",
                    },
                    {
                        "title": "Notifications",
                        "icon": "notifications",
                        "link": "/admin/notifications/notification/",
                    },
                ],
            },
            {
                "title": "AI & Intelligence",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "AI Outputs",
                        "icon": "smart_toy",
                        "link": "/admin/ai_tools/aioutput/",
                    },
                ],
            },
            {
                "title": "System",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Audit Logs",
                        "icon": "shield",
                        "link": "/admin/audit/auditlog/",
                    },
                    {
                        "title": "Deletion Requests",
                        "icon": "delete_sweep",
                        "link": "/admin/document_retention/deletionrequest/",
                    },
                    {
                        "title": "Billing",
                        "icon": "payments",
                        "link": "/admin/billing/billingprofile/",
                    },
                ],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000"],
)
CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3000"],
)

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.ActiveJWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("REDIS_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://redis:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "tasks.send_deadline_reminders": {
        "task": "tasks.send_deadline_reminders",
        "schedule": 60 * 60,  # hourly
    },
    "tasks.send_stale_task_alerts": {
        "task": "tasks.send_stale_task_alerts",
        "schedule": 60 * 60 * 4,  # every 4 hours
    },
    "retention.cleanup_expired_documents": {
        "task": "retention.cleanup_expired_documents",
        "schedule": 60 * 60 * 24,  # daily
    },
}

# ---------------------------------------------------------------------------
# Custom User Model
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

# ---------------------------------------------------------------------------
# Simple JWT
# ---------------------------------------------------------------------------
from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# Channels
# ---------------------------------------------------------------------------
ASGI_APPLICATION = "config.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://redis:6379/0")],
        },
    },
}
