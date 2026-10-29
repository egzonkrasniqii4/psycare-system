from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and response.status_code == 404 and isinstance(response.data, dict):
        response.data["detail"] = "Nuk u gjet."
    return response
