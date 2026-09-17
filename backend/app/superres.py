import cv2
import numpy as np

from .model_paths import MODEL_DIR


WEIGHTS_PATH = MODEL_DIR / "ultra_hd_upscaler.pt"

MAX_INPUT_DIM = 1000

_model = None
_load_attempted = False

def _build_model():
    import torch.nn as nn
    import torch.nn.functional as F

    class SRVGGNetCompact(nn.Module):
        def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4):
            super().__init__()
            self.upscale = upscale
            self.body = nn.ModuleList()
            self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
            self.body.append(nn.PReLU(num_parameters=num_feat))
            for _ in range(num_conv):
                self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
                self.body.append(nn.PReLU(num_parameters=num_feat))
            self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
            self.upsampler = nn.PixelShuffle(upscale)

        def forward(self, x):
            out = x
            for layer in self.body:
                out = layer(out)
            out = self.upsampler(out)
            base = F.interpolate(x, scale_factor=self.upscale, mode="nearest")
            return out + base

    return SRVGGNetCompact()


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
        state_dict = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=True)["params"]
        model = _build_model()
        model.load_state_dict(state_dict, strict=True)
        model.eval()
        _model = model
        return True
    except Exception:
        return False


def upscale(image_bgr):
    if not is_available():
        raise RuntimeError("Super-resolution model is not available (torch missing or weights not found)")

    import torch

    h, w = image_bgr.shape[:2]
    scale = min(1.0, MAX_INPUT_DIM / max(h, w))
    if scale < 1.0:
        image_bgr = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0)

    with torch.no_grad():
        out = _model(tensor)

    out = out.squeeze(0).clamp(0.0, 1.0).numpy().transpose(1, 2, 0)
    out = (out * 255.0).round().astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_RGB2BGR)
