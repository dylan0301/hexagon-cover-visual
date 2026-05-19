import type { Point, TriangleState } from './types';
import { canvasToMath, config, mathToCanvas, scaleToCanvas, scaleToMath } from './coords';
import {
  clampPointToCircle,
  clampPointToTriangle,
  closestPointOnSegment,
  distance,
  distanceToCircleBorder,
  distanceToSegment,
  distanceToTriangleBorder,
  pointInCircle,
  pointInTriangle,
  rotatePoint,
} from './geometry';
import { HEXAGON_VERTICES } from './hexagon';
import { CIRCUMRADIUS, getValidRegion, getVertices } from './triangle';
import { fitTriangle } from './cover';

const SQRT3 = Math.sqrt(3);
const ANGLE_PERIOD = 2 * Math.PI / 3;
const EPS = 1e-7;
const EPS2 = 1e-12;
const REGION_VERTEX_HIT_PX = 12;
const POINT_HIT_PX = 14;
const LOCAL_C_HIT_PX = 8;
const LOCAL_C_RAY_HIT_PX = 10;
const CONTROL_POINT_HIT_PX = 8;
const BORDER_HIT_PX = 6;
const MARK_HIT_PX = 9;
const CLICK_CANCEL_PX = 6;
const PEN_HIT_SCALE = 1.35;
const TOUCH_HIT_SCALE = 1.75;
const COVER_RGBA = [157, 219, 198, 150] as const;
const UNCOVERED_RGBA = [220, 38, 38, 145] as const;
const BOUNDARY_COLORS = ['#344e86', '#8a3ffc', '#0f766e', '#b45309', '#be123c', '#475569'];
const HEX_AXIS_HULL_STEPS = 3;
const HEX_AXIS_HULL_NEAR_EQUALITY_SUM = 0.9;
const FAR_PAIR_DIRECTIONS = Array.from({ length: 48 }, (_, index) => {
  const angle = Math.PI * index / 48;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

export type AbUnionCenterMode = 'none' | 'triangle' | 'circle' | 'local-c';
export type AbUnionQuality = 'coarse' | 'high' | 'adaptive';
export type AbUnionPreset = 'equality' | 'midpoint';
export type AbUnionTool = 'move' | 'add' | 'delete' | 'd-mark' | 's-mark' | 'f-mark';
export type AbUnionLockKind = 'a' | 'b';
export type AbUnionLabelMode = 'dynamic' | 'static';
export type AbUnionCoincidenceRole = 'shared' | 'left' | 'right';
export type AbUnionMarkSourceKind =
  | 'hex-edge'
  | 'half-diagonal'
  | 'center-triangle-edge'
  | 'center-circle';

export interface AbUnionEdgeDots {
  left: number;
  right: number;
  split: boolean;
}

export interface AbUnionMarkSourceRef {
  kind: AbUnionMarkSourceKind;
  index: number;
}

export interface AbUnionLabel {
  id: string;
  name: string;
  mode: AbUnionLabelMode;
  first: AbUnionMarkSourceRef | null;
  second: AbUnionMarkSourceRef | null;
  point: Point | null;
}

export interface AbUnionCoincidenceLock {
  labelId: string;
  edge: number;
  role: AbUnionCoincidenceRole;
}

export interface AbUnionCoincidenceTarget {
  edge: number;
  role: AbUnionCoincidenceRole;
  label: string;
  locked: boolean;
}

export interface AbUnionFMark {
  id: string;
  point: Point;
}

export interface AbUnionState {
  edgeDots: AbUnionEdgeDots[];
  tool: AbUnionTool;
  theta: number;
  centerMode: AbUnionCenterMode;
  centerLocked: boolean;
  quality: AbUnionQuality;
  showRegion: boolean;
  showThetaTriangle: boolean;
  showFarPair: boolean;
  clipToCornerSectors: boolean;
  useAxisAlignedHull: boolean;
  regionVisible: boolean[];
  aLocked: boolean[];
  bLocked: boolean[];
  fixedSums: Array<number | null>;
  activeRegions: boolean[];
  labels: AbUnionLabel[];
  selectedMarkSources: AbUnionMarkSourceRef[];
  coincidenceLocks: AbUnionCoincidenceLock[];
  fMarks: AbUnionFMark[];
  selectedFMarkId: string | null;
  status: string;
  lastOptimized: AbUnionOptimization | null;
}

export interface AbUnionEdgeRow {
  index: number;
  left: number;
  right: number;
  split: boolean;
}

export interface AbUnionRegionRow {
  index: number;
  a: number;
  b: number;
  sum: number;
  distance: number;
  equality: boolean;
  aLocked: boolean;
  bLocked: boolean;
  fixedSum: number | null;
  state: 'active' | 'limit' | 'empty';
}

export interface AbUnionOptimization {
  theta: number;
  L: number;
}

export interface AbUnionRenderResult {
  currentL: number;
  thetaTriangle: Point[] | null;
  uncoveredCount: number;
  analysisCount: number;
  centerContains: boolean;
  centerFailures: number;
  farPair: AbUnionFarPair | null;
  minEqualityGap: number;
  fMarkCount: number;
  fMarkDistance: number | null;
  fMarkTriangleSide: number | null;
  edgeRows: AbUnionEdgeRow[];
  regionRows: AbUnionRegionRow[];
  activeLabel: string;
}

export interface AbUnionFarPair {
  start: Point;
  end: Point;
  distance: number;
  exceedsUnit: boolean;
}

interface MaskCache {
  size: number;
  center: number;
  scale: number;
  offscreen: HTMLCanvasElement;
  offctx: CanvasRenderingContext2D;
  overlay: ImageData;
  insideMap: Int32Array;
  pixelIndex: Uint32Array;
  xWorld: Float32Array;
  yWorld: Float32Array;
  localU: Float32Array[];
  localV: Float32Array[];
  maskBits: Uint8Array;
}

export interface AbUnionHexAxisHullSlab {
  uStart: number;
  uEnd: number;
  maxV: number;
  minDelta: number;
  maxDelta: number;
}

export interface AbUnionHexAxisHull {
  maxU: number;
  slabs: AbUnionHexAxisHullSlab[];
}

type HexAxisHull = AbUnionHexAxisHull;

type PointerInteraction =
  | { kind: 'idle' }
  | { kind: 'pending-click'; startMouse: Point; hit: AbUnionHitTarget | null }
  | { kind: 'dragging-dot'; dot: AbUnionDotHandle; startMouse: Point; moved: boolean }
  | { kind: 'dragging-f-mark'; id: string; startMouse: Point; moved: boolean }
  | { kind: 'dragging-local-c'; index: number }
  | { kind: 'dragging-center'; startMouse: Point; startPos: Point; startControl: Point }
  | { kind: 'rotating-triangle'; startMouse: Point; startAngle: number; startPos: Point }
  | { kind: 'dragging-control'; startMouse: Point; startControl: Point };

type AbUnionDotRole = 'left' | 'right' | 'shared';

interface AbUnionDotHandle {
  edge: number;
  role: AbUnionDotRole;
}

type AbUnionHitTarget =
  | { kind: 'dot'; dot: AbUnionDotHandle }
  | { kind: 'edge'; index: number }
  | { kind: 'v'; index: number }
  | { kind: 'local-c'; index: number }
  | { kind: 'center-control' }
  | { kind: 'center-border' }
  | { kind: 'center-interior' };

type AbUnionMarkPrimitive =
  | { kind: 'line'; ref: AbUnionMarkSourceRef; label: string; start: Point; end: Point }
  | { kind: 'circle'; ref: AbUnionMarkSourceRef; label: string; center: Point; radius: number };

const cacheBySize = new Map<number, MaskCache>();

function mod6(index: number): number {
  return (index + 6) % 6;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function edgeVector(index: number): Point {
  const start = HEXAGON_VERTICES[index];
  const end = HEXAGON_VERTICES[mod6(index + 1)];
  return { x: end.x - start.x, y: end.y - start.y };
}

function localCPoint(index: number, localC: number): Point {
  const vertex = HEXAGON_VERTICES[index];
  const radius = 1 - clamp01(localC);
  return { x: vertex.x * radius, y: vertex.y * radius };
}

function defaultEdgeDots(value: number): AbUnionEdgeDots {
  const clamped = clamp01(value);
  return { left: clamped, right: clamped, split: false };
}

function pointOnEdge(index: number, value: number): Point {
  const start = HEXAGON_VERTICES[index];
  const edge = edgeVector(index);
  const clamped = clamp01(value);
  return { x: start.x + clamped * edge.x, y: start.y + clamped * edge.y };
}

function bValue(state: AbUnionState, index: number): number {
  return clamp01(state.edgeDots[mod6(index)]?.left ?? 0);
}

function aValue(state: AbUnionState, index: number): number {
  return 1 - clamp01(state.edgeDots[mod6(index - 1)]?.right ?? 0);
}

export function abUnionBValues(state: AbUnionState): number[] {
  normalizeAbUnionState(state);
  return Array.from({ length: 6 }, (_, index) => bValue(state, index));
}

export function abUnionAValues(state: AbUnionState): number[] {
  normalizeAbUnionState(state);
  return Array.from({ length: 6 }, (_, index) => aValue(state, index));
}

function pointInHex(point: Point): boolean {
  let inside = false;
  for (let i = 0, j = 5; i < 6; j = i++) {
    const vi = HEXAGON_VERTICES[i];
    const vj = HEXAGON_VERTICES[j];
    const crosses = (vi.y > point.y) !== (vj.y > point.y);
    if (crosses) {
      const xAtY = ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x;
      if (point.x < xAtY) inside = !inside;
    }
  }
  return inside;
}

function pointInClosedHex(point: Point): boolean {
  for (let i = 0; i < 6; i++) {
    const a = HEXAGON_VERTICES[i];
    const b = HEXAGON_VERTICES[mod6(i + 1)];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross < -EPS) return false;
  }
  return true;
}

function clampPointToHexagon(point: Point): Point {
  if (pointInClosedHex(point)) return point;
  let best = closestPointOnSegment(point, HEXAGON_VERTICES[0], HEXAGON_VERTICES[1]);
  let bestDistance = distance(point, best);
  for (let i = 1; i < 6; i++) {
    const candidate = closestPointOnSegment(point, HEXAGON_VERTICES[i], HEXAGON_VERTICES[mod6(i + 1)]);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function createMaskCache(sizeInput: number): MaskCache {
  const size = Math.max(1, Math.round(sizeInput));
  const center = size / 2;
  const scale = size * 0.4;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const offctx = offscreen.getContext('2d');
  if (!offctx) {
    throw new Error('2D canvas not supported');
  }

  const insideMap = new Int32Array(size * size);
  insideMap.fill(-1);
  const pixelIndexList: number[] = [];
  const xWorldList: number[] = [];
  const yWorldList: number[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = (x + 0.5 - center) / scale;
      const wy = (center - (y + 0.5)) / scale;
      if (!pointInHex({ x: wx, y: wy })) continue;
      const pixelIndexValue = y * size + x;
      insideMap[pixelIndexValue] = pixelIndexList.length;
      pixelIndexList.push(pixelIndexValue);
      xWorldList.push(wx);
      yWorldList.push(wy);
    }
  }

  const pixelIndex = Uint32Array.from(pixelIndexList);
  const xWorld = Float32Array.from(xWorldList);
  const yWorld = Float32Array.from(yWorldList);
  const localU = Array.from({ length: 6 }, () => new Float32Array(pixelIndex.length));
  const localV = Array.from({ length: 6 }, () => new Float32Array(pixelIndex.length));

  for (let i = 0; i < 6; i++) {
    const out = edgeVector(i);
    const inc = {
      x: HEXAGON_VERTICES[mod6(i - 1)].x - HEXAGON_VERTICES[i].x,
      y: HEXAGON_VERTICES[mod6(i - 1)].y - HEXAGON_VERTICES[i].y,
    };
    for (let k = 0; k < pixelIndex.length; k++) {
      const rx = xWorld[k] - HEXAGON_VERTICES[i].x;
      const ry = yWorld[k] - HEXAGON_VERTICES[i].y;
      const dOut = rx * out.x + ry * out.y;
      const dIn = rx * inc.x + ry * inc.y;
      localU[i][k] = (4 / 3) * (dOut + 0.5 * dIn);
      localV[i][k] = (4 / 3) * (0.5 * dOut + dIn);
    }
  }

  return {
    size,
    center,
    scale,
    offscreen,
    offctx,
    overlay: offctx.createImageData(size, size),
    insideMap,
    pixelIndex,
    xWorld,
    yWorld,
    localU,
    localV,
    maskBits: new Uint8Array(pixelIndex.length),
  };
}

function getMaskCache(sizeInput: number): MaskCache {
  const size = Math.max(1, Math.round(sizeInput));
  const existing = cacheBySize.get(size);
  if (existing) return existing;
  const cache = createMaskCache(size);
  cacheBySize.set(size, cache);
  return cache;
}

function containsConeRegion(u: number, v: number, outLen: number, inLen: number): boolean {
  if (u < -EPS || v < -EPS) return false;

  const a = outLen;
  const b = inLen;
  const s2 = a * a + a * b + b * b;
  if (s2 > 1 + EPS) return false;

  if (a < EPS && b < EPS) {
    return u * u + v * v - u * v <= 1 + EPS;
  }

  if (a > EPS && b > EPS) {
    if (b * u + a * v <= a * b + EPS) return true;
  } else if (a > EPS) {
    if (Math.abs(v) <= EPS && u <= a + EPS) return true;
  } else if (b > EPS) {
    if (Math.abs(u) <= EPS && v <= b + EPS) return true;
  }

  if (Math.max(a + b, a - u + v, u + b, v) <= 1 + EPS) return true;
  if (Math.max(a + b, b - v + u, v + a, u) <= 1 + EPS) return true;

  const du = u - a;
  const da2 = du * du + v * v - du * v;
  if (da2 > EPS2) {
    const da = Math.sqrt(da2);
    const p = a * (a - u + v) + b * v;
    const q = a * (a - u);
    const s = a * (a + b - u) + b * (v - u);
    const ell = Math.max(da, p / da) - Math.min(0, q / da, s / da);
    if (ell <= 1 + EPS) return true;
  }

  const dv = v - b;
  const db2 = u * u + dv * dv - u * dv;
  if (db2 > EPS2) {
    const db = Math.sqrt(db2);
    const p = b * (b - v + u) + a * u;
    const q = b * (b - v);
    const s = b * (a + b - v) + a * (u - v);
    const ell = Math.max(db, p / db) - Math.min(0, q / db, s / db);
    if (ell <= 1 + EPS) return true;
  }

  return false;
}

export function containsAbUnionLocal(u: number, v: number, a: number, b: number): boolean {
  return containsConeRegion(u, v, b, a);
}

function inCornerSector(u: number, v: number): boolean {
  return u <= 1 + EPS && v <= 1 + EPS;
}

function containsExactRegionLocal(
  state: AbUnionState,
  u: number,
  v: number,
  outLen: number,
  inLen: number,
): boolean {
  return (
    (!state.clipToCornerSectors || inCornerSector(u, v)) &&
    containsConeRegion(u, v, outLen, inLen)
  );
}

function shouldUseHexAxisHull(state: AbUnionState, outLen: number, inLen: number): boolean {
  return state.useAxisAlignedHull && outLen + inLen < 1 - EPS;
}

function emptyHexAxisHull(): HexAxisHull {
  return {
    maxU: 0,
    slabs: [],
  };
}

export function abUnionAdjacentBoundaryHit(edgeOppositeLength: number): number {
  const value = clamp01(edgeOppositeLength);
  return Math.max(0, (-value + Math.sqrt(Math.max(0, 4 - 3 * value * value))) / 2);
}

interface HexAxisHullSample {
  u: number;
  v: number;
  delta: number;
}

interface RawHexAxisHullSlab {
  uStart: number;
  uEnd: number;
  maxV: number;
  minDelta: number;
  maxDelta: number;
  found: boolean;
}

function uniqueSortedBreakpoints(values: number[], maxU: number): number[] {
  return values
    .map((value) => Math.max(0, Math.min(maxU, value)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > EPS);
}

function adaptiveHexAxisHullBreakpoints(
  samples: HexAxisHullSample[],
  maxU: number,
  outLen: number,
  inLen: number,
  margin: number,
): number[] {
  const bottomHit = abUnionAdjacentBoundaryHit(inLen);
  const leftHit = abUnionAdjacentBoundaryHit(outLen);
  const coarse = Array.from({ length: HEX_AXIS_HULL_STEPS + 1 }, (_, index) =>
    (maxU * index) / HEX_AXIS_HULL_STEPS,
  );

  if (outLen + inLen < HEX_AXIS_HULL_NEAR_EQUALITY_SUM) {
    return uniqueSortedBreakpoints(coarse, maxU);
  }

  const topStart = samples.reduce(
    (best, sample) => sample.v >= 1 - 2 * margin ? Math.min(best, sample.u) : best,
    Number.POSITIVE_INFINITY,
  );
  const rightShelfV = Math.max(0, Math.min(1, 1 - outLen + margin));
  const rightShelfStart = samples.reduce(
    (best, sample) => sample.v > rightShelfV + EPS ? Math.max(best, sample.u) : best,
    0,
  );
  return uniqueSortedBreakpoints([
    0,
    1 - leftHit,
    1 - inLen,
    Number.isFinite(topStart) ? topStart + margin : 1 - leftHit,
    rightShelfStart + margin,
    bottomHit,
    maxU,
  ], maxU);
}

function fillRawHexAxisSlabs(slabs: RawHexAxisHullSlab[]): void {
  let previous: RawHexAxisHullSlab | null = null;
  for (const slab of slabs) {
    if (slab.found) {
      previous = slab;
    } else if (previous) {
      slab.maxV = previous.maxV;
      slab.minDelta = previous.minDelta;
      slab.maxDelta = previous.maxDelta;
    }
  }

  let next: RawHexAxisHullSlab | null = null;
  for (let index = slabs.length - 1; index >= 0; index--) {
    const slab = slabs[index];
    if (slab.found) {
      next = slab;
    } else if (next) {
      slab.maxV = next.maxV;
      slab.minDelta = next.minDelta;
      slab.maxDelta = next.maxDelta;
    }
  }
}

function buildHexAxisHullFromSamples(
  sampleCount: number,
  getU: (index: number) => number,
  getV: (index: number) => number,
  containsSample: (index: number, u: number, v: number) => boolean,
  outLen: number,
  inLen: number,
  margin: number,
): HexAxisHull {
  let found = false;
  let maxU = 0;
  let minDelta = Number.POSITIVE_INFINITY;
  let maxDelta = Number.NEGATIVE_INFINITY;
  const samples: HexAxisHullSample[] = [];

  for (let k = 0; k < sampleCount; k++) {
    const u = getU(k);
    const v = getV(k);
    if (!containsSample(k, u, v)) continue;
    const delta = u - v;
    found = true;
    samples.push({ u, v, delta });
    maxU = Math.max(maxU, u);
    minDelta = Math.min(minDelta, delta);
    maxDelta = Math.max(maxDelta, delta);
  }

  if (!found) return emptyHexAxisHull();

  const bottomHit = abUnionAdjacentBoundaryHit(inLen);
  const leftHit = abUnionAdjacentBoundaryHit(outLen);
  const hullMaxU = Math.max(maxU, bottomHit) + margin;
  const globalMinDelta = Math.min(-leftHit, minDelta) - margin;
  const globalMaxDelta = Math.max(bottomHit, maxDelta) + margin;
  samples.push({ u: bottomHit, v: 0, delta: bottomHit });
  samples.push({ u: 0, v: leftHit, delta: -leftHit });

  const breakpoints = adaptiveHexAxisHullBreakpoints(samples, hullMaxU, outLen, inLen, margin);
  const rawSlabs: RawHexAxisHullSlab[] = [];
  for (let index = 0; index < breakpoints.length - 1; index++) {
    rawSlabs.push({
      uStart: breakpoints[index],
      uEnd: breakpoints[index + 1],
      maxV: Number.NEGATIVE_INFINITY,
      minDelta: Number.POSITIVE_INFINITY,
      maxDelta: Number.NEGATIVE_INFINITY,
      found: false,
    });
  }

  for (const sample of samples) {
    const slabIndex = rawSlabs.findIndex((slab, index) =>
      sample.u >= slab.uStart - EPS &&
      (sample.u < slab.uEnd - EPS || index === rawSlabs.length - 1 && sample.u <= slab.uEnd + EPS),
    );
    const slab = rawSlabs[
      slabIndex >= 0
        ? slabIndex
        : sample.u <= rawSlabs[0].uStart ? 0 : rawSlabs.length - 1
    ];
    slab.found = true;
    slab.maxV = Math.max(slab.maxV, Math.max(0, sample.v) + margin);
    slab.minDelta = Math.min(slab.minDelta, sample.delta);
    slab.maxDelta = Math.max(slab.maxDelta, sample.delta);
  }

  const useLocalDelta = outLen + inLen >= HEX_AXIS_HULL_NEAR_EQUALITY_SUM;
  fillRawHexAxisSlabs(rawSlabs);
  if (!useLocalDelta) {
    for (let i = rawSlabs.length - 2; i >= 0; i--) {
      rawSlabs[i].maxV = Math.max(rawSlabs[i].maxV, rawSlabs[i + 1].maxV);
    }
  }
  return {
    maxU: hullMaxU,
    slabs: rawSlabs.map((slab) => {
      const useLocalMaxDelta = useLocalDelta && slab.uStart >= bottomHit - EPS;
      return {
        uStart: slab.uStart,
        uEnd: slab.uEnd,
        maxV: slab.maxV,
        minDelta: useLocalDelta ? slab.minDelta - margin : globalMinDelta,
        maxDelta: useLocalMaxDelta ? slab.maxDelta + margin : globalMaxDelta,
      };
    }),
  };
}

function buildHexAxisHull(
  cache: MaskCache,
  state: AbUnionState,
  regionIndex: number,
  outLen: number,
  inLen: number,
): HexAxisHull {
  return buildHexAxisHullFromSamples(
    cache.pixelIndex.length,
    (index) => cache.localU[regionIndex][index],
    (index) => cache.localV[regionIndex][index],
    (_index, u, v) => containsExactRegionLocal(state, u, v, outLen, inLen),
    outLen,
    inLen,
    2 / cache.scale,
  );
}

export function buildAbUnionLocalHexAxisHull(
  a: number,
  b: number,
  sampleSteps: number,
  margin: number,
): AbUnionHexAxisHull {
  const steps = Math.max(1, Math.floor(sampleSteps));
  const samplesPerAxis = steps + 1;
  const sampleCount = samplesPerAxis * samplesPerAxis;
  const outLen = clamp01(b);
  const inLen = clamp01(a);

  return buildHexAxisHullFromSamples(
    sampleCount,
    (index) => Math.floor(index / samplesPerAxis) / steps,
    (index) => (index % samplesPerAxis) / steps,
    (_index, u, v) => containsConeRegion(u, v, outLen, inLen),
    outLen,
    inLen,
    Math.max(0, margin),
  );
}

function buildHexAxisHulls(
  cache: MaskCache,
  state: AbUnionState,
  out: number[],
  inc: number[],
): Array<HexAxisHull | null> {
  return Array.from({ length: 6 }, (_, index) =>
    shouldUseHexAxisHull(state, out[index], inc[index])
      ? buildHexAxisHull(cache, state, index, out[index], inc[index])
      : null,
  );
}

function pointInHexAxisHull(u: number, v: number, hull: HexAxisHull): boolean {
  if (u < -EPS || v < -EPS || u > hull.maxU + EPS) return false;
  const slab = hull.slabs.find((candidate, index) =>
    u >= candidate.uStart - EPS &&
    (u < candidate.uEnd - EPS || index === hull.slabs.length - 1 && u <= candidate.uEnd + EPS),
  );
  if (!slab) return false;
  const delta = u - v;
  return (
    delta >= slab.minDelta - EPS &&
    delta <= slab.maxDelta + EPS &&
    v <= slab.maxV + EPS
  );
}

function buildMask(cache: MaskCache, state: AbUnionState): number {
  const data = cache.overlay.data;
  data.fill(0);
  const out = Array.from({ length: 6 }, (_, index) => bValue(state, index));
  const inc = Array.from({ length: 6 }, (_, index) => aValue(state, index));
  const hexAxisHulls = buildHexAxisHulls(cache, state, out, inc);
  let uncoveredCount = 0;

  for (let k = 0; k < cache.pixelIndex.length; k++) {
    let bits = 0;
    for (let i = 0; i < 6; i++) {
      const u = cache.localU[i][k];
      const v = cache.localV[i][k];
      const hull = hexAxisHulls[i];
      if (hull ? pointInHexAxisHull(u, v, hull) : containsExactRegionLocal(state, u, v, out[i], inc[i])) {
        bits |= 1 << i;
      }
    }
    cache.maskBits[k] = bits;

    const q = cache.pixelIndex[k] * 4;
    if (bits) {
      const hasVisibleRegion = state.regionVisible.some((visible, index) =>
        visible && (bits & (1 << index)) !== 0,
      );
      if (state.showRegion && hasVisibleRegion) {
        data[q] = COVER_RGBA[0];
        data[q + 1] = COVER_RGBA[1];
        data[q + 2] = COVER_RGBA[2];
        data[q + 3] = COVER_RGBA[3];
      }
    } else {
      uncoveredCount++;
      data[q] = UNCOVERED_RGBA[0];
      data[q + 1] = UNCOVERED_RGBA[1];
      data[q + 2] = UNCOVERED_RGBA[2];
      data[q + 3] = UNCOVERED_RGBA[3];
    }
  }

  cache.offctx.putImageData(cache.overlay, 0, 0);
  return uncoveredCount;
}

function coveredBoundaryTouchesUncovered(cache: MaskCache, k: number): boolean {
  if (cache.maskBits[k] === 0) return false;
  const pixel = cache.pixelIndex[k];
  const x = pixel % cache.size;
  const y = Math.floor(pixel / cache.size);
  const neighbors = [
    x > 0 ? pixel - 1 : -1,
    x < cache.size - 1 ? pixel + 1 : -1,
    y > 0 ? pixel - cache.size : -1,
    y < cache.size - 1 ? pixel + cache.size : -1,
  ];
  return neighbors.some((neighbor) => {
    if (neighbor < 0) return false;
    const neighborK = cache.insideMap[neighbor];
    return neighborK >= 0 && cache.maskBits[neighborK] === 0;
  });
}

function isAnalysisPoint(cache: MaskCache, k: number, quality: AbUnionQuality): boolean {
  if (quality === 'coarse' && k % 4 !== 0) return false;
  if (cache.maskBits[k] === 0) return true;
  return quality === 'adaptive' && coveredBoundaryTouchesUncovered(cache, k);
}

function lineIntersection(n1: Point, c1: number, n2: Point, c2: number): Point {
  const det = n1.x * n2.y - n1.y * n2.x;
  return {
    x: (c1 * n2.y - n1.y * c2) / det,
    y: (n1.x * c2 - c1 * n2.x) / det,
  };
}

function computeThetaTriangle(
  cache: MaskCache,
  theta: number,
  quality: AbUnionQuality,
): AbUnionOptimization & { vertices: Point[] | null; analysisCount: number } {
  const normals = [0, 1, 2].map((index) => {
    const angle = theta + index * ANGLE_PERIOD;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  const h = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let analysisCount = 0;

  for (let k = 0; k < cache.pixelIndex.length; k++) {
    if (!isAnalysisPoint(cache, k, quality)) continue;
    analysisCount++;
    const point = { x: cache.xWorld[k], y: cache.yWorld[k] };
    for (let i = 0; i < 3; i++) {
      h[i] = Math.max(h[i], dot(normals[i], point));
    }
  }

  if (analysisCount === 0) {
    return { theta, L: 0, vertices: null, analysisCount };
  }

  for (let i = 0; i < 3; i++) {
    const margin = 0.5 * (Math.abs(normals[i].x) + Math.abs(normals[i].y)) / cache.scale;
    h[i] += margin;
  }

  return {
    theta,
    L: Math.max(0, (2 / SQRT3) * h.reduce((sum, value) => sum + value, 0)),
    vertices: [
      lineIntersection(normals[0], h[0], normals[1], h[1]),
      lineIntersection(normals[1], h[1], normals[2], h[2]),
      lineIntersection(normals[2], h[2], normals[0], h[0]),
    ],
    analysisCount,
  };
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 1) return sorted;

  function cross(o: Point, a: Point, b: Point): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointInConvexPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) <= EPS) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

function localCHull(localCs: number[]): Point[] {
  return convexHull(localCs.map((value, index) => localCPoint(index, value)));
}

function sameMarkSource(a: AbUnionMarkSourceRef, b: AbUnionMarkSourceRef): boolean {
  return a.kind === b.kind && a.index === b.index;
}

function markSourceLabel(ref: AbUnionMarkSourceRef): string {
  if (ref.kind === 'hex-edge') return `e${ref.index}`;
  if (ref.kind === 'half-diagonal') return `r${ref.index}`;
  if (ref.kind === 'center-triangle-edge') return `C:e${ref.index}`;
  return 'C:circle';
}

function isCenterMarkSource(ref: AbUnionMarkSourceRef): boolean {
  return ref.kind === 'center-triangle-edge' || ref.kind === 'center-circle';
}

function isSkeletonMarkSource(ref: AbUnionMarkSourceRef): boolean {
  return ref.kind === 'hex-edge' || ref.kind === 'half-diagonal';
}

function hexEdgeSource(label: AbUnionLabel): number | null {
  if (label.first?.kind === 'hex-edge') return label.first.index;
  if (label.second?.kind === 'hex-edge') return label.second.index;
  return null;
}

function markPrimitiveForRef(
  ref: AbUnionMarkSourceRef,
  state: AbUnionState,
  triangleState: TriangleState,
): AbUnionMarkPrimitive | null {
  const index = ref.index;
  if (ref.kind === 'hex-edge') {
    if (!Number.isInteger(index) || index < 0 || index >= 6) return null;
    return {
      kind: 'line',
      ref,
      label: markSourceLabel(ref),
      start: HEXAGON_VERTICES[index],
      end: HEXAGON_VERTICES[mod6(index + 1)],
    };
  }
  if (ref.kind === 'half-diagonal') {
    if (!Number.isInteger(index) || index < 0 || index >= 6) return null;
    return {
      kind: 'line',
      ref,
      label: markSourceLabel(ref),
      start: { x: 0, y: 0 },
      end: HEXAGON_VERTICES[index],
    };
  }
  if (ref.kind === 'center-triangle-edge') {
    if (state.centerMode !== 'triangle' || !Number.isInteger(index) || index < 0 || index >= 3) return null;
    const vertices = getVertices(triangleState);
    return {
      kind: 'line',
      ref,
      label: markSourceLabel(ref),
      start: vertices[index],
      end: vertices[(index + 1) % 3],
    };
  }
  if (ref.kind === 'center-circle') {
    if (state.centerMode !== 'circle') return null;
    return {
      kind: 'circle',
      ref,
      label: markSourceLabel(ref),
      center: triangleState.position,
      radius: CIRCUMRADIUS,
    };
  }
  return null;
}

function segmentIntersectionPoints(a: Extract<AbUnionMarkPrimitive, { kind: 'line' }>, b: Extract<AbUnionMarkPrimitive, { kind: 'line' }>): Point[] {
  const r = { x: a.end.x - a.start.x, y: a.end.y - a.start.y };
  const s = { x: b.end.x - b.start.x, y: b.end.y - b.start.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < EPS) return [];
  const q = { x: b.start.x - a.start.x, y: b.start.y - a.start.y };
  const t = (q.x * s.y - q.y * s.x) / denom;
  const u = (q.x * r.y - q.y * r.x) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return [];
  return [{ x: a.start.x + clamp01(t) * r.x, y: a.start.y + clamp01(t) * r.y }];
}

function lineCircleIntersectionPoints(
  line: Extract<AbUnionMarkPrimitive, { kind: 'line' }>,
  circle: Extract<AbUnionMarkPrimitive, { kind: 'circle' }>,
): Point[] {
  const d = { x: line.end.x - line.start.x, y: line.end.y - line.start.y };
  const f = { x: line.start.x - circle.center.x, y: line.start.y - circle.center.y };
  const a = d.x * d.x + d.y * d.y;
  const b = 2 * (f.x * d.x + f.y * d.y);
  const c = f.x * f.x + f.y * f.y - circle.radius * circle.radius;
  const disc = b * b - 4 * a * c;
  if (a < EPS || disc < -EPS) return [];
  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  const values = [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];
  const points: Point[] = [];
  for (const value of values) {
    if (value < -EPS || value > 1 + EPS) continue;
    const point = { x: line.start.x + clamp01(value) * d.x, y: line.start.y + clamp01(value) * d.y };
    if (!points.some((existing) => distance(existing, point) <= EPS)) points.push(point);
  }
  return points;
}

function circleCircleIntersectionPoints(
  a: Extract<AbUnionMarkPrimitive, { kind: 'circle' }>,
  b: Extract<AbUnionMarkPrimitive, { kind: 'circle' }>,
): Point[] {
  const dx = b.center.x - a.center.x;
  const dy = b.center.y - a.center.y;
  const d = Math.hypot(dx, dy);
  if (d < EPS || d > a.radius + b.radius + EPS || d < Math.abs(a.radius - b.radius) - EPS) return [];
  const along = (a.radius * a.radius - b.radius * b.radius + d * d) / (2 * d);
  const h2 = a.radius * a.radius - along * along;
  if (h2 < -EPS) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const ux = dx / d;
  const uy = dy / d;
  const base = { x: a.center.x + along * ux, y: a.center.y + along * uy };
  if (h <= EPS) return [base];
  return [
    { x: base.x - uy * h, y: base.y + ux * h },
    { x: base.x + uy * h, y: base.y - ux * h },
  ];
}

function distanceToMarkPrimitive(point: Point, primitive: AbUnionMarkPrimitive): number {
  if (primitive.kind === 'line') return distanceToSegment(point, primitive.start, primitive.end);
  return Math.abs(distance(point, primitive.center) - primitive.radius);
}

function closestPoint(points: Point[], preferred: Point | null): Point | null {
  if (points.length === 0) return null;
  if (!preferred) return points[0];
  let best = points[0];
  let bestDistance = distance(best, preferred);
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i], preferred);
    if (d < bestDistance) {
      best = points[i];
      bestDistance = d;
    }
  }
  return best;
}

function intersectionPoint(
  first: AbUnionMarkPrimitive,
  second: AbUnionMarkPrimitive,
  preferred: Point | null,
): Point | null {
  if (first.kind === 'line' && second.kind === 'line') {
    return closestPoint(segmentIntersectionPoints(first, second), preferred);
  }
  if (first.kind === 'line' && second.kind === 'circle') {
    return closestPoint(lineCircleIntersectionPoints(first, second), preferred);
  }
  if (first.kind === 'circle' && second.kind === 'line') {
    return closestPoint(lineCircleIntersectionPoints(second, first), preferred);
  }
  if (first.kind === 'circle' && second.kind === 'circle') {
    return closestPoint(circleCircleIntersectionPoints(first, second), preferred);
  }
  return null;
}

function nextLabelId(state: AbUnionState, mode: AbUnionLabelMode): string {
  const prefix = mode === 'dynamic' ? 'D' : 'S';
  const max = state.labels.reduce((currentMax, label) => {
    if (label.mode !== mode || !label.id.startsWith(prefix)) return currentMax;
    const value = Number.parseInt(label.id.slice(prefix.length), 10);
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return `${prefix}${max + 1}`;
}

function createAbUnionLabel(
  state: AbUnionState,
  first: AbUnionMarkSourceRef,
  second: AbUnionMarkSourceRef,
  mode: AbUnionLabelMode,
  preferred: Point,
  triangleState: TriangleState,
): AbUnionLabel | null {
  const hasCenterAndSkeleton = (
    (isCenterMarkSource(first) && isSkeletonMarkSource(second)) ||
    (isSkeletonMarkSource(first) && isCenterMarkSource(second))
  );
  if (!hasCenterAndSkeleton) return null;

  const firstPrimitive = markPrimitiveForRef(first, state, triangleState);
  const secondPrimitive = markPrimitiveForRef(second, state, triangleState);
  if (!firstPrimitive || !secondPrimitive) return null;
  const point = intersectionPoint(firstPrimitive, secondPrimitive, preferred);
  if (!point) return null;
  const id = nextLabelId(state, mode);
  return {
    id,
    name: id,
    mode,
    first,
    second,
    point,
  };
}

function refreshAbUnionLabels(
  state: AbUnionState,
  triangleState: TriangleState,
): void {
  for (const label of state.labels) {
    if (label.mode === 'static') continue;
    if (!label.first || !label.second) {
      label.point = null;
      continue;
    }
    const first = markPrimitiveForRef(label.first, state, triangleState);
    const second = markPrimitiveForRef(label.second, state, triangleState);
    label.point = first && second ? intersectionPoint(first, second, label.point) : null;
  }
}

export function deleteAbUnionLabel(state: AbUnionState, id: string): void {
  normalizeAbUnionState(state);
  state.labels = state.labels.filter((label) => label.id !== id);
  state.coincidenceLocks = state.coincidenceLocks.filter((lock) => lock.labelId !== id);
  state.status = `Deleted ${id}.`;
}

function nextFMarkId(state: AbUnionState): string {
  const used = new Set(state.fMarks.map((mark) => mark.id));
  let index = state.fMarks.length + 1;
  while (used.has(`F${index}`)) index++;
  return `F${index}`;
}

function addAbUnionFMark(state: AbUnionState, point: Point): string | null {
  normalizeAbUnionState(state);
  if (!pointInClosedHex(point)) {
    state.status = 'F-mark mode: click inside the hexagon.';
    return null;
  }
  const id = nextFMarkId(state);
  state.fMarks.push({ id, point });
  state.selectedFMarkId = id;
  state.status = `Created ${id}.`;
  return id;
}

function moveAbUnionFMark(state: AbUnionState, id: string, point: Point): void {
  normalizeAbUnionState(state);
  const mark = state.fMarks.find((candidate) => candidate.id === id);
  if (!mark) return;
  mark.point = clampPointToHexagon(point);
  state.selectedFMarkId = id;
}

export function deleteSelectedAbUnionFMark(state: AbUnionState): void {
  normalizeAbUnionState(state);
  const selected = state.selectedFMarkId;
  if (!selected) {
    state.status = 'No f mark selected.';
    return;
  }
  state.fMarks = state.fMarks.filter((mark) => mark.id !== selected);
  state.selectedFMarkId = null;
  state.status = `Deleted ${selected}.`;
}

export function clearAbUnionFMarks(state: AbUnionState): void {
  normalizeAbUnionState(state);
  if (state.fMarks.length === 0) return;
  state.fMarks = [];
  state.selectedFMarkId = null;
  state.status = 'Cleared f marks.';
}

function sameCoincidenceTarget(
  lock: AbUnionCoincidenceLock,
  edge: number,
  role: AbUnionCoincidenceRole,
): boolean {
  return mod6(lock.edge) === mod6(edge) && lock.role === role;
}

function labelForId(state: AbUnionState, labelId: string): AbUnionLabel | null {
  return state.labels.find((label) => label.id === labelId) ?? null;
}

function applyCoincidenceTarget(
  state: AbUnionState,
  edge: number,
  role: AbUnionCoincidenceRole,
  point: Point,
): void {
  const normalizedEdge = mod6(edge);
  const value = projectEdgeValue(point, normalizedEdge);
  const dots = state.edgeDots[normalizedEdge];
  if (
    (role === 'left' && Math.abs(dots.left - value) <= EPS) ||
    (role === 'right' && Math.abs(dots.right - value) <= EPS) ||
    (role === 'shared' && Math.abs(dots.left - value) <= EPS && Math.abs(dots.right - value) <= EPS)
  ) {
    return;
  }
  setDotValue(state, { edge: normalizedEdge, role }, value);
}

export function abUnionCoincidenceTargets(
  state: AbUnionState,
  labelId: string,
): AbUnionCoincidenceTarget[] {
  normalizeAbUnionState(state);
  const label = labelForId(state, labelId);
  if (!label) return [];
  const edge = hexEdgeSource(label);
  if (edge === null) return [];
  const dot = state.edgeDots[mod6(edge)];
  const roles: AbUnionCoincidenceRole[] = dot.split ? ['left', 'right'] : ['shared'];
  return roles.map((role) => ({
    edge: mod6(edge),
    role,
    label: role === 'left' ? `b${edge}` : role === 'right' ? `a${mod6(edge + 1)}` : 'shared',
    locked: state.coincidenceLocks.some((lock) =>
      lock.labelId === labelId && sameCoincidenceTarget(lock, edge, role),
    ),
  }));
}

export function snapAbUnionLabelToEdge(
  state: AbUnionState,
  labelId: string,
  edge: number,
  role: AbUnionCoincidenceRole,
): void {
  normalizeAbUnionState(state);
  const label = labelForId(state, labelId);
  if (!label?.point || hexEdgeSource(label) !== mod6(edge)) return;
  applyCoincidenceTarget(state, edge, role, label.point);
  state.status = `Snapped ${role === 'shared' ? 'shared dot' : role} on e${mod6(edge)} to ${label.name}.`;
}

export function setAbUnionCoincidenceLock(
  state: AbUnionState,
  labelId: string,
  edge: number,
  role: AbUnionCoincidenceRole,
  locked: boolean,
): void {
  normalizeAbUnionState(state);
  state.coincidenceLocks = state.coincidenceLocks.filter((lock) => locked
    ? !sameCoincidenceTarget(lock, edge, role)
    : !(lock.labelId === labelId && sameCoincidenceTarget(lock, edge, role)),
  );
  if (!locked) {
    state.status = `Unlocked ${role === 'shared' ? 'shared dot' : role} on e${mod6(edge)}.`;
    return;
  }
  const label = labelForId(state, labelId);
  if (!label || hexEdgeSource(label) !== mod6(edge)) return;
  state.coincidenceLocks.push({ labelId, edge: mod6(edge), role });
  if (label.point) {
    applyCoincidenceTarget(state, edge, role, label.point);
  }
  state.status = `Locked ${role === 'shared' ? 'shared dot' : role} on e${mod6(edge)} to ${label.name}.`;
}

function applyAbUnionCoincidenceLocks(state: AbUnionState): void {
  for (const lock of state.coincidenceLocks) {
    const label = labelForId(state, lock.labelId);
    if (!label?.point || hexEdgeSource(label) !== mod6(lock.edge)) continue;
    applyCoincidenceTarget(state, lock.edge, lock.role, label.point);
  }
}

export function setAbUnionTool(state: AbUnionState, tool: AbUnionTool): void {
  normalizeAbUnionState(state);
  state.tool = tool;
  state.selectedMarkSources = [];
  if (tool === 'd-mark') {
    state.status = 'D-mark mode: click two intersecting sources.';
  } else if (tool === 's-mark') {
    state.status = 'S-mark mode: click two intersecting sources.';
  } else if (tool === 'add') {
    state.status = 'Add mode: click an edge or one-dot handle.';
  } else if (tool === 'delete') {
    state.status = 'Delete mode: click a split-dot handle.';
  } else if (tool === 'f-mark') {
    state.status = 'F-mark mode: click inside the hexagon to add dots; drag dots to move them.';
  } else {
    state.status = 'Move mode: drag edge dots or center geometry.';
  }
}

function centerContainsPoint(
  point: Point,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
): boolean {
  if (state.centerMode === 'none') {
    return true;
  }
  if (state.centerMode === 'circle') {
    return distance(point, triangleState.position) <= CIRCUMRADIUS + EPS;
  }
  if (state.centerMode === 'local-c') {
    return pointInConvexPolygon(point, localCHull(localCs));
  }
  const vertices = getVertices(triangleState);
  return pointInTriangle(point, vertices[0], vertices[1], vertices[2]);
}

function computeCenterContainment(
  cache: MaskCache,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
): { contains: boolean; failures: number } {
  if (state.centerMode === 'none') {
    return { contains: true, failures: 0 };
  }
  let failures = 0;
  for (let k = 0; k < cache.pixelIndex.length; k++) {
    if (!isAnalysisPoint(cache, k, state.quality)) continue;
    if (!centerContainsPoint({ x: cache.xWorld[k], y: cache.yWorld[k] }, state, triangleState, localCs)) {
      failures++;
    }
  }
  return { contains: failures === 0, failures };
}

function pointFromCache(cache: MaskCache, index: number): Point {
  return { x: cache.xWorld[index], y: cache.yWorld[index] };
}

function findFarRedPair(cache: MaskCache): AbUnionFarPair | null {
  const directionCount = FAR_PAIR_DIRECTIONS.length;
  const minIndices = Array(directionCount).fill(-1) as number[];
  const maxIndices = Array(directionCount).fill(-1) as number[];
  const minValues = Array(directionCount).fill(Number.POSITIVE_INFINITY) as number[];
  const maxValues = Array(directionCount).fill(Number.NEGATIVE_INFINITY) as number[];
  let uncoveredCount = 0;

  for (let k = 0; k < cache.pixelIndex.length; k++) {
    if (cache.maskBits[k] !== 0) continue;
    uncoveredCount++;
    const point = pointFromCache(cache, k);
    for (let d = 0; d < directionCount; d++) {
      const direction = FAR_PAIR_DIRECTIONS[d];
      const value = point.x * direction.x + point.y * direction.y;
      if (value < minValues[d]) {
        minValues[d] = value;
        minIndices[d] = k;
      }
      if (value > maxValues[d]) {
        maxValues[d] = value;
        maxIndices[d] = k;
      }
    }
  }

  if (uncoveredCount < 2) return null;

  const candidateIndices = Array.from(new Set([...minIndices, ...maxIndices].filter((index) => index >= 0)));
  let bestStart = pointFromCache(cache, candidateIndices[0]);
  let bestEnd = pointFromCache(cache, candidateIndices[1] ?? candidateIndices[0]);
  let bestDistance = 0;

  for (let i = 0; i < candidateIndices.length; i++) {
    const start = pointFromCache(cache, candidateIndices[i]);
    for (let j = i + 1; j < candidateIndices.length; j++) {
      const end = pointFromCache(cache, candidateIndices[j]);
      const currentDistance = distance(start, end);
      if (currentDistance > bestDistance) {
        bestDistance = currentDistance;
        bestStart = start;
        bestEnd = end;
      }
    }
  }

  return {
    start: bestStart,
    end: bestEnd,
    distance: bestDistance,
    exceedsUnit: bestDistance > 1,
  };
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Point[], stroke: string, fill: string, dashed = false): void {
  if (points.length === 0) return;
  const canvasPoints = points.map(mathToCanvas);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  for (let i = 1; i < canvasPoints.length; i++) {
    ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (dashed) ctx.setLineDash([8, 6]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = dashed ? 2.25 : 2;
  ctx.stroke();
  ctx.restore();
}

function drawThetaTriangle(ctx: CanvasRenderingContext2D, points: Point[] | null): void {
  if (!points) return;
  drawPolygon(ctx, points, '#7c3aed', 'rgba(124, 58, 237, 0.06)', true);
}

function drawFarPair(ctx: CanvasRenderingContext2D, pair: AbUnionFarPair | null): void {
  if (!pair || !pair.exceedsUnit) return;
  const start = mathToCanvas(pair.start);
  const end = mathToCanvas(pair.end);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  ctx.save();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const point of [start, end]) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#fee2e2';
    ctx.fill();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#991b1b';
  ctx.fillText(`d=${pair.distance.toFixed(3)}`, mid.x, mid.y - 6);
  ctx.restore();
}

function fMarkDistance(state: AbUnionState): number | null {
  return state.fMarks.length === 2 ? distance(state.fMarks[0].point, state.fMarks[1].point) : null;
}

function fMarkTriangle(state: AbUnionState): ReturnType<typeof fitTriangle> | null {
  if (state.fMarks.length < 3) return null;
  return fitTriangle('F', state.fMarks.map((mark) => mark.point), '#eab308');
}

function drawFMarkDistance(ctx: CanvasRenderingContext2D, state: AbUnionState, distanceValue: number | null): void {
  if (state.fMarks.length !== 2 || distanceValue === null) return;
  const start = mathToCanvas(state.fMarks[0].point);
  const end = mathToCanvas(state.fMarks[1].point);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#2563eb';
  ctx.fillText(`d=${distanceValue.toFixed(5)}`, mid.x, mid.y - 6);
  ctx.restore();
}

function drawFMarkOverlay(ctx: CanvasRenderingContext2D, state: AbUnionState, triangle: ReturnType<typeof fitTriangle> | null): void {
  if (triangle) {
    drawPolygon(ctx, triangle.vertices, '#eab308', 'rgba(250, 204, 21, 0.14)');
  }

  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const mark of state.fMarks) {
    const point = mathToCanvas(mark.point);
    const selected = mark.id === state.selectedFMarkId;
    ctx.beginPath();
    ctx.arc(point.x, point.y, selected ? 6.6 : 5.4, 0, 2 * Math.PI);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.strokeStyle = selected ? '#2563eb' : '#a16207';
    ctx.lineWidth = selected ? 2.4 : 1.7;
    ctx.stroke();
    ctx.fillStyle = '#854d0e';
    ctx.fillText(mark.id, point.x + 7, point.y - 7);
  }
  ctx.restore();
}

function drawCenterShape(
  ctx: CanvasRenderingContext2D,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
): void {
  if (state.centerMode === 'none') {
    return;
  }

  ctx.save();
  if (state.centerMode === 'circle') {
    const center = mathToCanvas(triangleState.position);
    ctx.beginPath();
    ctx.arc(center.x, center.y, scaleToCanvas(CIRCUMRADIUS), 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.05)';
    ctx.fill();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (state.centerMode === 'local-c') {
    const hull = localCHull(localCs);
    drawPolygon(ctx, hull, '#d97706', 'rgba(250, 204, 21, 0.16)');

    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const start = mathToCanvas({ x: 0, y: 0 });
      const end = mathToCanvas(HEXAGON_VERTICES[i]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    for (let i = 0; i < 6; i++) {
      const handle = mathToCanvas(localCPoint(i, localCs[i] ?? 0));
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    drawPolygon(ctx, getVertices(triangleState), '#0ea5e9', 'rgba(14, 165, 233, 0.05)');
    const cp = mathToCanvas(triangleState.controlPoint);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRegionBoundary(ctx: CanvasRenderingContext2D, cache: MaskCache, regionIndex: number): void {
  const bit = 1 << regionIndex;
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k < cache.pixelIndex.length; k++) {
    if ((cache.maskBits[k] & bit) === 0) continue;
    const idx = cache.pixelIndex[k];
    const x = idx % cache.size;
    const y = Math.floor(idx / cache.size);
    const left = x > 0 ? cache.insideMap[idx - 1] : -1;
    const right = x < cache.size - 1 ? cache.insideMap[idx + 1] : -1;
    const top = y > 0 ? cache.insideMap[idx - cache.size] : -1;
    const bottom = y < cache.size - 1 ? cache.insideMap[idx + cache.size] : -1;

    if (left < 0 || (cache.maskBits[left] & bit) === 0) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 1);
    }
    if (right < 0 || (cache.maskBits[right] & bit) === 0) {
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + 1, y + 1);
    }
    if (top < 0 || (cache.maskBits[top] & bit) === 0) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1, y);
    }
    if (bottom < 0 || (cache.maskBits[bottom] & bit) === 0) {
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + 1, y + 1);
    }
  }
  ctx.strokeStyle = BOUNDARY_COLORS[regionIndex];
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.15;
  ctx.stroke();
  ctx.restore();
}

function drawActiveBoundaries(ctx: CanvasRenderingContext2D, cache: MaskCache, state: AbUnionState): void {
  for (let i = 0; i < 6; i++) {
    if (state.activeRegions[i]) drawRegionBoundary(ctx, cache, i);
  }
}

function drawMarkPrimitive(
  ctx: CanvasRenderingContext2D,
  primitive: AbUnionMarkPrimitive,
): void {
  ctx.save();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 5.2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  if (primitive.kind === 'line') {
    const start = mathToCanvas(primitive.start);
    const end = mathToCanvas(primitive.end);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else {
    const center = mathToCanvas(primitive.center);
    ctx.arc(center.x, center.y, scaleToCanvas(primitive.radius), 0, 2 * Math.PI);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSelectedMarkSources(
  ctx: CanvasRenderingContext2D,
  state: AbUnionState,
  triangleState: TriangleState,
): void {
  for (const source of state.selectedMarkSources) {
    const primitive = markPrimitiveForRef(source, state, triangleState);
    if (primitive) drawMarkPrimitive(ctx, primitive);
  }
}

function drawAbUnionLabels(ctx: CanvasRenderingContext2D, state: AbUnionState): void {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const label of state.labels) {
    if (!label.point) continue;
    const point = mathToCanvas(label.point);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.fillText(label.name, point.x + 6, point.y - 6);
  }
  ctx.restore();
}

function drawPointsAndVertices(ctx: CanvasRenderingContext2D, state: AbUnionState): void {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 6; i++) {
    const vertex = mathToCanvas(HEXAGON_VERTICES[i]);
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, state.activeRegions[i] ? 6.4 : 5.2, 0, 2 * Math.PI);
    ctx.fillStyle = state.activeRegions[i] ? '#7c3aed' : '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const label = mathToCanvas({
      x: HEXAGON_VERTICES[i].x * 1.11,
      y: HEXAGON_VERTICES[i].y * 1.11,
    });
    ctx.fillStyle = '#334155';
    ctx.fillText(`V${i}`, label.x, label.y);
  }

  for (let i = 0; i < 6; i++) {
    const edge = state.edgeDots[i];
    const edgeMid = {
      x: (HEXAGON_VERTICES[i].x + HEXAGON_VERTICES[mod6(i + 1)].x) / 2,
      y: (HEXAGON_VERTICES[i].y + HEXAGON_VERTICES[mod6(i + 1)].y) / 2,
    };
    const normalLen = Math.hypot(edgeMid.x, edgeMid.y) || 1;
    const normal = { x: edgeMid.x / normalLen, y: edgeMid.y / normalLen };
    const tangent = edgeVector(i);
    const tangentLen = Math.hypot(tangent.x, tangent.y) || 1;
    const unitTangent = { x: tangent.x / tangentLen, y: tangent.y / tangentLen };

    function drawHandle(value: number, labelText: string, active: boolean, color: string, labelShift: number): void {
      const point = pointOnEdge(i, value);
      const canvasPoint = mathToCanvas(point);
      ctx.beginPath();
      ctx.arc(canvasPoint.x, canvasPoint.y, 7.7, 0, 2 * Math.PI);
      ctx.fillStyle = active ? '#fff7ed' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = active ? color : '#334155';
      ctx.lineWidth = active ? 2.7 : 2.1;
      ctx.stroke();

      const label = mathToCanvas({
        x: point.x + 0.085 * normal.x + labelShift * unitTangent.x,
        y: point.y + 0.085 * normal.y + labelShift * unitTangent.y,
      });
      ctx.fillStyle = '#475569';
      ctx.fillText(labelText, label.x, label.y);
    }

    if (edge.split) {
      drawHandle(edge.left, `b${i}`, state.activeRegions[i], '#2563eb', -0.035);
      drawHandle(edge.right, `a${mod6(i + 1)}`, state.activeRegions[mod6(i + 1)], '#d97706', 0.035);
    } else {
      drawHandle(
        edge.left,
        `b${i}/a${mod6(i + 1)}`,
        state.activeRegions[i] || state.activeRegions[mod6(i + 1)],
        '#d97706',
        0,
      );
    }
  }

  ctx.restore();
}

function normalizeLockArray(value: boolean[] | undefined): boolean[] {
  return Array.from({ length: 6 }, (_, index) => Boolean(value?.[index]));
}

function normalizeFixedSums(value: unknown): Array<number | null> {
  return Array.from({ length: 6 }, (_, index) => {
    if (!Array.isArray(value)) return null;
    const fixedSum = value[index];
    return typeof fixedSum === 'number' && Number.isFinite(fixedSum)
      ? Math.max(0, Math.min(2, fixedSum))
      : null;
  });
}

function normalizeMarkSource(value: unknown): AbUnionMarkSourceRef | null {
  if (!value || typeof value !== 'object') return null;
  const ref = value as Partial<AbUnionMarkSourceRef>;
  if (
    ref.kind !== 'hex-edge' &&
    ref.kind !== 'half-diagonal' &&
    ref.kind !== 'center-triangle-edge' &&
    ref.kind !== 'center-circle'
  ) {
    return null;
  }
  if (typeof ref.index !== 'number' || !Number.isInteger(ref.index) || ref.index < 0) return null;
  return { kind: ref.kind, index: ref.index };
}

function normalizeLabels(value: unknown): AbUnionLabel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): AbUnionLabel[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const label = candidate as Partial<AbUnionLabel>;
    if (typeof label.id !== 'string' || typeof label.name !== 'string') return [];
    if (label.mode !== 'dynamic' && label.mode !== 'static') return [];
    const point = label.point && typeof label.point.x === 'number' && typeof label.point.y === 'number'
      ? { x: label.point.x, y: label.point.y }
      : null;
    const first = normalizeMarkSource(label.first);
    const second = normalizeMarkSource(label.second);
    if (label.mode === 'static') {
      if (!point) return [];
      return [{ id: label.id, name: label.name, mode: label.mode, first, second, point }];
    }
    if (!first || !second) return [];
    return [{ id: label.id, name: label.name, mode: label.mode, first, second, point }];
  });
}

function normalizeFMarks(value: unknown): AbUnionFMark[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.flatMap((candidate, index): AbUnionFMark[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const mark = candidate as Partial<AbUnionFMark>;
    if (!mark.point || typeof mark.point.x !== 'number' || typeof mark.point.y !== 'number') return [];
    if (!Number.isFinite(mark.point.x) || !Number.isFinite(mark.point.y)) return [];
    const fallbackId = `F${index + 1}`;
    const rawId = typeof mark.id === 'string' && /^[A-Za-z0-9_-]+$/.test(mark.id) ? mark.id : fallbackId;
    let id = rawId;
    let suffix = 2;
    while (used.has(id)) {
      id = `${rawId}_${suffix}`;
      suffix++;
    }
    used.add(id);
    return [{ id, point: clampPointToHexagon(mark.point) }];
  });
}

function normalizeCoincidenceLocks(value: unknown, labels: AbUnionLabel[]): AbUnionCoincidenceLock[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(labels.map((label) => label.id));
  return value.flatMap((candidate): AbUnionCoincidenceLock[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const lock = candidate as Partial<AbUnionCoincidenceLock>;
    if (typeof lock.labelId !== 'string' || !ids.has(lock.labelId)) return [];
    if (typeof lock.edge !== 'number' || !Number.isInteger(lock.edge)) return [];
    if (lock.role !== 'shared' && lock.role !== 'left' && lock.role !== 'right') return [];
    const label = labels.find((current) => current.id === lock.labelId);
    if (!label || hexEdgeSource(label) !== mod6(lock.edge)) return [];
    return [{ labelId: lock.labelId, edge: mod6(lock.edge), role: lock.role }];
  });
}

function normalizeAbUnionState(state: AbUnionState): void {
  const legacy = state as unknown as { b?: number[]; edgeDots?: AbUnionEdgeDots[]; tool?: AbUnionTool };
  const source = Array.isArray(legacy.edgeDots)
    ? legacy.edgeDots
    : Array.from({ length: 6 }, (_, index) => defaultEdgeDots(legacy.b?.[index] ?? 0.25));

  state.edgeDots = Array.from({ length: 6 }, (_, index) => {
    const edge = source[index] ?? defaultEdgeDots(0.25);
    const first = clamp01(edge.left);
    const second = clamp01(edge.split ? edge.right : edge.left);
    return {
      left: Math.min(first, second),
      right: Math.max(first, second),
      split: Boolean(edge.split),
    };
  });
  state.tool = legacy.tool === 'add' ||
    legacy.tool === 'delete' ||
    legacy.tool === 'd-mark' ||
    legacy.tool === 's-mark' ||
    legacy.tool === 'f-mark'
    ? legacy.tool
    : 'move';
  state.centerLocked = Boolean(state.centerLocked);
  state.useAxisAlignedHull = Boolean(state.useAxisAlignedHull);
  state.regionVisible = Array.from({ length: 6 }, (_, index) => state.regionVisible?.[index] ?? true);
  state.aLocked = normalizeLockArray(state.aLocked);
  state.bLocked = normalizeLockArray(state.bLocked);
  state.fixedSums = normalizeFixedSums(state.fixedSums);
  state.activeRegions = normalizeLockArray(state.activeRegions);
  state.labels = normalizeLabels(state.labels);
  state.selectedMarkSources = Array.isArray(state.selectedMarkSources)
    ? state.selectedMarkSources.flatMap((source) => {
        const normalized = normalizeMarkSource(source);
        return normalized ? [normalized] : [];
      }).slice(-2)
    : [];
  state.coincidenceLocks = normalizeCoincidenceLocks(state.coincidenceLocks, state.labels);
  state.fMarks = normalizeFMarks(state.fMarks);
  state.selectedFMarkId = typeof state.selectedFMarkId === 'string' &&
    state.fMarks.some((mark) => mark.id === state.selectedFMarkId)
    ? state.selectedFMarkId
    : null;
  state.status = typeof state.status === 'string' ? state.status : 'Move mode: drag edge dots or center geometry.';
}

type AbUnionVariableKind = 'a' | 'b';
type AbUnionSign = -1 | 1;

interface AbUnionPreference {
  kind: AbUnionVariableKind;
  index: number;
  value: number;
}

interface AbUnionConstraintRelation {
  to: number;
  sign: AbUnionSign;
  offset: number;
}

interface AbUnionVariablePosition {
  component: number;
  sign: AbUnionSign;
  offset: number;
}

interface AbUnionConstraintComponent {
  variables: number[];
  fixedRoot: number | null;
  minRoot: number;
  maxRoot: number;
  hasPreference: boolean;
}

interface AbUnionConstraintAnalysis {
  positions: AbUnionVariablePosition[];
  components: AbUnionConstraintComponent[];
}

const AB_UNION_VARIABLE_COUNT = 12;

function abVariableIndex(kind: AbUnionVariableKind, index: number): number {
  return kind === 'a' ? mod6(index) : 6 + mod6(index);
}

function multiplySign(first: AbUnionSign, second: AbUnionSign): AbUnionSign {
  return first === second ? 1 : -1;
}

function addConstraintRelation(
  graph: AbUnionConstraintRelation[][],
  from: number,
  to: number,
  sign: AbUnionSign,
  offset: number,
): void {
  graph[from].push({ to, sign, offset });
  graph[to].push({ to: from, sign, offset: sign === 1 ? -offset : offset });
}

function setFixedRoot(component: AbUnionConstraintComponent, value: number): boolean {
  if (component.fixedRoot === null) {
    component.fixedRoot = value;
    return true;
  }
  return Math.abs(component.fixedRoot - value) <= EPS;
}

function buildAbUnionConstraintGraph(state: AbUnionState): AbUnionConstraintRelation[][] {
  const graph = Array.from({ length: AB_UNION_VARIABLE_COUNT }, () => [] as AbUnionConstraintRelation[]);
  const firstA = state.aLocked.findIndex(Boolean);
  if (firstA >= 0) {
    for (let index = 0; index < 6; index++) {
      if (state.aLocked[index] && index !== firstA) {
        addConstraintRelation(graph, abVariableIndex('a', firstA), abVariableIndex('a', index), 1, 0);
      }
    }
  }
  const firstB = state.bLocked.findIndex(Boolean);
  if (firstB >= 0) {
    for (let index = 0; index < 6; index++) {
      if (state.bLocked[index] && index !== firstB) {
        addConstraintRelation(graph, abVariableIndex('b', firstB), abVariableIndex('b', index), 1, 0);
      }
    }
  }
  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    if (!state.edgeDots[edgeIndex].split) {
      addConstraintRelation(graph, abVariableIndex('b', edgeIndex), abVariableIndex('a', edgeIndex + 1), -1, 1);
    }
  }
  for (let index = 0; index < 6; index++) {
    const fixedSum = state.fixedSums[index];
    if (fixedSum !== null) {
      addConstraintRelation(graph, abVariableIndex('a', index), abVariableIndex('b', index), -1, fixedSum);
    }
  }
  return graph;
}

function analyzeAbUnionConstraints(graph: AbUnionConstraintRelation[][]): AbUnionConstraintAnalysis | null {
  const positions: Array<AbUnionVariablePosition | null> = Array(AB_UNION_VARIABLE_COUNT).fill(null);
  const components: AbUnionConstraintComponent[] = [];

  for (let root = 0; root < AB_UNION_VARIABLE_COUNT; root++) {
    if (positions[root]) continue;
    const componentIndex = components.length;
    const component: AbUnionConstraintComponent = {
      variables: [],
      fixedRoot: null,
      minRoot: Number.NEGATIVE_INFINITY,
      maxRoot: Number.POSITIVE_INFINITY,
      hasPreference: false,
    };
    components.push(component);
    positions[root] = { component: componentIndex, sign: 1, offset: 0 };
    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const currentPosition = positions[current]!;
      component.variables.push(current);
      for (const relation of graph[current]) {
        const nextPosition: AbUnionVariablePosition = {
          component: componentIndex,
          sign: multiplySign(relation.sign, currentPosition.sign),
          offset: relation.sign * currentPosition.offset + relation.offset,
        };
        const existing = positions[relation.to];
        if (!existing) {
          positions[relation.to] = nextPosition;
          stack.push(relation.to);
          continue;
        }
        if (existing.sign === nextPosition.sign) {
          if (Math.abs(existing.offset - nextPosition.offset) > EPS) return null;
          continue;
        }
        const fixedRoot = (nextPosition.offset - existing.offset) / (existing.sign - nextPosition.sign);
        if (!setFixedRoot(component, fixedRoot)) return null;
      }
    }
  }

  return {
    positions: positions.map((position) => {
      if (!position) throw new Error('Missing AB union constraint position.');
      return position;
    }),
    components,
  };
}

function constrainRootInterval(
  component: AbUnionConstraintComponent,
  coefficient: number,
  constant: number,
  lower: number,
  upper: number,
): boolean {
  if (Math.abs(coefficient) <= EPS) {
    return constant >= lower - EPS && constant <= upper + EPS;
  }
  const first = (lower - constant) / coefficient;
  const second = (upper - constant) / coefficient;
  component.minRoot = Math.max(component.minRoot, Math.min(first, second));
  component.maxRoot = Math.min(component.maxRoot, Math.max(first, second));
  return component.minRoot <= component.maxRoot + EPS;
}

function rootForVariableValue(position: AbUnionVariablePosition, value: number): number {
  return position.sign * (value - position.offset);
}

function variableValue(position: AbUnionVariablePosition, rootValues: number[]): number {
  return position.sign * rootValues[position.component] + position.offset;
}

function rootForCurrentComponent(
  component: AbUnionConstraintComponent,
  positions: AbUnionVariablePosition[],
  currentValues: number[],
): number {
  const variable = component.variables[0];
  return rootForVariableValue(positions[variable], currentValues[variable]);
}

function clampRootToInterval(value: number, component: AbUnionConstraintComponent): number {
  return Math.max(component.minRoot, Math.min(component.maxRoot, value));
}

function constrainSplitEdgeAgainstValue(
  component: AbUnionConstraintComponent,
  position: AbUnionVariablePosition,
  otherValue: number,
): boolean {
  return constrainRootInterval(component, position.sign, position.offset + otherValue, Number.NEGATIVE_INFINITY, 1);
}

function cleanUnitValue(value: number): number {
  if (value >= -EPS && value <= EPS) return 0;
  if (value >= 1 - EPS && value <= 1 + EPS) return 1;
  return clamp01(value);
}

function readAbUnionVariableValues(state: AbUnionState): number[] {
  return Array.from({ length: AB_UNION_VARIABLE_COUNT }, (_, index) =>
    index < 6 ? aValue(state, index) : bValue(state, index - 6),
  );
}

function writeAbUnionVariableValues(state: AbUnionState, values: number[]): void {
  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    const edge = state.edgeDots[edgeIndex];
    const left = cleanUnitValue(values[abVariableIndex('b', edgeIndex)]);
    const right = cleanUnitValue(1 - values[abVariableIndex('a', edgeIndex + 1)]);
    if (edge.split) {
      edge.left = left;
      edge.right = right;
      if (edge.right < edge.left && edge.left - edge.right <= EPS) {
        edge.right = edge.left;
      }
    } else {
      const shared = cleanUnitValue((left + right) / 2);
      edge.left = shared;
      edge.right = shared;
    }
  }
}

function abUnionValuesSatisfyConstraints(state: AbUnionState, values: number[]): boolean {
  for (const value of values) {
    if (value < -EPS || value > 1 + EPS) return false;
  }
  for (let index = 0; index < 6; index++) {
    if (state.fixedSums[index] !== null) {
      const sum = values[abVariableIndex('a', index)] + values[abVariableIndex('b', index)];
      if (Math.abs(sum - state.fixedSums[index]!) > 10 * EPS) return false;
    }
  }
  const firstA = state.aLocked.findIndex(Boolean);
  if (firstA >= 0) {
    const value = values[abVariableIndex('a', firstA)];
    for (let index = 0; index < 6; index++) {
      if (state.aLocked[index] && Math.abs(values[abVariableIndex('a', index)] - value) > 10 * EPS) {
        return false;
      }
    }
  }
  const firstB = state.bLocked.findIndex(Boolean);
  if (firstB >= 0) {
    const value = values[abVariableIndex('b', firstB)];
    for (let index = 0; index < 6; index++) {
      if (state.bLocked[index] && Math.abs(values[abVariableIndex('b', index)] - value) > 10 * EPS) {
        return false;
      }
    }
  }
  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    const edgeSum = values[abVariableIndex('b', edgeIndex)] + values[abVariableIndex('a', edgeIndex + 1)];
    if (state.edgeDots[edgeIndex].split) {
      if (edgeSum > 1 + 10 * EPS) return false;
    } else if (Math.abs(edgeSum - 1) > 10 * EPS) {
      return false;
    }
  }
  return true;
}

function solveAbUnionConstraints(state: AbUnionState, preferences: AbUnionPreference[]): boolean {
  normalizeAbUnionState(state);
  const currentValues = readAbUnionVariableValues(state);
  const analysis = analyzeAbUnionConstraints(buildAbUnionConstraintGraph(state));
  if (!analysis) return false;
  const { positions, components } = analysis;
  const preferredRootByComponent = new Map<number, number>();

  for (const preference of preferences) {
    const variable = abVariableIndex(preference.kind, preference.index);
    const position = positions[variable];
    if (!preferredRootByComponent.has(position.component)) {
      preferredRootByComponent.set(position.component, rootForVariableValue(position, clamp01(preference.value)));
      components[position.component].hasPreference = true;
    }
  }

  for (let variable = 0; variable < AB_UNION_VARIABLE_COUNT; variable++) {
    const position = positions[variable];
    if (!constrainRootInterval(components[position.component], position.sign, position.offset, 0, 1)) {
      return false;
    }
  }

  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    if (!state.edgeDots[edgeIndex].split) continue;
    const bPosition = positions[abVariableIndex('b', edgeIndex)];
    const aPosition = positions[abVariableIndex('a', edgeIndex + 1)];
    if (bPosition.component === aPosition.component) {
      const component = components[bPosition.component];
      if (!constrainRootInterval(
        component,
        bPosition.sign + aPosition.sign,
        bPosition.offset + aPosition.offset,
        Number.NEGATIVE_INFINITY,
        1,
      )) {
        return false;
      }
    }
  }

  const rootValues = components.map((component, index) => {
    if (component.fixedRoot !== null) return component.fixedRoot;
    if (component.hasPreference) return 0;
    return clampRootToInterval(rootForCurrentComponent(component, positions, currentValues), components[index]);
  });

  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    if (!state.edgeDots[edgeIndex].split) continue;
    const bPosition = positions[abVariableIndex('b', edgeIndex)];
    const aPosition = positions[abVariableIndex('a', edgeIndex + 1)];
    if (bPosition.component === aPosition.component) continue;
    const bComponent = components[bPosition.component];
    const aComponent = components[aPosition.component];
    if (bComponent.hasPreference && !aComponent.hasPreference) {
      if (!constrainSplitEdgeAgainstValue(bComponent, bPosition, variableValue(aPosition, rootValues))) {
        return false;
      }
    } else if (aComponent.hasPreference && !bComponent.hasPreference) {
      if (!constrainSplitEdgeAgainstValue(aComponent, aPosition, variableValue(bPosition, rootValues))) {
        return false;
      }
    } else if (!bComponent.hasPreference && !aComponent.hasPreference && bComponent.fixedRoot === null) {
      if (!constrainSplitEdgeAgainstValue(bComponent, bPosition, variableValue(aPosition, rootValues))) {
        return false;
      }
    } else if (!bComponent.hasPreference && !aComponent.hasPreference && aComponent.fixedRoot === null) {
      if (!constrainSplitEdgeAgainstValue(aComponent, aPosition, variableValue(bPosition, rootValues))) {
        return false;
      }
    }
  }

  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    if (component.fixedRoot !== null) {
      if (component.fixedRoot < component.minRoot - EPS || component.fixedRoot > component.maxRoot + EPS) return false;
      rootValues[index] = component.fixedRoot;
    } else {
      const target = component.hasPreference
        ? preferredRootByComponent.get(index) ?? 0
        : rootForCurrentComponent(component, positions, currentValues);
      rootValues[index] = clampRootToInterval(target, component);
    }
  }

  const nextValues = positions.map((position) => cleanUnitValue(variableValue(position, rootValues)));
  if (!abUnionValuesSatisfyConstraints(state, nextValues)) return false;
  writeAbUnionVariableValues(state, nextValues);
  return true;
}

function setBValue(state: AbUnionState, index: number, value: number): void {
  if (solveAbUnionConstraints(state, [{ kind: 'b', index, value }])) {
    state.lastOptimized = null;
  } else {
    state.status = 'Cannot move dot: same-value and fixed-sum constraints conflict.';
  }
}

function setAValue(state: AbUnionState, index: number, value: number): void {
  if (solveAbUnionConstraints(state, [{ kind: 'a', index, value }])) {
    state.lastOptimized = null;
  } else {
    state.status = 'Cannot move dot: same-value and fixed-sum constraints conflict.';
  }
}

function setSharedEdgeValue(state: AbUnionState, edgeIndex: number, value: number): void {
  if (solveAbUnionConstraints(state, [{ kind: 'b', index: edgeIndex, value }])) {
    state.lastOptimized = null;
  } else {
    state.status = 'Cannot move dot: same-value and fixed-sum constraints conflict.';
  }
}

function setDotValue(state: AbUnionState, dot: AbUnionDotHandle, value: number): void {
  if (dot.role === 'left') {
    setBValue(state, dot.edge, value);
  } else if (dot.role === 'right') {
    setAValue(state, dot.edge + 1, 1 - value);
  } else {
    setSharedEdgeValue(state, dot.edge, value);
  }
}

function addEdgeDot(state: AbUnionState, edgeIndex: number, value: number): void {
  normalizeAbUnionState(state);
  const edge = state.edgeDots[mod6(edgeIndex)];
  if (edge.split) return;
  const existing = edge.left;
  const nextValue = clamp01(value);
  edge.left = Math.min(existing, nextValue);
  edge.right = Math.max(existing, nextValue);
  edge.split = true;
  state.lastOptimized = null;
}

function deleteEdgeDot(state: AbUnionState, dot: AbUnionDotHandle): void {
  normalizeAbUnionState(state);
  const edge = state.edgeDots[mod6(dot.edge)];
  if (!edge.split || dot.role === 'shared') return;
  const previous = { ...edge };
  const kept = dot.role === 'left' ? edge.right : edge.left;
  edge.left = kept;
  edge.right = kept;
  edge.split = false;
  if (!solveAbUnionConstraints(state, [])) {
    edge.left = previous.left;
    edge.right = previous.right;
    edge.split = previous.split;
    state.status = 'Cannot delete dot: same-value and fixed-sum constraints conflict.';
    return;
  }
  state.lastOptimized = null;
}

export function setAbUnionLock(
  state: AbUnionState,
  kind: AbUnionLockKind,
  indexInput: number,
  locked: boolean,
): void {
  normalizeAbUnionState(state);
  const index = mod6(indexInput);
  const locks = kind === 'a' ? state.aLocked : state.bLocked;
  if (!locked) {
    locks[index] = false;
    return;
  }
  if (locks[index]) return;

  const firstLockedIndex = locks.findIndex(Boolean);
  const preferredValue = firstLockedIndex >= 0
    ? kind === 'a'
      ? aValue(state, firstLockedIndex)
      : bValue(state, firstLockedIndex)
    : null;
  const previousLocks = locks.slice();
  locks[index] = true;
  const preferences = preferredValue === null
    ? []
    : [{ kind, index: firstLockedIndex, value: preferredValue }];
  if (!solveAbUnionConstraints(state, preferences)) {
    if (kind === 'a') {
      state.aLocked = previousLocks;
    } else {
      state.bLocked = previousLocks;
    }
    state.status = `Cannot lock ${kind}${index}: same-value and fixed-sum constraints conflict.`;
    return;
  }
  state.lastOptimized = null;
}

function enforceAbUnionLocks(state: AbUnionState): void {
  if (!solveAbUnionConstraints(state, [])) {
    state.status = 'Same-value and fixed-sum constraints conflict.';
  }
}

export function setAbUnionFixedSum(state: AbUnionState, indexInput: number, fixed: boolean): void {
  normalizeAbUnionState(state);
  const index = mod6(indexInput);
  if (!fixed) {
    state.fixedSums[index] = null;
    return;
  }

  const previousFixedSums = state.fixedSums.slice();
  state.fixedSums[index] = aValue(state, index) + bValue(state, index);
  if (!solveAbUnionConstraints(state, [])) {
    state.fixedSums = previousFixedSums;
    state.status = `Cannot fix a${index}+b${index}: same-value and fixed-sum constraints conflict.`;
  }
}

function edgeRowsForState(state: AbUnionState): AbUnionEdgeRow[] {
  return state.edgeDots.map((edge, index) => ({
    index,
    left: edge.left,
    right: edge.right,
    split: edge.split,
  }));
}

function regionRowsForState(state: AbUnionState): AbUnionRegionRow[] {
  return Array.from({ length: 6 }, (_, index) => {
    const a = aValue(state, index);
    const b = bValue(state, index);
    const distanceValue = Math.sqrt(a * a + a * b + b * b);
    let rowState: AbUnionRegionRow['state'] = 'active';
    if (distanceValue * distanceValue > 1 + 1e-5) rowState = 'empty';
    else if (Math.abs(distanceValue * distanceValue - 1) <= 1e-5) rowState = 'limit';
    return {
      index,
      a,
      b,
      sum: a + b,
      distance: distanceValue,
      equality: Math.abs(a + b - 1) <= 1e-9,
      aLocked: Boolean(state.aLocked[index]),
      bLocked: Boolean(state.bLocked[index]),
      fixedSum: state.fixedSums[index],
      state: rowState,
    };
  });
}

function minEqualityGap(state: AbUnionState): number {
  return Math.min(...Array.from({ length: 6 }, (_, index) =>
    Math.abs(aValue(state, index) + bValue(state, index) - 1),
  ));
}

function activeLabel(activeRegions: boolean[]): string {
  const labels = activeRegions
    .map((active, index) => active ? `R${index}` : null)
    .filter((label): label is string => label !== null);
  return labels.join(', ') || 'none';
}

export function createDefaultAbUnionState(): AbUnionState {
  return {
    edgeDots: Array.from({ length: 6 }, () => defaultEdgeDots(0.25)),
    tool: 'move',
    theta: Math.PI / 6,
    centerMode: 'none',
    centerLocked: false,
    quality: 'adaptive',
    showRegion: true,
    showThetaTriangle: true,
    showFarPair: true,
    clipToCornerSectors: false,
    useAxisAlignedHull: false,
    regionVisible: Array(6).fill(true),
    aLocked: Array(6).fill(false),
    bLocked: Array(6).fill(false),
    fixedSums: Array(6).fill(null),
    activeRegions: Array(6).fill(false),
    labels: [],
    selectedMarkSources: [],
    coincidenceLocks: [],
    fMarks: [],
    selectedFMarkId: null,
    status: 'Move mode: drag edge dots or center geometry.',
    lastOptimized: null,
  };
}

export function setAbUnionPreset(state: AbUnionState, preset: AbUnionPreset): void {
  normalizeAbUnionState(state);
  const previousEdgeDots = state.edgeDots.map((edge) => ({ ...edge }));
  const previousActiveRegions = state.activeRegions.slice();
  const previousSelectedMarkSources = state.selectedMarkSources.slice();
  if (preset === 'equality') {
    state.edgeDots = Array.from({ length: 6 }, () => defaultEdgeDots(0.25));
  } else {
    state.edgeDots = Array.from({ length: 6 }, () => defaultEdgeDots(0.5));
  }
  state.activeRegions = Array(6).fill(false);
  state.selectedMarkSources = [];
  normalizeAbUnionState(state);
  if (!solveAbUnionConstraints(state, [])) {
    state.edgeDots = previousEdgeDots;
    state.activeRegions = previousActiveRegions;
    state.selectedMarkSources = previousSelectedMarkSources;
    state.status = 'Cannot apply preset: same-value and fixed-sum constraints conflict.';
    return;
  }
  state.lastOptimized = null;
}

function evaluateState(
  state: AbUnionState,
  thetaSamples: number,
  size: number,
  quality: AbUnionQuality,
): AbUnionOptimization {
  const cache = getMaskCache(size);
  const tempState = createDefaultAbUnionState();
  tempState.edgeDots = state.edgeDots.map((edge) => ({ ...edge }));
  tempState.clipToCornerSectors = state.clipToCornerSectors;
  tempState.useAxisAlignedHull = state.useAxisAlignedHull;
  tempState.showRegion = false;
  buildMask(cache, tempState);

  let best: AbUnionOptimization = { theta: 0, L: Number.POSITIVE_INFINITY };
  const samples = Math.max(1, Math.floor(thetaSamples));
  for (let i = 0; i < samples; i++) {
    const theta = (ANGLE_PERIOD * i) / samples;
    const candidate = computeThetaTriangle(cache, theta, quality);
    if (candidate.L < best.L) best = { theta, L: candidate.L };
  }
  return best;
}

export function optimizeAbUnionTheta(
  state: AbUnionState,
  thetaSamples = 240,
  size = config.canvasSize,
): AbUnionOptimization {
  normalizeAbUnionState(state);
  return evaluateState(state, thetaSamples, size, state.quality);
}

export function renderAbUnion(
  ctx: CanvasRenderingContext2D,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
): AbUnionRenderResult {
  normalizeAbUnionState(state);
  enforceAbUnionLocks(state);
  const cache = getMaskCache(config.canvasSize);
  refreshAbUnionLabels(state, triangleState);
  applyAbUnionCoincidenceLocks(state);
  enforceAbUnionLocks(state);
  const uncoveredCount = buildMask(cache, state);
  ctx.drawImage(cache.offscreen, 0, 0, config.canvasSize, config.canvasSize);
  const thetaResult = computeThetaTriangle(cache, state.theta, state.quality);
  const farPair = state.showFarPair ? findFarRedPair(cache) : null;
  const currentFMarkDistance = fMarkDistance(state);
  const currentFMarkTriangle = fMarkTriangle(state);
  if (state.showThetaTriangle) {
    drawThetaTriangle(ctx, thetaResult.vertices);
  }
  drawCenterShape(ctx, state, triangleState, localCs);
  drawFarPair(ctx, farPair);
  drawActiveBoundaries(ctx, cache, state);
  drawSelectedMarkSources(ctx, state, triangleState);
  drawPointsAndVertices(ctx, state);
  drawFMarkDistance(ctx, state, currentFMarkDistance);
  drawFMarkOverlay(ctx, state, currentFMarkTriangle);
  drawAbUnionLabels(ctx, state);
  const containment = computeCenterContainment(cache, state, triangleState, localCs);

  return {
    currentL: thetaResult.L,
    thetaTriangle: thetaResult.vertices,
    uncoveredCount,
    analysisCount: thetaResult.analysisCount,
    centerContains: containment.contains,
    centerFailures: containment.failures,
    farPair,
    minEqualityGap: minEqualityGap(state),
    fMarkCount: state.fMarks.length,
    fMarkDistance: currentFMarkDistance,
    fMarkTriangleSide: currentFMarkTriangle?.side ?? null,
    edgeRows: edgeRowsForState(state),
    regionRows: regionRowsForState(state),
    activeLabel: activeLabel(state.activeRegions),
  };
}

function getHitScale(pointerType: string): number {
  if (pointerType === 'touch') return TOUCH_HIT_SCALE;
  if (pointerType === 'pen') return PEN_HIT_SCALE;
  return 1;
}

function getPointerMath(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? config.canvasSize / rect.width : 1;
  const scaleY = rect.height > 0 ? config.canvasSize / rect.height : 1;
  return canvasToMath({
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  });
}

function hitDotTarget(mouse: Point, state: AbUnionState, pointerType: string): AbUnionHitTarget | null {
  const pointHit = scaleToMath(POINT_HIT_PX * getHitScale(pointerType));
  let best: AbUnionHitTarget | null = null;
  let bestDistance = Infinity;

  for (let i = 0; i < 6; i++) {
    const edge = state.edgeDots[i];
    if (!edge.split) {
      const d = distance(mouse, pointOnEdge(i, edge.left));
      if (d <= pointHit && d < bestDistance) {
        best = { kind: 'dot', dot: { edge: i, role: 'shared' } };
        bestDistance = d;
      }
      continue;
    }

    const leftDistance = distance(mouse, pointOnEdge(i, edge.left));
    const rightDistance = distance(mouse, pointOnEdge(i, edge.right));
    if (leftDistance <= pointHit || rightDistance <= pointHit) {
      let role: AbUnionDotRole = leftDistance <= rightDistance ? 'left' : 'right';
      if (Math.abs(leftDistance - rightDistance) < 1e-6) {
        const projected = projectEdgeValue(mouse, i);
        role = projected <= (edge.left + edge.right) / 2 ? 'left' : 'right';
      }
      const d = Math.min(leftDistance, rightDistance);
      if (d < bestDistance) {
        best = { kind: 'dot', dot: { edge: i, role } };
        bestDistance = d;
      }
    }
  }

  return best;
}

function hitFMarkTarget(mouse: Point, state: AbUnionState, pointerType: string): AbUnionFMark | null {
  const pointHit = scaleToMath(POINT_HIT_PX * getHitScale(pointerType));
  let best: AbUnionFMark | null = null;
  let bestDistance = Infinity;
  for (const mark of state.fMarks) {
    const d = distance(mouse, mark.point);
    if (d <= pointHit && d < bestDistance) {
      best = mark;
      bestDistance = d;
    }
  }
  return best;
}

function hitRegionTarget(mouse: Point, state: AbUnionState, pointerType: string): AbUnionHitTarget | null {
  const dot = hitDotTarget(mouse, state, pointerType);
  if (dot) return dot;

  const vertexHit = scaleToMath(REGION_VERTEX_HIT_PX * getHitScale(pointerType));
  let best: AbUnionHitTarget | null = null;
  let bestDistance = Infinity;

  for (let i = 0; i < 6; i++) {
    const d = distance(mouse, HEXAGON_VERTICES[i]);
    if (d <= vertexHit && d < bestDistance) {
      best = { kind: 'v', index: i };
      bestDistance = d;
    }
  }

  return best;
}

function hitEdgeTarget(mouse: Point, pointerType: string): AbUnionHitTarget | null {
  const edgeHit = scaleToMath(LOCAL_C_RAY_HIT_PX * getHitScale(pointerType));
  let best: AbUnionHitTarget | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < 6; i++) {
    const d = distanceToSegment(mouse, HEXAGON_VERTICES[i], HEXAGON_VERTICES[mod6(i + 1)]);
    if (d <= edgeHit && d < bestDistance) {
      best = { kind: 'edge', index: i };
      bestDistance = d;
    }
  }
  return best;
}

function hitLocalC(mouse: Point, localCs: number[], pointerType: string): AbUnionHitTarget | null {
  const handleHit = scaleToMath(LOCAL_C_HIT_PX * getHitScale(pointerType));
  let bestIndex: number | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < 6; i++) {
    const d = distance(mouse, localCPoint(i, localCs[i] ?? 0));
    if (d <= handleHit && d < bestDistance) {
      bestIndex = i;
      bestDistance = d;
    }
  }
  if (bestIndex !== null) return { kind: 'local-c', index: bestIndex };

  const rayHit = scaleToMath(LOCAL_C_RAY_HIT_PX * getHitScale(pointerType));
  for (let i = 0; i < 6; i++) {
    const d = distanceToSegment(mouse, localCPoint(i, 1), HEXAGON_VERTICES[i]);
    if (d <= rayHit && d < bestDistance) {
      bestIndex = i;
      bestDistance = d;
    }
  }
  return bestIndex === null ? null : { kind: 'local-c', index: bestIndex };
}

function hitCenterShape(
  mouse: Point,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
  pointerType: string,
): AbUnionHitTarget | null {
  if (state.centerMode === 'none') {
    return null;
  }
  if (state.centerLocked) {
    return null;
  }
  const hitScale = getHitScale(pointerType);
  if (state.centerMode === 'local-c') {
    return hitLocalC(mouse, localCs, pointerType);
  }
  if (state.centerMode === 'circle') {
    const borderDist = distanceToCircleBorder(mouse, triangleState.position, CIRCUMRADIUS);
    if (borderDist <= scaleToMath(BORDER_HIT_PX * hitScale)) return { kind: 'center-border' };
    if (pointInCircle(mouse, triangleState.position, CIRCUMRADIUS)) return { kind: 'center-interior' };
    return null;
  }

  const controlDist = distance(mouse, triangleState.controlPoint);
  if (controlDist <= scaleToMath(CONTROL_POINT_HIT_PX * hitScale)) return { kind: 'center-control' };
  const vertices = getVertices(triangleState);
  const borderDist = distanceToTriangleBorder(mouse, vertices);
  if (borderDist <= scaleToMath(BORDER_HIT_PX * hitScale)) return { kind: 'center-border' };
  if (pointInTriangle(mouse, vertices[0], vertices[1], vertices[2])) return { kind: 'center-interior' };
  return null;
}

function selectableMarkPrimitives(
  state: AbUnionState,
  triangleState: TriangleState,
): AbUnionMarkPrimitive[] {
  if (state.centerMode !== 'triangle' && state.centerMode !== 'circle') return [];
  const refs: AbUnionMarkSourceRef[] = [
    ...Array.from({ length: 6 }, (_, index) => ({ kind: 'hex-edge', index }) as AbUnionMarkSourceRef),
    ...Array.from({ length: 6 }, (_, index) => ({ kind: 'half-diagonal', index }) as AbUnionMarkSourceRef),
  ];

  if (state.centerMode === 'triangle') {
    refs.push(...Array.from({ length: 3 }, (_, index) => ({ kind: 'center-triangle-edge', index }) as AbUnionMarkSourceRef));
  } else if (state.centerMode === 'circle') {
    refs.push({ kind: 'center-circle', index: 0 });
  }

  return refs.flatMap((ref) => {
    const primitive = markPrimitiveForRef(ref, state, triangleState);
    return primitive ? [primitive] : [];
  });
}

function hitMarkSource(
  mouse: Point,
  state: AbUnionState,
  triangleState: TriangleState,
  pointerType: string,
): AbUnionMarkSourceRef | null {
  const limit = scaleToMath(MARK_HIT_PX * getHitScale(pointerType));
  let best: { ref: AbUnionMarkSourceRef; distance: number } | null = null;
  for (const primitive of selectableMarkPrimitives(state, triangleState)) {
    const d = distanceToMarkPrimitive(mouse, primitive);
    if (d <= limit && (!best || d < best.distance)) {
      best = { ref: primitive.ref, distance: d };
    }
  }
  return best?.ref ?? null;
}

function hitTest(
  mouse: Point,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
  pointerType: string,
): AbUnionHitTarget | null {
  return (state.tool === 'add' ? hitDotTarget(mouse, state, pointerType) ?? hitEdgeTarget(mouse, pointerType) : null)
    ?? hitRegionTarget(mouse, state, pointerType)
    ?? hitCenterShape(mouse, state, triangleState, localCs, pointerType);
}

function projectEdgeValue(mouse: Point, index: number): number {
  const start = HEXAGON_VERTICES[index];
  const edge = edgeVector(index);
  const length2 = edge.x * edge.x + edge.y * edge.y;
  if (length2 === 0) return 0;
  return clamp01(((mouse.x - start.x) * edge.x + (mouse.y - start.y) * edge.y) / length2);
}

function projectLocalC(mouse: Point, index: number): number {
  const closest = closestPointOnSegment(mouse, { x: 0, y: 0 }, HEXAGON_VERTICES[index]);
  return clamp01(1 - distance(closest, { x: 0, y: 0 }));
}

function setActiveOnly(state: AbUnionState, regions: number[]): void {
  const wanted = new Set(regions.map(mod6));
  const same = state.activeRegions.every((active, index) => active === wanted.has(index));
  state.activeRegions = Array(6).fill(false);
  if (same) return;
  for (const index of wanted) {
    state.activeRegions[index] = true;
  }
}

function handleClick(state: AbUnionState, hit: AbUnionHitTarget | null): void {
  if (!hit) {
    state.activeRegions = Array(6).fill(false);
  } else if (hit.kind === 'v') {
    setActiveOnly(state, [hit.index]);
  } else if (hit.kind === 'dot') {
    if (hit.dot.role === 'left') {
      setActiveOnly(state, [hit.dot.edge]);
    } else if (hit.dot.role === 'right') {
      setActiveOnly(state, [hit.dot.edge + 1]);
    } else {
      setActiveOnly(state, [hit.dot.edge, hit.dot.edge + 1]);
    }
  }
}

function selectMarkSource(
  state: AbUnionState,
  ref: AbUnionMarkSourceRef,
  mode: AbUnionLabelMode,
  preferred: Point,
  triangleState: TriangleState,
): void {
  normalizeAbUnionState(state);
  if (state.selectedMarkSources.some((selected) => sameMarkSource(selected, ref))) {
    state.selectedMarkSources = state.selectedMarkSources.filter((selected) => !sameMarkSource(selected, ref));
    state.status = 'Mark source unselected.';
    return;
  }

  const next = [...state.selectedMarkSources, ref].slice(-2);
  state.selectedMarkSources = next;
  if (next.length < 2) {
    state.status = `Selected ${markSourceLabel(ref)}; choose one more source.`;
    return;
  }

  const label = createAbUnionLabel(state, next[0], next[1], mode, preferred, triangleState);
  state.selectedMarkSources = [];
  if (!label) {
    state.status = 'Selected sources do not intersect.';
    return;
  }
  state.labels.push(label);
  state.status = `Created label ${label.name}.`;
}

function updateCursor(
  canvas: HTMLCanvasElement,
  hit: AbUnionHitTarget | null,
  centerMode: AbUnionCenterMode,
  tool: AbUnionTool,
): void {
  if (!hit) {
    canvas.style.cursor = 'default';
  } else if (tool === 'add' && hit.kind === 'edge') {
    canvas.style.cursor = 'copy';
  } else if (tool === 'delete' && hit.kind === 'dot') {
    canvas.style.cursor = 'pointer';
  } else if (hit.kind === 'dot') {
    canvas.style.cursor = 'grab';
  } else if (hit.kind === 'v' || hit.kind === 'local-c' || hit.kind === 'center-control') {
    canvas.style.cursor = 'pointer';
  } else if (hit.kind === 'center-border') {
    canvas.style.cursor = centerMode === 'circle' ? 'move' : 'alias';
  } else {
    canvas.style.cursor = 'move';
  }
}

function updateFMarkCursor(
  canvas: HTMLCanvasElement,
  mouse: Point,
  state: AbUnionState,
  pointerType: string,
): void {
  if (hitFMarkTarget(mouse, state, pointerType)) {
    canvas.style.cursor = 'grab';
  } else if (pointInClosedHex(mouse)) {
    canvas.style.cursor = 'crosshair';
  } else {
    canvas.style.cursor = 'default';
  }
}

export function setupAbUnionInteraction(
  canvas: HTMLCanvasElement,
  isEnabled: () => boolean,
  getState: () => AbUnionState,
  triangleState: TriangleState,
  getLocalCs: () => number[],
  onLocalCChange: (index: number, value: number) => void,
  render: () => void,
): void {
  let interaction: PointerInteraction = { kind: 'idle' };
  let activePointerId: number | null = null;
  let activePointerType = 'mouse';

  function stop(): void {
    interaction = { kind: 'idle' };
    if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
      canvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    activePointerType = 'mouse';
  }

  function onPointerDown(event: PointerEvent): void {
    if (!isEnabled() || !event.isPrimary) return;
    const pointerType = event.pointerType || 'mouse';
    const mouse = getPointerMath(canvas, event);
    const state = getState();

    if (state.tool === 'd-mark' || state.tool === 's-mark') {
      const source = hitMarkSource(mouse, state, triangleState, pointerType);
      if (source) {
        selectMarkSource(
          state,
          source,
          state.tool === 's-mark' ? 'static' : 'dynamic',
          mouse,
          triangleState,
        );
        render();
        event.preventDefault();
      }
      return;
    }

    if (state.tool === 'f-mark') {
      const existingMark = hitFMarkTarget(mouse, state, pointerType);
      const id = existingMark?.id ?? addAbUnionFMark(state, mouse);
      if (existingMark) {
        state.selectedFMarkId = existingMark.id;
        state.status = `Selected ${existingMark.id}.`;
      }
      if (id) {
        interaction = { kind: 'dragging-f-mark', id, startMouse: mouse, moved: false };
        activePointerId = event.pointerId;
        activePointerType = pointerType;
        canvas.setPointerCapture(event.pointerId);
      }
      render();
      event.preventDefault();
      return;
    }

    const hit = hitTest(mouse, state, triangleState, getLocalCs(), pointerType);

    if (state.tool === 'add' && (hit?.kind === 'edge' || hit?.kind === 'dot')) {
      const edgeIndex = hit.kind === 'edge' ? hit.index : hit.dot.edge;
      addEdgeDot(state, edgeIndex, projectEdgeValue(mouse, edgeIndex));
      render();
      event.preventDefault();
      return;
    }
    if (state.tool === 'delete' && hit?.kind === 'dot') {
      deleteEdgeDot(state, hit.dot);
      render();
      event.preventDefault();
      return;
    }

    if (state.tool === 'move' && hit?.kind === 'dot') {
      interaction = { kind: 'dragging-dot', dot: hit.dot, startMouse: mouse, moved: false };
      setDotValue(state, hit.dot, projectEdgeValue(mouse, hit.dot.edge));
      render();
    } else if (hit?.kind === 'local-c') {
      interaction = { kind: 'dragging-local-c', index: hit.index };
      onLocalCChange(hit.index, projectLocalC(mouse, hit.index));
      render();
    } else if (hit?.kind === 'center-control') {
      interaction = { kind: 'dragging-control', startMouse: mouse, startControl: { ...triangleState.controlPoint } };
    } else if (hit?.kind === 'center-border') {
      interaction = state.centerMode === 'circle'
        ? {
            kind: 'dragging-center',
            startMouse: mouse,
            startPos: { ...triangleState.position },
            startControl: { ...triangleState.controlPoint },
          }
        : {
            kind: 'rotating-triangle',
            startMouse: mouse,
            startAngle: triangleState.angle,
            startPos: { ...triangleState.position },
          };
    } else if (hit?.kind === 'center-interior') {
      interaction = {
        kind: 'dragging-center',
        startMouse: mouse,
        startPos: { ...triangleState.position },
        startControl: { ...triangleState.controlPoint },
      };
    } else {
      interaction = { kind: 'pending-click', startMouse: mouse, hit };
    }

    activePointerId = event.pointerId;
    activePointerType = pointerType;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isEnabled()) return;
    const pointerType = activePointerId === event.pointerId ? activePointerType : (event.pointerType || 'mouse');
    const mouse = getPointerMath(canvas, event);
    const state = getState();

    if (interaction.kind === 'idle') {
      if (state.tool === 'd-mark' || state.tool === 's-mark') {
        const source = hitMarkSource(mouse, state, triangleState, pointerType);
        canvas.style.cursor = source ? 'crosshair' : 'default';
        return;
      }
      if (state.tool === 'f-mark') {
        updateFMarkCursor(canvas, mouse, state, pointerType);
        return;
      }
      updateCursor(canvas, hitTest(mouse, state, triangleState, getLocalCs(), pointerType), state.centerMode, state.tool);
      return;
    }
    if (activePointerId !== event.pointerId) return;

    if (interaction.kind === 'pending-click') {
      if (distance(mouse, interaction.startMouse) > scaleToMath(CLICK_CANCEL_PX * getHitScale(pointerType))) {
        stop();
      }
      return;
    }

    if (interaction.kind === 'dragging-dot') {
      interaction.moved = interaction.moved
        || distance(mouse, interaction.startMouse) > scaleToMath(CLICK_CANCEL_PX * getHitScale(pointerType));
      setDotValue(state, interaction.dot, projectEdgeValue(mouse, interaction.dot.edge));
    } else if (interaction.kind === 'dragging-f-mark') {
      interaction.moved = interaction.moved
        || distance(mouse, interaction.startMouse) > scaleToMath(CLICK_CANCEL_PX * getHitScale(pointerType));
      moveAbUnionFMark(state, interaction.id, mouse);
    } else if (interaction.kind === 'dragging-local-c') {
      onLocalCChange(interaction.index, projectLocalC(mouse, interaction.index));
    } else if (interaction.kind === 'dragging-center') {
      const dx = mouse.x - interaction.startMouse.x;
      const dy = mouse.y - interaction.startMouse.y;
      const desiredPos = { x: interaction.startPos.x + dx, y: interaction.startPos.y + dy };
      const clamped = state.centerMode === 'circle'
        ? clampPointToCircle(desiredPos, { x: 0, y: 0 }, CIRCUMRADIUS)
        : clampPointToTriangle(desiredPos, ...getValidRegion(triangleState.angle));
      const clampDx = clamped.x - interaction.startPos.x;
      const clampDy = clamped.y - interaction.startPos.y;
      triangleState.position = clamped;
      triangleState.controlPoint = {
        x: interaction.startControl.x + clampDx,
        y: interaction.startControl.y + clampDy,
      };
    } else if (interaction.kind === 'rotating-triangle') {
      const cp = triangleState.controlPoint;
      const startAngle = Math.atan2(interaction.startMouse.y - cp.y, interaction.startMouse.x - cp.x);
      const currentAngle = Math.atan2(mouse.y - cp.y, mouse.x - cp.x);
      const delta = currentAngle - startAngle;
      const nextAngle = interaction.startAngle + delta;
      const nextPosition = rotatePoint(interaction.startPos, cp, delta);
      if (pointInTriangle(nextPosition, ...getValidRegion(nextAngle))) {
        triangleState.angle = nextAngle;
        triangleState.position = nextPosition;
      }
    } else if (interaction.kind === 'dragging-control') {
      triangleState.controlPoint = {
        x: interaction.startControl.x + mouse.x - interaction.startMouse.x,
        y: interaction.startControl.y + mouse.y - interaction.startMouse.y,
      };
    }

    render();
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!isEnabled() || activePointerId !== event.pointerId) return;
    const mouse = getPointerMath(canvas, event);
    const state = getState();
    const hit = hitTest(mouse, state, triangleState, getLocalCs(), activePointerType);

    if (interaction.kind === 'pending-click') {
      handleClick(state, interaction.hit ?? hit);
      render();
    } else if (interaction.kind === 'dragging-dot' && !interaction.moved) {
      handleClick(state, { kind: 'dot', dot: interaction.dot });
      render();
    }

    stop();
    if (state.tool === 'f-mark') {
      updateFMarkCursor(canvas, mouse, state, activePointerType);
    } else {
      updateCursor(canvas, hit, state.centerMode, state.tool);
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) return;
    stop();
    canvas.style.cursor = 'default';
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', () => {
    if (interaction.kind === 'idle' && isEnabled()) canvas.style.cursor = 'default';
  });
  canvas.addEventListener('lostpointercapture', () => {
    interaction = { kind: 'idle' };
    activePointerId = null;
    activePointerType = 'mouse';
  });
}
