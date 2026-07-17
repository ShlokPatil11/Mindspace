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
