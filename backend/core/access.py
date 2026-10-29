def therapist_sees_patient(user, patient):
    if patient.assigned_therapist_id == user.id:
        return True
    return patient.appointments.filter(therapist_id=user.id).exists()


def therapist_can_book(user, patient):
    if patient.assigned_therapist_id is None:
        return True
    return therapist_sees_patient(user, patient)


def user_can_access_patient(user, patient):
    role = getattr(user, "role", None)
    if role == "admin":
        return True
    if role == "therapist":
        return therapist_sees_patient(user, patient)
    if role == "patient":
        return patient.user_id == user.id
    return False
