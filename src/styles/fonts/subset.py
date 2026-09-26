#!/usr/bin/env python3
"""
Subset the site's two variable fonts to the characters and OpenType features
the site actually sets. Every design axis stays: Archivo keeps wght 100-900
and wdth 62-125 (the headline squeeze on the home dial, /story/ and /crack/
runs the full width range), Martian Mono keeps wght 100-800.

    python3 -m pip install fonttools brotli
    python3 src/styles/fonts/subset.py

Reads the @fontsource-variable Latin files from node_modules and writes the
.woff2 files next to this script. Re-run after upgrading either font package
and paste the printed unicode-range lines into src/styles/fonts.css.

Characters outside these sets still render in the right face: fonts.css also
declares the full fontsource file for exactly the rest of what it maps (the
printed "rest" line), so a browser only fetches it if a page, or a visitor's
own input, uses such a character. The ranges must not overlap, or
document.fonts.load() on the canvas pages would fetch both files, and "rest"
lists only codepoints the file really has, so a glyph neither file has
(″ or ∞ in Martian Mono) never triggers a useless download.
"""
import os
from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
NM = os.path.join(ROOT, 'node_modules', '@fontsource-variable')

# Archivo sets all prose and UI: ASCII, the Latin-1 symbols the copy uses
# (nbsp © ® ° ± · × Ø ½ ...), dashes, curly quotes, primes, ellipsis, € and −.
ARCHIVO = (
    'U+0020-007E,U+00A0,U+00A2-00A3,U+00A5,U+00A7,U+00A9,U+00AB,U+00AE,U+00B0-00B3,'
    'U+00B7,U+00B9-00BE,U+00D7-00D8,U+00F7-00F8,U+2009,U+2010-2014,U+2018-201A,U+201C-201E,'
    'U+2020-2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+2044,U+20AC,U+2122,U+2212'
)
# The unicode-range fontsource declares for its Latin files.
FONTSOURCE_LATIN = (
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,'
    'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
)
# Martian Mono only sets readouts: numbers, units, serials, degrees.
MARTIAN = (
    'U+0020-007E,U+00A0,U+00B0-00B1,U+00B7,U+00BC-00BE,U+00D7-00D8,U+2013-2014,'
    'U+2018-2019,U+201C-201D,U+2026,U+2212'
)

FONTS = [
    # (source in node_modules, output, codepoints, OpenType features to keep)
    ('archivo/files/archivo-latin-standard-normal.woff2', 'archivo-core.woff2', ARCHIVO, ['kern', 'liga', 'tnum', 'rvrn']),
    ('martian-mono/files/martian-mono-latin-wght-normal.woff2', 'martian-mono-core.woff2', MARTIAN, ['calt', 'rvrn']),
]


def codepoints(spec):
    out = []
    for part in spec.split(','):
        a, _, b = part.strip().replace('U+', '').partition('-')
        out.extend(range(int(a, 16), int(b or a, 16) + 1))
    return out


def unicode_range(cps):
    """Compact unicode-range for the codepoints the subset really maps."""
    cps = sorted(cps)
    parts, start, prev = [], cps[0], cps[0]
    for c in cps[1:] + [None]:
        if c is not None and c == prev + 1:
            prev = c
            continue
        parts.append(f'U+{start:04X}' if start == prev else f'U+{start:04X}-{prev:04X}')
        if c is not None:
            start = prev = c
    return ', '.join(parts)


for src, name, spec, features in FONTS:
    font = TTFont(os.path.join(NM, src))
    full = set(font.getBestCmap().keys()) & set(codepoints(FONTSOURCE_LATIN))
    opts = subset.Options()
    opts.layout_features = features
    opts.hinting = False
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.flavor = 'woff2'
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=codepoints(spec))
    sub.subset(font)
    path = os.path.join(HERE, name)
    subset.save_font(font, path, opts)
    print(f'{name}: {os.path.getsize(path):,} B, {len(font.getGlyphOrder())} glyphs')
    core = set(font.getBestCmap().keys())
    print(f'  core unicode-range: {unicode_range(core)};')
    print(f'  rest unicode-range: {unicode_range({c for c in full - core if c > 0x20})};')
