from datetime import timedelta

import jwt
import pytest

from app.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.config import settings


def test_hash_password_produces_a_different_string_than_the_input():
    hashed = hash_password("my-secret-password")
    assert hashed != "my-secret-password"


def test_verify_password_accepts_the_correct_password():
    hashed = hash_password("my-secret-password")
    assert verify_password("my-secret-password", hashed) is True


def test_verify_password_rejects_the_wrong_password():
    hashed = hash_password("my-secret-password")
    assert verify_password("wrong-password", hashed) is False


def test_create_and_decode_access_token_round_trips_the_user_id():
    token = create_access_token("user-123")
    assert decode_access_token(token) == "user-123"


def test_decode_access_token_rejects_an_expired_token():
    token = create_access_token("user-123", expires_delta=timedelta(seconds=-1))
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


def test_decode_access_token_rejects_a_token_signed_with_a_different_secret():
    bad_token = jwt.encode({"sub": "user-123"}, "wrong-secret", algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(bad_token)
