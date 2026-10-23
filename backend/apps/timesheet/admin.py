from django.contrib import admin

from .models import Timesheet


@admin.register(Timesheet)
class TimesheetAdmin(admin.ModelAdmin):
    list_display = (
        "user", "organisation", "period_start", "period_end",
        "status", "source", "total_days_worked", "total_hours",
    )
    list_filter = ("status", "source", "organisation")
    search_fields = ("user__first_name", "user__last_name", "user__email")
    date_hierarchy = "period_start"
