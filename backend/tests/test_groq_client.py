from unittest.mock import MagicMock, patch

import pytest
from groq import APIStatusError

from app.services import groq_client


@pytest.fixture(autouse=True)
def reset_client():
    groq_client._client = None
    yield
    groq_client._client = None


def _mock_response(text):
    response = MagicMock()
    response.choices = [MagicMock(message=MagicMock(content=text))]
    return response


def _status_error(status_code, message="error"):
    return APIStatusError(message=message, response=MagicMock(status_code=status_code), body=None)


def test_call_groq_returns_the_response_content_on_success():
    with patch.object(groq_client, "Groq") as MockGroq:
        instance = MockGroq.return_value
        instance.chat.completions.create.return_value = _mock_response("hello")

        result = groq_client.call_groq([{"role": "user", "content": "hi"}])

        assert result == "hello"


def test_call_groq_retries_on_a_retryable_error_then_succeeds():
    with patch.object(groq_client, "Groq") as MockGroq, patch("time.sleep", return_value=None):
        instance = MockGroq.return_value
        instance.chat.completions.create.side_effect = [_status_error(429), _mock_response("ok")]

        result = groq_client.call_groq([{"role": "user", "content": "hi"}])

        assert result == "ok"
        assert instance.chat.completions.create.call_count == 2


def test_call_groq_raises_groq_error_after_exhausting_retries():
    with patch.object(groq_client, "Groq") as MockGroq, patch("time.sleep", return_value=None):
        instance = MockGroq.return_value
        instance.chat.completions.create.side_effect = _status_error(500)

        with pytest.raises(groq_client.GroqError):
            groq_client.call_groq([{"role": "user", "content": "hi"}])

        assert instance.chat.completions.create.call_count == 3


def test_call_groq_raises_groq_error_immediately_on_a_non_retryable_error():
    with patch.object(groq_client, "Groq") as MockGroq:
        instance = MockGroq.return_value
        instance.chat.completions.create.side_effect = _status_error(400)

        with pytest.raises(groq_client.GroqError):
            groq_client.call_groq([{"role": "user", "content": "hi"}])

        assert instance.chat.completions.create.call_count == 1
