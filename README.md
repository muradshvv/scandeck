# Document Scanner

Upload a photo of a document and get a cropped, deskewed, enhanced scan back
(color, grayscale, or black & white). Corners are auto-detected; there's a
quick confirm/edit step before processing.

## Running locally

First time:

```powershell
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
cd ..\frontend
npm install
```

Optional extras:

```powershell
cd backend
venv\Scripts\pip install -r requirements-ml.txt
venv\Scripts\pip install -r requirements-ocr.txt 
```

Then, from the project root:

```cmd
start.bat
```

Starts the backend on 127.0.0.1:8001 and the frontend on localhost:5173.

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

`backend/app/superres.py` runs realesr-general-x4v3, the compact variant, for inference. Off by
default. It's trained on natural
photos, not scanned text, and tends to add ringing artifacts to document
scans rather than sharpening them.

Input is capped at 1000px on the long edge before upscaling - this model's
cost scales with input size, not output, so it bounds worst-case latency.

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

