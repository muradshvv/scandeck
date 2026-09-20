import cv2
import numpy as np

from . import superres



def _resize_for_detection(image, max_dim=1500):
    h, w = image.shape[:2]
    scale = min(1.0, max_dim / max(h, w))
    if scale < 1.0:
        resized = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        resized = image.copy()
        scale = 1.0
    return resized, scale


def order_points(pts):
    # sort corners into top-left, top-right, bottom-right, bottom-left order
    pts = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    center = pts.mean(axis=0)
    angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
    ordered = pts[np.argsort(angles)]
    start = int(np.argmin(ordered.sum(axis=1)))
    ordered = np.roll(ordered, -start, axis=0)

    edge_a = ordered[1] - ordered[0]
    edge_b = ordered[2] - ordered[1]
    if edge_a[0] * edge_b[1] - edge_a[1] * edge_b[0] < 0:
        ordered = ordered[[0, 3, 2, 1]]
    return ordered.astype(np.float32)


def _auto_canny_thresholds(image, sigma=0.33):
    median = float(np.median(image))
    lower = int(max(0, (1.0 - sigma) * median))
    upper = int(min(255, (1.0 + sigma) * median))
    return lower, upper


def _find_quad(gray, img_area, kernel_size=3, iterations=1):
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    lower, upper = _auto_canny_thresholds(blurred)
    edged = cv2.Canny(blurred, lower, upper)
    kernel = np.ones((kernel_size, kernel_size), np.uint8)
    edged = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel, iterations=iterations)

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    for c in contours:
        area = cv2.contourArea(c)
        if area < img_area*0.05:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return approx.reshape(4, 2)

    for c in contours:
        area = cv2.contourArea(c)
        if area < img_area * 0.05:
            continue
        hull_area = cv2.contourArea(cv2.convexHull(c))
        solidity = area / hull_area if hull_area > 0 else 0
        if solidity < 0.85:
            continue
        rect = cv2.minAreaRect(c)
        return cv2.boxPoints(rect)

    return None

def detect_document_corners(image):
    # returns 4 corners in original image coords, or None if nothing found
    small, scale = _resize_for_detection(image)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    img_area = small.shape[0] * small.shape[1]

    contrast_variants = [
        cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray),
        cv2.createCLAHE(clipLimit=6.0, tileGridSize=(4, 4)).apply(gray),
        gray,
    ]
    closing_levels = [(3, 1), (7, 2), (11, 3), (15, 4)]

    best_quad = None
    for candidate in contrast_variants:
        for kernel_size, iterations in closing_levels:
            best_quad = _find_quad(candidate, img_area, kernel_size, iterations)
            if best_quad is not None:
                break
        if best_quad is not None:
            break

    if best_quad is None:
        return None

    ordered = order_points(best_quad)
    return ordered / scale


def full_image_corners(image):
    h, w = image.shape[:2]
    return np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype="float32")



def warp_document(image, corners):
    rect = order_points(corners)
    (tl, tr, br, bl) = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(int(height_a), int(height_b))

    max_width = max(max_width, 1)
    max_height = max(max_height, 1)

    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1],
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, matrix, (max_width, max_height))
    return warped


def rotate_image_steps(image, steps):
    steps = steps % 4
    if steps == 1:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if steps == 2:
        return cv2.rotate(image, cv2.ROTATE_180)
    if steps == 3:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def enhance(image, mode="color"):
    if mode == "bw":
        # adaptive threshold needs enough pixels per letter stroke to binarize
        # cleanly, and a blockSize matched to that resolution - a fixed
        # blockSize on a low-res crop breaks text up into patchy fragments
        h, w = image.shape[:2]
        min_dim = 1800
        if max(h, w) < min_dim:
            scale = min_dim / max(h, w)
            image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
            h, w = image.shape[:2]

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        block_size = max((w // 45) | 1, 11)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 10
        )
        return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

    if mode == "gray":
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        equalized = clahe.apply(gray)
        return cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge((l, a, b))
    result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    blurred = cv2.GaussianBlur(result, (0, 0), 3)
    sharpened = cv2.addWeighted(result, 1.5, blurred, -0.5, 0)
    return sharpened


def upscale_to_hd(image, progress_cb=None):
    if superres.weights_available() and superres.is_available():
        return superres.upscale_tiled(image, progress_cb=progress_cb)

    h, w = image.shape[:2]
    scale = 3840/max(h, w)
    if scale <= 1.0:
        return image
    upscaled = cv2.resize(
        image,
        (int(round(w * scale)), int(round(h * scale))),
        interpolation=cv2.INTER_LANCZOS4,
    )
    denoised = cv2.bilateralFilter(upscaled, d=5, sigmaColor=35, sigmaSpace=35)
    stroke_blur = cv2.GaussianBlur(denoised, (0, 0), 1.0)
    return cv2.addWeighted(denoised, 1.6, stroke_blur, -0.6, 0)
