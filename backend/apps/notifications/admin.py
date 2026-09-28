from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    list_display = ["title", "user", "notification_type", "is_read", "organisation", "created_at"]
    search_fields = ["title", "message"]
    list_filter = ["notification_type", "is_read", "organisation"]
