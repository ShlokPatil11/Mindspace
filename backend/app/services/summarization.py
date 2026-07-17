from app.services.groq_client import call_groq

DIRECT_SUMMARY_THRESHOLD = 4


def summarize_document(chunks: list[str]) -> str:
    if not chunks:
        return ""

    if len(chunks) <= DIRECT_SUMMARY_THRESHOLD:
        return _summarize_text("\n\n".join(chunks))

    partial_summaries = [_summarize_text(chunk) for chunk in chunks]
    return _summarize_text("\n\n".join(partial_summaries))


def _summarize_text(text: str) -> str:
    messages = [
        {
            "role": "system",
            "content": "You summarize documents concisely and accurately, in 3-5 sentences.",
        },
        {"role": "user", "content": f"Summarize the following text:\n\n{text}"},
    ]
    return call_groq(messages)
