def chunk_text(text: str, chunk_size_words: int = 600, overlap_words: int = 100) -> list[str]:
    words = text.split()
    if not words:
        return []

    if len(words) <= chunk_size_words:
        return [" ".join(words)]

    chunks = []
    start = 0
    step = chunk_size_words - overlap_words
    while start < len(words):
        chunk_words = words[start : start + chunk_size_words]
        chunks.append(" ".join(chunk_words))
        if start + chunk_size_words >= len(words):
            break
        start += step
    return chunks
