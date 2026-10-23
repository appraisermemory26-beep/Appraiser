from rest_framework import viewsets
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
        return StatutoryScheme.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)


class TaxBracketViewSet(viewsets.ModelViewSet):
    serializer_class = TaxBracketSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsExecutiveOrAbove]

    def get_queryset(self):
        return TaxBracket.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)
