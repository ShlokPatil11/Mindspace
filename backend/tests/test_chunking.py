from app.services.chunking import chunk_text


def test_chunk_text_returns_empty_list_for_empty_input():
    assert chunk_text("") == []


def test_chunk_text_returns_a_single_chunk_when_text_fits_within_chunk_size():
    words = " ".join(f"word{i}" for i in range(5))
    chunks = chunk_text(words, chunk_size_words=10, overlap_words=3)
    assert chunks == [words]


def test_chunk_text_splits_long_text_into_overlapping_chunks():
    words = [f"word{i}" for i in range(25)]
    text = " ".join(words)
    chunks = chunk_text(text, chunk_size_words=10, overlap_words=3)

    assert len(chunks) == 4
    assert chunks[0] == " ".join(words[0:10])
    assert chunks[1] == " ".join(words[7:17])
    assert chunks[2] == " ".join(words[14:24])
    assert chunks[3] == " ".join(words[21:25])


def test_chunk_text_overlap_shares_words_between_consecutive_chunks():
    words = [f"word{i}" for i in range(25)]
    text = " ".join(words)
    chunks = chunk_text(text, chunk_size_words=10, overlap_words=3)

    first_chunk_words = chunks[0].split()
    second_chunk_words = chunks[1].split()
    assert first_chunk_words[-3:] == second_chunk_words[:3]
