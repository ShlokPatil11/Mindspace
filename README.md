# MindSpace

Upload PDF/DOCX/TXT/MD documents into named spaces, get auto-generated
summaries, and ask questions answered from your documents' content.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full code walkthrough — every
backend module, every frontend file, the complete API reference, and
sequence diagrams for signup, document processing, and Q&A.

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
