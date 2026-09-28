import pytest
from django.test import Client


@pytest.mark.django_db
def test_health_check():
    client = Client()
    response = client.get("/api/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.django_db
def test_core_status():
    client = Client()
    response = client.get("/api/v1/core/status/")
    assert response.status_code == 200
    assert response.json()["service"] == "appraiser"
