def test_signup_creates_a_user_and_returns_a_token(client):
    response = client.post("/auth/signup", json={"email": "a@test.com", "password": "secret123"})
    assert response.status_code == 201
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_signup_rejects_a_duplicate_email(client):
    client.post("/auth/signup", json={"email": "dup@test.com", "password": "secret123"})
    response = client.post("/auth/signup", json={"email": "dup@test.com", "password": "otherpass"})
    assert response.status_code == 409


def test_login_returns_a_token_for_correct_credentials(client):
    client.post("/auth/signup", json={"email": "login@test.com", "password": "secret123"})
    response = client.post("/auth/login", json={"email": "login@test.com", "password": "secret123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_rejects_the_wrong_password(client):
    client.post("/auth/signup", json={"email": "login2@test.com", "password": "secret123"})
    response = client.post("/auth/login", json={"email": "login2@test.com", "password": "wrong"})
    assert response.status_code == 401


def test_login_rejects_an_unknown_email(client):
    response = client.post("/auth/login", json={"email": "nobody@test.com", "password": "secret123"})
    assert response.status_code == 401
