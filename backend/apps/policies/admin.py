from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import PolicyCategory, Policy, PolicyVersion, PolicyAcknowledgment


@admin.register(PolicyCategory)
class PolicyCategoryAdmin(ModelAdmin):
    list_display = ["name", "organisation"]
    search_fields = ["name"]
    list_filter = ["organisation"]


@admin.register(Policy)
class PolicyAdmin(ModelAdmin):
    list_display = ["title", "category", "organisation", "current_version", "created_at"]
    search_fields = ["title", "description"]
    list_filter = ["category", "organisation"]


@admin.register(PolicyVersion)
class PolicyVersionAdmin(ModelAdmin):
    list_display = ["policy", "version_number", "uploaded_by", "created_at"]
    list_filter = ["policy__organisation"]


@admin.register(PolicyAcknowledgment)
class PolicyAcknowledgmentAdmin(ModelAdmin):
    list_display = ["policy_version", "user", "acknowledged_at"]
    list_filter = ["policy_version__policy__organisation"]
