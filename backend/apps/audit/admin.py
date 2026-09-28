from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(ModelAdmin):
    list_display = ["event_type", "event_category", "user", "organisation", "entity_type", "timestamp"]
    search_fields = ["event_type", "description", "entity_type"]
    list_filter = ["event_category", "organisation"]
    readonly_fields = [
        "event_type", "event_category", "user", "organisation",
        "description", "entity_type", "entity_id", "metadata", "timestamp",
    ]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
