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
