from app.database import SessionLocal
from app.models import Chunk, Document
from app.services.chunking import chunk_text
from app.services.embeddings import embed_texts
from app.services.extraction import ExtractionError, extract_text
from app.services.groq_client import GroqError
from app.services.summarization import summarize_document


def process_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            return

        try:
            text = extract_text(document.file_path, document.file_type)
        except ExtractionError as e:
            document.status = "failed"
            document.error_message = str(e)
            db.commit()
            return

        chunks_text = chunk_text(text)
        embeddings = embed_texts(chunks_text)
        for index, (content, embedding) in enumerate(zip(chunks_text, embeddings)):
            db.add(Chunk(document_id=document.id, content=content, embedding=embedding, chunk_index=index))

        try:
            document.summary = summarize_document(chunks_text)
        except GroqError:
            document.summary = None

        document.status = "ready"
        db.commit()
    finally:
        db.close()
