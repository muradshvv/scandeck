# Document Scanner

Upload a photo of a document and get a cropped, deskewed, enhanced scan back
(color, grayscale, or black & white). Corners are auto-detected; there's a
quick confirm/edit step before processing.

## Architecture

```mermaid
%%{init: {'themeVariables': {'fontSize': '22px'}}}%%
flowchart LR
    Client["Frontend\n(React + Vite)"]
    Server["Backend\n(FastAPI)"]
    Corners["Corner detection\n(ML, with classical\nCV fallback)"]
    Process["Warp, enhance,\noptional HD upscale"]
    OCR["OCR + searchable PDF\n(optional)"]
    Storage[("Storage")]

    Client -- "upload photo" --> Server
    Server --> Corners -- "4 corners" --> Client
    Client -- "confirm/edit" --> Process
    Process --> Storage --> Client
    Client -- "on demand" --> OCR
```

Full detail (every module and endpoint) is in the code and the sections below; this is the high-level shape.

## Requirements

- **Python 3.11+** (backend)
- **Node.js 20+** and npm (frontend)
- Windows (`start.bat` uses `cmd`); on macOS/Linux run the two `Then, from the
  project root` commands below manually instead.

## Running locally

### 1. Backend setup

```powershell
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

Optional extras (install if you want the Ultra HD upscaler / MobileNetV2
fallback detector, and/or OCR + searchable PDF export):

```powershell
venv\Scripts\pip install -r requirements-ml.txt
venv\Scripts\pip install -r requirements-ocr.txt
```

### 2. Frontend setup

```powershell
cd ..\frontend
npm install
```

### 3. Run both together

From the project root:

```cmd
start.bat
```

This opens two terminal windows: the backend on `127.0.0.1:8001`
(`uvicorn app.main:app`) and the frontend dev server on `localhost:5173`. The
backend also auto-opens `http://127.0.0.1:8001` in your browser on startup
(set `SCANNER_NO_BROWSER=1` to disable).

Or run them individually, each from its own directory:

```powershell
# backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8001

# frontend (separate terminal)
cd frontend
npm run dev
```

Then open `http://localhost:5173` in a browser.

### 4. Production build (frontend)

```powershell
cd frontend
npm run build
```

Outputs static assets to `frontend/dist/`. The FastAPI backend is API-only
(see `GET /` below) and is not set up to serve this build directly — it must
be served separately (e.g. `npm run preview`, or any static file host) with
`VITE`-configured requests pointed at the backend's URL.

## How it works

1. `POST /api/upload` - decodes the image, runs the corner-detection chain.
2. User confirms or adjusts the corners in the frontend.
3. `POST /api/process` - warps to a flat rectangle, applies the selected
   style, optionally upscales. Returns the result and a download link.
4. `GET /api/download/{id}` - serves the file (image, standard PDF, or
   searchable PDF).

Uploads and processed files live under `backend/storage/` and expire after an
hour. Completed scans also get a permanent history entry until deleted.
Nothing leaves localhost.

## Ultra HD upscale

`scanner.upscale_to_hd` (in `backend/app/scanner.py`) upscales the result to
up to 3840px on the long edge using a Lanczos resize followed by an
edge-preserving denoise and a small-radius unsharp mask tuned to character
stroke width. Off by default.

## OCR & searchable PDF

`backend/app/ocr.py` runs EasyOCR on demand via `GET /api/ocr/{id}`, 
returning extracted text and per-word confidence.
`backend/app/pdf_export.py` builds the searchable PDF variant - the scan
image with an invisible text layer positioned from the OCR word boxes.

Both are optional (`requirements-ocr.txt`); without it, those endpoints
return a 503. OCR quality depends heavily on the source photo's resolution -
upscaling a low-res crop first doesn't help, since there's no detail to
recover.

## ML / model weights

`ml/models/` holds every model file the backend loads at runtime. `document_detector_*.pt`
was trained on SmartDoc 2015 via a Kaggle GPU notebook.

## Repo layout

```
CVPROJ/
├── README.md                 You are here ._.
├── start.bat                 Launches backend + frontend together for local dev.
│
├── backend/                  FastAPI server.
│   ├── requirements.txt          Core deps (FastAPI, OpenCV, etc.) - always needed.
│   ├── requirements-ml.txt       Optional: torch, for the Ultra HD upscaler and fallback detector.
│   ├── requirements-ocr.txt       Optional: EasyOCR, for text extraction and searchable PDFs.
│   └── app/
│       ├── main.py                API routes: /api/upload, /api/process, /api/download, /api/ocr, history.
│       ├── model_paths.py         Resolves ml/models/ regardless of where the app is run from.
│       ├── detector.py            Primary corner detector
│       ├── scanner.py             Classical CV corner fallback, perspective warp, color/gray/b&w enhance.
│       ├── corner_model.py        Less accurate trained corner detector (document_detector_2.pt).
│       ├── superres.py            Ultra HD upscaler.
│       ├── ocr.py                 EasyOCR text extraction.
│       ├── pdf_export.py          Builds searchable PDFs from OCR word boxes.
│       └── history.py             Reads/writes the scan history index.
│
├── frontend/               
│   └── src/
│       ├── App.tsx                Top-level layout: sidebar, topbar, and page routing.
│       ├── main.tsx               React entry point.
│       ├── types.ts               Shared TypeScript types for API payloads.
│       ├── api/client.ts           Fetch wrappers for all backend endpoints.
│       ├── hooks/
│       │   ├── useScanFlow.ts         Drives the upload → adjust → result flow and its state.
│       │   └── useSettings.ts         Persists theme/default mode/toggles to localStorage.
│       ├── lib/
│       │   ├── imageAdjust.ts         Client-side brightness/contrast/etc. canvas adjustments.
│       │   └── rotate.ts              Rotation math kept in sync with scanner.py's cv2.rotate geometry.
│       └── components/
│           ├── BrandMark.tsx          App logo.
│           ├── Stepper.tsx            Upload/Confirm/Done progress indicator.
│           ├── AdjustmentPanel.tsx    Manual brightness/contrast/etc. controls on the result step.
│           ├── BeforeAfterSlider.tsx  Draggable before/after comparison slider.
│           ├── HelpBubble.tsx         Keyboard-shortcut help popover.
│           ├── LoadingOverlay.tsx     Full-screen spinner shown during upload/processing.
│           ├── Toast.tsx / ToastContext.ts   Toast notification system.
│           ├── layout/
│           │   ├── Sidebar.tsx            Page navigation (Scan/History/Settings).
│           │   └── Topbar.tsx             Top bar with theme toggle.
│           ├── pages/
│           │   ├── ScanPage.tsx           Hosts the upload/adjust/result step flow.
│           │   ├── HistoryPage.tsx        Lists and re-downloads past scans.
│           │   └── SettingsPage.tsx       Theme, default style, upscale toggle, clear history.
│           └── steps/
│               ├── UploadStep.tsx         File picker / drag-drop.
│               ├── AdjustStep.tsx         Corner adjustment before processing.
│               └── ResultStep.tsx         Final scan preview, download, before/after compare.
│
└── ml/
    └── models/               
        ├── document_detector_1.pt    Primary corner detector.
        ├── document_detector_2.pt    Secondary corner detector.
        ├── ultra_hd_upscaler.pt      upscaler.
        ├── text_detector.pt          text detector.
        └── text_reader.pt            text recognizer.
```
