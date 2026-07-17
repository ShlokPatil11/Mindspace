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
