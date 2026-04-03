#!/usr/bin/env python3
import argparse
import hashlib
import math
import os
from typing import List, Tuple

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont


PALETTES = [
    ("#315F72", "#F4B183", "#F7F4EF", "#1F2A30"),
    ("#4F6D7A", "#7FAE9F", "#F8F6F2", "#213038"),
    ("#5D7B6F", "#E4A672", "#F6F2EC", "#22302D"),
    ("#8A6F8F", "#F0C36D", "#FBF7F0", "#2B2330"),
    ("#52796F", "#F28482", "#F8F4EF", "#20312D"),
    ("#7C8C5A", "#5E81AC", "#F6F5EE", "#27301F"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--city", default="")
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def choose_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]

    for path in candidates:
        if path and os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                pass

    return ImageFont.load_default()


def identity_hash(name: str, city: str) -> int:
    digest = hashlib.sha256(f"{name}::{city}".encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def split_name(name: str) -> List[str]:
    tokens = [token.strip() for token in name.replace("&", " & ").split() if token.strip()]
    if not tokens:
        return [name]
    if len(tokens) <= 2:
        return [" ".join(tokens)]
    midpoint = math.ceil(len(tokens) / 2)
    return [" ".join(tokens[:midpoint]), " ".join(tokens[midpoint:])]


def rounded_rectangle(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width: int = 1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_variant(draw: ImageDraw.ImageDraw, variant: int, center: Tuple[int, int], primary, secondary, dark):
    cx, cy = center
    if variant == 0:
        draw.ellipse((cx - 98, cy - 98, cx + 98, cy + 98), fill=None, outline=primary, width=18)
        draw.ellipse((cx - 56, cy - 56, cx + 56, cy + 56), fill=secondary)
        draw.rounded_rectangle((cx - 14, cy - 80, cx + 14, cy + 80), radius=14, fill=dark)
        draw.rounded_rectangle((cx - 80, cy - 14, cx + 80, cy + 14), radius=14, fill=dark)
    elif variant == 1:
        for offset in (-48, 0, 48):
            draw.arc((cx - 120, cy - 90 + offset, cx + 40, cy + 70 + offset), start=295, end=75, fill=primary, width=18)
        draw.ellipse((cx + 32, cy - 28, cx + 88, cy + 28), fill=secondary)
    elif variant == 2:
        for angle in (0, 72, 144, 216, 288):
            rad = math.radians(angle)
            px = cx + math.cos(rad) * 58
            py = cy + math.sin(rad) * 58
            draw.ellipse((px - 52, py - 34, px + 52, py + 34), fill=primary)
        draw.ellipse((cx - 46, cy - 46, cx + 46, cy + 46), fill=secondary)
    elif variant == 3:
        for idx, width in enumerate((184, 150, 116)):
            top = cy - 94 + idx * 58
            draw.rounded_rectangle((cx - width / 2, top, cx + width / 2, top + 34), radius=17, fill=primary if idx % 2 == 0 else secondary)
        draw.ellipse((cx + 66, cy - 122, cx + 118, cy - 70), fill=dark)
    elif variant == 4:
        draw.rounded_rectangle((cx - 22, cy - 120, cx + 22, cy + 120), radius=20, fill=primary)
        draw.rounded_rectangle((cx - 120, cy - 22, cx + 120, cy + 22), radius=20, fill=primary)
        draw.arc((cx - 142, cy - 142, cx + 142, cy + 142), start=28, end=165, fill=secondary, width=16)
        draw.arc((cx - 122, cy - 122, cx + 122, cy + 122), start=210, end=350, fill=dark, width=14)
    else:
        draw.ellipse((cx - 116, cy - 72, cx + 4, cy + 48), outline=primary, width=20)
        draw.ellipse((cx - 4, cy - 48, cx + 116, cy + 72), outline=secondary, width=20)
        draw.rounded_rectangle((cx - 28, cy - 110, cx + 28, cy + 110), radius=22, fill=dark)


def generate_logo(name: str, city: str, output_path: str):
    seed = identity_hash(name, city)
    primary_hex, secondary_hex, card_hex, text_hex = PALETTES[seed % len(PALETTES)]
    primary = ImageColor.getrgb(primary_hex)
    secondary = ImageColor.getrgb(secondary_hex)
    card = ImageColor.getrgb(card_hex)
    dark = ImageColor.getrgb(text_hex)

    canvas = Image.new("RGBA", (960, 960), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (960, 960), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    rounded_rectangle(shadow_draw, (92, 92, 868, 868), radius=120, fill=(15, 23, 31, 42))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow, (10, 18))

    draw = ImageDraw.Draw(canvas)
    rounded_rectangle(draw, (90, 90, 870, 870), radius=120, fill=card, outline=(222, 217, 209, 255), width=4)

    draw.ellipse((136, 136, 824, 824), fill=(255, 255, 255, 84))

    variant = seed % 6
    draw_variant(draw, variant, (480, 360), primary, secondary, dark)

    badge_fill = primary if variant % 2 == 0 else secondary
    rounded_rectangle(draw, (150, 166, 332, 230), radius=28, fill=badge_fill)
    badge_font = choose_font(34, bold=True)
    badge_text = city.upper()[:12] if city else "PRAXIS"
    badge_box = draw.textbbox((0, 0), badge_text, font=badge_font)
    badge_width = badge_box[2] - badge_box[0]
    draw.text((241 - badge_width / 2, 184), badge_text, fill=(255, 255, 255, 255), font=badge_font)

    lines = split_name(name)[:2]
    name_font = choose_font(58, bold=True)
    sub_font = choose_font(28, bold=False)
    current_y = 590

    for line in lines:
        text_box = draw.textbbox((0, 0), line, font=name_font)
        text_width = text_box[2] - text_box[0]
        draw.text((480 - text_width / 2, current_y), line, fill=dark, font=name_font)
        current_y += 72

    descriptor = "Physiotherapie & Bewegung"
    descriptor_box = draw.textbbox((0, 0), descriptor, font=sub_font)
    descriptor_width = descriptor_box[2] - descriptor_box[0]
    draw.text((480 - descriptor_width / 2, current_y + 16), descriptor, fill=(dark[0], dark[1], dark[2], 188), font=sub_font)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    canvas.save(output_path, format="PNG")


if __name__ == "__main__":
    args = parse_args()
    generate_logo(args.name, args.city, args.output)
