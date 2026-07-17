from sqlalchemy.orm import Session

from app.models import Document
from app.services.embeddings import embed_texts
from app.services.groq_client import GroqError, call_groq
from app.services.retrieval import retrieve_relevant_chunks

NO_DOCUMENTS_MESSAGE = (
    "This space has no processed documents yet. Upload a document and wait "
    "for it to finish processing before asking questions."
)
NO_RELEVANT_INFO_MESSAGE = (
    "I couldn't find relevant information in this space's documents to answer that question."
)
SERVICE_UNAVAILABLE_MESSAGE = (
    "I found relevant information but the AI service is temporarily unavailable. Please try again shortly."
)


def answer_question(db: Session, space_id, question: str) -> dict:
    ready_documents = db.query(Document).filter(Document.space_id == space_id, Document.status == "ready").all()
    if not ready_documents:
        return {"answer": NO_DOCUMENTS_MESSAGE, "sources": []}

    question_embedding = embed_texts([question])[0]
    results = retrieve_relevant_chunks(db, space_id, question_embedding)

    if results:
        context = "\n\n".join(f"[Source: {r['document'].filename}]\n{r['chunk'].content}" for r in results)
        sources = [
            {"document_id": r["document"].id, "filename": r["document"].filename, "snippet": r["chunk"].content[:200]}
            for r in results
        ]
    else:
        # No chunk is a close semantic match -- common for whole-document questions
        # like "what is this about?" where no single chunk resembles the query.
        # Fall back to each ready document's summary so those questions still work.
        summarized_documents = [d for d in ready_documents if d.summary]
        if not summarized_documents:
            return {"answer": NO_RELEVANT_INFO_MESSAGE, "sources": []}
        context = "\n\n".join(f"[Source: {d.filename}]\n{d.summary}" for d in summarized_documents)
        sources = [{"document_id": d.id, "filename": d.filename, "snippet": d.summary} for d in summarized_documents]

    messages = [
        {
            "role": "system",
            "content": (
                "Answer the user's question using only the provided context. If the "
                "context doesn't contain the answer, say so. Cite which source "
                "documents you used."
            ),
        },
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
    ]

    try:
        answer = call_groq(messages)
    except GroqError:
        answer = SERVICE_UNAVAILABLE_MESSAGE

    return {"answer": answer, "sources": sources}
