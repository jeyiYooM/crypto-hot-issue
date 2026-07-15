import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def rounded_gradient_bg(size):
    img = Image.new("RGB", (size, size))
    top = (255, 106, 61)
    bottom = (122, 32, 20)
    for y in range(size):
        t = y / size
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        ImageDraw.Draw(img).line([(0, y), (size, y)], fill=(r, g, b))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    rgba = Image.new("RGBA", (size, size))
    rgba.paste(img, (0, 0), mask)
    return rgba


def draw_bell(size):
    img = rounded_gradient_bg(size)
    draw = ImageDraw.Draw(img)

    cream = (255, 244, 230)
    edge = (196, 130, 30)
    cx, cy = size / 2, size * 0.46
    body_w = size * 0.42
    body_h = size * 0.4

    draw.pieslice(
        [cx - body_w / 2, cy - body_h / 2, cx + body_w / 2, cy + body_h / 2],
        start=180,
        end=360,
        fill=cream,
        outline=edge,
        width=max(2, int(size * 0.012)),
    )
    draw.rectangle(
        [cx - body_w / 2, cy, cx + body_w / 2, cy + body_h * 0.55],
        fill=cream,
        outline=edge,
        width=max(2, int(size * 0.012)),
    )
    lip_w = body_w * 1.25
    lip_h = size * 0.06
    lip_y = cy + body_h * 0.55
    draw.rounded_rectangle(
        [cx - lip_w / 2, lip_y, cx + lip_w / 2, lip_y + lip_h],
        radius=lip_h / 2,
        fill=cream,
        outline=edge,
        width=max(2, int(size * 0.012)),
    )
    clapper_r = size * 0.035
    draw.ellipse(
        [cx - clapper_r, lip_y + lip_h - clapper_r * 0.3, cx + clapper_r, lip_y + lip_h + clapper_r * 1.7],
        fill=cream,
        outline=edge,
        width=max(2, int(size * 0.01)),
    )
    knob_r = size * 0.03
    draw.ellipse(
        [cx - knob_r, cy - body_h / 2 - knob_r * 1.6, cx + knob_r, cy - body_h / 2 + knob_r * 0.4],
        fill=cream,
        outline=edge,
        width=max(2, int(size * 0.01)),
    )

    return img


for size in (192, 512):
    icon = draw_bell(size)
    icon.save(os.path.join(OUT_DIR, "icon-{}.png".format(size)))

print("icons written to", OUT_DIR)
