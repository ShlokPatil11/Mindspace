# MindSpace — Design

## Overview

MindSpace is a self-hosted web app for a small team. Each user creates named
"spaces," uploads documents (PDF/DOCX/TXT/MD) into a space, gets an
auto-generated summary per document, and asks questions answered via RAG
(retrieval-augmented generation) scoped to that space's documents, with
source citations.

## Scope

- Small, trusted team, self-hosted (not a public multi-tenant product).
- Individual user accounts (email + password), no OAuth/email verification
  for v1.
- Spaces are private to the user who created them (no team-sharing of a
  space in v1).
- Target scale: a few to ~20 documents per space.
- AI usage stays free: Groq API (free tier) for LLM calls, a local
  open-source embedding model for vectors (no embedding API cost).

## Architecture

- **Frontend:** React + Vite SPA (TypeScript), talks to the backend over a
  REST API.
- **Backend:** Python + FastAPI. Handles auth, file upload, document
  processing, embeddings, retrieval, and Groq calls for
  summarization/Q&A.
- **Database:** Postgres with the `pgvector` extension — one database for
  users, spaces, documents, and chunk embeddings.
- **File storage:** raw uploaded files on a local disk volume (mounted in
  Docker), referenced by path in Postgres.
- **Embeddings:** generated locally in the backend with a small
  sentence-transformers model (e.g. `all-MiniLM-L6-v2`, 384-dim) — no API
  cost or rate limit.
- **LLM:** Groq API (free tier), an open model such as
  `llama-3.3-70b-versatile`, for both document summarization and Q&A
  answer generation.
- **Deployment:** Docker Compose bundling frontend, backend, and Postgres,
  run on a server the team controls.

## Components

1. **Auth service** — signup/login with email+password, JWT-based
   sessions, bcrypt password hashing.
2. **Spaces service** — CRUD for spaces, each owned by a single user.
3. **Document pipeline** — on upload:
   1. Extract text (pdfplumber for PDF, python-docx for DOCX, plain read
      for TXT/MD).
   2. Chunk text (~500–1000 tokens, with overlap).
   3. Embed chunks locally and store chunks + embeddings in pgvector.
   4. Generate a summary via Groq (map-reduce: summarize chunks, then
      combine) and store it on the document.
4. **Q&A service** — embeds the user's question, runs a pgvector
   similarity search across the space's chunks (never across spaces),
   builds a prompt from the top-k retrieved chunks, calls Groq for the
   answer, and returns the answer plus the source document(s)/snippets it
   drew from.

## Data Model (Postgres)

- **users** — `id, email (unique), password_hash, created_at`
- **spaces** — `id, user_id (FK), name, created_at`
- **documents** — `id, space_id (FK), filename, file_path, file_type,
  status (processing/ready/failed), summary (text, nullable),
  error_message (nullable), uploaded_at`
- **chunks** — `id, document_id (FK), content (text),
  embedding (vector(384)), chunk_index`

Relationships: a user has many spaces; a space has many documents; a
document has many chunks. Deleting a space cascades to its documents,
chunks, and files on disk. Retrieval queries filter chunks by
`document_id IN (documents for this space)` so answers never draw on
another space's content.

**Document status flow:** `processing` → `ready` (summary + chunks
stored) or `failed` (`error_message` set; user can retry/re-upload).

## Error Handling & Edge Cases

- **Unsupported/corrupt files:** if text extraction fails, mark the
  document `failed` with a clear `error_message`; other uploads in the
  space are unaffected.
- **Empty/unparseable content** (e.g. scanned image-only PDF with no
  OCR): mark `failed` with "no extractable text found" rather than
  producing an empty summary.
- **Groq API failures/rate limits:** retry with backoff (2–3 attempts on
  429/5xx). If summarization ultimately fails, keep the document's
  chunks/embeddings usable for Q&A and mark the summary "unavailable"
  rather than failing the whole upload.
- **File size limits:** enforce a max upload size (e.g. 20MB) at the API
  layer.
- **Empty space:** if a user asks a question in a space with no `ready`
  documents, return a clear "no documents to search yet" response instead
  of calling the LLM.
- **No relevant chunks found:** if similarity search returns nothing
  above a relevance threshold, the answer states it couldn't find
  relevant information rather than the LLM hallucinating from unrelated
  chunks.

## Testing Approach

- Unit tests for text extraction (PDF/DOCX/TXT/MD parsers) and chunking
  logic, using small fixture files.
- Unit tests for the retrieval query (given known chunks/embeddings,
  correct top-k returned).
- Integration test for the full pipeline (upload → process → ready → ask
  question → grounded answer), with the Groq API mocked so tests don't
  depend on network/API keys.
- Auth tests: signup/login, JWT validation, and that a user cannot access
  another user's spaces/documents.
