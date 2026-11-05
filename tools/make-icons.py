"""Erzeugt die App-Icons von DebateBase (eigenes, einfaches Motiv).

Aufruf: python3 tools/make-icons.py
Motiv: weiße Sprechblase mit drei Textzeilen auf petrolfarbenem Grund.
"""
from PIL import Image, ImageDraw
import os

TEAL = (11, 122, 133, 255)
TEAL_DARK = (8, 94, 103, 255)
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
SS = 4  # Supersampling für glatte Kanten


def draw_motif(d, size, scale):
    """Sprechblase zentriert; scale = Anteil der Kantenlänge."""
    s = size * scale
    cx, cy = size / 2, size / 2
    w, h = s, s * 0.74
    x0, y0 = cx - w / 2, cy - h / 2 - s * 0.06
    r = s * 0.16
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=r, fill=WHITE)
    # Spitze unten links
    tx = x0 + w * 0.24
    d.polygon([(tx, y0 + h - 1), (tx + w * 0.2, y0 + h - 1), (tx - w * 0.04, y0 + h + s * 0.2)], fill=WHITE)
    # drei Zeilen
    lh = s * 0.085
    lx = x0 + w * 0.17
    for i, frac in enumerate((0.66, 0.50, 0.34)):
        ly = y0 + h * (0.24 + i * 0.22)
        d.rounded_rectangle([lx, ly, lx + w * frac, ly + lh], radius=lh / 2, fill=TEAL if i != 1 else TEAL_DARK)


def make(size, maskable=False, name=None):
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, big, big], fill=TEAL)
        draw_motif(d, big, 0.50)  # innerhalb der sicheren Zone (80 %)
    else:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=TEAL)
        draw_motif(d, big, 0.62)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(OUT, name or f'icon-{size}.png'), optimize=True)


os.makedirs(OUT, exist_ok=True)
make(192)
make(512)
make(512, maskable=True, name='icon-maskable-512.png')
make(192, maskable=True, name='icon-maskable-192.png')
make(180, maskable=True, name='apple-touch-icon.png')
make(32, name='favicon-32.png')
print('Icons erstellt in', os.path.normpath(OUT))
