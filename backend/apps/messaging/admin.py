from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Conversation, ConversationParticipant, Message


@admin.register(Conversation)
class ConversationAdmin(ModelAdmin):
    list_display = ["id", "conversation_type", "task", "created_by", "organisation", "created_at"]
    list_filter = ["conversation_type", "organisation"]


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(ModelAdmin):
    list_display = ["conversation", "user"]
    list_filter = ["conversation__organisation"]


@admin.register(Message)
class MessageAdmin(ModelAdmin):
    list_display = ["conversation", "sender", "is_read", "created_at"]
    search_fields = ["content"]
    list_filter = ["is_read", "organisation"]
