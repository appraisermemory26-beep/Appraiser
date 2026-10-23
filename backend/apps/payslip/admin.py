from django.contrib import admin

from .models import Payslip


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = (
        "user", "organisation", "period_start", "period_end",
        "currency", "gross_pay", "net_pay", "generated_at",
    )
    list_filter = ("organisation",)
    search_fields = ("user__first_name", "user__last_name", "user__email")
    date_hierarchy = "period_start"