from unittest.mock import patch

from app.database import SessionLocal
from app.models import Chunk, Document


def _signup_and_create_space(client, email="qa@test.com"):
    token = client.post("/auth/signup", json={"email": email, "password": "secret123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    space = client.post("/spaces", json={"name": "QA space"}, headers=headers).json()
    return headers, space["id"]


def test_ask_requires_auth(client):
    response = client.post("/spaces/some-id/ask", json={"question": "hi"})
    assert response.status_code == 401


def test_ask_rejects_asking_in_a_space_you_do_not_own(client):
    headers_a, space_id = _signup_and_create_space(client, "owner2@test.com")
    headers_b, _ = _signup_and_create_space(client, "other2@test.com")
    response = client.post(f"/spaces/{space_id}/ask", json={"question": "hi"}, headers=headers_b)
    assert response.status_code == 404


def test_ask_returns_a_canned_response_when_the_space_has_no_ready_documents(client):
    headers, space_id = _signup_and_create_space(client)
    response = client.post(f"/spaces/{space_id}/ask", json={"question": "hi"}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert "no processed documents" in body["answer"]
    assert body["sources"] == []


def test_ask_returns_an_answer_with_sources_when_relevant_chunks_exist(client, db_session):
    headers, space_id = _signup_and_create_space(client, "answering@test.com")

    from app.services.embeddings import embed_texts

    document = Document(space_id=space_id, filename="fruit.txt", file_path="/tmp/fruit.txt", file_type="txt", status="ready")
    db_session.add(document)
    db_session.commit()

    content = "Bananas and apples are great fruit for a smoothie."
    embedding = embed_texts([content])[0]
    db_session.add(Chunk(document_id=document.id, content=content, embedding=embedding, chunk_index=0))
    db_session.commit()

    with patch("app.services.qa.call_groq", return_value="Bananas and apples are good choices."):
        response = client.post(
            f"/spaces/{space_id}/ask",
            json={"question": "What fruit is good for a smoothie?"},
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Bananas and apples are good choices."
    assert len(body["sources"]) == 1
    assert body["sources"][0]["filename"] == "fruit.txt"


def test_ask_falls_back_to_document_summaries_for_generic_questions_no_chunk_matches(client, db_session):
    headers, space_id = _signup_and_create_space(client, "generic@test.com")

    document = Document(
        space_id=space_id,
        filename="photosynthesis.md",
        file_path="/tmp/photosynthesis.md",
        file_type="md",
        status="ready",
        summary="Photosynthesis converts light energy into chemical energy in plants.",
    )
    db_session.add(document)
    db_session.commit()

    with (
        patch("app.services.qa.retrieve_relevant_chunks", return_value=[]),
        patch("app.services.qa.call_groq", return_value="This document is about photosynthesis.") as mock_call_groq,
    ):
        response = client.post(
            f"/spaces/{space_id}/ask",
            json={"question": "What is this document about?"},
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "This document is about photosynthesis."
    assert body["sources"] == [
        {"document_id": str(document.id), "filename": "photosynthesis.md", "snippet": document.summary}
    ]
    prompt_context = mock_call_groq.call_args[0][0][1]["content"]
    assert "Photosynthesis converts light energy" in prompt_context


def test_ask_returns_no_relevant_info_when_no_chunks_match_and_no_summaries_exist(client, db_session):
    headers, space_id = _signup_and_create_space(client, "nosummary@test.com")

    document = Document(
        space_id=space_id,
        filename="empty.md",
        file_path="/tmp/empty.md",
        file_type="md",
        status="ready",
        summary=None,
    )
    db_session.add(document)
    db_session.commit()

    with patch("app.services.qa.retrieve_relevant_chunks", return_value=[]):
        response = client.post(
            f"/spaces/{space_id}/ask",
            json={"question": "What is this document about?"},
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert "couldn't find relevant information" in body["answer"]
    assert body["sources"] == []
