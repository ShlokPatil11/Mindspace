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
