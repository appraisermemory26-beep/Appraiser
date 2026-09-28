from rest_framework import serializers

from .models import Conversation, ConversationParticipant, Message


class ConversationParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversationParticipant
        fields = ["id", "conversation", "user", "created_at"]
        read_only_fields = ["id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    is_editable = serializers.SerializerMethodField()
    edited = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "conversation", "sender", "sender_name", "content", "is_read",
            "organisation", "created_at", "updated_at", "is_editable", "edited",
        ]
        read_only_fields = [
            "id", "sender", "sender_name", "organisation", "created_at",
            "updated_at", "is_editable", "edited",
        ]

    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}".strip() if obj.sender else ""

    def get_is_editable(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return None
        return obj.is_editable_by(request.user)

    def get_edited(self, obj):
        return obj.edited_at is not None


class ConversationSerializer(serializers.ModelSerializer):
    participants_detail = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "conversation_type", "task", "organisation", "created_by",
                  "participants_detail", "last_message", "unread_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "organisation", "created_at", "updated_at"]

    def get_participants_detail(self, obj):
        return [{"id": p.user.id, "name": f"{p.user.first_name} {p.user.last_name}".strip(), "email": p.user.email}
                for p in obj.participants.select_related('user').all()]

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return {"content": msg.content[:100], "sender_name": f"{msg.sender.first_name} {msg.sender.last_name}".strip(), "created_at": msg.created_at}
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0
