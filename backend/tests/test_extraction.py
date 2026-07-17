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
