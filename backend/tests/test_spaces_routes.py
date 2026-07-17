def _signup_and_get_headers(client, email="spaces@test.com"):
    response = client.post("/auth/signup", json={"email": email, "password": "secret123"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_space_requires_auth(client):
    response = client.post("/spaces", json={"name": "Tax Docs"})
    assert response.status_code == 401


def test_create_and_list_spaces_for_the_authenticated_user(client):
    headers = _signup_and_get_headers(client)
    create_response = client.post("/spaces", json={"name": "Tax Docs"}, headers=headers)
    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Tax Docs"

    list_response = client.get("/spaces", headers=headers)
    assert list_response.status_code == 200
    names = [s["name"] for s in list_response.json()]
    assert "Tax Docs" in names


def test_users_only_see_their_own_spaces(client):
    headers_a = _signup_and_get_headers(client, "a@test.com")
    headers_b = _signup_and_get_headers(client, "b@test.com")
    client.post("/spaces", json={"name": "A's space"}, headers=headers_a)

    list_response = client.get("/spaces", headers=headers_b)
    names = [s["name"] for s in list_response.json()]
    assert "A's space" not in names


def test_get_space_returns_404_for_a_space_owned_by_another_user(client):
    headers_a = _signup_and_get_headers(client, "c@test.com")
    headers_b = _signup_and_get_headers(client, "d@test.com")
    created = client.post("/spaces", json={"name": "C's space"}, headers=headers_a).json()

    response = client.get(f"/spaces/{created['id']}", headers=headers_b)
    assert response.status_code == 404


def test_delete_space_removes_it_from_the_list(client):
    headers = _signup_and_get_headers(client, "e@test.com")
    created = client.post("/spaces", json={"name": "To delete"}, headers=headers).json()

    delete_response = client.delete(f"/spaces/{created['id']}", headers=headers)
    assert delete_response.status_code == 204

    list_response = client.get("/spaces", headers=headers)
    names = [s["name"] for s in list_response.json()]
    assert "To delete" not in names
