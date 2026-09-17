import cv2
import numpy as np

from .model_paths import MODEL_DIR


WEIGHTS_PATH = MODEL_DIR / "document_detector_2.pt"
IMG_SIZE = 320

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_model = None
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


def _letterbox(image, target_size):
    h, w = image.shape[:2]
    scale = min(target_size / w, target_size / h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas = np.full((target_size, target_size, 3), 114, dtype=np.uint8)
    pad_x = (target_size - new_w) // 2
    pad_y = (target_size - new_h) // 2
    canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized
    return canvas, scale, pad_x, pad_y


def _build_model():
    import torch.nn as nn
    from torchvision.models import mobilenet_v2

    class CornerRegressor(nn.Module):
        def __init__(self, dropout=0.2):
            super().__init__()
            backbone = mobilenet_v2(weights=None)
            self.features = backbone.features
            last_channel = backbone.last_channel
            self.pool = nn.AdaptiveAvgPool2d(1)
            self.head = nn.Sequential(
                nn.Flatten(),
                nn.Dropout(dropout),
                nn.Linear(last_channel, 256),
                nn.ReLU(inplace=True),
                nn.Dropout(dropout),
                nn.Linear(256, 8),
                nn.Sigmoid(),
            )

        def forward(self, x):
            x = self.features(x)
            x = self.pool(x)
            return self.head(x)

    return CornerRegressor()


def is_available():
    global _model, _load_attempted
    if _model is not None:
        return True
    if _load_attempted:
        return False
    _load_attempted = True

    try:
        import torch
    except ImportError:
        return False

    if not WEIGHTS_PATH.exists():
        return False

    try:
        ckpt = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=True)
        model = _build_model()
        model.load_state_dict(ckpt["model_state"], strict=True)
        model.eval()
        _model = model
        return True
    except Exception:
        return False


def detect_corners_ml(image):
    if not is_available():
        return None

    import torch

    h, w = image.shape[:2]
    canvas, scale, pad_x, pad_y = _letterbox(image, IMG_SIZE)

    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    rgb = (rgb - IMAGENET_MEAN) / IMAGENET_STD
    tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).float()

    with torch.no_grad():
        pred = _model(tensor).squeeze(0).numpy()

    pred_letterboxed = pred.reshape(4, 2) * IMG_SIZE
    corners = (pred_letterboxed - np.array([pad_x, pad_y], dtype=np.float32)) / scale
    corners = _order_points(corners)

    corners_clamped = np.clip(corners, [0, 0], [w - 1, h - 1])
    area = cv2.contourArea(corners_clamped.astype(np.float32))
    if area < 0.1 * (w * h):
        return None

    return corners_clamped.astype(np.float32)
