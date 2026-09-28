from rest_framework import serializers

from .models import BillingProfile


class BillingProfileSerializer(serializers.ModelSerializer):
    organisation_name = serializers.SerializerMethodField()

    class Meta:
        model = BillingProfile
        fields = [
            "id", "organisation", "organisation_name", "contact_name",
            "billing_email", "address", "plan_tier", "billing_cycle",
            "payment_status", "card_last_four", "card_brand",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "organisation", "organisation_name",
            "card_last_four", "card_brand",  # Read-only — set by future gateway
            "created_at", "updated_at",
        ]

    def get_organisation_name(self, obj):
        return obj.organisation.name if obj.organisation else ""
