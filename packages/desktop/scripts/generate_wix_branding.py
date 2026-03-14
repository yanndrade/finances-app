from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[3]
DESKTOP_DIR = ROOT / "packages" / "desktop"
TAURI_DIR = DESKTOP_DIR / "src-tauri"
ASSETS_DIR = TAURI_DIR / "installer-assets"
LOGO_PATH = ROOT / "packages" / "frontend" / "public" / "meucofri-logo.png"

BRAND = ImageColor.getrgb("#831BB0")
BRAND_DARK = ImageColor.getrgb("#331241")
BRAND_DEEP = ImageColor.getrgb("#22102E")
SURFACE = ImageColor.getrgb("#F8F5FB")
SURFACE_ELEVATED = ImageColor.getrgb("#FDFBFE")
TEXT_MUTED = ImageColor.getrgb("#8A7B97")
TEXT_SOFT = ImageColor.getrgb("#D8C6E2")
SUCCESS = ImageColor.getrgb("#2DAA71")
LILAC = ImageColor.getrgb("#B26FD0")


def clamp(value: float) -> int:
    return max(0, min(255, int(round(value))))


def mix(left: tuple[int, int, int], right: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(
        clamp(left[index] * (1 - amount) + right[index] * amount)
        for index in range(3)
    )


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, top)
    pixels = image.load()
    for y in range(height):
        amount = y / max(1, height - 1)
        color = mix(top, bottom, amount)
        for x in range(width):
            pixels[x, y] = color
    return image


def diagonal_pattern(size: tuple[int, int], line_color: tuple[int, int, int, int], spacing: int) -> Image.Image:
    width, height = size
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for offset in range(-height, width, spacing):
        draw.line((offset, 0, offset + height, height), fill=line_color, width=1)
    return overlay


def radial_glow(size: tuple[int, int], center: tuple[float, float], radius: float, color: tuple[int, int, int], alpha: int) -> Image.Image:
    width, height = size
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = glow.load()
    cx, cy = center
    for y in range(height):
        for x in range(width):
            dx = x - cx
            dy = y - cy
            distance = (dx * dx + dy * dy) ** 0.5
            if distance > radius:
                continue
            strength = 1 - (distance / radius)
            pixels[x, y] = (*color, clamp(alpha * (strength ** 2)))
    return glow


def rounded_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None) -> None:
    draw.rounded_rectangle(box, radius=box[3] - box[1], fill=fill, outline=outline, width=1 if outline else 0)


def load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: Iterable[str]
    if bold:
        candidates = (
            "C:/Windows/Fonts/seguibl.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        )
    else:
        candidates = (
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
        )

    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)

    return ImageFont.load_default()


def paste_logo(base: Image.Image, *, box: tuple[int, int, int, int], shadow_offset: tuple[int, int] = (0, 6)) -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    max_width = box[2] - box[0]
    max_height = box[3] - box[1]
    logo.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

    logo_x = box[0] + (max_width - logo.width) // 2
    logo_y = box[1] + (max_height - logo.height) // 2

    alpha = logo.getchannel("A")
    shadow = Image.new("RGBA", logo.size, (14, 6, 18, 140))
    shadow.putalpha(alpha.point(lambda value: clamp(value * 0.46)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(7))

    base.alpha_composite(shadow, (logo_x + shadow_offset[0], logo_y + shadow_offset[1]))
    base.alpha_composite(logo, (logo_x, logo_y))


def create_dialog_asset() -> Image.Image:
    width, height = 493, 312
    base = Image.new("RGBA", (width, height), (*SURFACE, 255))
    base.alpha_composite(radial_glow((width, height), (405, 48), 170, BRAND, 28))
    base.alpha_composite(radial_glow((width, height), (330, 270), 180, LILAC, 18))

    right_texture = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    texture_draw = ImageDraw.Draw(right_texture)
    for y in range(188, 276, 18):
        texture_draw.rounded_rectangle(
            (258, y, 448, y + 8),
            radius=4,
            fill=(*mix(SURFACE, BRAND, 0.08), 255),
        )
    base.alpha_composite(right_texture)

    panel_width = 162
    panel = vertical_gradient((panel_width, height), BRAND_DARK, BRAND_DEEP).convert("RGBA")
    panel.alpha_composite(radial_glow((panel_width, height), (84, 98), 110, BRAND, 92))
    panel.alpha_composite(radial_glow((panel_width, height), (95, 212), 92, LILAC, 46))
    panel.alpha_composite(diagonal_pattern((panel_width, height), (255, 255, 255, 18), 14))
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rectangle((0, 0, panel_width - 1, height - 1), outline=(84, 38, 108, 255), width=1)

    orb_box = (30, 42, 132, 144)
    panel_draw.ellipse(orb_box, fill=(255, 255, 255, 18), outline=(255, 255, 255, 34), width=1)
    panel.alpha_composite(radial_glow((panel_width, height), (81, 93), 64, BRAND, 62))
    paste_logo(panel, box=(36, 48, 126, 138))

    title_font = load_font(18, bold=True)
    body_font = load_font(12)
    small_font = load_font(11, bold=True)

    panel_draw.text((24, 192), "MEUCOFRI", font=title_font, fill=(255, 255, 255, 224))
    panel_draw.text((24, 218), "Controle financeiro\npessoal no Windows.", font=body_font, fill=(232, 220, 241, 212), spacing=4)

    rounded_box(panel_draw, (24, 268, 78, 286), fill=(255, 255, 255), outline=None)
    panel_draw.ellipse((30, 274, 38, 282), fill=SUCCESS)
    panel_draw.text((42, 270), "local", font=small_font, fill=BRAND_DARK)

    rounded_box(panel_draw, (84, 268, 140, 286), fill=(255, 255, 255), outline=None)
    panel_draw.text((98, 270), "rápido", font=small_font, fill=BRAND_DARK)

    base.alpha_composite(panel, (0, 0))

    divider = Image.new("RGBA", (1, height), (*mix(SURFACE, BRAND, 0.16), 255))
    base.alpha_composite(divider, (panel_width, 0))

    accent_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent_layer)
    accent_draw.line((248, 44, 460, 44), fill=(*mix(SURFACE, BRAND, 0.22), 255), width=1)
    accent_draw.rounded_rectangle((388, 254, 450, 270), radius=8, fill=(*SURFACE_ELEVATED, 255), outline=(*mix(SURFACE, BRAND, 0.16), 255), width=1)
    accent_draw.ellipse((398, 259, 406, 267), fill=SUCCESS)
    accent_draw.text((412, 255), "dados locais", font=load_font(10, bold=True), fill=(*TEXT_MUTED, 255))
    base.alpha_composite(accent_layer)

    return base.convert("RGB")


def create_banner_asset() -> Image.Image:
    width, height = 493, 58
    base = Image.new("RGBA", (width, height), (*SURFACE_ELEVATED, 255))
    draw = ImageDraw.Draw(base)

    ribbon_width = 112
    ribbon = vertical_gradient((ribbon_width, height), BRAND_DARK, BRAND).convert("RGBA")
    ribbon.alpha_composite(diagonal_pattern((ribbon_width, height), (255, 255, 255, 20), 16))
    ribbon.alpha_composite(radial_glow((ribbon_width, height), (22, 10), 72, LILAC, 62))
    base.alpha_composite(ribbon, (0, 0))

    paste_logo(base, box=(14, 8, 48, 42), shadow_offset=(0, 3))
    draw.text((66, 12), "MeuCofri", font=load_font(18, bold=True), fill=BRAND_DARK)
    draw.text((66, 33), "instalação segura e local", font=load_font(10), fill=TEXT_MUTED)

    chip_fill = mix(SURFACE, BRAND, 0.06)
    rounded_box(draw, (368, 18, 420, 36), fill=chip_fill, outline=mix(SURFACE, BRAND, 0.12))
    draw.ellipse((376, 24, 384, 32), fill=SUCCESS)
    draw.text((389, 21), "local", font=load_font(10, bold=True), fill=BRAND_DARK)

    rounded_box(draw, (427, 18, 478, 36), fill=chip_fill, outline=mix(SURFACE, BRAND, 0.12))
    draw.text((438, 21), "setup", font=load_font(10, bold=True), fill=BRAND_DARK)

    draw.line((0, height - 1, width, height - 1), fill=mix(SURFACE, BRAND, 0.18), width=1)
    return base.convert("RGB")


def save_asset(image: Image.Image, stem: str) -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    image.save(ASSETS_DIR / f"{stem}.bmp", format="BMP")
    image.save(ASSETS_DIR / f"{stem}.png", format="PNG")


def main() -> None:
    save_asset(create_dialog_asset(), "wix-dialog")
    save_asset(create_banner_asset(), "wix-banner")


if __name__ == "__main__":
    main()
