/**
 * 1200×630 social cards. Layout is satori (text set as paths from the
 * static Archivo/Martian Mono WOFFs), the dial is hand-built SVG, and resvg
 * rasterizes the combined document. sharp squeezes the PNG afterwards.
 *
 * Composition: graphite night, the wordmark top left, the kicker behind an
 * on-air dot, the title huge and bottom-anchored, and Detent One bleeding
 * off the right edge with its indicator (and the one lit tick on the scale)
 * pointing back at the headline.
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { token } from './color';
import { dialSvg } from './dial';
import { cardArt, cardCopy, dialArt } from './art';
import { fitTitle, measure, satoriFonts } from './fonts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[]; [k: string]: unknown };
}
type Child = Node | string;

const h = (
  type: string,
  style: Style,
  children?: Child | Child[],
  extra: Record<string, unknown> = {},
): Node => ({
  type,
  props: { style, children, ...extra },
});

/** Geometry shared by the satori layer and the dial layer. */
const PAD_X = 64;
const PAD_TOP = 58;
const PAD_BOTTOM = 62;
const DIAL = { cx: 1064, cy: 328, R: 292 };
const TITLE_RIGHT = DIAL.cx - DIAL.R * 1.115 - 44;
const TRACKING = -0.02;
const LEADING = 0.98;

function logo(ink: string, tally: string): Node {
  // Same drawing as src/components/Logo.astro (knob + tally indicator at 35°).
  const mark = h(
    'svg',
    { width: 34, height: 34 },
    [
      h('circle', {}, undefined, { cx: 16, cy: 16, r: 14, fill: ink }),
      h('line', {}, undefined, {
        x1: 16,
        y1: 5.5,
        x2: 16,
        y2: 11.5,
        stroke: tally,
        'stroke-width': 3.2,
        'stroke-linecap': 'round',
        transform: 'rotate(35 16 16)',
      }),
    ],
    { viewBox: '0 0 32 32' },
  );
  return h('div', { display: 'flex', alignItems: 'center', gap: 13 }, [
    mark,
    h(
      'div',
      {
        fontFamily: 'Archivo',
        fontWeight: 800,
        fontSize: 31,
        letterSpacing: -0.6,
        color: ink,
        lineHeight: 1,
      },
      'detent',
    ),
  ]);
}

function readout(value: string, label: string, color: string, ink: string, muted: string): Node {
  const box = DIAL.R * 0.74;
  let size = 46;
  while (size > 24 && measure(value, 'mono-500', size) > box - 16) size -= 2;
  return h(
    'div',
    {
      position: 'absolute',
      left: DIAL.cx - box / 2,
      top: DIAL.cy - 52,
      width: box,
      height: 104,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    [
      h(
        'div',
        {
          fontFamily: 'Martian Mono',
          fontWeight: 500,
          fontSize: size,
          color: ink,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        },
        value,
      ),
      ...(label
        ? [
            h(
              'div',
              {
                fontFamily: 'Martian Mono',
                fontWeight: 400,
                fontSize: 15,
                letterSpacing: 1.8,
                color: color === ink ? muted : color,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              },
              label,
            ),
          ]
        : []),
    ],
  );
}

export async function renderCardSvg(slug: string): Promise<string> {
  const art = cardArt(slug);
  const copy = cardCopy(slug);
  const dial = dialArt(art);

  const bg = token('graphite-950');
  const bgLift = token('graphite-850');
  const ink = token('alu-50');
  const muted = token('alu-400');
  const kickerInk = token('alu-300');
  const tally = token('tally');

  const titleTop = PAD_TOP + 34 + 40; // below the logo row
  const kickerBlock = 28 + 26;
  const fitted = fitTitle(copy.title, {
    key: 'archivo-800',
    maxWidth: TITLE_RIGHT - PAD_X,
    maxHeight: OG_HEIGHT - PAD_BOTTOM - titleTop - kickerBlock,
    // Short titles get three lines at the largest size; long ones may take four.
    maxLines: copy.title.length > 40 ? 4 : 3,
    min: 64,
    max: 136,
    tracking: TRACKING,
    leading: LEADING,
  });
  // The kicker stays on one line clear of the dial.
  let kickerSize = 28;
  while (
    kickerSize > 20 &&
    measure(copy.kicker, 'archivo-600', kickerSize) > TITLE_RIGHT - PAD_X - 30
  )
    kickerSize -= 1;

  const tree = h(
    'div',
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
      position: 'relative',
    },
    [
      logo(ink, tally),
      h('div', { display: 'flex', flexDirection: 'column', gap: 26 }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
          h('div', {
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: tally,
            boxShadow: `0 0 18px 3px ${tally}88`,
          }),
          h(
            'div',
            {
              fontFamily: 'Archivo',
              fontWeight: 600,
              fontSize: kickerSize,
              color: kickerInk,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            },
            copy.kicker,
          ),
        ]),
        h(
          'div',
          { display: 'flex', flexDirection: 'column' },
          fitted.lines.map((line) =>
            h(
              'div',
              {
                fontFamily: 'Archivo',
                fontWeight: 800,
                fontSize: fitted.size,
                lineHeight: LEADING,
                letterSpacing: TRACKING * fitted.size,
                color: ink,
                whiteSpace: 'nowrap',
              },
              line,
            ),
          ),
        ),
      ]),
      ...(art.silhouette
        ? []
        : [
            readout(
              art.display.value,
              art.display.label,
              dial.ring.length > 1 ? muted : dial.ring[0]!,
              ink,
              muted,
            ),
          ]),
    ],
  );

  const text = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: satoriFonts(),
  });

  // Lamp light: a wide, low falloff from the upper right where the dial sits.
  const backdrop = `<defs><radialGradient id="bg-lamp" cx="${DIAL.cx - 120}" cy="${DIAL.cy - 260}" r="820" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${bgLift}"/><stop offset="1" stop-color="${bg}"/>
    </radialGradient></defs>
    <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${bg}"/>
    <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg-lamp)"/>
    ${dialSvg(dial, DIAL.cx, DIAL.cy, DIAL.R, 'dial')}`;

  const open = text.indexOf('>') + 1;
  return `${text.slice(0, open)}${backdrop}${text.slice(open)}`;
}

const pngCache = new Map<string, Uint8Array>();

export async function renderCard(slug: string): Promise<Uint8Array> {
  const hit = pngCache.get(slug);
  if (hit) return hit;
  const svg = await renderCardSvg(slug);
  const raw = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { loadSystemFonts: false },
    background: token('graphite-950'),
  })
    .render()
    .asPng();
  const png = await sharp(raw)
    .png({ palette: true, quality: 100, dither: 1, effort: 10, compressionLevel: 9 })
    .toBuffer();
  const out = new Uint8Array(png);
  pngCache.set(slug, out);
  return out;
}
