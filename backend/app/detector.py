import cv2
import numpy as np

from .model_paths import MODEL_DIR

WEIGHTS_PATH = MODEL_DIR / "document_detector_1.pt"
INPUT_SIZE = 256
HEATMAP_THRESHOLD = 0.3

_session = None
_load_attempted = False


def _order_points(pts):
    pts = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    center = pts.mean(axis=0)
    angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
    ordered = pts[np.argsort(angles)]
    ordered = np.roll(ordered, -int(np.argmin(ordered.sum(axis=1))), axis=0)
    edge_a = ordered[1] - ordered[0]
    edge_b = ordered[2] - ordered[1]
    if edge_a[0] * edge_b[1] - edge_a[1] * edge_b[0] < 0:
        ordered = ordered[[0, 3, 2, 1]]
    return ordered.astype(np.float32)

def is_available():
    global _session, _load_attempted
    if _session is not None:
        return True
    if _load_attempted:
        return False
    _load_attempted = True

    try:
        import onnxruntime as ort
    except ImportError:
        return False

    if not WEIGHTS_PATH.exists():
        return False

    try:
        _session = ort.InferenceSession(str(WEIGHTS_PATH), providers=["CPUExecutionProvider"])
        return True
    except Exception:
        return False


def _heatmap_to_point(channel, out_size):
    resized = cv2.resize(channel, out_size, interpolation=cv2.INTER_LINEAR)
    mask = (resized >= HEATMAP_THRESHOLD).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    m = cv2.moments(largest)
    if m["m00"] == 0:
        return None
    return (m["m10"] / m["m00"], m["m01"] / m["m00"])


def detect_corners(image):
    if not is_available():
        return None

    h, w = image.shape[:2]

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    tensor = (resized.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]

    heatmaps = _session.run(["heatmap"], {"img": tensor})[0][0]

    points = [_heatmap_to_point(heatmaps[i], (w, h)) for i in range(4)]
    if any(p is None for p in points):
        return None

    corners = _order_points(np.array(points, dtype=np.float32))

    corners_clamped = np.clip(corners, [0, 0], [w - 1, h - 1])
    area = cv2.contourArea(corners_clamped.astype(np.float32))
    if area < 0.1 * (w * h):
        return None

    return corners_clamped.astype(np.float32)
