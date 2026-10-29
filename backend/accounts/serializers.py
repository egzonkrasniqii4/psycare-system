from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import PhoneVerification, User
from core.otp import CODE_LENGTH, consume_code
from core.phone import is_valid_phone, normalize_phone


def display_name(user):
    return user.get_full_name().strip() or user.email or user.phone


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    patient_profile_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "role",
            "patient_profile_id",
        ]

    def get_full_name(self, obj):
        return display_name(obj)

    def get_patient_profile_id(self, obj):
        try:
            return obj.patient_profile.id
        except ObjectDoesNotExist:
            return None


class TherapistSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "full_name", "email"]

    def get_full_name(self, obj):
        return display_name(obj)


class TherapistAdminSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    patient_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "is_active",
            "password",
            "patient_count",
            "date_joined",
        ]
        read_only_fields = ["id", "full_name", "patient_count", "date_joined"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
        }

    def get_full_name(self, obj):
        return display_name(obj)

    def _others(self):
        users = User.objects.all()
        if self.instance is not None:
            users = users.exclude(pk=self.instance.pk)
        return users

    def validate_email(self, value):
        value = value.strip().lower()
        if self._others().filter(email=value).exists():
            raise serializers.ValidationError("Ky email është i zënë.")
        return value

    def validate_phone(self, value):
        if not value:
            return ""
        phone = clean_phone(value)
        if self._others().filter(phone=phone).exists():
            raise serializers.ValidationError("Ky numër telefoni është i zënë.")
        return phone

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Vendosni një fjalëkalim të përkohshëm."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=User.Role.THERAPIST, **validated_data)
        validate_optional_password(password, user)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", "")
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            validate_optional_password(password, instance)
            instance.set_password(password)
        instance.save()
        return instance


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": "Email-i ose fjalëkalimi është i pasaktë.",
    }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = display_name(user)
        return token

    def validate(self, attrs):
        email = attrs.get(self.username_field)
        if isinstance(email, str):
            attrs[self.username_field] = email.strip().lower()
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


def validate_optional_password(password, user):
    if not password:
        return
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"password": list(exc.messages)}) from exc


def clean_phone(value):
    phone = normalize_phone(value)
    if not is_valid_phone(phone):
        raise serializers.ValidationError("Numër telefoni i pavlefshëm.")
    return phone


def _same_name(left, right):
    return " ".join(left.split()).casefold() == " ".join(right.split()).casefold()


class PhoneCodeSerializer(serializers.Serializer):
    """Shared checks for asking for an SMS code and for redeeming it.

    register: claims the record the clinic made for this phone (names must match) or creates one.
    login: only patients who already confirmed their phone.
    """

    purpose = serializers.ChoiceField(choices=PhoneVerification.Purpose.choices)
    phone = serializers.CharField(max_length=32)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    def validate_phone(self, value):
        return clean_phone(value)

    def validate_email(self, value):
        return value.strip().lower() if value else None

    def validate(self, attrs):
        phone = attrs["phone"]
        existing = User.objects.filter(phone=phone).first()
        if attrs["purpose"] == PhoneVerification.Purpose.LOGIN:
            if (
                existing is None
                or existing.role != User.Role.PATIENT
                or existing.phone_verified_at is None
                or not existing.is_active
            ):
                raise serializers.ValidationError(
                    {"phone": "Ky numër nuk ka llogari pacienti. Regjistrohuni së pari."}
                )
            attrs["user"] = existing
            return attrs

        for field in ("first_name", "last_name"):
            if not (attrs.get(field) or "").strip():
                raise serializers.ValidationError({field: "Kjo fushë është e detyrueshme."})
        if existing is not None:
            if existing.role != User.Role.PATIENT or existing.phone_verified_at is not None:
                raise serializers.ValidationError(
                    {"phone": "Ky numër ka tashmë llogari. Hyni me kod në telefon."}
                )
            if not (
                _same_name(existing.first_name, attrs["first_name"])
                and _same_name(existing.last_name, attrs["last_name"])
            ):
                raise serializers.ValidationError(
                    {
                        "phone": "Ky numër është i regjistruar në klinikë me emër tjetër. "
                        "Kontaktoni klinikën."
                    }
                )
        email = attrs.get("email")
        if email:
            taken = User.objects.filter(email=email)
            if existing is not None:
                taken = taken.exclude(pk=existing.pk)
            if taken.exists():
                raise serializers.ValidationError({"email": "Ky email është i zënë."})
        attrs["user"] = existing
        return attrs


class PhoneCodeVerifySerializer(PhoneCodeSerializer):
    code = serializers.RegexField(
        rf"^\d{{{CODE_LENGTH}}}$", error_messages={"invalid": f"Kodi ka {CODE_LENGTH} shifra."}
    )

    def save(self):
        data = self.validated_data
        consume_code(data["phone"], data["purpose"], data["code"])
        with transaction.atomic():
            return self._finish(data)

    def _finish(self, data):
        from patients.models import PatientProfile

        user = data["user"]
        self.claimed = False
        if data["purpose"] == PhoneVerification.Purpose.REGISTER:
            self.claimed = user is not None
            if user is None:
                user = User(
                    first_name=data["first_name"].strip(),
                    last_name=data["last_name"].strip(),
                    phone=data["phone"],
                    role=User.Role.PATIENT,
                )
                user.set_unusable_password()
            if data.get("email"):
                user.email = data["email"]
            user.phone_verified_at = timezone.now()
            user.save()
            PatientProfile.objects.get_or_create(user=user)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return user
