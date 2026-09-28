from rest_framework import serializers

from .models import AIOutput, ChatThread, ChatMessage


class AIOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIOutput
        fields = [
            "id", "output_type", "user", "organisation", "input_data",
            "output_content", "is_draft", "entity_type", "entity_id",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = fields


class ChatThreadSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    last_message_preview = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = [
            "id", "title", "messages", "last_message_preview",
            "message_count", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_last_message_preview(self, obj):
        last = obj.messages.order_by("-created_at").first()
        return last.content[:120] if last else ""

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatThreadListSerializer(serializers.ModelSerializer):
    """Lighter list serializer (no embedded messages array)."""

    last_message_preview = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = [
            "id", "title", "last_message_preview", "message_count",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_last_message_preview(self, obj):
        last = obj.messages.order_by("-created_at").first()
        return last.content[:120] if last else ""

    def get_message_count(self, obj):
        return obj.messages.count()
