from django.contrib import admin

from .models import PayrollConfiguration, StatutoryScheme, TaxBracket


@admin.register(PayrollConfiguration)
class PayrollConfigurationAdmin(admin.ModelAdmin):
    list_display = ("organisation", "currency", "pay_frequency")
    search_fields = ("organisation__name",)


@admin.register(StatutoryScheme)
class StatutorySchemeAdmin(admin.ModelAdmin):
    list_display = ("name", "organisation", "employee_rate", "employer_rate", "effective_date", "is_active")
    list_filter = ("organisation", "is_active")
    search_fields = ("name", "organisation__name")


@admin.register(TaxBracket)
class TaxBracketAdmin(admin.ModelAdmin):
    list_display = ("organisation", "lower_bound", "upper_bound", "rate", "effective_date", "is_active")
    list_filter = ("organisation", "is_active")
