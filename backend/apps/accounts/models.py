from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import TimeStampedModel
from .managers import UserManager


class User(AbstractUser, TimeStampedModel):
    class Role(models.TextChoices):
        STAFF = "STAFF", "Staff"
        MANAGER = "MANAGER", "Manager"
        DEPT_HEAD = "DEPT_HEAD", "Department Head"
        EXECUTIVE = "EXECUTIVE", "Executive"
        BOARD_MEMBER = "BOARD_MEMBER", "Board Member"
        ADMIN = "ADMIN", "Admin"

    class EmploymentStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PROBATION = "PROBATION", "Probation"
        PROMOTED = "PROMOTED", "Promoted"
        DEMOTED = "DEMOTED", "Demoted"
        SUSPENDED = "SUSPENDED", "Suspended"
        RESIGNED = "RESIGNED", "Resigned"
        TERMINATED = "TERMINATED", "Terminated"
        CONTRACT_ENDED = "CONTRACT_ENDED", "Contract Ended"

    username = None
    email = models.EmailField("email address", unique=True)
    middle_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)
    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
    )
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        "organisations.Department",
        on_delete=models.SET_NULL,
        related_name="members",
        null=True,
        blank=True,
    )
    reports_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="direct_reports",
        null=True,
        blank=True,
    )
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    job_title = models.CharField(max_length=150, blank=True)
    succeeded_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="predecessors",
        null=True,
        blank=True,
        help_text=(
            "Successor — assigned while active for handover planning; once this user is "
            "inactive, the successor inherits their tasks and records."
        ),
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["first_name", "last_name"]

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p).strip()

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    def save(self, *args, **kwargs):
        # Only the "former" statuses revoke access; Probation/Promoted/Demoted/
        # Suspended are descriptive labels that keep the user fully active.
        self.is_active = self.employment_status not in self.inactive_employment_statuses()
        super().save(*args, **kwargs)

    @classmethod
    def inactive_employment_statuses(cls):
        return [
            cls.EmploymentStatus.RESIGNED,
            cls.EmploymentStatus.TERMINATED,
            cls.EmploymentStatus.CONTRACT_ENDED,
        ]

    def predecessor_user_ids(self):
        """IDs of inactive users transitively succeeded by this user (institutional memory)."""
        if not self.pk:
            return []
        Model = self.__class__
        inactive = self.inactive_employment_statuses()
        seen: set[int] = set()
        frontier = set(
            Model.objects.filter(
                succeeded_by_id=self.pk,
                employment_status__in=inactive,
            ).values_list("id", flat=True)
        )
        while frontier:
            seen |= frontier
            frontier = set(
                Model.objects.filter(
                    succeeded_by_id__in=frontier,
                    employment_status__in=inactive,
                ).values_list("id", flat=True)
            ) - seen
        return list(seen)
