from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import BillingProfile


@admin.register(BillingProfile)
class BillingProfileAdmin(ModelAdmin):
    list_display = ["organisation", "contact_name", "billing_email", "plan_tier", "billing_cycle", "payment_status"]
    search_fields = ["organisation__name", "contact_name", "billing_email"]
    list_filter = ["plan_tier", "billing_cycle", "payment_status"]
