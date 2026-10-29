from django.contrib import admin

from clinical.models import SessionNote


@admin.register(SessionNote)
class SessionNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "therapist", "appointment", "created_at")
    fields = ("patient", "therapist", "appointment", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    search_fields = ("patient__user__email", "therapist__email")

    def has_add_permission(self, request):
        return False
