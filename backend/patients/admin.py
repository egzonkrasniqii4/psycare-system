from django.contrib import admin

from patients.models import PatientProfile


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "assigned_therapist", "date_of_birth", "created_at")
    search_fields = ("user__email", "user__first_name", "user__last_name", "user__phone")
    autocomplete_fields = ("user", "assigned_therapist")
    exclude = ("medical_history",)
