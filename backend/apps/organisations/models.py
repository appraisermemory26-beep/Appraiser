from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class Organisation(TimeStampedModel):
    class OrganogramParseStatus(models.TextChoices):
        NOT_PARSED = "NOT_PARSED", "Not Parsed"
        PARSING = "PARSING", "Parsing"
        PARSED = "PARSED", "Parsed"
        FAILED = "FAILED", "Failed"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    logo = models.ImageField(upload_to="org_logos/", blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    is_setup_complete = models.BooleanField(default=False)
    organogram_file = models.URLField(max_length=500, blank=True, help_text="URL to organogram file (Cloudinary or S3)")
    organogram_parse_status = models.CharField(
        max_length=20,
        choices=OrganogramParseStatus.choices,
        default=OrganogramParseStatus.NOT_PARSED,
    )
    organogram_structure = models.JSONField(default=dict, blank=True)
    organogram_parsed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.is_setup_complete and not self.organogram_file:
            raise ValidationError({
                "organogram_file": "Organisation setup cannot be marked complete without uploading an organogram."
            })
        if self.organogram_parse_status == self.OrganogramParseStatus.PARSED and not self.organogram_parsed_at:
            self.organogram_parsed_at = timezone.now()


class Department(TimeStampedModel):
    name = models.CharField(max_length=255)
    organisation = models.ForeignKey(
        Organisation, on_delete=models.CASCADE, related_name="departments"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, related_name="children",
        null=True, blank=True,
    )
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name="headed_departments", null=True, blank=True,
    )

    class Meta:
        ordering = ["name"]
        unique_together = [("name", "organisation")]

    def __str__(self):
        return f"{self.name} ({self.organisation.name})"


class Unit(TimeStampedModel):
    name = models.CharField(max_length=255)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="units"
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Division(TimeStampedModel):
    name = models.CharField(max_length=255)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="divisions")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ReportingLine(TimeStampedModel):
    subordinate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reporting_lines_as_subordinate"
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reporting_lines_as_supervisor"
    )
    organisation = models.ForeignKey(
        Organisation, on_delete=models.CASCADE, related_name="reporting_lines"
    )

    class Meta:
        unique_together = [("subordinate", "supervisor", "organisation")]

    def __str__(self):
        return f"{self.subordinate} -> {self.supervisor}"
