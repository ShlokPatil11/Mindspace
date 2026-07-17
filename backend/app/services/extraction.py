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
