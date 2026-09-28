from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsOrganisationMember, IsAdmin
from apps.audit.models import AuditLog

from .models import BillingProfile
from .serializers import BillingProfileSerializer


class BillingProfileViewSet(viewsets.ModelViewSet):
    serializer_class = BillingProfileSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsAdmin]

    def get_queryset(self):
        return BillingProfile.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)

    def perform_update(self, serializer):
        old = self.get_object()
        old_tier = old.plan_tier
        old_cycle = old.billing_cycle
        old_status = old.payment_status
        instance = serializer.save()
        user = self.request.user

        changes = []
        if old_tier != instance.plan_tier:
            changes.append(f"plan tier from {old_tier} to {instance.plan_tier}")
        if old_cycle != instance.billing_cycle:
            changes.append(f"billing cycle from {old_cycle} to {instance.billing_cycle}")
        if old_status != instance.payment_status:
            changes.append(f"payment status from {old_status} to {instance.payment_status}")

        if changes:
            AuditLog.objects.create(
                event_type="billing_updated",
                event_category="ADMINISTRATIVE",
                user=user,
                organisation=user.organisation,
                description=f"Billing profile updated: {'; '.join(changes)}",
                entity_type="billing_profile",
                entity_id=instance.id,
                metadata={
                    "old_plan_tier": old_tier,
                    "new_plan_tier": instance.plan_tier,
                    "old_billing_cycle": old_cycle,
                    "new_billing_cycle": instance.billing_cycle,
                    "old_payment_status": old_status,
                    "new_payment_status": instance.payment_status,
                },
            )
