import io

from PIL import Image



def build_searchable_pdf(image_path, ocr_result):
    from reportlab.pdfgen import canvas

    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))
    c.drawImage(str(image_path), 0, 0, width=w, height=h)

    # pdf y-axis is bottom-up, image coordinates are top-down
    for word in ocr_result["words"]:
        box = word["box"]
        x0 = min(p[0] for p in box)
        y0 = min(p[1] for p in box)
        y1 = max(p[1] for p in box)
        box_h = max(y1 - y0, 1.0)

        text_obj = c.beginText(x0, h - y1)
        text_obj.setTextRenderMode(3)
        text_obj.setFont("Helvetica", box_h * 0.85)
        text_obj.textOut(word["text"])
        c.drawText(text_obj)

    c.showPage()
    c.save()
    return buf.getvalue()
