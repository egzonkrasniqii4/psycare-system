from django.conf import settings
from django.db import models


class AppointmentQuerySet(models.QuerySet):
    def for_user(self, user):
        if user.role == "admin":
            return self
        if user.role == "therapist":
            return self.filter(therapist=user)
        return self.filter(patient__user=user)


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Në pritje"
        CONFIRMED = "confirmed", "Konfirmuar"
        COMPLETED = "completed", "Përfunduar"
        CANCELLED = "cancelled", "Anuluar"

    patient = models.ForeignKey(
        "patients.PatientProfile",
        on_delete=models.PROTECT,
        related_name="appointments",
    )
    therapist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="therapist_appointments",
        limit_choices_to={"role": "therapist"},
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.CharField(
        max_length=255,
        blank=True,
        help_text="Arsye e shkurtër administrative. Shënimet klinike ruhen te SessionNote.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AppointmentQuerySet.as_manager()

    class Meta:
        ordering = ["starts_at"]
        verbose_name = "termin"
        verbose_name_plural = "terminet"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="appointment_ends_after_start",
                violation_error_message="Mbarimi duhet të jetë pas fillimit.",
            )
        ]
        indexes = [
            models.Index(fields=["therapist", "starts_at"]),
            models.Index(fields=["patient", "starts_at"]),
            models.Index(fields=["status", "starts_at"]),
        ]

    def __str__(self):
        return f"{self.starts_at:%d.%m.%Y %H:%M} · {self.get_status_display()}"
