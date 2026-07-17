from unittest.mock import patch

from sqlalchemy import text

from app.database import SessionLocal
from app.models import Chunk, Document, Space, User
from app.services.document_pipeline import process_document


def _cleanup(session):
    session.execute(text("DELETE FROM chunks"))
    session.execute(text("DELETE FROM documents"))
    session.execute(text("DELETE FROM spaces"))
    session.execute(text("DELETE FROM users"))
    session.commit()


def _make_space_and_document(session, tmp_path, filename, file_type, content):
    user = User(email=f"pipeline-{filename}@test.com", password_hash="x")
    session.add(user)
    session.commit()

    space = Space(user_id=user.id, name="Pipeline space")
    session.add(space)
    session.commit()

    file_path = tmp_path / filename
    file_path.write_text(content)

    document = Document(space_id=space.id, filename=filename, file_path=str(file_path), file_type=file_type)
    session.add(document)
    session.commit()
    return document


def test_process_document_marks_ready_and_stores_chunks_and_summary(tmp_path):
    session = SessionLocal()
    try:
        document = _make_space_and_document(session, tmp_path, "notes.txt", "txt", "The quick brown fox jumps over the lazy dog.")

        with patch("app.services.document_pipeline.summarize_document", return_value="A fox jumps over a dog."):
            process_document(str(document.id))

        session.expire_all()
        refreshed = session.get(Document, document.id)
        assert refreshed.status == "ready"
        assert refreshed.summary == "A fox jumps over a dog."

        chunks = session.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 1
        assert chunks[0].content == "The quick brown fox jumps over the lazy dog."
    finally:
        _cleanup(session)
        session.close()


def test_process_document_marks_failed_when_extraction_fails(tmp_path):
    session = SessionLocal()
    try:
        document = _make_space_and_document(session, tmp_path, "corrupt.pdf", "pdf", "not a real pdf")

        process_document(str(document.id))

        session.expire_all()
        refreshed = session.get(Document, document.id)
        assert refreshed.status == "failed"
        assert refreshed.error_message is not None

        chunks = session.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 0
    finally:
        _cleanup(session)
        session.close()


def test_process_document_keeps_chunks_and_status_ready_when_summarization_fails(tmp_path):
    from app.services.groq_client import GroqError

    session = SessionLocal()
    try:
        document = _make_space_and_document(session, tmp_path, "notes2.txt", "txt", "Some content for the document.")

        with patch("app.services.document_pipeline.summarize_document", side_effect=GroqError("down")):
            process_document(str(document.id))

        session.expire_all()
        refreshed = session.get(Document, document.id)
        assert refreshed.status == "ready"
        assert refreshed.summary is None

        chunks = session.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 1
    finally:
        _cleanup(session)
        session.close()
