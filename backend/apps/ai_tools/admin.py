from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import AIOutput


@admin.register(AIOutput)
class AIOutputAdmin(ModelAdmin):
    list_display = ["output_type", "user", "organisation", "is_draft", "entity_type", "created_at"]
    search_fields = ["output_content", "entity_type"]
    list_filter = ["output_type", "is_draft", "organisation"]
