from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes as perms
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, Count
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import IsOrganisationMember, IsManagerOrAbove

from .consumers import conversation_group, user_group
from .models import Conversation, ConversationParticipant, Message
from .serializers import ConversationSerializer, ConversationParticipantSerializer, MessageSerializer


def _serialize_message(msg: Message, user=None) -> dict:
    """Serialize a message, optionally with viewer context for is_editable."""
    import json as _json
    from types import SimpleNamespace

    from rest_framework.utils.encoders import JSONEncoder

    context = {"request": SimpleNamespace(user=user)} if user is not None else {}
    raw = MessageSerializer(msg, context=context).data
    return _json.loads(_json.dumps(raw, cls=JSONEncoder))


def _broadcast_message(msg: Message) -> None:
    """Push a newly-created message to all participants via Channels."""
    _broadcast_message_event(msg, "message_new")


def _broadcast_message_updated(msg: Message) -> None:
    """Push an edited message to all participants via Channels."""
    _broadcast_message_event(msg, "message_updated")


def _broadcast_message_event(msg: Message, event_type: str) -> None:
    layer = get_channel_layer()
    if layer is None:
        return

    participant_ids = list(
        ConversationParticipant.objects.filter(
            conversation_id=msg.conversation_id
        ).values_list("user_id", flat=True)
    )
    users_by_id = {u.id: u for u in User.objects.filter(id__in=participant_ids)}

    # Conversation channel: omit viewer-specific fields (client computes edit eligibility).
    conversation_payload = _serialize_message(msg)
    async_to_sync(layer.group_send)(
        conversation_group(msg.conversation_id),
        {"type": event_type, "message": conversation_payload},
    )

    # Personal channels: include per-recipient is_editable.
    for uid in participant_ids:
        user = users_by_id.get(uid)
        payload = _serialize_message(msg, user=user) if user else conversation_payload
        async_to_sync(layer.group_send)(
            user_group(uid),
            {"type": event_type, "message": payload},
        )


def _broadcast_conversation(conv: Conversation, event: str = "conversation_new") -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    import json as _json
    from rest_framework.utils.encoders import JSONEncoder

    raw = ConversationSerializer(conv, context={"request": None}).data
    payload = _json.loads(_json.dumps(raw, cls=JSONEncoder))
    participant_ids = ConversationParticipant.objects.filter(
        conversation_id=conv.id
    ).values_list("user_id", flat=True)
    for uid in participant_ids:
        async_to_sync(layer.group_send)(
            user_group(uid),
            {"type": event, "conversation": payload},
        )


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['conversation_type', 'task']

    def get_queryset(self):
        """Conversations where the user (or any predecessor) is a participant."""
        user = self.request.user
        visible_user_ids = [user.id] + user.predecessor_user_ids()
        return Conversation.objects.filter(
            organisation=user.organisation,
            participants__user_id__in=visible_user_ids,
        ).distinct().order_by('-updated_at')

    def perform_create(self, serializer):
        conv = serializer.save(
            created_by=self.request.user,
            organisation=self.request.user.organisation,
        )
        # Auto-add creator as participant
        ConversationParticipant.objects.get_or_create(conversation=conv, user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Conversations cannot be deleted."""
        return Response({"error": "Conversations cannot be deleted."}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """Get total unread message count for the current user."""
        user = request.user
        count = Message.objects.filter(
            organisation=user.organisation,
            conversation__participants__user=user,
            is_read=False,
        ).exclude(sender=user).count()
        return Response({"unread_count": count})

    @action(detail=True, methods=["post"], url_path="add-participant")
    def add_participant(self, request, pk=None):
        """Add a user to the conversation."""
        conv = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id is required"}, status=400)
        from apps.accounts.models import User
        try:
            target = User.objects.get(id=user_id, organisation=request.user.organisation)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        ConversationParticipant.objects.get_or_create(conversation=conv, user=target)
        return Response({"message": f"Added {target.email} to conversation"})


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['conversation', 'sender']
    search_fields = ['content', 'sender__first_name', 'sender__last_name', 'sender__email']
    ordering_fields = ['created_at']
    ordering = ['created_at']

    def get_queryset(self):
        """Messages from conversations the user (or any predecessor) participates in."""
        user = self.request.user
        visible_user_ids = [user.id] + user.predecessor_user_ids()
        qs = Message.objects.filter(
            organisation=user.organisation,
            conversation__participants__user_id__in=visible_user_ids,
        ).select_related('sender', 'conversation')

        # Additional filters via query params
        conversation_id = self.request.query_params.get('conversation')
        if conversation_id:
            qs = qs.filter(conversation_id=conversation_id)

        sender_id = self.request.query_params.get('sender')
        if sender_id:
            qs = qs.filter(sender_id=sender_id)

        # Date range filtering
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        # Task filter
        task_id = self.request.query_params.get('task')
        if task_id:
            qs = qs.filter(conversation__task_id=task_id)

        return qs.distinct()

    def perform_create(self, serializer):
        """Save message with sender and org. Auto-add sender as participant if not already."""
        msg = serializer.save(
            sender=self.request.user,
            organisation=self.request.user.organisation,
        )
        # Ensure sender is a participant
        ConversationParticipant.objects.get_or_create(
            conversation=msg.conversation, user=self.request.user
        )
        _broadcast_message(msg)

    def destroy(self, request, *args, **kwargs):
        """Messages cannot be deleted — permanent institutional records."""
        return Response(
            {"error": "Messages are permanent institutional records and cannot be deleted."},
            status=status.HTTP_403_FORBIDDEN
        )

    def update(self, request, *args, **kwargs):
        """Full updates are not supported — use PATCH to edit content within 2 hours."""
        return Response(
            {"error": "Use PATCH to edit message content within the 2-hour edit window."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        msg = self.get_object()
        if not msg.is_editable_by(request.user):
            return Response(
                {"error": "Messages can only be edited by the sender within 2 hours of sending."},
                status=status.HTTP_403_FORBIDDEN,
            )

        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"error": "content is required"}, status=400)

        if len(set(request.data.keys()) - {"content"}) > 0:
            return Response({"error": "Only content may be edited."}, status=400)

        msg.content = content
        msg.edited_at = timezone.now()
        msg.save(update_fields=["content", "updated_at", "edited_at"])
        _broadcast_message_updated(msg)
        serializer = self.get_serializer(msg)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        """Mark a message as read."""
        msg = self.get_object()
        Message.objects.filter(pk=msg.pk).update(is_read=True)
        return Response({"status": "read"})

    @action(detail=False, methods=["post"], url_path="mark-conversation-read")
    def mark_conversation_read(self, request):
        """Mark all messages in a conversation as read for the current user."""
        conv_id = request.data.get("conversation_id")
        if not conv_id:
            return Response({"error": "conversation_id required"}, status=400)
        Message.objects.filter(
            conversation_id=conv_id,
            organisation=request.user.organisation,
        ).exclude(sender=request.user).update(is_read=True)
        return Response({"status": "all read"})


class ConversationParticipantViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationParticipantSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        user = self.request.user
        visible_user_ids = [user.id] + user.predecessor_user_ids()
        return ConversationParticipant.objects.filter(
            conversation__organisation=user.organisation,
            conversation__participants__user_id__in=visible_user_ids,
        ).distinct()


@api_view(["POST"])
@perms([IsAuthenticated])
def create_group_broadcast(request):
    """Manager broadcasts a message to all staff in their team.
    Expects: { "content": "message text" }
    """
    user = request.user
    if user.role not in ['MANAGER', 'DEPT_HEAD', 'EXECUTIVE', 'ADMIN']:
        return Response({"error": "Only managers can broadcast"}, status=403)

    content = request.data.get("content", "").strip()
    if not content:
        return Response({"error": "content is required"}, status=400)

    from apps.accounts.models import User
    # Get team members (users who report to this manager or are in same department)
    team = User.objects.filter(
        organisation=user.organisation,
        department=user.department,
        employment_status="ACTIVE"
    ).exclude(id=user.id)

    if not team.exists():
        return Response({"error": "No team members found"}, status=400)

    # Create group conversation
    conv = Conversation.objects.create(
        conversation_type="GROUP",
        organisation=user.organisation,
        created_by=user,
    )
    ConversationParticipant.objects.create(conversation=conv, user=user)
    for member in team:
        ConversationParticipant.objects.create(conversation=conv, user=member)

    # Send the broadcast message
    msg = Message.objects.create(
        conversation=conv,
        sender=user,
        content=content,
        organisation=user.organisation,
    )
    _broadcast_conversation(conv, event="conversation_new")
    _broadcast_message(msg)

    return Response({
        "message": f"Broadcast sent to {team.count()} team members",
        "conversation_id": conv.id,
    }, status=201)


@api_view(["POST"])
@perms([IsAuthenticated])
def send_direct_message(request):
    """Send a direct message to another user. Auto-creates conversation if none exists.
    Expects: { "recipient_id": 123, "content": "message text" }
    """
    recipient_id = request.data.get("recipient_id")
    content = request.data.get("content", "").strip()

    if not recipient_id or not content:
        return Response({"error": "recipient_id and content are required"}, status=400)

    from apps.accounts.models import User
    try:
        recipient = User.objects.get(id=recipient_id, organisation=request.user.organisation)
    except User.DoesNotExist:
        return Response({"error": "Recipient not found"}, status=404)

    # Find existing direct conversation between these two users
    conv = Conversation.objects.filter(
        conversation_type="DIRECT",
        organisation=request.user.organisation,
        participants__user=request.user,
    ).filter(
        participants__user=recipient,
    ).first()

    if not conv:
        conv = Conversation.objects.create(
            conversation_type="DIRECT",
            organisation=request.user.organisation,
            created_by=request.user,
        )
        ConversationParticipant.objects.create(conversation=conv, user=request.user)
        ConversationParticipant.objects.create(conversation=conv, user=recipient)

    msg = Message.objects.create(
        conversation=conv,
        sender=request.user,
        content=content,
        organisation=request.user.organisation,
    )
    _broadcast_conversation(conv, event="conversation_new")
    _broadcast_message(msg)

    return Response(MessageSerializer(msg, context={"request": request}).data, status=201)
