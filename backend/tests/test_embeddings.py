import numpy as np

from app.services.embeddings import embed_texts


def _cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def test_embed_texts_returns_one_vector_per_input_text():
    embeddings = embed_texts(["hello world", "goodbye world"])
    assert len(embeddings) == 2


def test_embed_texts_returns_384_dimensional_vectors():
    embeddings = embed_texts(["hello world"])
    assert len(embeddings[0]) == 384


def test_similar_sentences_are_more_similar_than_unrelated_ones():
    cat_sentence, similar_sentence, unrelated_sentence = embed_texts(
        [
            "The cat sat on the mat.",
            "A feline rested on the rug.",
            "Quantum physics explains subatomic particles.",
        ]
    )
    assert _cosine_similarity(cat_sentence, similar_sentence) > _cosine_similarity(
        cat_sentence, unrelated_sentence
    )
