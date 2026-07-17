from sqlalchemy import text

from app.database import SessionLocal
from app.models import Chunk, Document, Space, User
from app.services.embeddings import embed_texts
from app.services.retrieval import retrieve_relevant_chunks


def _cleanup(session):
    session.execute(text("DELETE FROM chunks"))
    session.execute(text("DELETE FROM documents"))
    session.execute(text("DELETE FROM spaces"))
    session.execute(text("DELETE FROM users"))
    session.commit()


def test_retrieve_relevant_chunks_only_returns_chunks_from_the_target_space():
    session = SessionLocal()
    try:
        user = User(email="retrieval@test.com", password_hash="x")
        session.add(user)
        session.commit()

        space_fruit = Space(user_id=user.id, name="Fruit space")
        space_physics = Space(user_id=user.id, name="Physics space")
        session.add_all([space_fruit, space_physics])
        session.commit()

        doc_fruit = Document(space_id=space_fruit.id, filename="fruit.txt", file_path="/tmp/fruit.txt", file_type="txt", status="ready")
        doc_physics = Document(space_id=space_physics.id, filename="physics.txt", file_path="/tmp/physics.txt", file_type="txt", status="ready")
        session.add_all([doc_fruit, doc_physics])
        session.commit()

        fruit_text = "Apples and bananas are delicious fruit for a smoothie."
        physics_text = "Quantum mechanics describes the behavior of subatomic particles."
        fruit_embedding, physics_embedding = embed_texts([fruit_text, physics_text])

        session.add(Chunk(document_id=doc_fruit.id, content=fruit_text, embedding=fruit_embedding, chunk_index=0))
        session.add(Chunk(document_id=doc_physics.id, content=physics_text, embedding=physics_embedding, chunk_index=0))
        session.commit()

        query_embedding = embed_texts(["What fruit is good in a smoothie?"])[0]
        results = retrieve_relevant_chunks(session, space_fruit.id, query_embedding)

        assert len(results) == 1
        assert results[0]["chunk"].content == fruit_text
        assert results[0]["document"].id == doc_fruit.id
    finally:
        _cleanup(session)
        session.close()


def test_retrieve_relevant_chunks_filters_out_irrelevant_chunks_by_distance_threshold():
    session = SessionLocal()
    try:
        user = User(email="retrieval2@test.com", password_hash="x")
        session.add(user)
        session.commit()

        space = Space(user_id=user.id, name="Mixed space")
        session.add(space)
        session.commit()

        document = Document(space_id=space.id, filename="mixed.txt", file_path="/tmp/mixed.txt", file_type="txt", status="ready")
        session.add(document)
        session.commit()

        unrelated_text = "The history of ancient Roman aqueduct engineering."
        embedding = embed_texts([unrelated_text])[0]
        session.add(Chunk(document_id=document.id, content=unrelated_text, embedding=embedding, chunk_index=0))
        session.commit()

        query_embedding = embed_texts(["What is your favorite pizza topping?"])[0]
        results = retrieve_relevant_chunks(session, space.id, query_embedding)

        assert results == []
    finally:
        _cleanup(session)
        session.close()
