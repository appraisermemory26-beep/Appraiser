from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsOrganisationMember, IsExecutiveOrAbove

from .models import PayrollConfiguration, StatutoryScheme, TaxBracket
from .serializers import (
    PayrollConfigurationSerializer,
    StatutorySchemeSerializer,
    TaxBracketSerializer,
)


class PayrollConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollConfigurationSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsExecutiveOrAbove]

    def get_queryset(self):
        return PayrollConfiguration.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)


class StatutorySchemeViewSet(viewsets.ModelViewSet):
    serializer_class = StatutorySchemeSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsExecutiveOrAbove]

    def get_queryset(self):
        return StatutoryScheme.objects.filter(
            payroll_configuration__organisation=self.request.user.organisation
        )

    def perform_create(self, serializer):
        config = serializer.validated_data["payroll_configuration"]
        if config.organisation_id != self.request.user.organisation_id:
            raise ValidationError({"payroll_configuration": "Not found."})
        serializer.save()


class TaxBracketViewSet(viewsets.ModelViewSet):
    serializer_class = TaxBracketSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsExecutiveOrAbove]

    def get_queryset(self):
        return TaxBracket.objects.filter(
            payroll_configuration__organisation=self.request.user.organisation
        )

    def perform_create(self, serializer):
        config = serializer.validated_data["payroll_configuration"]
        if config.organisation_id != self.request.user.organisation_id:
            raise ValidationError({"payroll_configuration": "Not found."})
        serializer.save()