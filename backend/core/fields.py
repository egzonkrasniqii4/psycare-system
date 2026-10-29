from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models


class EncryptedTextField(models.TextField):
    """Stores Fernet ciphertext. The ORM returns plaintext after a read."""

    description = "Text encrypted with Fernet before it is written."

    def _fernet(self):
        key = settings.FIELD_ENCRYPTION_KEY
        if isinstance(key, str):
            key = key.encode("utf-8")
        return Fernet(key)

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        return self._fernet().decrypt(str(value).encode("utf-8")).decode("utf-8")

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        token = self._fernet().encrypt(str(value).encode("utf-8"))
        return token.decode("utf-8")
