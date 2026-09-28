from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Project, ProjectDocument, ProjectMilestone, ProjectReport


@admin.register(Project)
class ProjectAdmin(ModelAdmin):
    list_display = ["name", "status", "owner", "department", "start_year", "end_year", "organisation"]
    search_fields = ["name"]
    list_filter = ["status", "organisation"]


@admin.register(ProjectDocument)
class ProjectDocumentAdmin(ModelAdmin):
    list_display = ["project", "category", "version", "uploaded_by", "created_at"]
    list_filter = ["category", "project__organisation"]


@admin.register(ProjectMilestone)
class ProjectMilestoneAdmin(ModelAdmin):
    list_display = ["project", "title", "deadline", "is_completed"]
    list_filter = ["is_completed", "project__organisation"]


@admin.register(ProjectReport)
class ProjectReportAdmin(ModelAdmin):
    list_display = ["project", "title", "period_start", "period_end", "is_draft", "is_ai_generated"]
    list_filter = ["is_draft", "is_ai_generated", "project__organisation"]
