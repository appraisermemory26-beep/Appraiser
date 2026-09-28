from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Task, TaskOutput, TaskReview, TaskStatusChange


@admin.register(Task)
class TaskAdmin(ModelAdmin):
    list_display = ["task_id", "title", "status", "priority", "assigned_to", "deadline", "organisation"]
    search_fields = ["task_id", "title", "description"]
    list_filter = ["status", "priority", "deadline_type", "organisation"]
    readonly_fields = ["task_id"]


@admin.register(TaskOutput)
class TaskOutputAdmin(ModelAdmin):
    list_display = ["task", "submitted_by", "created_at"]
    list_filter = ["task__organisation"]


@admin.register(TaskReview)
class TaskReviewAdmin(ModelAdmin):
    list_display = ["task", "reviewer", "action", "created_at"]
    list_filter = ["action"]


@admin.register(TaskStatusChange)
class TaskStatusChangeAdmin(ModelAdmin):
    list_display = ["task", "from_status", "to_status", "changed_by", "timestamp"]
    list_filter = ["from_status", "to_status"]
