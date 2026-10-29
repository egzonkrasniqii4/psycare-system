from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email-i është i detyrueshëm.")
        email = self.normalize_email(email).lower()
        extra.setdefault("role", "patient")
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", "admin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser duhet të ketë is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser duhet të ketë is_superuser=True.")
        return self.create_user(email, password, **extra)
