import json
import sys
from pathlib import Path

import cv2

from . import scanner


def _write_progress(progress_path, done, total):
    tmp = progress_path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"done": done, "total": total}), encoding="utf-8")
    tmp.replace(progress_path)


def main():
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    progress_path = Path(sys.argv[3])

    image = cv2.imread(str(input_path))
    if image is None:
        print("Could not read input image", file=sys.stderr)
        sys.exit(1)

    def progress_cb(done, total):
        _write_progress(progress_path, done, total)

    try:
        result = scanner.upscale_to_hd(image, progress_cb=progress_cb)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    ok = cv2.imwrite(str(output_path), result)

    tmp_path = getattr(result, "filename", None)
    if tmp_path:
        try:
            Path(tmp_path).unlink()
        except OSError:
            pass

    if not ok:
        print("Failed to write output image", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
