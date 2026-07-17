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
