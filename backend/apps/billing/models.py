from django.db import models

from apps.core.models import TimeStampedModel


class BillingProfile(TimeStampedModel):
    class PlanTier(models.TextChoices):
        BASIC = "BASIC", "Basic"
        PROFESSIONAL = "PROFESSIONAL", "Professional"
        ENTERPRISE = "ENTERPRISE", "Enterprise"

    class BillingCycle(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        ANNUAL = "ANNUAL", "Annual"

    class PaymentStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PENDING = "PENDING", "Pending"
        OVERDUE = "OVERDUE", "Overdue"
        CANCELLED = "CANCELLED", "Cancelled"

    organisation = models.OneToOneField(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="billing_profile"
    )
    contact_name = models.CharField(max_length=255)
    billing_email = models.EmailField()
    address = models.TextField(blank=True)
    plan_tier = models.CharField(
        max_length=20, choices=PlanTier.choices, default=PlanTier.BASIC
    )
    billing_cycle = models.CharField(
        max_length=10, choices=BillingCycle.choices, default=BillingCycle.MONTHLY
    )
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )

    # Future payment gateway fields — nullable for Stripe/gateway integration
    gateway_customer_id = models.CharField(
        max_length=255, blank=True, null=True, unique=True,
        help_text="External payment gateway customer ID (e.g. Stripe cus_xxx)",
    )
    gateway_subscription_id = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="External payment gateway subscription ID",
    )
    card_last_four = models.CharField(max_length=4, blank=True, help_text="Last 4 digits of card on file")
    card_brand = models.CharField(max_length=50, blank=True, help_text="Card brand (Visa, Mastercard, etc.)")

    def __str__(self):
        return f"{self.organisation.name} - {self.plan_tier}"
