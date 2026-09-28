from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import TimeLog, ActivityLog, BreakLog


@admin.register(TimeLog)
class TimeLogAdmin(ModelAdmin):
    list_display = ["user", "task", "started_at", "ended_at", "organisation"]
    search_fields = ["user__email", "task__task_id"]
    list_filter = ["organisation"]


@admin.register(ActivityLog)
class ActivityLogAdmin(ModelAdmin):
    list_display = ["user", "activity_type", "started_at", "ended_at", "organisation"]
    search_fields = ["user__email"]
    list_filter = ["activity_type", "organisation"]


@admin.register(BreakLog)
class BreakLogAdmin(ModelAdmin):
    list_display = ["user", "break_type", "started_at", "ended_at", "organisation"]
    search_fields = ["user__email"]
    list_filter = ["break_type", "organisation"]
