def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_session_can_create_and_query_a_user(db_session):
    from app.models import User

    user = User(email="smoke@test.com", password_hash="x")
    db_session.add(user)
    db_session.commit()

    found = db_session.query(User).filter(User.email == "smoke@test.com").first()
    assert found is not None
    assert found.email == "smoke@test.com"
