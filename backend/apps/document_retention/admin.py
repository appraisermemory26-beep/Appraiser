from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import DeletionRequest


@admin.register(DeletionRequest)
class DeletionRequestAdmin(ModelAdmin):
    list_display = ["document_type", "document_id", "requested_by", "status", "approved_by", "organisation", "created_at"]
    search_fields = ["document_type", "reason"]
    list_filter = ["status", "organisation"]
