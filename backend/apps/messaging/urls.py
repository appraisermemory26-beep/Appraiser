from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ConversationViewSet, ConversationParticipantViewSet, MessageViewSet,
    create_group_broadcast, send_direct_message,
)

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("conversation-participants", ConversationParticipantViewSet, basename="conversation-participant")
router.register("messages", MessageViewSet, basename="message")

urlpatterns = [
    path("broadcast/", create_group_broadcast, name="broadcast"),
    path("direct/", send_direct_message, name="direct-message"),
    path("", include(router.urls)),
]
