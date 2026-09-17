# uses easyocr, optional dep - see requirements-ocr.txt
import cv2

from .model_paths import MODEL_DIR


_reader = None
_load_attempted = False

def is_available():
    global _reader, _load_attempted
    if _reader is not None:
        return True
    if _load_attempted:
        return False
    _load_attempted = True

    try:
        import easyocr
        from easyocr.config import detection_models, recognition_models
    except ImportError:
        return False

    try:
        # EasyOCR keys models by filename. Keep its genuine PyTorch payloads
        # while following this project's .pt-only naming convention.
        detection_models["craft"]["filename"] = "text_detector.pt"
        recognition_models["gen2"]["english_g2"]["filename"] = "text_reader.pt"
        _reader = easyocr.Reader(
            ["en"],
            gpu=False,
            model_storage_directory=str(MODEL_DIR),
            download_enabled=False,
            verbose=False,
        )
        return True
    except Exception:
        return False


def extract_text(image_bgr):
    if not is_available():
        return None

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = _reader.readtext(rgb)

    words = [
        {"text": text, "confidence": float(conf), "box": [[float(x), float(y)] for x, y in box]}
        for box, text, conf in results
    ]
    full_text = "\n".join(w["text"] for w in words)
    avg_confidence = sum(w["confidence"] for w in words) / len(words) if words else 0.0

    return {"text": full_text, "confidence": avg_confidence, "words": words}
