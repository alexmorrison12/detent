/**
 * three.js renderer for <detent-dial>. Loaded with import() only when a dial
 * is near the viewport and the browser is idle, never on the critical path.
 *
 * Choices (see the dial feature notes in the commit):
 * - WebGLRenderer, not WebGPURenderer: this scene needs only built-in
 *   MeshPhysicalMaterial features, the WebGL build is ~110 KB lighter (gz),
 *   renders identically in headless SwiftShader for the stills, and moving to
 *   three/webgpu later is an import swap.
 * - ONE WebGL context per page on an offscreen canvas. Each dial renders its
 *   viewport there and blits into its own 2D canvas (which getCanvas() hands
 *   to MediaRecorder). A page with 24 dials still holds a single context.
 * - Procedural model in millimetres (lathe profiles with flat-shaded
 *   segments, so chamfers stay crisp), IBL from a procedural studio (grey room,
 *   soft key/fill/top boxes, a rim strip) through PMREM: no HDR download, and
 *   nothing blows out when the camera looks straight down. Khronos PBR Neutral
 *   tone mapping, sRGB output.
 * - Render on demand only: the element calls draw() while something moves.
 */
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  ClampToEdgeWrapping,
  Color,
  CylinderGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  LatheGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  RGBAFormat,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Finish, FinishId } from '@/data/product';
import { FOV, MM, PARTS, partLift, partProgress } from './model';
import { luminance, mix } from './color';
import { displayKey, drawDisplay, loadDisplayFonts } from './display';
import type { DialPartAnchor } from './types';
import {
  enclose,
  hullRings,
  type DialView,
  type Ellipse,
  type KnobCircle,
  type KnobGrip,
  type ViewState,
} from './view';

const DEG = Math.PI / 180;
const SEGS = 192;
/** Halo light on the desk: a soft pool at night... */
const GLOW = 0.6;
/** ...and in a day world a faint line at the foot: the pool reads as a pink stain on white. */
const GLOW_DAY = 0.4;
type P = [number, number]; // [radius, y] in mm

/* ------------------------------------------------------------------------ */
/* Geometry helpers                                                          */
/* ------------------------------------------------------------------------ */

/** Lathe a profile. Flat: each segment gets its own normals (crisp machined edges). */
function lathe(points: P[], segs = SEGS, smooth = false): BufferGeometry {
  const v = (p: P) => new Vector2(p[0], p[1]);
  if (smooth) return new LatheGeometry(points.map(v), segs);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < points.length - 1; i++)
    parts.push(new LatheGeometry([v(points[i]!), v(points[i + 1]!)], segs));
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Deterministic PRNG for the PCB's small parts. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------------ */
/* Procedural textures (zero downloads)                                      */
/* ------------------------------------------------------------------------ */

/** Knurl lines around the band: the model's count, the one the specs page quotes. */
const KNURL_TEETH = MM.knurlTeeth;
const KNURL_ROWS = 12;
/** Teeth per texture tile: the largest divisor of the count up to 8, so the band has no seam. */
const KNURL_TILE = [8, 7, 6, 5, 4, 3, 2, 1].find((n) => KNURL_TEETH % n === 0)!;

/** Diamond knurl normal map: one tile = KNURL_TILE teeth × 1 row, repeated around the band. */
function knurlNormalMap(): DataTexture {
  const W = 32 * KNURL_TILE;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  const tri = (x: number) => Math.abs(x - Math.floor(x) - 0.5) * 2;
  const pitchU = (2 * Math.PI * (MM.knobR - 0.25)) / KNURL_TEETH; // mm per tooth
  const rowH = (MM.knurlTop - MM.knurlBottom) / KNURL_ROWS; // mm per row
  const depth = 0.32;
  const h = (s: number, t: number) => Math.min(1, 1.25 * Math.min(tri(s + t), tri(s - t)));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (x / W) * KNURL_TILE;
      const t = y / H;
      const e = 1e-3;
      const dhds = (h(s + e, t) - h(s - e, t)) / (2 * e);
      const dhdt = (h(s, t + e) - h(s, t - e)) / (2 * e);
      const nx = (-dhds / pitchU) * depth;
      const ny = (-dhdt / rowH) * depth;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * W + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, W, H, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(KNURL_TEETH / KNURL_TILE, KNURL_ROWS);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Concentric machining bands for the knob's top face (roughness, G channel). */
function ringRoughnessMap(): DataTexture {
  const H = 64;
  const data = new Uint8Array(4 * H * 4);
  const rnd = lcg(7);
  let level = 0.7;
  for (let y = 0; y < H; y++) {
    if (y % 5 === 0) level = 0.52 + rnd() * 0.36;
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = level * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, 4, H, RGBAFormat);
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** The halo's 24 LEDs seen through the diffuser slot (u runs around the base). */
function ledStripMap(): DataTexture {
  const W = 480;
  const data = new Uint8Array(W * 4);
  for (let x = 0; x < W; x++) {
    const phase = ((x / W) * 24) % 1;
    const d = Math.min(phase, 1 - phase);
    const v = 0.62 + 0.38 * Math.exp(-(d * d) / 0.012);
    const i = x * 4;
    data[i] = data[i + 1] = data[i + 2] = v * 255;
    data[i + 3] = 255;
  }
  const tex = new DataTexture(data, W, 1, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Radial alpha texture for a ground plane of the given size (mm). */
function radialTexture(sizeMM: number, alpha: (rMM: number, ang: number) => number): CanvasTexture {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = ((x + 0.5) / N - 0.5) * sizeMM;
      const dy = ((y + 0.5) / N - 0.5) * sizeMM;
      const a = Math.max(0, Math.min(1, alpha(Math.hypot(dx, dy), Math.atan2(dy, dx))));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The photo studio the metal reflects. Values above 1 are HDR (PMREM keeps them).
 * A mid-grey room keeps aluminum bright (a dark room turns metal black); the
 * boxes give the highlights their shape.
 */
function studioEnvironment(): Scene {
  const scene = new Scene();
  const box = new BoxGeometry(1, 1, 1);
  const panel = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: number | [number, number, number],
  ) => {
    const [r, g, b] = typeof c === 'number' ? [c, c, c] : c;
    const m = new Mesh(box.clone(), new MeshBasicMaterial({ color: new Color(r, g, b) }));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  // Room: floor darker (a desk), walls mid-grey, ceiling a little lighter. At the hero
  // and config angles the knob and base sides mirror the floor, so it can't be black:
  // a near-black floor turned Raw gunmetal and Glacier slate.
  const room = new Mesh(
    box.clone(),
    new MeshBasicMaterial({ color: new Color(0.38, 0.38, 0.39), side: BackSide }),
  );
  room.scale.set(30, 22, 30);
  room.position.y = 5;
  scene.add(room);
  const floor = new Mesh(
    new PlaneGeometry(30, 30),
    new MeshBasicMaterial({ color: new Color(0.22, 0.214, 0.22) }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5.5;
  scene.add(floor);
  // Key: large soft box, front-left and high.
  panel(-8, 7, 8, 7, 5, 0.2, 5.5);
  // Fill: tall and dim, right.
  panel(10, 2, 3, 5, 8, 0.2, 1.6);
  // Top: small and soft, so straight-down views stay readable.
  panel(-1, 11, 2, 4, 3, 0.2, 1.1);
  // A broad, dim panel high on the back wall: top faces of dark finishes get a gradient.
  panel(0, 12, -9, 18, 6, 0.2, 0.9);
  // Rim: a long cool strip behind, catches every chamfer.
  panel(-2, 6, -11, 16, 0.9, 0.2, [8.5, 9, 10]);
  // Kicker: a thin strip low on the right-back for the silhouettes.
  panel(9, 0.5, -7, 0.7, 7, 0.2, 3.2);
  // Warm bounce card, low and wide in front: the sides of dark finishes keep their shape.
  panel(2, -2.2, 11, 18, 3.2, 0.2, [1.25, 1.08, 0.9]);
  // Floor-to-ceiling strips, front-left and right: a highlight runs down every side,
  // so cylinders read as turned metal (and Graphite's base isn't a void).
  panel(-9, 2, 7, 1.4, 16, 0.2, 5);
  panel(10, 2, -1, 1.2, 16, 0.2, 3);
  // A low cyc light between them and the desk: the lower sides pick up a lit band.
  panel(0, -4.4, 9, 26, 2, 0.2, 1.5);
  // A soft strip back-right, where the hero view mirrors off the cover glass: one
  // highlight band crosses the display, so it reads as glass over a screen.
  panel(5.5, 6, -8.6, 11, 1.1, 0.2, 2.4);
  box.dispose();
  return scene;
}

/* ------------------------------------------------------------------------ */
/* Engine: one renderer, shared geometry, textures and materials             */
/* ------------------------------------------------------------------------ */

interface FinishMats {
  body: MeshPhysicalMaterial;
  top: MeshPhysicalMaterial;
  knurl: MeshPhysicalMaterial;
  base: MeshPhysicalMaterial;
  bore: MeshPhysicalMaterial;
  indicator: MeshBasicMaterial;
}

class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly views = new Set<ThreeView>();
  env: Texture | null = null;
  lost = false;
  losses = 0;
  private w = 0;
  private h = 0;
  tex!: {
    knurl: DataTexture;
    rings: DataTexture;
    leds: DataTexture;
    shadow: CanvasTexture;
    glow: CanvasTexture;
  };
  geo!: Record<string, BufferGeometry>;
  mat!: Record<string, Material>;
  private finishes = new Map<FinishId, FinishMats>();
  private glowDay: CanvasTexture | null = null;

  /** The desk glow for a world. The day one is built the first time a day dial draws. */
  glowMap(day: boolean): CanvasTexture {
    if (!day) return this.tex.glow;
    // Same ring of 24 LEDs, a third of the reach and no long tail.
    return (this.glowDay ??= radialTexture(180, (r, a) => {
      if (r < 35) return 0.7;
      const d = r - 35.5;
      return 0.62 * Math.exp(-d / 1.8) * (1 + 0.12 * Math.cos(a * 24)) * smooth(44, 37, r);
    }));
  }

  constructor(readonly antialias: boolean) {
    this.canvas = document.createElement('canvas');
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    const r = this.renderer;
    r.setPixelRatio(1);
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1.02;
    r.outputColorSpace = SRGBColorSpace;
    r.autoClear = false;
    r.setClearColor(0x000000, 0);
  }

  /**
   * The expensive half, one step per task so no single task blocks input for long
   * (a tap during boot is handled between steps): studio lighting, textures, geometry.
   */
  async build(): Promise<void> {
    const r = this.renderer;
    this.buildEnv();
    await yieldToMain();

    const knurl = knurlNormalMap();
    const rings = ringRoughnessMap();
    const leds = ledStripMap();
    await yieldToMain();
    this.tex = {
      knurl,
      rings,
      leds,
      shadow: radialTexture(
        140,
        (r) =>
          0.78 * smooth(41, 33, r) + 0.3 * Math.exp(-Math.max(0, r - 33) / 8) * smooth(54, 38, r),
      ),
      // Shadow and glow fall to nothing inside the frame (half-width ≈ 51 mm at the hero
      // distance), so the canvas edge never shows as a lit or shaded rectangle.
      glow: radialTexture(180, (r, a) => {
        if (r < 35) return 0.7;
        const d = r - 35.5;
        return (
          (0.62 * Math.exp(-d / 4.5) + 0.12 * Math.exp(-d / 9)) *
          (1 + 0.12 * Math.cos(a * 24)) *
          smooth(54, 40, r)
        );
      }),
    };
    const maxAniso = r.capabilities.getMaxAnisotropy();
    this.tex.knurl.anisotropy = maxAniso;
    this.tex.rings.anisotropy = Math.min(4, maxAniso);
    await yieldToMain();

    this.geo = this.buildGeometry();
    this.mat = this.buildSharedMaterials();

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.losses++;
      this.views.forEach((v) => v.onLost?.());
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      // Render-target contents (the PMREM) don't survive a loss; rebuild them.
      this.buildEnv();
      this.views.forEach((v) => {
        v.scene.environment = this.env;
        v.onRestored?.();
      });
    });
  }

  private buildEnv() {
    const pmrem = new PMREMGenerator(this.renderer);
    const studio = studioEnvironment();
    const old = this.env;
    this.env = pmrem.fromScene(studio, 0.03).texture;
    old?.dispose();
    pmrem.dispose();
    studio.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as Material).dispose();
      }
    });
  }

  private buildGeometry(): Record<string, BufferGeometry> {
    const k = MM;
    const kc = k.knobChamfer;
    const g: Record<string, BufferGeometry> = {};
    // Knob ring (rotates)
    g.knobBody = lathe([
      [k.boreR + 0.2, k.knobBottom],
      [k.knobR - 0.5, k.knobBottom],
      [k.knobR, k.knobBottom + 0.5],
      [k.knobR, k.knurlBottom - 0.4],
      [k.knobR - 0.25, k.knurlBottom - 0.15],
      [k.knobR - 0.25, k.knurlBottom],
    ]);
    g.knobUpper = lathe([
      [k.knobR - 0.25, k.knurlTop],
      [k.knobR - 0.25, k.knurlTop + 0.15],
      [k.knobR, k.knurlTop + 0.4],
      [k.knobR, k.knobTop - kc],
    ]);
    g.knobChamfer = lathe([
      [k.knobR, k.knobTop - kc],
      [k.knobR - kc, k.knobTop],
    ]);
    g.knobTop = lathe([
      [k.knobR - kc, k.knobTop],
      [25.2, k.knobTop],
      [24.95, k.knobTop - 0.12],
      [20.9, k.knobTop - 0.12],
    ]);
    // Per-vertex tangents running around the ring: without them the anisotropic
    // (turned-metal) highlight takes each triangle's own frame and breaks into wedges.
    g.knobTop.computeTangents();
    g.knobInner = lathe([
      [20.9, k.knobTop - 0.12],
      [k.boreR + 0.2, k.knobTop - 0.7],
    ]);
    g.bore = lathe([
      [k.boreR + 0.2, k.knobTop - 0.7],
      [k.boreR + 0.2, k.knobBottom],
    ]);
    g.knurl = new CylinderGeometry(
      k.knobR - 0.25,
      k.knobR - 0.25,
      k.knurlTop - k.knurlBottom,
      256,
      1,
      true,
    );
    g.knurl.translate(0, (k.knurlTop + k.knurlBottom) / 2, 0);
    // The tally line: a lit inlay on the outer ring, set in a dark engraved groove so it
    // reads on every finish (Raw and Tally included) and survives the hero foreshortening.
    g.indicator = new BoxGeometry(1.25, 0.14, 2.5);
    g.indicator.translate(0, k.knobTop + 0.06, -26.7);
    g.groove = new BoxGeometry(1.85, 0.1, 3.05);
    g.groove.translate(0, k.knobTop + 0.03, -26.7);

    // Base (static)
    const bc = k.baseChamfer;
    g.baseBody = lathe([
      [0, k.footH],
      [k.baseR - 0.7, k.footH],
      [k.baseR, k.footH + 0.7],
      [k.baseR, k.slotBottom - 0.3],
    ]);
    g.baseWall = lathe([
      [k.baseR, k.slotTop + 0.3],
      [k.baseR, k.baseTop - bc],
    ]);
    g.baseTop = lathe([
      [k.baseR - bc, k.baseTop],
      [k.knobR + 0.9, k.baseTop],
    ]);
    g.baseChamfer = lathe([
      [k.baseR, k.baseTop - bc],
      [k.baseR - bc, k.baseTop],
    ]);
    g.slotRecess = lathe([
      [k.baseR, k.slotBottom - 0.3],
      [k.baseR - k.slotDepth, k.slotBottom - 0.3],
    ]);
    g.slotCeil = lathe([
      [k.baseR - k.slotDepth, k.slotTop + 0.3],
      [k.baseR, k.slotTop + 0.3],
    ]);
    g.slot = lathe(
      [
        [k.baseR - k.slotDepth, k.slotBottom - 0.3],
        [k.baseR - k.slotDepth, k.slotTop + 0.3],
      ],
      SEGS,
    );
    g.well = lathe([
      [k.knobR + 0.9, k.baseTop],
      [k.knobR + 0.9, k.baseTop - 0.8],
      [27.6, k.baseTop - 0.8],
      [27.6, 6.2],
      [0, 6.2],
    ]);
    g.foot = lathe([
      [0, 0],
      [k.footR - 0.5, 0],
      [k.footR, 0.45],
      [k.footR, k.footH],
      [0, k.footH],
    ]);

    // Stationary hub: display under glass.
    g.hubSide = lathe([
      [k.hubR, 40.6],
      [k.hubR, 43.55],
    ]);
    // Cover glass: a polished bevel you can see edge-on, and a clear face.
    g.glassEdge = lathe([
      [k.hubR, 43.55],
      [k.hubR, 43.7],
      [k.hubR - 0.3, k.glassTop],
    ]);
    g.glass = lathe([
      [k.hubR - 0.3, k.glassTop],
      [0, k.glassTop],
    ]);
    g.display = new CircleGeometry(k.displayR, 128);
    g.display.rotateX(-Math.PI / 2);
    g.display.translate(0, 43.62, 0);
    g.bezel = new RingGeometry(k.displayR, k.hubR, 96, 1);
    g.bezel.rotateX(-Math.PI / 2);
    g.bezel.translate(0, 43.6, 0);

    // Ground planes
    g.shadow = new PlaneGeometry(140, 140);
    g.shadow.rotateX(-Math.PI / 2);
    g.glow = new PlaneGeometry(180, 180);
    g.glow.rotateX(-Math.PI / 2);

    // Internals
    g.battery = lathe(
      [
        [0, 6.5],
        [21.6, 6.5],
        [22.6, 6.8],
        [23, 7.7],
        [23, 11.3],
        [22.6, 12.2],
        [21.6, 12.5],
        [0, 12.5],
      ],
      96,
      true,
    );
    g.pcb = new CylinderGeometry(26.5, 26.5, 1.6, 96);
    g.pcb.translate(0, 14, 0);
    g.led = new BoxGeometry(1.9, 0.8, 1.3);
    g.chip = new BoxGeometry(5, 0.9, 5);
    g.chip.translate(0, 15.25, 0);
    g.usb = new BoxGeometry(9, 3.2, 7.2);
    g.usb.translate(0, 16.4, -21.5);
    g.smd = new BoxGeometry(1, 0.5, 0.6);
    g.statorCore = lathe([
      [0, 15.5],
      [17, 15.5],
      [17, 17.3],
      [5.2, 17.3],
      [5.2, 23.4],
      [0, 23.4],
    ]);
    g.coil = new BoxGeometry(4.8, 5.2, 8.6);
    g.tooth = new BoxGeometry(6.6, 6.2, 1.1);
    g.rotorRing = lathe([
      [22.6, 15.5],
      [24.2, 15.5],
      [24.2, 24.9],
      [12, 24.9],
      [12, 24.1],
      [22.6, 24.1],
      [22.6, 15.5],
    ]);
    g.magnet = new BoxGeometry(3.9, 8, 1.6);
    return g;
  }

  private buildSharedMaterials(): Record<string, Material> {
    const envMapIntensity = 1;
    return {
      chamfer: new MeshPhysicalMaterial({
        color: '#e7e7e4',
        metalness: 1,
        roughness: 0.12,
        anisotropy: 0.5,
        envMapIntensity: 1.15,
      }),
      dark: new MeshStandardMaterial({ color: '#0d0c0d', metalness: 0.4, roughness: 0.6 }),
      foot: new MeshStandardMaterial({ color: '#121012', metalness: 0, roughness: 0.92 }),
      hub: new MeshPhysicalMaterial({
        color: '#070707',
        metalness: 0.2,
        roughness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      }),
      bezel: new MeshBasicMaterial({ color: '#030303' }),
      // Clear, not additive: an additive face wrote full alpha and floated as an opaque
      // grey disc in the exploded view. Faint tint, strong mirror (scaled by opacity).
      glass: new MeshPhysicalMaterial({
        color: '#0b0b0c',
        metalness: 0,
        roughness: 0.02,
        ior: 1.52,
        specularIntensity: 1,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        envMapIntensity: 2.2,
      }),
      shadow: new MeshBasicMaterial({
        color: '#000000',
        map: this.tex.shadow,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      copper: new MeshPhysicalMaterial({
        color: '#c8783f',
        metalness: 1,
        roughness: 0.3,
        envMapIntensity,
      }),
      steel: new MeshStandardMaterial({ color: '#3b3b40', metalness: 0.85, roughness: 0.42 }),
      nickel: new MeshStandardMaterial({ color: '#c9cbd0', metalness: 1, roughness: 0.22 }),
      pcb: new MeshStandardMaterial({ color: '#10231a', metalness: 0.1, roughness: 0.55 }),
      chip: new MeshStandardMaterial({ color: '#0a0a0b', metalness: 0.2, roughness: 0.45 }),
      battery: new MeshPhysicalMaterial({
        color: '#5d6874',
        metalness: 0.55,
        roughness: 0.48,
        clearcoat: 0.3,
        envMapIntensity: 0.7,
      }),
    };
  }

  finishMats(f: Finish): FinishMats {
    let m = this.finishes.get(f.id);
    if (m) return m;
    // Very dark anodize reads as a black hole under IBL; lift the albedo a touch.
    const body = luminance(f.body) < 0.05 ? mix(f.body, '#ffffff', 0.16) : f.body;
    const color = new Color(body);
    const anod = f.id !== 'raw';
    m = {
      // Anodizing is a clear oxide over the metal: a glossy coat that carries the studio's
      // strip lights as crisp bands, which is what gives the dark finishes their form.
      body: new MeshPhysicalMaterial({
        color,
        metalness: f.metalness,
        roughness: f.roughness,
        clearcoat: anod ? 0.6 : 0,
        clearcoatRoughness: 0.22,
      }),
      top: new MeshPhysicalMaterial({
        color: new Color(mix(body, '#ffffff', anod ? 0.04 : 0.08)),
        metalness: f.metalness,
        roughness: Math.min(1, f.roughness * 1.18),
        roughnessMap: this.tex.rings,
        anisotropy: 0.55,
        anisotropyRotation: Math.PI / 2,
        clearcoat: anod ? 0.25 : 0,
        clearcoatRoughness: 0.35,
      }),
      knurl: new MeshPhysicalMaterial({
        color: new Color(mix(body, '#000000', 0.08)),
        metalness: f.metalness,
        roughness: Math.min(1, f.roughness + 0.04),
        normalMap: this.tex.knurl,
        normalScale: new Vector2(1, 1),
      }),
      base: new MeshPhysicalMaterial({
        color,
        metalness: f.metalness,
        roughness: Math.min(1, f.roughness + 0.1),
        clearcoat: anod ? 0.6 : 0,
        clearcoatRoughness: 0.22,
      }),
      bore: new MeshPhysicalMaterial({
        color: new Color(mix(f.body, '#000000', 0.55)),
        metalness: f.metalness,
        roughness: 0.5,
      }),
      // Lit, not painted: tone mapping must not dim the one signal on a dark page.
      indicator: new MeshBasicMaterial({ color: f.accent, toneMapped: false }),
    };
    this.finishes.set(f.id, m);
    return m;
  }

  /** Grow-only drawing buffer that fits the largest dial on the page. */
  private ensureSize(w: number, h: number) {
    if (w <= this.w && h <= this.h) return;
    this.w = Math.max(this.w, w);
    this.h = Math.max(this.h, h);
    this.renderer.setSize(this.w, this.h, false);
  }

  render(view: ThreeView) {
    if (this.lost) return;
    const { pw, ph } = view;
    if (pw < 2 || ph < 2) return;
    this.ensureSize(pw, ph);
    const r = this.renderer;
    r.setViewport(0, 0, pw, ph);
    r.setScissor(0, 0, pw, ph);
    r.setScissorTest(true);
    r.clear(true, true, true);
    r.render(view.scene, view.camera);
    const ctx = view.ctx;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(this.canvas, 0, this.h - ph, pw, ph, 0, 0, pw, ph);
  }
}

/** Give the main thread back between boot steps (input, rendering), then continue. */
function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return s?.yield ? s.yield() : new Promise((r) => setTimeout(r, 0));
}

let engine: Engine | null = null;
let booting: Promise<Engine | null> | null = null;

function getEngine(antialias: boolean): Promise<Engine | null> {
  booting ??= (async () => {
    try {
      const e = new Engine(antialias);
      await yieldToMain();
      await e.build();
      engine = e;
      // QA hook (dev builds only): window.__detentEngine.renderer.forceContextLoss()
      if (import.meta.env.DEV) (window as Window & { __detentEngine?: Engine }).__detentEngine = e;
      return e;
    } catch {
      return null;
    }
  })();
  return booting;
}

/* ------------------------------------------------------------------------ */
/* One dial's view                                                           */
/* ------------------------------------------------------------------------ */

export class ThreeView implements DialView {
  readonly kind = 'webgl2' as const;
  readonly el: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 5, 4000);
  pw = 0;
  ph = 0;
  private cssW = 1;
  private cssH = 1;
  onLost?: () => void;
  onRestored?: () => void;
  private g: Record<string, Object3D> = {};
  private finishId = '';
  private color = '';
  private dispCanvas: HTMLCanvasElement;
  private dispCtx: CanvasRenderingContext2D;
  private dispTex: CanvasTexture;
  private dispKey = '';
  private own: {
    slot: MeshBasicMaterial;
    glow: MeshBasicMaterial;
    led: MeshBasicMaterial;
    display: MeshBasicMaterial;
  };
  private meshes: Record<string, Mesh> = {};
  private lastState: ViewState | null = null;
  private tmp = new Vector3();
  private tmp2 = new Vector3();

  constructor(private engine: Engine) {
    this.el = document.createElement('canvas');
    this.el.className = 'dd-layer dd-canvas';
    this.el.setAttribute('aria-hidden', 'true');
    this.ctx = this.el.getContext('2d', { alpha: true })!;
    const e = engine;
    const G = e.geo;
    const M = e.mat;
    this.scene.environment = e.env;

    this.dispCanvas = document.createElement('canvas');
    this.dispCanvas.width = this.dispCanvas.height = 512;
    this.dispCtx = this.dispCanvas.getContext('2d')!;
    this.dispTex = new CanvasTexture(this.dispCanvas);
    this.dispTex.colorSpace = SRGBColorSpace;
    this.dispTex.generateMipmaps = false;
    this.dispTex.minFilter = LinearFilter;
    this.dispTex.anisotropy = Math.min(8, e.renderer.capabilities.getMaxAnisotropy());

    this.own = {
      slot: new MeshBasicMaterial({ map: e.tex.leds, toneMapped: false }),
      glow: new MeshBasicMaterial({
        map: e.tex.glow,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: GLOW,
      }),
      led: new MeshBasicMaterial({ toneMapped: false }),
      display: new MeshBasicMaterial({ map: this.dispTex, toneMapped: false }),
    };

    const group = (name: string, parent: Object3D = this.scene) => {
      const g = new Group();
      g.name = name;
      parent.add(g);
      this.g[name] = g;
      return g;
    };
    const mesh = (
      name: string,
      geo: BufferGeometry,
      mat: Material,
      parent: Object3D,
      order = 0,
    ) => {
      const m = new Mesh(geo, mat);
      m.renderOrder = order;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      parent.add(m);
      this.meshes[name] = m;
      return m;
    };

    const ground = group('ground');
    mesh('shadow', G.shadow!, M.shadow!, ground, 1).position.y = 0.02;
    mesh('glow', G.glow!, this.own.glow, ground, 2).position.y = 0.04;
    this.meshes.shadow!.updateMatrix();
    this.meshes.glow!.updateMatrix();

    const foot = group('foot');
    mesh('foot', G.foot!, M.foot!, foot);

    const base = group('base');
    mesh('baseBody', G.baseBody!, M.dark!, base);
    mesh('baseWall', G.baseWall!, M.dark!, base);
    mesh('baseTop', G.baseTop!, M.dark!, base);
    mesh('baseChamfer', G.baseChamfer!, M.chamfer!, base);
    mesh('slotRecess', G.slotRecess!, M.dark!, base);
    mesh('slotCeil', G.slotCeil!, M.dark!, base);
    mesh('slot', G.slot!, this.own.slot, base);
    mesh('well', G.well!, M.dark!, base);

    const battery = group('battery');
    mesh('battery', G.battery!, M.battery!, battery);

    const encoder = group('encoder');
    mesh('pcb', G.pcb!, M.pcb!, encoder);
    mesh('chip', G.chip!, M.chip!, encoder);
    mesh('usb', G.usb!, M.nickel!, encoder);
    const leds = new InstancedMesh(G.led!, this.own.led, 24);
    const smd = new InstancedMesh(G.smd!, M.steel!, 36);
    const o = new Object3D();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      o.position.set(25.1 * Math.sin(a), 15.2, 25.1 * Math.cos(a));
      o.rotation.set(0, a, 0);
      o.updateMatrix();
      leds.setMatrixAt(i, o.matrix);
    }
    const rnd = lcg(42);
    for (let i = 0; i < 36; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 6 + rnd() * 15;
      o.position.set(r * Math.sin(a), 15.05, r * Math.cos(a));
      o.rotation.set(0, rnd() * Math.PI, 0);
      o.scale.setScalar(0.8 + rnd() * 1.4);
      o.updateMatrix();
      smd.setMatrixAt(i, o.matrix);
    }
    encoder.add(leds, smd);

    const stator = group('stator');
    mesh('statorCore', G.statorCore!, M.steel!, stator);
    const coils = new InstancedMesh(G.coil!, M.copper!, 12);
    const teeth = new InstancedMesh(G.tooth!, M.steel!, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      o.scale.setScalar(1);
      o.rotation.set(0, a, 0);
      o.position.set(11 * Math.sin(a), 20.2, 11 * Math.cos(a));
      o.updateMatrix();
      coils.setMatrixAt(i, o.matrix);
      o.position.set(16.3 * Math.sin(a), 20.2, 16.3 * Math.cos(a));
      o.updateMatrix();
      teeth.setMatrixAt(i, o.matrix);
    }
    stator.add(coils, teeth);

    const rotor = group('rotor');
    mesh('rotorRing', G.rotorRing!, M.steel!, rotor);
    const magnets = new InstancedMesh(G.magnet!, M.nickel!, 14);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      o.rotation.set(0, a, 0);
      o.position.set(21.7 * Math.sin(a), 19.8, 21.7 * Math.cos(a));
      o.updateMatrix();
      magnets.setMatrixAt(i, o.matrix);
    }
    rotor.add(magnets);

    const knob = group('knob');
    mesh('knobBody', G.knobBody!, M.dark!, knob);
    mesh('knobUpper', G.knobUpper!, M.dark!, knob);
    mesh('knurl', G.knurl!, M.dark!, knob);
    mesh('knobTop', G.knobTop!, M.dark!, knob);
    mesh('knobChamfer', G.knobChamfer!, M.chamfer!, knob);
    mesh('knobInner', G.knobInner!, M.chamfer!, knob);
    mesh('bore', G.bore!, M.dark!, knob);
    mesh('groove', G.groove!, M.bezel!, knob);
    mesh('indicator', G.indicator!, M.dark!, knob);

    const display = group('display');
    mesh('hubSide', G.hubSide!, M.hub!, display);
    mesh('bezel', G.bezel!, M.bezel!, display);
    mesh('display', G.display!, this.own.display, display);
    const glass = group('glass');
    mesh('glassEdge', G.glassEdge!, M.chamfer!, glass);
    mesh('glass', G.glass!, M.glass!, glass, 5);

    engine.views.add(this);
  }

  resize(w: number, h: number, dpr: number): void {
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    const pw = Math.max(2, Math.round(w * dpr));
    const ph = Math.max(2, Math.round(h * dpr));
    if (pw !== this.pw || ph !== this.ph) {
      this.pw = this.el.width = pw;
      this.ph = this.el.height = ph;
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyFinish(f: Finish) {
    const m = this.engine.finishMats(f);
    const set = (name: string, mat: Material) => (this.meshes[name]!.material = mat);
    set('knobBody', m.body);
    set('knobUpper', m.body);
    set('knurl', m.knurl);
    set('knobTop', m.top);
    set('bore', m.bore);
    set('indicator', m.indicator);
    set('baseBody', m.base);
    set('baseWall', m.base);
    set('baseTop', m.base);
  }

  private applyColor(hex: string) {
    const c = new Color(hex);
    this.own.slot.color.set(mix(hex, '#ffffff', 0.18));
    this.own.glow.color.copy(c);
    this.own.led.color.copy(c);
  }

  /** Swap in finish materials and colors without rendering (before compileAsync). */
  prime(s: ViewState): void {
    if (this.finishId !== s.finish.id) {
      this.finishId = s.finish.id;
      this.applyFinish(s.finish);
    }
    if (this.color !== s.color) {
      this.color = s.color;
      this.applyColor(s.color);
    }
  }

  draw(s: ViewState): void {
    this.lastState = s;
    if (this.finishId !== s.finish.id) {
      this.finishId = s.finish.id;
      this.applyFinish(s.finish);
    }
    if (this.color !== s.color) {
      this.color = s.color;
      this.applyColor(s.color);
    }

    // Explode choreography
    const L = (id: (typeof PARTS)[number]['id']) => partLift(id, s.explode);
    const seat = s.press * 0.45;
    const g = this.g;
    const footY = L('foot');
    g.foot!.position.y = footY;
    g.ground!.position.y = footY;
    const apart = Math.min(1, s.explode * 1.6);
    const glowMap = this.engine.glowMap(s.day);
    if (this.own.glow.map !== glowMap) this.own.glow.map = glowMap;
    this.own.glow.opacity = (s.day ? GLOW_DAY : GLOW) * (1 - 0.85 * apart);
    for (const id of ['battery', 'encoder', 'stator', 'rotor'] as const) {
      const part = PARTS.find((p) => p.id === id)!;
      const prog = partProgress(part.order, s.explode);
      g[id]!.visible = prog > 0.001;
      g[id]!.position.y = part.lift * prog;
    }
    g.rotor!.rotation.y = -partProgress(3, s.explode) * 60 * DEG;
    g.knob!.position.y = L('knob') - seat;
    g.knob!.rotation.y = -(s.theta + partProgress(2, s.explode) * 40 * DEG);
    g.display!.position.y = L('display') - seat * 0.3;
    g.glass!.position.y = L('glass') - seat * 0.3;

    // Display texture: redraw only when what it shows changes.
    const model = {
      name: s.name,
      color: s.color,
      text: s.text,
      sub: s.sub,
      theta: s.theta,
      index: s.index,
      p: s.p,
      snap: s.snap,
      press: s.press,
    };
    const key = displayKey(model);
    if (key !== this.dispKey) {
      this.dispKey = key;
      drawDisplay(this.dispCtx, 512, model);
      this.dispTex.needsUpdate = true;
    }

    // Camera
    const r = s.rig;
    const aspect = this.cssW / this.cssH;
    const dist = r.dist * (aspect < 1 ? 1 / aspect : 1);
    const el = Math.min(89.5, r.el) * DEG;
    const az = r.az * DEG;
    this.camera.position.set(
      dist * Math.cos(el) * Math.sin(az),
      r.ty + dist * Math.sin(el),
      dist * Math.cos(el) * Math.cos(az),
    );
    this.camera.lookAt(0, r.ty, 0);
    this.camera.updateMatrixWorld();

    // Knurl frequency clamp: when a tooth is only a few pixels wide the normal map
    // aliases into moiré, so fade it out (materials are shared; set per render). Full
    // relief from 10 px a tooth; a 1x desktop's ~5 px keeps a trace of it, enough to
    // read as knurl without stair-stepped cells crawling as the knob turns.
    const pxPerMM = this.ph / (2 * Math.tan((FOV / 2) * DEG) * dist);
    const pxPerTooth = ((2 * Math.PI * MM.knobR) / KNURL_TEETH) * pxPerMM;
    const k = Math.max(0.08, Math.min(1, (pxPerTooth - 4) / 6));
    this.engine.finishMats(s.finish).knurl.normalScale.set(k, k);

    this.engine.render(this);
  }

  /** Re-render the last state (after resize or context restore). */
  redraw(): void {
    if (this.lastState) this.draw(this.lastState);
  }

  private project(x: number, y: number, z: number) {
    const v = this.tmp.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.cssW, y: (-v.y * 0.5 + 0.5) * this.cssH };
  }

  knobCircle(): KnobCircle | null {
    const s = this.lastState;
    if (!s) return null;
    const lift = partLift('knob', s.explode) - s.press * 0.45;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const y of [MM.knobBottom, MM.glassTop]) {
        const p = this.project(MM.knobR * Math.sin(a), y + lift, MM.knobR * Math.cos(a));
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
    }
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) / 2 };
  }

  grip(px: number, py: number): KnobGrip | null {
    const s = this.lastState;
    if (!s) return null;
    const face = MM.knobTop + partLift('knob', s.explode) - s.press * 0.45;
    const cam = this.camera.position;
    // The knob's projected radius, measured along the screen's horizontal at the face.
    const right = this.tmp2.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const c = this.project(0, face, 0);
    const e = this.project(right.x * MM.knobR, face + right.y * MM.knobR, right.z * MM.knobR);
    const rpx = Math.max(1, Math.hypot(e.x - c.x, e.y - c.y));
    if (cam.y < face + 1) return { a: 0, r: Infinity, side: true, rpx };
    // Cast the pointer onto the plane of the top face.
    const dir = this.tmp
      .set((px / this.cssW) * 2 - 1, 1 - (py / this.cssH) * 2, 0.5)
      .unproject(this.camera)
      .sub(cam);
    if (dir.y > -1e-6) return { a: 0, r: Infinity, side: false, rpx };
    const t = (face - cam.y) / dir.y;
    const x = cam.x + dir.x * t;
    const z = cam.z + dir.z * t;
    const r = Math.hypot(x, z) / MM.knobR;
    // In front of the axis (toward the camera) and off the face: the knurled band.
    const front = x * cam.x + z * cam.z > 0;
    return { a: Math.atan2(x, -z), r, side: r > 1 && front, rpx };
  }

  outline(): Ellipse | null {
    const s = this.lastState;
    if (!s) return null;
    const pts: { x: number; y: number }[] = [];
    for (const [r, y] of hullRings(s.explode, s.press * 0.45)) {
      for (let i = 0; i < 24; i++) {
        const b = (i / 24) * Math.PI * 2;
        pts.push(this.project(r * Math.sin(b), y, r * Math.cos(b)));
      }
    }
    return enclose(pts);
  }

  anchors(): DialPartAnchor[] {
    const s = this.lastState;
    const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    return PARTS.map((p) => {
      const lift = s ? partLift(p.id, s.explode) : 0;
      const pt = this.project(right.x * p.r, p.y + lift + right.y * p.r, right.z * p.r);
      const visible =
        p.lift === 0 || ['knob', 'display', 'glass', 'foot'].includes(p.id) || Math.abs(lift) > 0.5;
      return { id: p.id, x: pt.x, y: pt.y, visible };
    });
  }

  dispose(): void {
    this.engine.views.delete(this);
    this.el.remove();
    this.dispTex.dispose();
    Object.values(this.own).forEach((m) => m.dispose());
    this.scene.traverse((o) => {
      if (o instanceof InstancedMesh) o.dispose();
    });
  }
}

export interface ThreeOptions {
  antialias: boolean;
}

/** Create a 3D view, or null when WebGL2 is unavailable/lost. */
export async function createThreeView(
  opts: ThreeOptions,
  initial?: ViewState,
): Promise<ThreeView | null> {
  await loadDisplayFonts();
  const e = await getEngine(opts.antialias);
  if (!e || e.lost) return null;
  await yieldToMain();
  const view = new ThreeView(e);
  if (initial) view.prime(initial);
  await yieldToMain();
  // Compile shaders without blocking input where the driver can (KHR_parallel_shader_compile).
  if (e.renderer.extensions.has('KHR_parallel_shader_compile')) {
    try {
      await e.renderer.compileAsync(view.scene, view.camera);
    } catch {
      /* an optimisation only; the first render compiles anyway */
    }
  }
  return view;
}

/** How many times the page's GPU context was lost (the element gives up after 2). */
export function contextLosses(): number {
  return engine?.losses ?? 0;
}
