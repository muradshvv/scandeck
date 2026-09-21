import base64
import io
import os
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from typing import Annotated, Literal

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, Field, field_validator

from . import corner_model, detector, ocr, pdf_export, scanner

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"
OUTPUT_DIR = BASE_DIR / "storage" / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
SESSION_TTL_SECONDS = 60 * 60  # 1 hour

app = FastAPI(title="Document Scanner")

_extra_origins = [o.strip() for o in os.environ.get("SCANNER_ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001", "http://127.0.0.1:8001", *_extra_origins],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _open_browser():
    if os.environ.get("SCANNER_NO_BROWSER") == "1":
        return
    url = f"http://127.0.0.1:{os.environ.get('SCANNER_PORT', '8001')}"
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()

# id -> {"path": Path, "created": float}
_sessions = {}
_sessions_lock = threading.Lock()


def _cleanup_expired():
    now = time.time()
    with _sessions_lock:
        expired = [sid for sid, meta in _sessions.items() if now - meta["created"] > SESSION_TTL_SECONDS]
        expired_meta = [_sessions.pop(sid) for sid in expired]

    for meta in expired_meta:
        meta["path"].unlink(missing_ok=True)

    # also sweep by mtime in case a restart wiped the in-memory session dict
    cutoff = now - SESSION_TTL_SECONDS
    for directory in (UPLOAD_DIR, OUTPUT_DIR):
        for path in directory.iterdir():
            try:
                if path.is_file() and path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                continue



def _write_image(path, image):
    if not cv2.imwrite(str(path), image):
        raise HTTPException(500, "Failed to save image")




def _encode_image_b64(image, ext=".jpg"):
    ok, buf = cv2.imencode(ext, image, [cv2.IMWRITE_JPEG_QUALITY, 92] if ext == ".jpg" else [])
    if not ok:
        raise HTTPException(500, "Failed to encode image")
    mime = "image/jpeg" if ext == ".jpg" else "image/png"
    return f"data:{mime};base64,{base64.b64encode(buf).decode('ascii')}"

@app.get("/api/health")
async def health():
    return {"status": "ok"}


class ProcessRequest(BaseModel):
    id: str
    corners: Annotated[list[tuple[float, float]], Field(min_length=4, max_length=4)]
    mode: Literal["color", "gray", "bw"] = "color"
    upscale: bool = False
    rotation_steps: int = 0

    @field_validator("corners")
    @classmethod
    def corners_must_be_finite(cls, corners):
        if not np.isfinite(np.asarray(corners, dtype=np.float32)).all():
            raise ValueError("Corner coordinates must be finite numbers")
        return corners

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    _cleanup_expired()

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 20MB)")

    arr = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image. Please upload a JPG or PNG.")

    h, w = image.shape[:2]
    max_dim = 3000
    if max(h, w) > max_dim:
        scale = max_dim/max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = image.shape[:2]

    session_id = uuid.uuid4().hex
    path = UPLOAD_DIR / f"{session_id}.png"
    _write_image(path, image)
    with _sessions_lock:
        _sessions[session_id] = {"path": path, "created": time.time()}

    corners = detector.detect_corners(image)
    if corners is None:
        corners = scanner.detect_document_corners(image)
    if corners is None:
        corners = corner_model.detect_corners_ml(image)
    if corners is None:
        corners = scanner.full_image_corners(image)

    return {
        "id": session_id,
        "width": w,
        "height": h,
        "corners": corners.tolist(),
        "preview": _encode_image_b64(image),
    }



@app.post("/api/process")
async def process_image(req: ProcessRequest):
    _cleanup_expired()

    with _sessions_lock:
        meta = _sessions.get(req.id)
    if meta is None or not meta["path"].exists():
        raise HTTPException(404, "Session expired or not found. Please re-upload the image.")

    image = cv2.imread(str(meta["path"]))
    if image is None:
        raise HTTPException(500, "Failed to load stored image.")

    image = scanner.rotate_image_steps(image, req.rotation_steps)

    h, w = image.shape[:2]
    corners = np.array(req.corners, dtype="float32")
    if np.any(corners[:, 0] < -1) or np.any(corners[:, 0] > w + 1) or \
       np.any(corners[:, 1] < -1) or np.any(corners[:, 1] > h + 1):
        raise HTTPException(400, "Corners must lie within the image bounds.")

    ordered = scanner.order_points(corners)
    pairwise = np.linalg.norm(ordered[:, None, :] - ordered[None, :, :], axis=2)
    pairwise += np.eye(4, dtype=np.float32) * max(h, w)
    area = abs(cv2.contourArea(ordered))
    if pairwise.min() < 2 or area < max(25.0, h * w * 0.00001) or not cv2.isContourConvex(ordered):
        raise HTTPException(400, "Corners must form a non-degenerate convex quadrilateral.")

    warped = scanner.warp_document(image, corners)
    result = scanner.enhance(warped, mode=req.mode)
    if req.upscale:
        result = scanner.upscale_to_hd(result)

    ext = ".png" if req.mode == "bw" else ".jpg"
    out_path = OUTPUT_DIR / f"{req.id}{ext}"
    _write_image(out_path, result)

    return {
        "id": req.id,
        "result": _encode_image_b64(result, ext=ext),
        "download_url": f"/api/download/{req.id}?ext={ext.lstrip('.')}",
    }


def _find_source_image_path(session_id):
    for ext in (".jpg", ".png"):
        path = OUTPUT_DIR / f"{session_id}{ext}"
        if path.exists():
            return path
    return None


@app.get("/api/download/{session_id}")
async def download(session_id: str, ext: str = "jpg", variant: str = "flattened"):
    _cleanup_expired()
    if ext not in ("jpg", "png", "pdf"):
        raise HTTPException(400, "ext must be one of: jpg, png, pdf")
    if variant not in ("flattened", "searchable"):
        raise HTTPException(400, "variant must be one of: flattened, searchable")

    if ext == "pdf":
        src = _find_source_image_path(session_id)
        if src is None:
            raise HTTPException(404, "Result not found. Process the image first.")

        if variant == "searchable":
            if not ocr.is_available():
                raise HTTPException(
                    503,
                    "Searchable PDF requires the OCR dependency (see requirements-ocr.txt); "
                    "it isn't installed.",
                )
            image = cv2.imread(str(src))
            ocr_result = ocr.extract_text(image)
            pdf_bytes = pdf_export.build_searchable_pdf(src, ocr_result)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": 'attachment; filename="scanned_document.pdf"'},
            )

        buf = io.BytesIO()
        Image.open(src).convert("RGB").save(buf, "PDF")
        return Response(
            content=buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="scanned_document.pdf"'},
        )

    path = OUTPUT_DIR / f"{session_id}.{ext}"
    if not path.exists():
        raise HTTPException(404, "Result not found. Process the image first.")
    return FileResponse(path, filename=f"scanned_document.{ext}")


@app.get("/api/ocr/{session_id}")
async def get_ocr(session_id: str):
    _cleanup_expired()
    src = _find_source_image_path(session_id)
    if src is None:
        raise HTTPException(404, "Result not found. Process the image first.")
    if not ocr.is_available():
        raise HTTPException(
            503, "OCR requires the optional dependency in requirements-ocr.txt; it isn't installed."
        )
    image = cv2.imread(str(src))
    result = ocr.extract_text(image)
    return {"text": result["text"], "confidence": result["confidence"], "word_count": len(result["words"])}

@app.get("/api/storage")
async def get_storage_usage():
    total_bytes = 0
    for directory in (UPLOAD_DIR, OUTPUT_DIR):
        for path in directory.rglob("*"):
            if path.is_file():
                total_bytes += path.stat().st_size
    return {"bytes": total_bytes}


@app.post("/api/export")
async def export_image(file: UploadFile = File(...), ext: str = "pdf", variant: str = "flattened"):
    if ext != "pdf":
        raise HTTPException(400, "ext must be pdf")
    if variant not in ("flattened", "searchable"):
        raise HTTPException(400, "variant must be one of: flattened, searchable")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 20MB)")

    arr = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image.")

    tmp_path = UPLOAD_DIR / f"export_{uuid.uuid4().hex}.png"
    try:
        _write_image(tmp_path, image)

        if variant == "searchable":
            if not ocr.is_available():
                raise HTTPException(
                    503,
                    "Searchable PDF requires the OCR dependency (see requirements-ocr.txt); "
                    "it isn't installed.",
                )
            ocr_result = ocr.extract_text(image)
            pdf_bytes = pdf_export.build_searchable_pdf(tmp_path, ocr_result)
        else:
            buf = io.BytesIO()
            Image.open(tmp_path).convert("RGB").save(buf, "PDF")
            pdf_bytes = buf.getvalue()
    finally:
        tmp_path.unlink(missing_ok=True)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="scanned_document.pdf"'},
    )


@app.get("/")
async def root():
    return {"status": "ok", "info": "API only - the frontend runs separately (frontend/, npm run dev)"}
