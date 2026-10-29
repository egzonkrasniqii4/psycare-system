from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q

from accounts.managers import UserManager
from core.phone import normalize_phone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        THERAPIST = "therapist", "Psikolog"
        PATIENT = "patient", "Pacient"

    username = None
    email = models.EmailField(
        "email",
        unique=True,
        null=True,
        blank=True,
        help_text="Bosh për pacientët e shtuar nga stafi që ende nuk janë regjistruar.",
    )
    phone = models.CharField(max_length=32, blank=True)
    phone_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Kur pacienti e konfirmoi numrin me kod SMS. Bosh = pa llogari.",
    )
    role = models.CharField(max_length=20, choices=Role.choices)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        swappable = "AUTH_USER_MODEL"
        ordering = ["email"]
        verbose_name = "përdorues"
        verbose_name_plural = "përdoruesit"
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=~Q(phone=""),
                name="unique_nonblank_phone",
                violation_error_message="Ky numër telefoni është i zënë.",
            )
        ]

    @property
    def has_account(self):
        if self.phone_verified_at is not None:
            return True
        return bool(self.email) and self.has_usable_password()

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower() if self.email else None
        self.phone = normalize_phone(self.phone)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email or self.get_full_name() or self.phone


class PhoneVerification(models.Model):
    class Purpose(models.TextChoices):
        REGISTER = "register", "Regjistrim"
        LOGIN = "login", "Hyrje"

    phone = models.CharField(max_length=32)
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["phone", "purpose", "created_at"])]
        verbose_name = "verifikim telefoni"
        verbose_name_plural = "verifikimet e telefonit"

    def __str__(self):
        return f"{self.phone} · {self.get_purpose_display()}"
