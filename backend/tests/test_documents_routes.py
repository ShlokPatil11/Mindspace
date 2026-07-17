from unittest.mock import patch

from app.database import get_db
from app.main import app


def _signup_and_create_space(client, email="docs@test.com"):
    token = client.post("/auth/signup", json={"email": email, "password": "secret123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    space = client.post("/spaces", json={"name": "Docs space"}, headers=headers).json()
    return headers, space["id"]


def test_upload_document_requires_auth(client):
    response = client.post("/spaces/some-id/documents", files={"file": ("a.txt", b"hello", "text/plain")})
    assert response.status_code == 401


def test_upload_document_rejects_an_unsupported_file_type(client):
    headers, space_id = _signup_and_create_space(client)
    response = client.post(
        f"/spaces/{space_id}/documents",
        files={"file": ("a.exe", b"hello", "application/octet-stream")},
        headers=headers,
    )
    assert response.status_code == 400


def test_upload_document_rejects_a_file_over_the_size_limit(client):
    headers, space_id = _signup_and_create_space(client)
    with patch("app.routers.documents.settings.MAX_UPLOAD_SIZE_BYTES", 10):
        response = client.post(
            f"/spaces/{space_id}/documents",
            files={"file": ("a.txt", b"this is more than ten bytes", "text/plain")},
            headers=headers,
        )
    assert response.status_code == 413


def test_upload_document_creates_a_processing_document_and_schedules_processing(client):
    headers, space_id = _signup_and_create_space(client)
    with patch("app.routers.documents.process_document") as mock_process:
        response = client.post(
            f"/spaces/{space_id}/documents",
            files={"file": ("a.txt", b"hello world", "text/plain")},
            headers=headers,
        )
    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "a.txt"
    assert body["status"] == "processing"
    mock_process.assert_called_once_with(body["id"])


def test_upload_document_rejects_uploading_to_a_space_you_do_not_own(client):
    headers_a, space_id = _signup_and_create_space(client, "owner@test.com")
    headers_b, _ = _signup_and_create_space(client, "other@test.com")
    response = client.post(
        f"/spaces/{space_id}/documents",
        files={"file": ("a.txt", b"hello", "text/plain")},
        headers=headers_b,
    )
    assert response.status_code == 404


def test_list_documents_returns_uploaded_documents_for_the_space(client):
    headers, space_id = _signup_and_create_space(client)
    with patch("app.routers.documents.process_document"):
        client.post(
            f"/spaces/{space_id}/documents",
            files={"file": ("a.txt", b"hello", "text/plain")},
            headers=headers,
        )
    response = client.get(f"/spaces/{space_id}/documents", headers=headers)
    assert response.status_code == 200
    filenames = [d["filename"] for d in response.json()]
    assert "a.txt" in filenames
