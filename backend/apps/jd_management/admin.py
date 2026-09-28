from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import JobDescription, JDVersion


@admin.register(JobDescription)
class JobDescriptionAdmin(ModelAdmin):
    list_display = ["title", "role_title", "department", "organisation", "current_version", "linked_user"]
    search_fields = ["title", "role_title"]
    list_filter = ["organisation", "department"]


@admin.register(JDVersion)
class JDVersionAdmin(ModelAdmin):
    list_display = ["job_description", "version_number", "uploaded_by", "is_ai_generated", "created_at"]
    list_filter = ["is_ai_generated", "job_description__organisation"]
