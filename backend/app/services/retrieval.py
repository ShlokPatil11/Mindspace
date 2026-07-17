from sqlalchemy.orm import Session

from app.models import Chunk, Document

DEFAULT_K = 5
MAX_DISTANCE_THRESHOLD = 0.6


def retrieve_relevant_chunks(db: Session, space_id, question_embedding: list[float], k: int = DEFAULT_K) -> list[dict]:
    distance = Chunk.embedding.cosine_distance(question_embedding)
    rows = (
        db.query(Chunk, Document, distance.label("distance"))
        .join(Document, Chunk.document_id == Document.id)
        .filter(Document.space_id == space_id)
        .order_by(distance)
        .limit(k)
        .all()
    )
    return [
        {"chunk": chunk, "document": document, "distance": dist}
        for chunk, document, dist in rows
        if dist <= MAX_DISTANCE_THRESHOLD
    ]
