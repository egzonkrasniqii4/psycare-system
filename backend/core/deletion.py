from django.db.models.deletion import ProtectedError
from rest_framework.exceptions import ValidationError


def delete_protected(instance):
    try:
        instance.delete()
    except ProtectedError as exc:
        raise ValidationError(
            "Ky regjistër ka termine, shënime ose fatura të lidhura dhe nuk fshihet."
        ) from exc
