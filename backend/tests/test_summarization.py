from unittest.mock import patch

from app.services.summarization import summarize_document


def test_summarize_document_returns_empty_string_for_no_chunks():
    assert summarize_document([]) == ""


def test_summarize_document_calls_groq_once_directly_for_few_chunks():
    with patch("app.services.summarization.call_groq", return_value="a concise summary") as mock_call:
        result = summarize_document(["chunk one", "chunk two"])
        assert result == "a concise summary"
        assert mock_call.call_count == 1


def test_summarize_document_uses_map_reduce_for_many_chunks():
    chunks = [f"chunk {i}" for i in range(6)]
    with patch(
        "app.services.summarization.call_groq",
        side_effect=["partial"] * 6 + ["final summary"],
    ) as mock_call:
        result = summarize_document(chunks)
        assert result == "final summary"
        assert mock_call.call_count == 7
