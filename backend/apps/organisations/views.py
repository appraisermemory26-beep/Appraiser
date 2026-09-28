import json

from django.http import FileResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember, IsAdmin, IsManagerOrAbove
from apps.ai_tools.services import chat_completion
from apps.audit.models import AuditLog

from .models import Organisation, Department, Unit, Division, ReportingLine
from .serializers import (
    OrganisationSerializer, DepartmentSerializer, UnitSerializer,
    DivisionSerializer, ReportingLineSerializer,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_organisation(request):
    """Get the current user's organisation details."""
    org = request.user.organisation
    if not org:
        return Response({"error": "No organisation"}, status=404)
    return Response(OrganisationSerializer(org).data)


class OrganisationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganisationSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return Organisation.objects.filter(id=self.request.user.organisation_id)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_update(self, serializer):
        old_org = self.get_object()
        old_organogram = old_org.organogram_file or None
        instance = serializer.save()
        new_organogram = instance.organogram_file or None

        AuditLog.objects.create(
            event_type="org_updated",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Organisation '{instance.name}' updated",
            entity_type="organisation",
            entity_id=instance.id,
        )

        if old_organogram != new_organogram and new_organogram:
            instance.organogram_parse_status = Organisation.OrganogramParseStatus.NOT_PARSED
            instance.organogram_structure = {}
            instance.organogram_parsed_at = None
            instance.save(update_fields=["organogram_parse_status", "organogram_structure", "organogram_parsed_at"])
            AuditLog.objects.create(
                event_type="organogram_uploaded",
                event_category="ADMINISTRATIVE",
                user=self.request.user,
                organisation=self.request.user.organisation,
                description=f"Organogram uploaded for organisation '{instance.name}'",
                entity_type="organisation",
                entity_id=instance.id,
            )

    @action(detail=True, methods=["post"], url_path="parse-organogram")
    def parse_organogram(self, request, pk=None):
        org = self.get_object()
        if not org.organogram_file:
            return Response({"error": "No organogram uploaded"}, status=400)

        org.organogram_parse_status = Organisation.OrganogramParseStatus.PARSING
        org.save(update_fields=["organogram_parse_status"])

        prompt = (
            "You are given an organisation organogram file URL. "
            "Extract the structure into JSON with this exact schema:\n"
            "{"
            "\"departments\": [{\"name\": \"...\", \"units\": [\"...\"], \"divisions\": [\"...\"]}],"
            "\"reporting_lines\": [{\"supervisor_title\": \"...\", \"subordinate_title\": \"...\"}],"
            "\"notes\": [\"...\"]"
            "}\n"
            "If uncertain, include best-effort guesses in notes. Return only valid JSON."
            f"\n\nOrganogram URL: {org.organogram_file}"
        )

        raw = chat_completion([{"role": "user", "content": prompt}], timeout=20)
        try:
            parsed = json.loads(raw)
            org.organogram_structure = parsed if isinstance(parsed, dict) else {"raw": parsed}
            org.organogram_parse_status = Organisation.OrganogramParseStatus.PARSED
            org.organogram_parsed_at = timezone.now()
            org.save(update_fields=["organogram_structure", "organogram_parse_status", "organogram_parsed_at"])
        except json.JSONDecodeError:
            org.organogram_structure = {"raw_output": raw}
            org.organogram_parse_status = Organisation.OrganogramParseStatus.FAILED
            org.organogram_parsed_at = None
            org.save(update_fields=["organogram_structure", "organogram_parse_status", "organogram_parsed_at"])
            return Response(
                {"status": "failed", "error": "Could not parse organogram output as JSON."},
                status=502,
            )

        AuditLog.objects.create(
            event_type="organogram_parsed",
            event_category="ADMINISTRATIVE",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Organogram parsed for organisation '{org.name}'",
            entity_type="organisation",
            entity_id=org.id,
        )

        return Response(
            {
                "status": "parsed",
                "organogram_parse_status": org.organogram_parse_status,
                "organogram_structure": org.organogram_structure,
                "organogram_parsed_at": org.organogram_parsed_at,
            }
        )

    @action(detail=True, methods=["get"], url_path="organogram")
    def download_organogram(self, request, pk=None):
        org = self.get_object()
        if not org.organogram_file:
            return Response({"error": "No organogram uploaded"}, status=404)
        # Only Admin, Dept Head, Executive, Board Member can access
        allowed_roles = ['ADMIN', 'DEPT_HEAD', 'EXECUTIVE', 'BOARD_MEMBER']
        if request.user.role not in allowed_roles:
            return Response({"error": "Insufficient permissions"}, status=403)
        from django.shortcuts import redirect
        return redirect(org.organogram_file)


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return Department.objects.filter(organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="department_created",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Department '{instance.name}' created",
            entity_type="department",
            entity_id=instance.id,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            event_type="department_updated",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Department '{instance.name}' updated",
            entity_type="department",
            entity_id=instance.id,
        )


class UnitViewSet(viewsets.ModelViewSet):
    serializer_class = UnitSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return Unit.objects.filter(department__organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save()
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="unit_created",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Unit '{instance.name}' created",
            entity_type="unit",
            entity_id=instance.id,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            event_type="unit_updated",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Unit '{instance.name}' updated",
            entity_type="unit",
            entity_id=instance.id,
        )


class DivisionViewSet(viewsets.ModelViewSet):
    serializer_class = DivisionSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return Division.objects.filter(unit__department__organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save()
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="division_created",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Division '{instance.name}' created",
            entity_type="division",
            entity_id=instance.id,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            event_type="division_updated",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Division '{instance.name}' updated",
            entity_type="division",
            entity_id=instance.id,
        )


class ReportingLineViewSet(viewsets.ModelViewSet):
    serializer_class = ReportingLineSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return ReportingLine.objects.filter(organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="reporting_line_created",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Reporting line created: {instance.subordinate} reports to {instance.manager}",
            entity_type="reporting_line",
            entity_id=instance.id,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            event_type="reporting_line_updated",
            event_category="ADMINISTRATIVE",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Reporting line updated: {instance.subordinate} reports to {instance.manager}",
            entity_type="reporting_line",
            entity_id=instance.id,
        )
