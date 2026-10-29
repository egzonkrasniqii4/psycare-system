from django.db import transaction
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import clean_phone, display_name
from patients.models import PatientProfile


class PatientSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    has_account = serializers.BooleanField(source="user.has_account", read_only=True)
    full_name = serializers.SerializerMethodField()
    assigned_therapist_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientProfile
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "has_account",
            "date_of_birth",
            "address",
            "emergency_contact_name",
            "emergency_contact_phone",
            "medical_history",
            "assigned_therapist",
            "assigned_therapist_name",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return display_name(obj.user)

    def get_assigned_therapist_name(self, obj):
        if obj.assigned_therapist_id is None:
            return None
        return display_name(obj.assigned_therapist)


class PatientWriteSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = PatientProfile
        fields = [
            "id",
            "first_name",
            "last_name",
            "phone",
            "email",
            "date_of_birth",
            "address",
            "emergency_contact_name",
            "emergency_contact_phone",
            "medical_history",
            "assigned_therapist",
        ]
        read_only_fields = ["id"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            for name in ("first_name", "last_name", "phone"):
                self.fields[name].required = False

    def _other_users(self):
        users = User.objects.all()
        if self.instance is not None:
            users = users.exclude(pk=self.instance.user_id)
        return users

    def validate_phone(self, value):
        phone = clean_phone(value)
        if self._other_users().filter(phone=phone).exists():
            raise serializers.ValidationError("Ky numër telefoni i përket një pacienti tjetër.")
        return phone

    def validate_email(self, value):
        if not value:
            return None
        value = value.strip().lower()
        if self._other_users().filter(email=value).exists():
            raise serializers.ValidationError("Ky email është i zënë.")
        return value

    def validate_assigned_therapist(self, value):
        if value is None:
            return value
        if value.role != User.Role.THERAPIST:
            raise serializers.ValidationError("Duhet të jetë psikolog.")
        if not value.is_active:
            raise serializers.ValidationError("Ky psikolog nuk është aktiv.")
        return value

    def to_representation(self, instance):
        return PatientSerializer(instance, context=self.context).data

    @transaction.atomic
    def create(self, validated_data):
        request_user = self.context["request"].user
        if request_user.role == User.Role.THERAPIST:
            validated_data["assigned_therapist"] = request_user
        user = User(
            first_name=validated_data.pop("first_name").strip(),
            last_name=validated_data.pop("last_name").strip(),
            phone=validated_data.pop("phone"),
            email=validated_data.pop("email", None),
            role=User.Role.PATIENT,
        )
        user.set_unusable_password()
        user.save()
        return PatientProfile.objects.create(user=user, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        request_user = self.context["request"].user
        if request_user.role == User.Role.PATIENT:
            for field in ("medical_history", "assigned_therapist", "phone"):
                validated_data.pop(field, None)
        elif request_user.role == User.Role.THERAPIST:
            validated_data.pop("assigned_therapist", None)
        user_fields = {
            field: validated_data.pop(field)
            for field in ("first_name", "last_name", "phone", "email")
            if field in validated_data
        }
        if user_fields:
            if "phone" in user_fields and user_fields["phone"] != instance.user.phone:
                instance.user.phone_verified_at = None
            for key, value in user_fields.items():
                setattr(instance.user, key, value)
            instance.user.save()
        return super().update(instance, validated_data)
