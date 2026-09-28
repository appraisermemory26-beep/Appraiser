from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Organisation, Department, Unit, Division, ReportingLine


@admin.register(Organisation)
class OrganisationAdmin(ModelAdmin):
    list_display = ["name", "slug", "email", "is_setup_complete", "created_at"]
    search_fields = ["name", "slug", "email"]
    list_filter = ["is_setup_complete"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Department)
class DepartmentAdmin(ModelAdmin):
    list_display = ["name", "organisation", "parent", "head"]
    search_fields = ["name"]
    list_filter = ["organisation"]


@admin.register(Unit)
class UnitAdmin(ModelAdmin):
    list_display = ["name", "department"]
    search_fields = ["name"]
    list_filter = ["department__organisation"]


@admin.register(Division)
class DivisionAdmin(ModelAdmin):
    list_display = ["name", "unit"]
    search_fields = ["name"]


@admin.register(ReportingLine)
class ReportingLineAdmin(ModelAdmin):
    list_display = ["subordinate", "supervisor", "organisation"]
    list_filter = ["organisation"]
