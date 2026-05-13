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
const CLICK_CANCEL_PX = 6;
const PEN_HIT_SCALE = 1.35;
const TOUCH_HIT_SCALE = 1.75;
const COVER_RGBA = [157, 219, 198, 150] as const;
const UNCOVERED_RGBA = [220, 38, 38, 145] as const;
const BOUNDARY_COLORS = ['#344e86', '#8a3ffc', '#0f766e', '#b45309', '#be123c', '#475569'];
const FAR_PAIR_DIRECTIONS = Array.from({ length: 48 }, (_, index) => {
  const angle = Math.PI * index / 48;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

export type AbUnionCenterMode = 'none' | 'triangle' | 'circle' | 'local-c';
export type AbUnionQuality = 'coarse' | 'high' | 'adaptive';
export type AbUnionPreset = 'equality' | 'midpoint';
export type AbUnionTool = 'move' | 'add' | 'delete';
export type AbUnionLockKind = 'a' | 'b';

export interface AbUnionEdgeDots {
  left: number;
  right: number;
  split: boolean;
}

export interface AbUnionState {
  edgeDots: AbUnionEdgeDots[];
  tool: AbUnionTool;
  theta: number;
  centerMode: AbUnionCenterMode;
  quality: AbUnionQuality;
  showRegion: boolean;
  showThetaTriangle: boolean;
  showFarPair: boolean;
  clipToCornerSectors: boolean;
  regionVisible: boolean[];
  aLocked: boolean[];
  bLocked: boolean[];
  activeRegions: boolean[];
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

type PointerInteraction =
  | { kind: 'idle' }
  | { kind: 'pending-click'; startMouse: Point; hit: AbUnionHitTarget | null }
  | { kind: 'dragging-dot'; dot: AbUnionDotHandle; startMouse: Point; moved: boolean }
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

function inCornerSector(u: number, v: number): boolean {
  return u <= 1 + EPS && v <= 1 + EPS;
}

function buildMask(cache: MaskCache, state: AbUnionState): number {
  const data = cache.overlay.data;
  data.fill(0);
  const out = Array.from({ length: 6 }, (_, index) => bValue(state, index));
  const inc = Array.from({ length: 6 }, (_, index) => aValue(state, index));
  let uncoveredCount = 0;

  for (let k = 0; k < cache.pixelIndex.length; k++) {
    let bits = 0;
    for (let i = 0; i < 6; i++) {
      const u = cache.localU[i][k];
      const v = cache.localV[i][k];
      if (
        (!state.clipToCornerSectors || inCornerSector(u, v)) &&
        containsConeRegion(u, v, out[i], inc[i])
      ) {
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
  state.tool = legacy.tool === 'add' || legacy.tool === 'delete' ? legacy.tool : 'move';
  state.regionVisible = Array.from({ length: 6 }, (_, index) => state.regionVisible?.[index] ?? true);
  state.aLocked = normalizeLockArray(state.aLocked);
  state.bLocked = normalizeLockArray(state.bLocked);
  state.activeRegions = normalizeLockArray(state.activeRegions);
}

function groupedIndices(locks: boolean[], index: number): number[] {
  return locks[mod6(index)] ? locks
    .map((locked, current) => locked ? current : -1)
    .filter((current) => current >= 0) : [mod6(index)];
}

function clampBForGroup(state: AbUnionState, indices: number[], value: number): number {
  const upper = Math.min(...indices.map((index) => {
    const edge = state.edgeDots[mod6(index)];
    return edge.split ? edge.right : 1;
  }));
  return Math.max(0, Math.min(upper, value));
}

function clampAForGroup(state: AbUnionState, indices: number[], value: number): number {
  const upper = Math.min(...indices.map((index) => {
    const edge = state.edgeDots[mod6(index - 1)];
    return edge.split ? 1 - edge.left : 1;
  }));
  return Math.max(0, Math.min(upper, value));
}

function applyBValue(state: AbUnionState, indices: number[], value: number): void {
  for (const index of indices) {
    const edge = state.edgeDots[mod6(index)];
    const nextValue = clamp01(value);
    if (edge.split) {
      edge.left = Math.min(nextValue, edge.right);
    } else {
      edge.left = nextValue;
      edge.right = nextValue;
    }
  }
}

function applyAValue(state: AbUnionState, indices: number[], value: number): void {
  for (const index of indices) {
    const edge = state.edgeDots[mod6(index - 1)];
    const nextRight = 1 - clamp01(value);
    if (edge.split) {
      edge.right = Math.max(edge.left, nextRight);
    } else {
      edge.left = nextRight;
      edge.right = nextRight;
    }
  }
}

function setBValue(state: AbUnionState, index: number, value: number): void {
  normalizeAbUnionState(state);
  const indices = groupedIndices(state.bLocked, index);
  applyBValue(state, indices, clampBForGroup(state, indices, clamp01(value)));
  state.lastOptimized = null;
}

function setAValue(state: AbUnionState, index: number, value: number): void {
  normalizeAbUnionState(state);
  const indices = groupedIndices(state.aLocked, index);
  applyAValue(state, indices, clampAForGroup(state, indices, clamp01(value)));
  state.lastOptimized = null;
}

function setSharedEdgeValue(state: AbUnionState, edgeIndex: number, value: number): void {
  normalizeAbUnionState(state);
  const edge = mod6(edgeIndex);
  const bGroup = groupedIndices(state.bLocked, edge);
  const aGroup = groupedIndices(state.aLocked, edge + 1);
  const minValue = Math.max(0, ...aGroup.map((index) => {
    const previousEdge = state.edgeDots[mod6(index - 1)];
    return previousEdge.split ? previousEdge.left : 0;
  }));
  const maxValue = Math.min(1, ...bGroup.map((index) => {
    const currentEdge = state.edgeDots[mod6(index)];
    return currentEdge.split ? currentEdge.right : 1;
  }));
  const nextValue = minValue <= maxValue
    ? Math.max(minValue, Math.min(maxValue, value))
    : clamp01(value);
  applyBValue(state, bGroup, nextValue);
  applyAValue(state, aGroup, 1 - nextValue);
  state.lastOptimized = null;
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
  const kept = dot.role === 'left' ? edge.right : edge.left;
  edge.left = kept;
  edge.right = kept;
  edge.split = false;
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
  locks[index] = true;
  if (firstLockedIndex >= 0) {
    if (kind === 'a') {
      setAValue(state, index, aValue(state, firstLockedIndex));
    } else {
      setBValue(state, index, bValue(state, firstLockedIndex));
    }
  }
  state.lastOptimized = null;
}

function enforceAbUnionLocks(state: AbUnionState): void {
  const firstB = state.bLocked.findIndex(Boolean);
  if (firstB >= 0) {
    const indices = groupedIndices(state.bLocked, firstB);
    applyBValue(state, indices, clampBForGroup(state, indices, bValue(state, firstB)));
  }
  const firstA = state.aLocked.findIndex(Boolean);
  if (firstA >= 0) {
    const indices = groupedIndices(state.aLocked, firstA);
    applyAValue(state, indices, clampAForGroup(state, indices, aValue(state, firstA)));
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
    quality: 'adaptive',
    showRegion: true,
    showThetaTriangle: true,
    showFarPair: true,
    clipToCornerSectors: false,
    regionVisible: Array(6).fill(true),
    aLocked: Array(6).fill(false),
    bLocked: Array(6).fill(false),
    activeRegions: Array(6).fill(false),
    lastOptimized: null,
  };
}

export function setAbUnionPreset(state: AbUnionState, preset: AbUnionPreset): void {
  if (preset === 'equality') {
    state.edgeDots = Array.from({ length: 6 }, () => defaultEdgeDots(0.25));
  } else {
    state.edgeDots = Array.from({ length: 6 }, () => defaultEdgeDots(0.5));
  }
  state.activeRegions = Array(6).fill(false);
  state.lastOptimized = null;
  normalizeAbUnionState(state);
  enforceAbUnionLocks(state);
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
  const uncoveredCount = buildMask(cache, state);
  ctx.drawImage(cache.offscreen, 0, 0, config.canvasSize, config.canvasSize);
  const thetaResult = computeThetaTriangle(cache, state.theta, state.quality);
  const farPair = state.showFarPair ? findFarRedPair(cache) : null;
  if (state.showThetaTriangle) {
    drawThetaTriangle(ctx, thetaResult.vertices);
  }
  drawCenterShape(ctx, state, triangleState, localCs);
  drawFarPair(ctx, farPair);
  drawActiveBoundaries(ctx, cache, state);
  drawPointsAndVertices(ctx, state);
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
    updateCursor(canvas, hit, state.centerMode, state.tool);
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
