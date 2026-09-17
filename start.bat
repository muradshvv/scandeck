@echo off
REM Launches the backend (FastAPI/uvicorn) and frontend (Vite) dev servers together.
REM Run this from the project root after completing the setup steps in README.md.

start "Document Scanner - backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --host 127.0.0.1 --port 8001"
start "Document Scanner - frontend" cmd /k "cd frontend && npm run dev"
