from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Payslip(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payslips"
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="payslips"
    )
    timesheet = models.OneToOneField(
        "timesheet.Timesheet", on_delete=models.CASCADE, related_name="payslip"
    )

    period_start = models.DateField()
    period_end = models.DateField()

    currency = models.CharField(max_length=3)
    pay_frequency = models.CharField(max_length=20)

    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_statutory_employee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_statutory_employer = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    breakdown = models.JSONField(default=dict, blank=True)

    generated_at = models.DateTimeField(auto_now_add=True)

    hidden_by_employee = models.BooleanField(default=False)

    class Meta:
        ordering = ["-period_start"]

    def __str__(self):
        return f"Payslip - {self.user} - {self.period_start} to {self.period_end}"

    def save(self, *args, **kwargs):
        if self.pk:
            allowed_fields = {"hidden_by_employee", "updated_at"}
            update_fields = kwargs.get("update_fields")
            if not update_fields or not set(update_fields).issubset(allowed_fields):
                raise ValueError(
                    "Payslips cannot be modified once generated, except the personal privacy toggle."
                )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Payslips cannot be deleted.")
