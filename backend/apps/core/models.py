from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model with created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class KPITarget(TimeStampedModel):
    """Board-set KPI target. Compared at read-time against actuals computed
    from current org data (task completion, on-time rate, dept productivity)."""

    class Metric(models.TextChoices):
        TASK_COMPLETION_RATE = "TASK_COMPLETION_RATE", "Task Completion Rate"
        ON_TIME_DELIVERY = "ON_TIME_DELIVERY", "On-Time Delivery"
        DEPT_PRODUCTIVITY = "DEPT_PRODUCTIVITY", "Department Productivity"

    class Period(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        QUARTERLY = "QUARTERLY", "Quarterly"
        ANNUAL = "ANNUAL", "Annual"

    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="kpi_targets"
    )
    metric = models.CharField(max_length=32, choices=Metric.choices)
    target_value = models.DecimalField(max_digits=6, decimal_places=2, help_text="Target percentage 0-100")
    period = models.CharField(max_length=16, choices=Period.choices, default=Period.QUARTERLY)
    department = models.ForeignKey(
        "organisations.Department", on_delete=models.CASCADE,
        related_name="kpi_targets", null=True, blank=True,
        help_text="Optional — if set, target applies to this department; else org-wide",
    )
    set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name="kpi_targets_set", null=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-updated_at"]
        unique_together = [("organisation", "metric", "period", "department")]

    def __str__(self):
        scope = self.department.name if self.department_id else "Org"
        return f"{scope} | {self.metric} {self.target_value}% ({self.period})"


class InstitutionalPerformanceObjective(TimeStampedModel):
    """Uploaded institutional performance objectives and KPI frameworks (PMCS M&E)."""

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="pmcs/objectives/")
    period = models.CharField(max_length=64, blank=True, help_text="e.g. FY 2026, Q1 2026")
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="performance_objectives",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="uploaded_performance_objectives",
        null=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Institutional performance objective"
        verbose_name_plural = "Institutional performance objectives"

    def __str__(self):
        return self.title
