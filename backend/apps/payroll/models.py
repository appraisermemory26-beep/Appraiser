from django.db import models

from apps.core.models import TimeStampedModel


class PayrollConfiguration(TimeStampedModel):
    class PayFrequency(models.TextChoices):
        WEEKLY = "WEEKLY", "Weekly"
        BIWEEKLY = "BIWEEKLY", "Bi-weekly"
        MONTHLY = "MONTHLY", "Monthly"

    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="payroll_configurations"
    )
    currency = models.CharField(max_length=3, help_text="ISO 4217 currency code, e.g. LRD, USD.")
    pay_frequency = models.CharField(
        max_length=20, choices=PayFrequency.choices, default=PayFrequency.MONTHLY
    )

    class Meta:
        ordering = ["currency"]
        constraints = [
            models.UniqueConstraint(
                fields=["organisation", "currency"], name="one_payroll_config_per_org_per_currency"
            ),
        ]

    def __str__(self):
        return f"Payroll config - {self.organisation} ({self.currency})"


class StatutoryScheme(TimeStampedModel):
    """A statutory contribution scheme, scoped to one currency's Payroll
    Configuration, e.g. Liberia's NASSCORP at 4% employee / 6% employer.
    Nothing here is hardcoded to any one country - each organisation
    defines its own schemes, per currency."""

    payroll_configuration = models.ForeignKey(
        "payroll.PayrollConfiguration", on_delete=models.CASCADE, related_name="statutory_schemes"
    )
    name = models.CharField(max_length=100, help_text="e.g. NASSCORP")
    employee_rate = models.DecimalField(
        max_digits=5, decimal_places=2, help_text="Percentage withheld from employee pay."
    )
    employer_rate = models.DecimalField(
        max_digits=5, decimal_places=2, help_text="Percentage contributed by the employer."
    )
    effective_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-effective_date"]

    def __str__(self):
        return f"{self.name} ({self.payroll_configuration})"


class TaxBracket(TimeStampedModel):
    """One row of an income tax bracket table, scoped to one currency's
    Payroll Configuration, with an effective date so historical brackets
    stay intact once a Payslip has been generated against them."""

    payroll_configuration = models.ForeignKey(
        "payroll.PayrollConfiguration", on_delete=models.CASCADE, related_name="tax_brackets"
    )
    lower_bound = models.DecimalField(max_digits=12, decimal_places=2)
    upper_bound = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Leave blank for the top, unbounded bracket.",
    )
    rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Percentage tax rate for this bracket.")
    effective_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["effective_date", "lower_bound"]

    def __str__(self):
        upper = self.upper_bound if self.upper_bound is not None else "unbounded"
        return f"{self.lower_bound}-{upper} @ {self.rate}% ({self.payroll_configuration})"