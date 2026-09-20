import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import cv2
import numpy as np

from .model_paths import MODEL_DIR


WEIGHTS_PATH = MODEL_DIR / "ultra_hd_upscaler.pt"

MAX_INPUT_DIM = 1000

TILE = 128
TILE_PAD = 10
TILE_SCALE = 4
MAX_TILED_SOURCE_DIM = 1400

_model = None
_load_attempted = False


def _build_model():
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    def make_layer(block, n_layers, **kwargs):
        return nn.Sequential(*[block(**kwargs) for _ in range(n_layers)])

    class ResidualDenseBlock(nn.Module):
        def __init__(self, num_feat=64, num_grow_ch=32):
            super().__init__()
            self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
            self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
            self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
            self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
            self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

        def forward(self, x):
            x1 = self.lrelu(self.conv1(x))
            x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
            x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
            x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
            x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
            return x5 * 0.2 + x

    class RRDB(nn.Module):
        def __init__(self, num_feat, num_grow_ch=32):
            super().__init__()
            self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
            self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
            self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

        def forward(self, x):
            out = self.rdb1(x)
            out = self.rdb2(out)
            out = self.rdb3(out)
            return out * 0.2 + x

    class RRDBNet(nn.Module):
        def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32):
            super().__init__()
            self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
            self.body = make_layer(RRDB, num_block, num_feat=num_feat, num_grow_ch=num_grow_ch)
            self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

        def forward(self, x):
            feat = self.conv_first(x)
            body_feat = self.conv_body(self.body(feat))
            feat = feat + body_feat
            feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
            feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
            return self.conv_last(self.lrelu(self.conv_hr(feat)))

    return RRDBNet()


def is_available():
    global _model, _load_attempted
    if _model is not None:
        return True
    if _load_attempted:
        return False
    _load_attempted = True

    try:
        import torch
        torch.set_num_threads(1)
        torch.backends.mkldnn.enabled = False
    except ImportError:
        return False

    if not WEIGHTS_PATH.exists():
        return False

    try:
        state_dict = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=True)["params_ema"]
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


def upscale_tiled(image_bgr, progress_cb=None):
    """Runs the model on small overlapping tiles so peak memory stays bounded
    regardless of the source image's size (RRDBNet's memory use grows with the
    square of input size when run on a whole image at once). The output is
    written to a memory-mapped temp file, not an in-RAM array - a naive
    in-memory buffer for the full 4x output (e.g. ~192MB for a 2000px source)
    was itself enough to blow a 512MB host even with tiny per-tile inference."""
    if not is_available():
        raise RuntimeError("Super-resolution model is not available (torch missing or weights not found)")

    import tempfile
    import torch

    h, w = image_bgr.shape[:2]
    scale = min(1.0, MAX_TILED_SOURCE_DIM / max(h, w))
    if scale < 1.0:
        image_bgr = cv2.resize(image_bgr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = image_bgr.shape[:2]

    cols = -(-w // TILE)
    rows = -(-h // TILE)
    total = cols * rows
    done = 0

    tmp = tempfile.NamedTemporaryFile(suffix=".dat", delete=False)
    tmp.close()
    out = np.memmap(tmp.name, dtype=np.uint8, mode="w+", shape=(h * TILE_SCALE, w * TILE_SCALE, 3))

    padded_size = TILE + 2 * TILE_PAD

    for row in range(rows):
        for col in range(cols):
            tx, ty = col * TILE, row * TILE
            tw, th = min(TILE, w - tx), min(TILE, h - ty)
            px, py = tx - TILE_PAD, ty - TILE_PAD

            src_x0, src_y0 = max(0, px), max(0, py)
            src_x1, src_y1 = min(w, px + padded_size), min(h, py + padded_size)
            tile_bgr = image_bgr[src_y0:src_y1, src_x0:src_x1]

            pad_left, pad_top = src_x0 - px, src_y0 - py
            pad_right = padded_size - tile_bgr.shape[1] - pad_left
            pad_bottom = padded_size - tile_bgr.shape[0] - pad_top
            if pad_left or pad_top or pad_right or pad_bottom:
                tile_bgr = cv2.copyMakeBorder(
                    tile_bgr, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_REFLECT
                )

            # every tile is fed to the model at the same fixed shape - a varying
            # shape per tile (edge tiles used to be smaller) made PyTorch's CPU
            # allocator keep a separate memory pool per shape it had seen,
            # so peak memory kept climbing as more distinct edge shapes showed up
            tile = cv2.cvtColor(tile_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            tensor = torch.from_numpy(tile.transpose(2, 0, 1)).unsqueeze(0)
            with torch.no_grad():
                pred = _model(tensor)
            pred = pred.squeeze(0).clamp(0.0, 1.0).numpy().transpose(1, 2, 0)

            cx, cy = TILE_PAD * TILE_SCALE, TILE_PAD * TILE_SCALE
            cw, ch = tw * TILE_SCALE, th * TILE_SCALE
            crop_rgb = (pred[cy:cy + ch, cx:cx + cw] * 255.0).round().astype(np.uint8)
            crop_bgr = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2BGR)
            out[ty * TILE_SCALE:ty * TILE_SCALE + ch, tx * TILE_SCALE:tx * TILE_SCALE + cw] = crop_bgr

            done += 1
            if progress_cb:
                progress_cb(done, total)

    out.flush()
    return out
