# MindSpace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MindSpace, a self-hosted web app where a small team of users each create named "spaces," upload PDF/DOCX/TXT/MD documents into a space, get an auto-generated summary per document, and ask questions answered via RAG scoped to that space's documents with source citations.

**Architecture:** Python/FastAPI backend with Postgres+pgvector as the single datastore (users, spaces, documents, chunk embeddings), local sentence-transformers embeddings, Groq (free tier) for summarization/Q&A generation, and a React+Vite TypeScript frontend. Deployed self-hosted via Docker Compose.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, psycopg2, pgvector, PyJWT, bcrypt, pdfplumber, python-docx, sentence-transformers, groq (Python SDK), pytest; React, react-router-dom, Vite, TypeScript, Vitest.

## Global Constraints

- Self-hosted, small trusted team — no public multi-tenant signup flow, no email verification, no OAuth (v1).
- Spaces are private to the user who created them — no space-sharing in v1.
- Supported upload formats: PDF, DOCX, TXT, MD only.
- Max upload size: 20MB per file.
- Target scale: up to ~20 documents per space — no ANN vector index needed; a plain pgvector distance query is sufficient at this scale.
- AI usage must stay free: Groq API (free tier) for all LLM calls; embeddings generated locally via sentence-transformers (no embedding API cost).
- Deployment target: Docker Compose on a self-controlled server.

---

## Task 1: Backend Scaffold & Dev Database

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/.env.example`
- Create: `docker-compose.yml`
- Create: `.gitignore`

**Interfaces:**
- Produces: `app.config.settings` (a `Settings` instance with fields `DATABASE_URL: str`, `JWT_SECRET: str`, `JWT_ALGORITHM: str = "HS256"`, `ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080`, `GROQ_API_KEY: str`, `GROQ_MODEL: str = "llama-3.3-70b-versatile"`, `EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"`, `UPLOAD_DIR: str = "./uploads"`, `MAX_UPLOAD_SIZE_BYTES: int = 20971520`), used by every later backend task.
- Produces: `app.main.app` (the FastAPI instance), used by every router task.

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi
uvicorn[standard]
sqlalchemy>=2.0
psycopg2-binary
pgvector
pydantic-settings
pydantic
email-validator
pyjwt
bcrypt
pdfplumber
python-docx
sentence-transformers
groq
python-multipart
```

- [ ] **Step 2: Create `backend/requirements-dev.txt`**

```
pytest
httpx
fpdf2
```

- [ ] **Step 3: Create `backend/app/__init__.py`** (empty file)

- [ ] **Step 4: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 20 * 1024 * 1024

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 5: Create `backend/app/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="MindSpace")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Create `backend/.env.example`**

```
DATABASE_URL=postgresql+psycopg2://mindspace:mindspace@localhost:5432/mindspace
JWT_SECRET=dev-secret-change-me
GROQ_API_KEY=your-groq-api-key-here
UPLOAD_DIR=./uploads
```

- [ ] **Step 7: Create `docker-compose.yml`** (dev version — just the database; backend/frontend services are added in Task 19)

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: mindspace
      POSTGRES_PASSWORD: mindspace
      POSTGRES_DB: mindspace
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 8: Create `.gitignore`**

```
__pycache__/
*.pyc
.env
backend/.env
backend/uploads/
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 9: Start the dev database and create the test database**

```bash
docker compose up -d postgres
docker compose exec postgres psql -U mindspace -d mindspace -c "CREATE DATABASE mindspace_test;"
```

Expected: `CREATE DATABASE` printed, no errors.

- [ ] **Step 10: Install backend dependencies and verify the app boots**

```bash
cd backend
cp .env.example .env
# edit .env and set a real GROQ_API_KEY (sign up free at console.groq.com)
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload &
sleep 2
curl -s http://localhost:8000/health
kill %1
```

Expected: `{"status":"ok"}` printed by curl.

- [ ] **Step 11: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/app/__init__.py backend/app/config.py backend/app/main.py backend/.env.example docker-compose.yml .gitignore
git commit -m "feat: backend scaffold with health endpoint and dev database"
```

---

## Task 2: Database Models & Test Infrastructure

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `app.config.settings` (Task 1).
- Produces: `app.database.Base`, `app.database.engine`, `app.database.SessionLocal`, `app.database.get_db()` (FastAPI dependency yielding a `Session`), `app.database.init_db()` — all used by every later backend task.
- Produces: `app.models.User(id, email, password_hash, created_at)`, `app.models.Space(id, user_id, name, created_at, user, documents)`, `app.models.Document(id, space_id, filename, file_path, file_type, status, summary, error_message, uploaded_at, space, chunks)`, `app.models.Chunk(id, document_id, content, embedding, chunk_index, document)` — used by every later backend task.
- Produces (test fixtures in `conftest.py`): `client` (FastAPI `TestClient` with DB dependency overridden to a rollback-isolated session), `db_session` (a `Session` bound to a transaction that rolls back after the test) — used by every later backend test.

- [ ] **Step 1: Create `backend/app/database.py`**

```python
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db():
    import app.models  # noqa: F401  registers tables on Base.metadata

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create `backend/app/models.py`**

```python
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    spaces: Mapped[list["Space"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Space(Base):
    __tablename__ = "spaces"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="spaces")
    documents: Mapped[list["Document"]] = relationship(back_populates="space", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("spaces.id"))
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="processing")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    space: Mapped["Space"] = relationship(back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("documents.id"))
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(384))
    chunk_index: Mapped[int] = mapped_column(Integer)

    document: Mapped["Document"] = relationship(back_populates="chunks")
```

- [ ] **Step 3: Modify `backend/app/main.py`** to initialize the database on startup

```python
from fastapi import FastAPI

from app.database import init_db

app = FastAPI(title="MindSpace")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create `backend/tests/__init__.py`** (empty file)

- [ ] **Step 5: Create `backend/tests/conftest.py`**

```python
import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://mindspace:mindspace@localhost:5432/mindspace_test",
)
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("GROQ_API_KEY", "test-key")
os.environ.setdefault("UPLOAD_DIR", "/tmp/mindspace-test-uploads")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.database import Base, engine, get_db, init_db
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    TestSession = sessionmaker(bind=connection)
    session = TestSession()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

- [ ] **Step 6: Write a smoke test verifying the fixtures work — `backend/tests/test_health.py`**

```python
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_session_can_create_and_query_a_user(db_session):
    from app.models import User

    user = User(email="smoke@test.com", password_hash="x")
    db_session.add(user)
    db_session.commit()

    found = db_session.query(User).filter(User.email == "smoke@test.com").first()
    assert found is not None
    assert found.email == "smoke@test.com"
```

- [ ] **Step 7: Run the tests and verify they pass**

```bash
cd backend && pytest tests/test_health.py -v
```

Expected: both tests PASS. (If `mindspace_test` does not exist yet, re-run Task 1 Step 9 first.)

- [ ] **Step 8: Commit**

```bash
git add backend/app/database.py backend/app/models.py backend/app/main.py backend/tests/
git commit -m "feat: add SQLAlchemy models, pgvector setup, and test DB infrastructure"
```

---

## Task 3: Auth Utilities (Hashing & JWT)

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/tests/test_auth_utils.py`

**Interfaces:**
- Consumes: `app.config.settings` (Task 1), `app.database.get_db` and `app.models.User` (Task 2).
- Produces: `hash_password(password: str) -> str`, `verify_password(password: str, password_hash: str) -> bool`, `create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str`, `decode_access_token(token: str) -> str`, `get_current_user(token: str = Depends(...), db: Session = Depends(get_db)) -> User` (FastAPI dependency) — used by all protected routes (Tasks 4, 5, 12, 14).

- [ ] **Step 1: Write the failing tests — `backend/tests/test_auth_utils.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_auth_utils.py -v
```

Expected: FAIL with `ModuleNotFoundError` or `ImportError` (`app.auth` does not exist yet).

- [ ] **Step 3: Create `backend/app/auth.py`**

```python
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str:
    delta = expires_delta if expires_delta is not None else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + delta
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    return payload["sub"]


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
    )
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        raise credentials_error
    user = db.get(User, user_id)
    if user is None:
        raise credentials_error
    return user
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_auth_utils.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth.py backend/tests/test_auth_utils.py
git commit -m "feat: add password hashing and JWT utilities"
```

---

## Task 4: Auth Routes (Signup & Login)

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_auth_routes.py`

**Interfaces:**
- Consumes: `hash_password`, `verify_password`, `create_access_token` (Task 3), `app.models.User` (Task 2).
- Produces: `app.schemas.SignupRequest(email, password)`, `LoginRequest(email, password)`, `TokenResponse(access_token, token_type)` — reused conceptually by frontend Task 16. Produces routes `POST /auth/signup`, `POST /auth/login`.

- [ ] **Step 1: Create `backend/app/schemas.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SpaceCreate(BaseModel):
    name: str


class SpaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    created_at: datetime


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    file_type: str
    status: str
    summary: str | None
    error_message: str | None
    uploaded_at: datetime


class AskRequest(BaseModel):
    question: str


class SourceSnippet(BaseModel):
    document_id: uuid.UUID
    filename: str
    snippet: str


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceSnippet]
```

- [ ] **Step 2: Create `backend/app/routers/__init__.py`** (empty file)

- [ ] **Step 3: Write the failing tests — `backend/tests/test_auth_routes.py`**

```python
def test_signup_creates_a_user_and_returns_a_token(client):
    response = client.post("/auth/signup", json={"email": "a@test.com", "password": "secret123"})
    assert response.status_code == 201
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_signup_rejects_a_duplicate_email(client):
    client.post("/auth/signup", json={"email": "dup@test.com", "password": "secret123"})
    response = client.post("/auth/signup", json={"email": "dup@test.com", "password": "otherpass"})
    assert response.status_code == 409


def test_login_returns_a_token_for_correct_credentials(client):
    client.post("/auth/signup", json={"email": "login@test.com", "password": "secret123"})
    response = client.post("/auth/login", json={"email": "login@test.com", "password": "secret123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_rejects_the_wrong_password(client):
    client.post("/auth/signup", json={"email": "login2@test.com", "password": "secret123"})
    response = client.post("/auth/login", json={"email": "login2@test.com", "password": "wrong"})
    assert response.status_code == 401


def test_login_rejects_an_unknown_email(client):
    response = client.post("/auth/login", json={"email": "nobody@test.com", "password": "secret123"})
    assert response.status_code == 401
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_auth_routes.py -v
```

Expected: FAIL with 404 (no `/auth/signup` route registered yet).

- [ ] **Step 5: Create `backend/app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, SignupRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)
```

- [ ] **Step 6: Modify `backend/app/main.py`** to register the router

```python
from fastapi import FastAPI

from app.database import init_db
from app.routers import auth

app = FastAPI(title="MindSpace")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_auth_routes.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/ backend/app/main.py backend/tests/test_auth_routes.py
git commit -m "feat: add signup and login routes"
```

---

## Task 5: Spaces CRUD Routes

**Files:**
- Create: `backend/app/routers/spaces.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_spaces_routes.py`

**Interfaces:**
- Consumes: `get_current_user` (Task 3), `app.models.Space`, `app.models.User` (Task 2), `SpaceCreate`, `SpaceResponse` (Task 4).
- Produces: routes `POST /spaces`, `GET /spaces`, `GET /spaces/{space_id}`, `DELETE /spaces/{space_id}`. Produces `_get_owned_space(db: Session, user: User, space_id: str) -> Space` (raises 404 if not found or not owned) — used by Tasks 12 and 14.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_spaces_routes.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_spaces_routes.py -v
```

Expected: FAIL with 404 (no `/spaces` route registered yet).

- [ ] **Step 3: Create `backend/app/routers/spaces.py`**

```python
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Space, User
from app.schemas import SpaceCreate, SpaceResponse

router = APIRouter(prefix="/spaces", tags=["spaces"])


def _get_owned_space(db: Session, user: User, space_id: str) -> Space:
    space = db.get(Space, space_id)
    if space is None or space.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    return space


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(payload: SpaceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    space = Space(user_id=user.id, name=payload.name)
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.get("", response_model=list[SpaceResponse])
def list_spaces(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Space).filter(Space.user_id == user.id).order_by(Space.created_at.desc()).all()


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(space_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_owned_space(db, user, space_id)


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(space_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    space = _get_owned_space(db, user, space_id)
    for document in space.documents:
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
    db.delete(space)
    db.commit()
```

- [ ] **Step 4: Modify `backend/app/main.py`** to register the router

```python
from fastapi import FastAPI

from app.database import init_db
from app.routers import auth, spaces

app = FastAPI(title="MindSpace")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(spaces.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_spaces_routes.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/spaces.py backend/app/main.py backend/tests/test_spaces_routes.py
git commit -m "feat: add spaces CRUD routes with per-user isolation"
```

---

## Task 6: Text Extraction Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/extraction.py`
- Create: `backend/tests/test_extraction.py`

**Interfaces:**
- Produces: `ExtractionError(Exception)`, `extract_text(file_path: str, file_type: str) -> str` (raises `ExtractionError` on unsupported type, read failure, or empty content) — used by Task 11.

- [ ] **Step 1: Create `backend/app/services/__init__.py`** (empty file)

- [ ] **Step 2: Write the failing tests — `backend/tests/test_extraction.py`**

```python
import docx
import pytest
from fpdf import FPDF

from app.services.extraction import ExtractionError, extract_text


def _make_pdf(path, text):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 10, text)
    pdf.output(str(path))


def _make_blank_pdf(path):
    pdf = FPDF()
    pdf.add_page()
    pdf.output(str(path))


def _make_docx(path, text):
    document = docx.Document()
    document.add_paragraph(text)
    document.save(str(path))


def test_extract_text_from_a_pdf(tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    _make_pdf(pdf_path, "Hello from a PDF document.")
    text = extract_text(str(pdf_path), "pdf")
    assert "Hello from a PDF document." in text


def test_extract_text_from_a_docx(tmp_path):
    docx_path = tmp_path / "sample.docx"
    _make_docx(docx_path, "Hello from a Word document.")
    text = extract_text(str(docx_path), "docx")
    assert "Hello from a Word document." in text


def test_extract_text_from_a_txt_file(tmp_path):
    txt_path = tmp_path / "sample.txt"
    txt_path.write_text("Hello from a plain text file.")
    text = extract_text(str(txt_path), "txt")
    assert "Hello from a plain text file." in text


def test_extract_text_from_a_markdown_file(tmp_path):
    md_path = tmp_path / "sample.md"
    md_path.write_text("# Heading\n\nHello from markdown.")
    text = extract_text(str(md_path), "md")
    assert "Hello from markdown." in text


def test_extract_text_raises_on_unsupported_file_type(tmp_path):
    path = tmp_path / "sample.xyz"
    path.write_text("irrelevant")
    with pytest.raises(ExtractionError):
        extract_text(str(path), "xyz")


def test_extract_text_raises_on_a_corrupt_pdf(tmp_path):
    path = tmp_path / "corrupt.pdf"
    path.write_bytes(b"not a real pdf file")
    with pytest.raises(ExtractionError):
        extract_text(str(path), "pdf")


def test_extract_text_raises_when_no_text_is_found(tmp_path):
    pdf_path = tmp_path / "blank.pdf"
    _make_blank_pdf(pdf_path)
    with pytest.raises(ExtractionError):
        extract_text(str(pdf_path), "pdf")
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_extraction.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.extraction` does not exist yet).

- [ ] **Step 4: Create `backend/app/services/extraction.py`**

```python
import docx
import pdfplumber


class ExtractionError(Exception):
    pass


def extract_text(file_path: str, file_type: str) -> str:
    if file_type == "pdf":
        text = _extract_pdf(file_path)
    elif file_type == "docx":
        text = _extract_docx(file_path)
    elif file_type in ("txt", "md"):
        text = _extract_plain(file_path)
    else:
        raise ExtractionError(f"Unsupported file type: {file_type}")

    text = text.strip()
    if not text:
        raise ExtractionError("No extractable text found")
    return text


def _extract_pdf(file_path: str) -> str:
    try:
        with pdfplumber.open(file_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        raise ExtractionError(f"Failed to extract PDF text: {e}") from e


def _extract_docx(file_path: str) -> str:
    try:
        document = docx.Document(file_path)
        return "\n".join(p.text for p in document.paragraphs)
    except Exception as e:
        raise ExtractionError(f"Failed to extract DOCX text: {e}") from e


def _extract_plain(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="strict") as f:
            return f.read()
    except Exception as e:
        raise ExtractionError(f"Failed to read text file: {e}") from e
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_extraction.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/__init__.py backend/app/services/extraction.py backend/tests/test_extraction.py
git commit -m "feat: add PDF/DOCX/TXT/MD text extraction service"
```

---

## Task 7: Chunking Service

**Files:**
- Create: `backend/app/services/chunking.py`
- Create: `backend/tests/test_chunking.py`

**Interfaces:**
- Produces: `chunk_text(text: str, chunk_size_words: int = 600, overlap_words: int = 100) -> list[str]` — used by Task 11.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_chunking.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_chunking.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.chunking` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/chunking.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_chunking.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/chunking.py backend/tests/test_chunking.py
git commit -m "feat: add word-based text chunking service with overlap"
```

---

## Task 8: Embeddings Service

**Files:**
- Create: `backend/app/services/embeddings.py`
- Create: `backend/tests/test_embeddings.py`

**Interfaces:**
- Consumes: `app.config.settings.EMBEDDING_MODEL_NAME` (Task 1).
- Produces: `embed_texts(texts: list[str]) -> list[list[float]]` (each inner list has 384 floats) — used by Tasks 11, 14.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_embeddings.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_embeddings.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.embeddings` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/embeddings.py`**

```python
from sentence_transformers import SentenceTransformer

from app.config import settings

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_embeddings.py -v
```

Expected: all 3 tests PASS. (First run downloads the `all-MiniLM-L6-v2` model, ~80MB — needs internet access once.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/embeddings.py backend/tests/test_embeddings.py
git commit -m "feat: add local sentence-transformers embedding service"
```

---

## Task 9: Groq Client Service

**Files:**
- Create: `backend/app/services/groq_client.py`
- Create: `backend/tests/test_groq_client.py`

**Interfaces:**
- Consumes: `app.config.settings.GROQ_API_KEY`, `settings.GROQ_MODEL` (Task 1).
- Produces: `GroqError(Exception)`, `call_groq(messages: list[dict], model: str | None = None) -> str` (retries up to 3 times on 429/500/502/503, raises `GroqError` on non-retryable errors or exhaustion) — used by Tasks 10, 11, 14.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_groq_client.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_groq_client.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.groq_client` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/groq_client.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_groq_client.py -v
```

Expected: all 4 tests PASS. (If `APIStatusError`'s constructor signature differs from the installed `groq` package version, adjust the test helper `_status_error` to match — check with `python -c "import groq; help(groq.APIStatusError)"`.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/groq_client.py backend/tests/test_groq_client.py
git commit -m "feat: add Groq API client with retry on rate limits"
```

---

## Task 10: Summarization Service

**Files:**
- Create: `backend/app/services/summarization.py`
- Create: `backend/tests/test_summarization.py`

**Interfaces:**
- Consumes: `call_groq` (Task 9).
- Produces: `summarize_document(chunks: list[str]) -> str` (direct summary for ≤4 chunks, map-reduce for more, `""` for no chunks) — used by Task 11.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_summarization.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_summarization.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.summarization` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/summarization.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_summarization.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/summarization.py backend/tests/test_summarization.py
git commit -m "feat: add map-reduce document summarization service"
```

---

## Task 11: Document Pipeline Orchestration

**Files:**
- Create: `backend/app/services/document_pipeline.py`
- Create: `backend/tests/test_document_pipeline.py`

**Interfaces:**
- Consumes: `extract_text`, `ExtractionError` (Task 6), `chunk_text` (Task 7), `embed_texts` (Task 8), `summarize_document` (Task 10), `GroqError` (Task 9), `app.database.SessionLocal`, `app.models.Document`, `app.models.Chunk` (Task 2).
- Produces: `process_document(document_id: str) -> None` — opens its own DB session, extracts/chunks/embeds/summarizes, sets `Document.status` to `"ready"` or `"failed"` with `error_message` set on failure. Used by Task 12 (called from the upload route via a background task).

- [ ] **Step 1: Write the failing tests — `backend/tests/test_document_pipeline.py`**

```python
from unittest.mock import patch

from sqlalchemy import text

from app.database import SessionLocal
from app.models import Chunk, Document, Space, User
from app.services.document_pipeline import process_document


def _cleanup(session):
    session.execute(text("DELETE FROM chunks"))
    session.execute(text("DELETE FROM documents"))
    session.execute(text("DELETE FROM spaces"))
    session.execute(text("DELETE FROM users"))
    session.commit()


def _make_space_and_document(session, tmp_path, filename, file_type, content):
    user = User(email=f"pipeline-{filename}@test.com", password_hash="x")
    session.add(user)
    session.commit()

    space = Space(user_id=user.id, name="Pipeline space")
    session.add(space)
    session.commit()

    file_path = tmp_path / filename
    file_path.write_text(content)

    document = Document(space_id=space.id, filename=filename, file_path=str(file_path), file_type=file_type)
    session.add(document)
    session.commit()
    return document


def test_process_document_marks_ready_and_stores_chunks_and_summary(tmp_path):
    session = SessionLocal()
    try:
        document = _make_space_and_document(session, tmp_path, "notes.txt", "txt", "The quick brown fox jumps over the lazy dog.")

        with patch("app.services.document_pipeline.summarize_document", return_value="A fox jumps over a dog."):
            process_document(str(document.id))

        session.expire_all()
        refreshed = session.get(Document, document.id)
        assert refreshed.status == "ready"
        assert refreshed.summary == "A fox jumps over a dog."

        chunks = session.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 1
        assert chunks[0].content == "The quick brown fox jumps over the lazy dog."
    finally:
        _cleanup(session)
        session.close()


def test_process_document_marks_failed_when_extraction_fails(tmp_path):
    session = SessionLocal()
    try:
        document = _make_space_and_document(session, tmp_path, "corrupt.pdf", "pdf", "not a real pdf")

        process_document(str(document.id))

        session.expire_all()
        refreshed = session.get(Document, document.id)
        assert refreshed.status == "failed"
        assert refreshed.error_message is not None

        chunks = session.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 0
    finally:
        _cleanup(session)
        session.close()


def test_process_document_keeps_chunks_and_status_ready_when_summarization_fails(tmp_path):
    from app.services.groq_client import GroqError

    session = SessionLocal()
    try:
        document = _make_space_and_document(session, tmp_path, "notes2.txt", "txt", "Some content for the document.")

        with patch("app.services.document_pipeline.summarize_document", side_effect=GroqError("down")):
            process_document(str(document.id))

        session.expire_all()
        refreshed = session.get(Document, document.id)
        assert refreshed.status == "ready"
        assert refreshed.summary is None

        chunks = session.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 1
    finally:
        _cleanup(session)
        session.close()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_document_pipeline.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.document_pipeline` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/document_pipeline.py`**

```python
from app.database import SessionLocal
from app.models import Chunk, Document
from app.services.chunking import chunk_text
from app.services.embeddings import embed_texts
from app.services.extraction import ExtractionError, extract_text
from app.services.groq_client import GroqError
from app.services.summarization import summarize_document


def process_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            return

        try:
            text = extract_text(document.file_path, document.file_type)
        except ExtractionError as e:
            document.status = "failed"
            document.error_message = str(e)
            db.commit()
            return

        chunks_text = chunk_text(text)
        embeddings = embed_texts(chunks_text)
        for index, (content, embedding) in enumerate(zip(chunks_text, embeddings)):
            db.add(Chunk(document_id=document.id, content=content, embedding=embedding, chunk_index=index))

        try:
            document.summary = summarize_document(chunks_text)
        except GroqError:
            document.summary = None

        document.status = "ready"
        db.commit()
    finally:
        db.close()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_document_pipeline.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/document_pipeline.py backend/tests/test_document_pipeline.py
git commit -m "feat: add document processing pipeline orchestration"
```

---

## Task 12: Document Upload Route

**Files:**
- Create: `backend/app/routers/documents.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_documents_routes.py`

**Interfaces:**
- Consumes: `get_current_user` (Task 3), `_get_owned_space` (Task 5), `process_document` (Task 11), `app.models.Document`, `DocumentResponse` (Tasks 2, 4), `settings.UPLOAD_DIR`, `settings.MAX_UPLOAD_SIZE_BYTES` (Task 1).
- Produces: routes `POST /spaces/{space_id}/documents` (multipart upload), `GET /spaces/{space_id}/documents` (list) — used by frontend Task 18.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_documents_routes.py`**

```python
from unittest.mock import patch

from app.database import get_db
from app.main import app


def _signup_and_create_space(client, email="docs@test.com"):
    token = client.post("/auth/signup", json={"email": email, "password": "secret123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    space = client.post("/spaces", json={"name": "Docs space"}, headers=headers).json()
    return headers, space["id"]


def test_upload_document_requires_auth(client):
    response = client.post("/spaces/some-id/documents", files={"file": ("a.txt", b"hello", "text/plain")})
    assert response.status_code == 401


def test_upload_document_rejects_an_unsupported_file_type(client):
    headers, space_id = _signup_and_create_space(client)
    response = client.post(
        f"/spaces/{space_id}/documents",
        files={"file": ("a.exe", b"hello", "application/octet-stream")},
        headers=headers,
    )
    assert response.status_code == 400


def test_upload_document_rejects_a_file_over_the_size_limit(client):
    headers, space_id = _signup_and_create_space(client)
    with patch("app.routers.documents.settings.MAX_UPLOAD_SIZE_BYTES", 10):
        response = client.post(
            f"/spaces/{space_id}/documents",
            files={"file": ("a.txt", b"this is more than ten bytes", "text/plain")},
            headers=headers,
        )
    assert response.status_code == 413


def test_upload_document_creates_a_processing_document_and_schedules_processing(client):
    headers, space_id = _signup_and_create_space(client)
    with patch("app.routers.documents.process_document") as mock_process:
        response = client.post(
            f"/spaces/{space_id}/documents",
            files={"file": ("a.txt", b"hello world", "text/plain")},
            headers=headers,
        )
    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "a.txt"
    assert body["status"] == "processing"
    mock_process.assert_called_once_with(body["id"])


def test_upload_document_rejects_uploading_to_a_space_you_do_not_own(client):
    headers_a, space_id = _signup_and_create_space(client, "owner@test.com")
    headers_b, _ = _signup_and_create_space(client, "other@test.com")
    response = client.post(
        f"/spaces/{space_id}/documents",
        files={"file": ("a.txt", b"hello", "text/plain")},
        headers=headers_b,
    )
    assert response.status_code == 404


def test_list_documents_returns_uploaded_documents_for_the_space(client):
    headers, space_id = _signup_and_create_space(client)
    with patch("app.routers.documents.process_document"):
        client.post(
            f"/spaces/{space_id}/documents",
            files={"file": ("a.txt", b"hello", "text/plain")},
            headers=headers,
        )
    response = client.get(f"/spaces/{space_id}/documents", headers=headers)
    assert response.status_code == 200
    filenames = [d["filename"] for d in response.json()]
    assert "a.txt" in filenames
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_documents_routes.py -v
```

Expected: FAIL with 404 (no `/spaces/{space_id}/documents` route registered yet).

- [ ] **Step 3: Create `backend/app/routers/documents.py`**

```python
import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Document, User
from app.routers.spaces import _get_owned_space
from app.schemas import DocumentResponse
from app.services.document_pipeline import process_document

router = APIRouter(prefix="/spaces/{space_id}/documents", tags=["documents"])

ALLOWED_TYPES = {"pdf": "pdf", "docx": "docx", "txt": "txt", "md": "md"}


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    space_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    space = _get_owned_space(db, user, space_id)

    extension = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if extension not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    content = file.file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    space_dir = os.path.join(settings.UPLOAD_DIR, str(space.id))
    os.makedirs(space_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(space_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(content)

    document = Document(
        space_id=space.id,
        filename=file.filename,
        file_path=file_path,
        file_type=ALLOWED_TYPES[extension],
        status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    background_tasks.add_task(process_document, str(document.id))
    return document


@router.get("", response_model=list[DocumentResponse])
def list_documents(space_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    space = _get_owned_space(db, user, space_id)
    return sorted(space.documents, key=lambda d: d.uploaded_at, reverse=True)
```

- [ ] **Step 4: Modify `backend/app/main.py`** to register the router

```python
from fastapi import FastAPI

from app.database import init_db
from app.routers import auth, documents, spaces

app = FastAPI(title="MindSpace")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(spaces.router)
app.include_router(documents.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_documents_routes.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/documents.py backend/app/main.py backend/tests/test_documents_routes.py
git commit -m "feat: add document upload and listing routes"
```

---

## Task 13: Retrieval Service

**Files:**
- Create: `backend/app/services/retrieval.py`
- Create: `backend/tests/test_retrieval.py`

**Interfaces:**
- Consumes: `app.models.Chunk`, `app.models.Document` (Task 2), `embed_texts` (Task 8).
- Produces: `retrieve_relevant_chunks(db: Session, space_id, question_embedding: list[float], k: int = 5) -> list[dict]` — each dict has keys `chunk`, `document`, `distance`; results are scoped to the given space and filtered to `distance <= 0.6`. Used by Task 14.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_retrieval.py`**

```python
from sqlalchemy import text

from app.database import SessionLocal
from app.models import Chunk, Document, Space, User
from app.services.embeddings import embed_texts
from app.services.retrieval import retrieve_relevant_chunks


def _cleanup(session):
    session.execute(text("DELETE FROM chunks"))
    session.execute(text("DELETE FROM documents"))
    session.execute(text("DELETE FROM spaces"))
    session.execute(text("DELETE FROM users"))
    session.commit()


def test_retrieve_relevant_chunks_only_returns_chunks_from_the_target_space():
    session = SessionLocal()
    try:
        user = User(email="retrieval@test.com", password_hash="x")
        session.add(user)
        session.commit()

        space_fruit = Space(user_id=user.id, name="Fruit space")
        space_physics = Space(user_id=user.id, name="Physics space")
        session.add_all([space_fruit, space_physics])
        session.commit()

        doc_fruit = Document(space_id=space_fruit.id, filename="fruit.txt", file_path="/tmp/fruit.txt", file_type="txt", status="ready")
        doc_physics = Document(space_id=space_physics.id, filename="physics.txt", file_path="/tmp/physics.txt", file_type="txt", status="ready")
        session.add_all([doc_fruit, doc_physics])
        session.commit()

        fruit_text = "Apples and bananas are delicious fruit for a smoothie."
        physics_text = "Quantum mechanics describes the behavior of subatomic particles."
        fruit_embedding, physics_embedding = embed_texts([fruit_text, physics_text])

        session.add(Chunk(document_id=doc_fruit.id, content=fruit_text, embedding=fruit_embedding, chunk_index=0))
        session.add(Chunk(document_id=doc_physics.id, content=physics_text, embedding=physics_embedding, chunk_index=0))
        session.commit()

        query_embedding = embed_texts(["What fruit is good in a smoothie?"])[0]
        results = retrieve_relevant_chunks(session, space_fruit.id, query_embedding)

        assert len(results) == 1
        assert results[0]["chunk"].content == fruit_text
        assert results[0]["document"].id == doc_fruit.id
    finally:
        _cleanup(session)
        session.close()


def test_retrieve_relevant_chunks_filters_out_irrelevant_chunks_by_distance_threshold():
    session = SessionLocal()
    try:
        user = User(email="retrieval2@test.com", password_hash="x")
        session.add(user)
        session.commit()

        space = Space(user_id=user.id, name="Mixed space")
        session.add(space)
        session.commit()

        document = Document(space_id=space.id, filename="mixed.txt", file_path="/tmp/mixed.txt", file_type="txt", status="ready")
        session.add(document)
        session.commit()

        unrelated_text = "The history of ancient Roman aqueduct engineering."
        embedding = embed_texts([unrelated_text])[0]
        session.add(Chunk(document_id=document.id, content=unrelated_text, embedding=embedding, chunk_index=0))
        session.commit()

        query_embedding = embed_texts(["What is your favorite pizza topping?"])[0]
        results = retrieve_relevant_chunks(session, space.id, query_embedding)

        assert results == []
    finally:
        _cleanup(session)
        session.close()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_retrieval.py -v
```

Expected: FAIL with `ModuleNotFoundError` (`app.services.retrieval` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/retrieval.py`**

```python
from sqlalchemy.orm import Session

from app.models import Chunk, Document

DEFAULT_K = 5
MAX_DISTANCE_THRESHOLD = 0.6


def retrieve_relevant_chunks(db: Session, space_id, question_embedding: list[float], k: int = DEFAULT_K) -> list[dict]:
    distance = Chunk.embedding.cosine_distance(question_embedding)
    rows = (
        db.query(Chunk, Document, distance.label("distance"))
        .join(Document, Chunk.document_id == Document.id)
        .filter(Document.space_id == space_id)
        .order_by(distance)
        .limit(k)
        .all()
    )
    return [
        {"chunk": chunk, "document": document, "distance": dist}
        for chunk, document, dist in rows
        if dist <= MAX_DISTANCE_THRESHOLD
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_retrieval.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/retrieval.py backend/tests/test_retrieval.py
git commit -m "feat: add pgvector-based chunk retrieval scoped to a space"
```

---

## Task 14: Q&A Service & Route

**Files:**
- Create: `backend/app/services/qa.py`
- Create: `backend/app/routers/qa.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_qa_routes.py`

**Interfaces:**
- Consumes: `embed_texts` (Task 8), `retrieve_relevant_chunks` (Task 13), `call_groq`, `GroqError` (Task 9), `_get_owned_space` (Task 5), `AskRequest`, `AskResponse`, `SourceSnippet` (Task 4), `app.models.Document`.
- Produces: `answer_question(db: Session, space_id, question: str) -> dict` (keys `answer`, `sources`), route `POST /spaces/{space_id}/ask` — used by frontend Task 18.

- [ ] **Step 1: Write the failing tests — `backend/tests/test_qa_routes.py`**

```python
from unittest.mock import patch

from app.database import SessionLocal
from app.models import Chunk, Document


def _signup_and_create_space(client, email="qa@test.com"):
    token = client.post("/auth/signup", json={"email": email, "password": "secret123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    space = client.post("/spaces", json={"name": "QA space"}, headers=headers).json()
    return headers, space["id"]


def test_ask_requires_auth(client):
    response = client.post("/spaces/some-id/ask", json={"question": "hi"})
    assert response.status_code == 401


def test_ask_rejects_asking_in_a_space_you_do_not_own(client):
    headers_a, space_id = _signup_and_create_space(client, "owner2@test.com")
    headers_b, _ = _signup_and_create_space(client, "other2@test.com")
    response = client.post(f"/spaces/{space_id}/ask", json={"question": "hi"}, headers=headers_b)
    assert response.status_code == 404


def test_ask_returns_a_canned_response_when_the_space_has_no_ready_documents(client):
    headers, space_id = _signup_and_create_space(client)
    response = client.post(f"/spaces/{space_id}/ask", json={"question": "hi"}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert "no processed documents" in body["answer"]
    assert body["sources"] == []


def test_ask_returns_an_answer_with_sources_when_relevant_chunks_exist(client, db_session):
    headers, space_id = _signup_and_create_space(client, "answering@test.com")

    from app.services.embeddings import embed_texts

    document = Document(space_id=space_id, filename="fruit.txt", file_path="/tmp/fruit.txt", file_type="txt", status="ready")
    db_session.add(document)
    db_session.commit()

    content = "Bananas and apples are great fruit for a smoothie."
    embedding = embed_texts([content])[0]
    db_session.add(Chunk(document_id=document.id, content=content, embedding=embedding, chunk_index=0))
    db_session.commit()

    with patch("app.services.qa.call_groq", return_value="Bananas and apples are good choices."):
        response = client.post(
            f"/spaces/{space_id}/ask",
            json={"question": "What fruit is good for a smoothie?"},
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Bananas and apples are good choices."
    assert len(body["sources"]) == 1
    assert body["sources"][0]["filename"] == "fruit.txt"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_qa_routes.py -v
```

Expected: FAIL with 404 (no `/spaces/{space_id}/ask` route registered yet).

- [ ] **Step 3: Create `backend/app/services/qa.py`**

```python
from sqlalchemy.orm import Session

from app.models import Document
from app.services.embeddings import embed_texts
from app.services.groq_client import GroqError, call_groq
from app.services.retrieval import retrieve_relevant_chunks

NO_DOCUMENTS_MESSAGE = (
    "This space has no processed documents yet. Upload a document and wait "
    "for it to finish processing before asking questions."
)
NO_RELEVANT_INFO_MESSAGE = (
    "I couldn't find relevant information in this space's documents to answer that question."
)
SERVICE_UNAVAILABLE_MESSAGE = (
    "I found relevant information but the AI service is temporarily unavailable. Please try again shortly."
)


def answer_question(db: Session, space_id, question: str) -> dict:
    has_ready_document = (
        db.query(Document).filter(Document.space_id == space_id, Document.status == "ready").first() is not None
    )
    if not has_ready_document:
        return {"answer": NO_DOCUMENTS_MESSAGE, "sources": []}

    question_embedding = embed_texts([question])[0]
    results = retrieve_relevant_chunks(db, space_id, question_embedding)
    if not results:
        return {"answer": NO_RELEVANT_INFO_MESSAGE, "sources": []}

    context = "\n\n".join(f"[Source: {r['document'].filename}]\n{r['chunk'].content}" for r in results)
    messages = [
        {
            "role": "system",
            "content": (
                "Answer the user's question using only the provided context. If the "
                "context doesn't contain the answer, say so. Cite which source "
                "documents you used."
            ),
        },
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
    ]

    try:
        answer = call_groq(messages)
    except GroqError:
        answer = SERVICE_UNAVAILABLE_MESSAGE

    sources = [
        {"document_id": r["document"].id, "filename": r["document"].filename, "snippet": r["chunk"].content[:200]}
        for r in results
    ]
    return {"answer": answer, "sources": sources}
```

- [ ] **Step 4: Create `backend/app/routers/qa.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.routers.spaces import _get_owned_space
from app.schemas import AskRequest, AskResponse
from app.services.qa import answer_question

router = APIRouter(prefix="/spaces/{space_id}/ask", tags=["qa"])


@router.post("", response_model=AskResponse)
def ask(space_id: str, payload: AskRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_owned_space(db, user, space_id)
    return answer_question(db, space_id, payload.question)
```

- [ ] **Step 5: Modify `backend/app/main.py`** to register the router

```python
from fastapi import FastAPI

from app.database import init_db
from app.routers import auth, documents, qa, spaces

app = FastAPI(title="MindSpace")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(spaces.router)
app.include_router(documents.router)
app.include_router(qa.router)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_qa_routes.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 7: Run the full backend test suite to check for regressions**

```bash
cd backend && pytest -v
```

Expected: all tests across all files PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/qa.py backend/app/routers/qa.py backend/app/main.py backend/tests/test_qa_routes.py
git commit -m "feat: add RAG-based Q&A service and route"
```

---

## Task 15: Frontend Scaffold & API Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: `getToken(): string | null`, `setToken(token: string): void`, `clearToken(): void`, `apiRequest<T>(path: string, options?: {method?: string, body?: unknown}): Promise<T>` — used by every later frontend API module (Tasks 16, 17, 18).
- Produces: TypeScript types `Space`, `Document`, `SourceSnippet`, `AskResponse` in `types.ts` — used by Tasks 16, 17, 18.

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "mindspace-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 4: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MindSpace</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `frontend/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: Create `frontend/src/types.ts`**

```ts
export interface Space {
  id: string
  name: string
  created_at: string
}

export interface Document {
  id: string
  filename: string
  file_type: string
  status: 'processing' | 'ready' | 'failed'
  summary: string | null
  error_message: string | null
  uploaded_at: string
}

export interface SourceSnippet {
  document_id: string
  filename: string
  snippet: string
}

export interface AskResponse {
  answer: string
  sources: SourceSnippet[]
}
```

- [ ] **Step 7: Write the failing test — `frontend/src/api/client.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, clearToken, setToken } from './client'

describe('apiRequest', () => {
  beforeEach(() => {
    clearToken()
    vi.restoreAllMocks()
  })

  it('attaches an Authorization header when a token is present', async () => {
    setToken('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/test')

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer abc123')
  })

  it('omits the Authorization header when no token is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/test')

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBeUndefined()
  })

  it('throws with the server-provided detail message on a failed request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Something went wrong' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/test')).rejects.toThrow('Something went wrong')
  })
})
```

- [ ] **Step 8: Install dependencies and run the test to verify it fails**

```bash
cd frontend && npm install && npm test
```

Expected: FAIL with a module-not-found error (`./client` does not exist yet).

- [ ] **Step 9: Create `frontend/src/api/client.ts`**

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'mindspace_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

interface RequestOptions {
  method?: string
  body?: unknown
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}
```

- [ ] **Step 10: Create `frontend/src/App.tsx`** (placeholder, filled in by later tasks)

```tsx
export function App() {
  return <div>MindSpace</div>
}
```

- [ ] **Step 11: Create `frontend/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 12: Run the test to verify it passes**

```bash
cd frontend && npm test
```

Expected: all 3 tests PASS.

- [ ] **Step 13: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src/
git commit -m "feat: scaffold frontend with typed API client"
```

---

## Task 16: Auth Context, Login & Signup Pages

**Files:**
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/context/AuthContext.test.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/SignupPage.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `apiRequest`, `getToken`, `clearToken` (Task 15).
- Produces: `AuthProvider` (React component), `useAuth(): {isAuthenticated: boolean, login, signup, logout}` — used by `ProtectedRoute`, `LoginPage`, `SignupPage`, and Tasks 17/18's pages.
- Produces: `ProtectedRoute` (React component using `<Outlet />`) — used by `App.tsx` routing.

- [ ] **Step 1: Add `@testing-library/dom` peer requirement and install** — modify `frontend/package.json` devDependencies to add `"@testing-library/dom": "^10.4.0"`, then:

```bash
cd frontend && npm install
```

- [ ] **Step 2: Create `frontend/src/api/auth.ts`**

```ts
import { apiRequest, setToken } from './client'

interface TokenResponse {
  access_token: string
}

export async function signup(email: string, password: string): Promise<void> {
  const data = await apiRequest<TokenResponse>('/auth/signup', {
    method: 'POST',
    body: { email, password },
  })
  setToken(data.access_token)
}

export async function login(email: string, password: string): Promise<void> {
  const data = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  setToken(data.access_token)
}
```

- [ ] **Step 3: Write the failing test — `frontend/src/context/AuthContext.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/auth'
import { clearToken } from '../api/client'
import { AuthProvider, useAuth } from './AuthContext'

function TestComponent() {
  const { isAuthenticated, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <button onClick={() => login('a@b.com', 'pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    clearToken()
  })

  it('starts unauthenticated, becomes authenticated after login, then unauthenticated after logout', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status').textContent).toBe('out')

    await act(async () => {
      screen.getByText('login').click()
    })
    expect(screen.getByTestId('status').textContent).toBe('in')

    act(() => {
      screen.getByText('logout').click()
    })
    expect(screen.getByTestId('status').textContent).toBe('out')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd frontend && npm test
```

Expected: FAIL with a module-not-found error (`./AuthContext` does not exist yet).

- [ ] **Step 5: Create `frontend/src/context/AuthContext.tsx`**

```tsx
import { createContext, ReactNode, useCallback, useContext, useState } from 'react'
import * as authApi from '../api/auth'
import { clearToken, getToken } from '../api/client'

interface AuthContextValue {
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken())

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password)
    setIsAuthenticated(true)
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    await authApi.signup(email, password)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, signup, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd frontend && npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Create `frontend/src/components/ProtectedRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
```

- [ ] **Step 8: Create `frontend/src/pages/LoginPage.tsx`**

```tsx
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate('/spaces')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Log in</h1>
      {error && <p role="alert">{error}</p>}
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Log in</button>
      <p>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 9: Create `frontend/src/pages/SignupPage.tsx`**

```tsx
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { signup } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signup(email, password)
      navigate('/spaces')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign up</h1>
      {error && <p role="alert">{error}</p>}
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Sign up</button>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 10: Modify `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/spaces" element={<div>Spaces (coming in Task 17)</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/spaces" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 11: Manually verify in the browser**

```bash
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev
```

Open `http://localhost:5173/signup`, sign up with a new email/password, confirm you're redirected to `/spaces` and see the placeholder text. Reload the page and confirm you stay on `/spaces` (not bounced to `/login`) since the token persists in `localStorage`. Stop both dev servers when done.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/context/ frontend/src/pages/LoginPage.tsx frontend/src/pages/SignupPage.tsx frontend/src/components/ProtectedRoute.tsx frontend/src/App.tsx frontend/package.json
git commit -m "feat: add auth context, protected routes, login and signup pages"
```

---

## Task 17: Spaces List Page

**Files:**
- Create: `frontend/src/api/spaces.ts`
- Create: `frontend/src/pages/SpacesListPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `apiRequest` (Task 15), `Space` type (Task 15).
- Produces: `listSpaces(): Promise<Space[]>`, `createSpace(name: string): Promise<Space>`, `deleteSpace(id: string): Promise<void>` — used by Task 18's navigation and reused pattern.

- [ ] **Step 1: Create `frontend/src/api/spaces.ts`**

```ts
import { apiRequest } from './client'
import type { Space } from '../types'

export function listSpaces(): Promise<Space[]> {
  return apiRequest<Space[]>('/spaces')
}

export function createSpace(name: string): Promise<Space> {
  return apiRequest<Space>('/spaces', { method: 'POST', body: { name } })
}

export function deleteSpace(id: string): Promise<void> {
  return apiRequest<void>(`/spaces/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 2: Create `frontend/src/pages/SpacesListPage.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSpace, deleteSpace, listSpaces } from '../api/spaces'
import type { Space } from '../types'

export function SpacesListPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setSpaces(await listSpaces())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spaces')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createSpace(name.trim())
    setName('')
    refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this space and all its documents?')) return
    await deleteSpace(id)
    refresh()
  }

  return (
    <div>
      <h1>Your Spaces</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleCreate}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New space name" />
        <button type="submit">Create</button>
      </form>
      <ul>
        {spaces.map((space) => (
          <li key={space.id}>
            <Link to={`/spaces/${space.id}`}>{space.name}</Link>
            <button onClick={() => handleDelete(space.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Modify `frontend/src/App.tsx`** to use the real page

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SpacesListPage } from './pages/SpacesListPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/spaces" element={<SpacesListPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/spaces" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 4: Manually verify in the browser**

```bash
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev
```

Log in with the account created in Task 16. On `/spaces`, create a space named "Test Space", confirm it appears in the list. Click delete, confirm the dialog, confirm it disappears from the list. Stop both dev servers when done.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/spaces.ts frontend/src/pages/SpacesListPage.tsx frontend/src/App.tsx
git commit -m "feat: add spaces list page with create and delete"
```

---

## Task 18: Space Detail Page (Documents, Upload, Q&A)

**Files:**
- Create: `frontend/src/api/documents.ts`
- Create: `frontend/src/api/qa.ts`
- Create: `frontend/src/pages/SpaceDetailPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `getToken` (Task 15), `Document`, `AskResponse` types (Task 15).
- Produces: `listDocuments(spaceId): Promise<Document[]>`, `uploadDocument(spaceId, file): Promise<Document>`, `askQuestion(spaceId, question): Promise<AskResponse>`.

- [ ] **Step 1: Create `frontend/src/api/documents.ts`**

```ts
import { getToken } from './client'
import type { Document } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function listDocuments(spaceId: string): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/spaces/${spaceId}/documents`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!response.ok) {
    throw new Error('Failed to load documents')
  }
  return response.json()
}

export async function uploadDocument(spaceId: string, file: File): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/spaces/${spaceId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || 'Upload failed')
  }
  return response.json()
}
```

- [ ] **Step 2: Create `frontend/src/api/qa.ts`**

```ts
import { apiRequest } from './client'
import type { AskResponse } from '../types'

export function askQuestion(spaceId: string, question: string): Promise<AskResponse> {
  return apiRequest<AskResponse>(`/spaces/${spaceId}/ask`, {
    method: 'POST',
    body: { question },
  })
}
```

- [ ] **Step 3: Create `frontend/src/pages/SpaceDetailPage.tsx`**

```tsx
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listDocuments, uploadDocument } from '../api/documents'
import { askQuestion } from '../api/qa'
import type { AskResponse, Document } from '../types'

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskResponse | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const refreshDocuments = useCallback(async () => {
    if (!spaceId) return
    setDocuments(await listDocuments(spaceId))
  }, [spaceId])

  useEffect(() => {
    refreshDocuments()
  }, [refreshDocuments])

  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(refreshDocuments, 3000)
    return () => clearInterval(interval)
  }, [documents, refreshDocuments])

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !spaceId) return
    setUploadError(null)
    try {
      await uploadDocument(spaceId, file)
      refreshDocuments()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    }
    e.target.value = ''
  }

  async function handleAsk(e: FormEvent) {
    e.preventDefault()
    if (!question.trim() || !spaceId) return
    setAsking(true)
    setAskError(null)
    try {
      setAnswer(await askQuestion(spaceId, question.trim()))
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Failed to get an answer')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div>
      <h1>Documents</h1>
      {uploadError && <p role="alert">{uploadError}</p>}
      <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleUpload} />
      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>
            <strong>{doc.filename}</strong> — {doc.status}
            {doc.status === 'ready' && doc.summary && <p>{doc.summary}</p>}
            {doc.status === 'failed' && <p role="alert">{doc.error_message}</p>}
          </li>
        ))}
      </ul>

      <h1>Ask a question</h1>
      <form onSubmit={handleAsk}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about these documents..."
        />
        <button type="submit" disabled={asking}>
          {asking ? 'Asking...' : 'Ask'}
        </button>
      </form>
      {askError && <p role="alert">{askError}</p>}
      {answer && (
        <div>
          <p>{answer.answer}</p>
          <ul>
            {answer.sources.map((s, i) => (
              <li key={i}>
                <em>{s.filename}</em>: {s.snippet}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Modify `frontend/src/App.tsx`** to add the route

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SpaceDetailPage } from './pages/SpaceDetailPage'
import { SpacesListPage } from './pages/SpacesListPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/spaces" element={<SpacesListPage />} />
            <Route path="/spaces/:spaceId" element={<SpaceDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/spaces" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 5: Manually verify the full flow in the browser**

```bash
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev
```

Log in, open a space, upload a small `.txt` file with a few sentences of real content. Watch the status go from "processing" to "ready" (polling every 3s) and confirm a summary appears. Ask a question whose answer is in the file's content, confirm an answer with a source citation appears. Then ask an unrelated question and confirm the "couldn't find relevant information" response. Stop both dev servers when done.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/documents.ts frontend/src/api/qa.ts frontend/src/pages/SpaceDetailPage.tsx frontend/src/App.tsx
git commit -m "feat: add space detail page with document upload, status polling, and Q&A"
```

---

## Task 19: Dockerize & Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Modify: `docker-compose.yml`
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Consumes: everything built in Tasks 1–18.
- Produces: a runnable self-hosted deployment via `docker compose up --build`.

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `frontend/nginx.conf`**

```
server {
    listen 80;

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 3: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: Modify `docker-compose.yml`** to the full production topology

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: mindspace
      POSTGRES_PASSWORD: mindspace
      POSTGRES_DB: mindspace
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+psycopg2://mindspace:mindspace@postgres:5432/mindspace
      JWT_SECRET: ${JWT_SECRET}
      GROQ_API_KEY: ${GROQ_API_KEY}
      UPLOAD_DIR: /data/uploads
    volumes:
      - uploads:/data/uploads
    depends_on:
      - postgres

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: /api
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  pgdata:
  uploads:
```

- [ ] **Step 5: Create `.env.example`** (repo root, used by `docker compose`)

```
JWT_SECRET=change-me-to-a-long-random-string
GROQ_API_KEY=your-groq-api-key-here
```

- [ ] **Step 6: Create `README.md`**

```markdown
# MindSpace

Upload PDF/DOCX/TXT/MD documents into named spaces, get auto-generated
summaries, and ask questions answered from your documents' content.

## Run it

1. Get a free API key at https://console.groq.com
2. `cp .env.example .env` and fill in `JWT_SECRET` (any long random string) and `GROQ_API_KEY`
3. `docker compose up --build -d`
4. Visit http://localhost, sign up, create a space, and upload a document

## Local development (without Docker)

Backend:

```bash
cd backend
cp .env.example .env  # fill in GROQ_API_KEY
docker compose up -d postgres
docker compose exec postgres psql -U mindspace -d mindspace -c "CREATE DATABASE mindspace_test;"
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
```

- [ ] **Step 7: Build and run the full stack**

```bash
cp .env.example .env
# edit .env with a real JWT_SECRET and GROQ_API_KEY
docker compose up --build -d
```

Expected: three containers (`postgres`, `backend`, `frontend`) reach a running state (`docker compose ps`).

- [ ] **Step 8: Verify the health endpoint through the frontend's nginx proxy**

```bash
curl -s http://localhost/api/health
```

Expected: `{"status":"ok"}`.

- [ ] **Step 9: Manually verify the end-to-end flow in a browser**

Open `http://localhost`. Sign up, create a space, upload a small text file, wait for it to reach "ready" with a summary, ask a question about its content, and confirm you get an answer with a source citation.

- [ ] **Step 10: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf docker-compose.yml .env.example README.md
git commit -m "feat: dockerize backend and frontend for self-hosted deployment"
```
