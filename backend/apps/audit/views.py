from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember, IsDeptHeadOrAbove

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsDeptHeadOrAbove]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['event_type', 'event_category', 'user', 'entity_type']
    search_fields = ['description', 'event_type', 'entity_type']
    ordering_fields = ['timestamp', 'event_type', 'event_category']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.user
        qs = AuditLog.objects.filter(organisation=user.organisation)
        # Dept heads only see logs related to their department, plus any
        # predecessor's actions for institutional memory.
        if user.role == 'DEPT_HEAD' and user.department:
            from django.db.models import Q
            predecessor_ids = user.predecessor_user_ids()
            qs = qs.filter(
                Q(user__department=user.department) | Q(user_id__in=predecessor_ids)
            )

        # Date range filtering
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)

        return qs

    def create(self, request, *args, **kwargs):
        return Response({"error": "Audit logs are immutable."}, status=403)

    def update(self, request, *args, **kwargs):
        return Response({"error": "Audit logs are immutable."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Audit logs are immutable."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Audit logs are immutable."}, status=403)
