import time

from groq import APIStatusError, Groq

from app.config import settings


class GroqError(Exception):
    pass


_client: Groq | None = None

RETRYABLE_STATUS_CODES = {429, 500, 502, 503}
MAX_RETRIES = 3


def get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def call_groq(messages: list[dict], model: str | None = None) -> str:
    client = get_client()
    model = model or settings.GROQ_MODEL
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(model=model, messages=messages)
            return response.choices[0].message.content
        except APIStatusError as e:
            last_error = e
            if e.status_code not in RETRYABLE_STATUS_CODES or attempt == MAX_RETRIES - 1:
                raise GroqError(f"Groq API call failed: {e}") from e
            time.sleep(2**attempt)

    raise GroqError(f"Groq API call failed after {MAX_RETRIES} attempts: {last_error}")
