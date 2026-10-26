from django.contrib import admin

from .models import PayrollConfiguration, StatutoryScheme, TaxBracket


@admin.register(PayrollConfiguration)
class PayrollConfigurationAdmin(admin.ModelAdmin):
    list_display = ("organisation", "currency", "pay_frequency")
    list_filter = ("currency", "pay_frequency", "organisation")


@admin.register(StatutoryScheme)
class StatutorySchemeAdmin(admin.ModelAdmin):
    list_display = ("name", "payroll_configuration", "employee_rate", "employer_rate", "effective_date", "is_active")
    list_filter = ("is_active", "payroll_configuration")
    search_fields = ("name",)


@admin.register(TaxBracket)
class TaxBracketAdmin(admin.ModelAdmin):
    list_display = ("payroll_configuration", "lower_bound", "upper_bound", "rate", "effective_date", "is_active")
    list_filter = ("is_active", "payroll_configuration")