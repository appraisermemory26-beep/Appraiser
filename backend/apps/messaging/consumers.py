"""Channels consumer for real-time messaging.

Each authenticated user joins:
- a personal group `user_<id>` (used for unread-count + new-conversation pings)
- a group per conversation they participate in (`conversation_<id>`)

Messages are pushed onto channel-layer groups by the REST views when a new
record is created (see `views.py`). The consumer relays those events to the
client.
"""
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Conversation, ConversationParticipant


def user_group(user_id: int) -> str:
    return f"user_{user_id}"


def conversation_group(conversation_id: int) -> str:
    return f"conversation_{conversation_id}"


class MessagingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        self.user = user
        self._joined_groups = []

        await self.channel_layer.group_add(user_group(user.id), self.channel_name)
        self._joined_groups.append(user_group(user.id))

        conversation_ids = await self._user_conversation_ids(user.id)
        for cid in conversation_ids:
            group = conversation_group(cid)
            await self.channel_layer.group_add(group, self.channel_name)
            self._joined_groups.append(group)

        await self.accept()
        await self.send_json({"type": "connected", "user_id": user.id})

    async def disconnect(self, code):
        for group in getattr(self, "_joined_groups", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        if action == "subscribe":
            cid = content.get("conversation_id")
            if cid and await self._is_participant(self.user.id, cid):
                group = conversation_group(int(cid))
                if group not in self._joined_groups:
                    await self.channel_layer.group_add(group, self.channel_name)
                    self._joined_groups.append(group)
                await self.send_json({"type": "subscribed", "conversation_id": cid})
        elif action == "ping":
            await self.send_json({"type": "pong"})

    async def message_new(self, event):
        await self.send_json({"type": "message_new", "message": event["message"]})

    async def message_updated(self, event):
        await self.send_json({"type": "message_updated", "message": event["message"]})

    async def conversation_new(self, event):
        await self.send_json(
            {"type": "conversation_new", "conversation": event["conversation"]}
        )

    async def conversation_updated(self, event):
        await self.send_json(
            {"type": "conversation_updated", "conversation": event["conversation"]}
        )

    async def unread_count(self, event):
        await self.send_json({"type": "unread_count", "unread_count": event["unread_count"]})

    @database_sync_to_async
    def _user_conversation_ids(self, user_id: int):
        return list(
            ConversationParticipant.objects.filter(user_id=user_id).values_list(
                "conversation_id", flat=True
            )
        )

    @database_sync_to_async
    def _is_participant(self, user_id: int, conversation_id: int) -> bool:
        return ConversationParticipant.objects.filter(
            user_id=user_id, conversation_id=conversation_id
        ).exists()
