from django.contrib import admin

from appointments.models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("id", "starts_at", "ends_at", "status", "patient", "therapist")
    list_filter = ("status",)
    search_fields = ("patient__user__email", "patient__user__last_name", "therapist__email", "reason")
    autocomplete_fields = ("patient", "therapist")
    date_hierarchy = "starts_at"
