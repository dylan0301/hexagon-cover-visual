import type { Point } from './types';
import { config } from './coords';
import {
  abUnionAdjacentBoundaryHit,
  buildAbUnionLocalHexAxisHull,
  containsAbUnionLocal,
  type AbUnionHexAxisHull,
} from './abUnion';

const SQRT3 = Math.sqrt(3);
const SAMPLE_STEPS = 240;
const HIT_RADIUS_PX = 11;
const EDGE_HIT_PX = 10;
const VIEW_PAD = 54;
const VIEW_MIN_X = -0.62;
const VIEW_MAX_X = 1.08;
const VIEW_MIN_Y = -0.08;
const VIEW_MAX_Y = 0.98;
const PARAM_LIMIT = 0.98;

type AxisFamily = 'u' | 'v' | 'd';

export interface AbHullDebugVertex {
  u: number;
  v: number;
}

export interface AbHullDebugExport {
  id: number;
  createdAt: string;
  a: number;
  b: number;
  sum: number;
  closed: boolean;
  polygon: AbHullDebugVertex[];
  coverage: {
    checked: boolean;
    sampleCount: number;
    missedCount: number;
  };
}

export interface AbHullDebugState {
  a: number;
  b: number;
  vertices: AbHullDebugVertex[];
  closed: boolean;
  selectedIndex: number | null;
  exports: AbHullDebugExport[];
  status: string;
}

export interface AbHullDebugResult {
  sampleCount: number;
  missedCount: number;
  closed: boolean;
  vertexText: string;
}

interface DebugSample {
  point: AbHullDebugVertex;
  missed: boolean;
}

interface DebugView {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function createDefaultAbHullDebugState(): AbHullDebugState {
  return {
    a: 0.2,
    b: 0.5,
    vertices: [],
    closed: false,
    selectedIndex: null,
    exports: [],
    status: 'Click to add snapped vertices.',
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampDebugPoint(point: AbHullDebugVertex): AbHullDebugVertex {
  return {
    u: clamp01(point.u),
    v: clamp01(point.v),
  };
}

export function setAbHullDebugParameter(
  state: AbHullDebugState,
  key: 'a' | 'b',
  rawValue: number,
): void {
  if (!Number.isFinite(rawValue)) return;
  const other = key === 'a' ? state.b : state.a;
  const value = Math.max(0, Math.min(PARAM_LIMIT - other, rawValue));
  state[key] = value;
  state.status = `Set ${key}=${value.toFixed(3)}.`;
}

export function resetAbHullDebugExample(state: AbHullDebugState): void {
  state.a = 0.2;
  state.b = 0.5;
  state.vertices = [];
  state.closed = false;
  state.selectedIndex = null;
  state.status = 'Reset to a=0.200, b=0.500.';
}

export function clearAbHullDebugPolygon(state: AbHullDebugState): void {
  state.vertices = [];
  state.closed = false;
  state.selectedIndex = null;
  state.status = 'Cleared polygon.';
}

export function undoAbHullDebugVertex(state: AbHullDebugState): void {
  if (state.closed) {
    state.closed = false;
    state.status = 'Reopened polygon.';
    return;
  }
  state.vertices.pop();
  state.selectedIndex = null;
  state.status = state.vertices.length === 0 ? 'Cleared polygon.' : 'Removed last vertex.';
}

export function closeAbHullDebugPolygon(state: AbHullDebugState): void {
  if (state.vertices.length < 3) {
    state.status = 'Need at least 3 vertices to close.';
    return;
  }
  state.closed = true;
  state.selectedIndex = null;
  state.status = 'Closed polygon.';
}

export function deleteSelectedAbHullDebugVertex(state: AbHullDebugState): void {
  const selected = state.selectedIndex;
  if (selected === null || selected < 0 || selected >= state.vertices.length) {
    state.status = 'Select a vertex before deleting.';
    return;
  }
  if (state.closed && state.vertices.length <= 3) {
    state.status = 'Closed polygon needs at least 3 vertices.';
    return;
  }

  const oldVertices = state.vertices.slice();
  state.vertices.splice(selected, 1);
  state.selectedIndex = null;
  repairDeletedVertexConnection(state, oldVertices, selected);
  state.status = `Deleted vertex ${selected + 1}.`;
}

function sameDebugPoint(a: AbHullDebugVertex, b: AbHullDebugVertex): boolean {
  return Math.abs(a.u - b.u) < 1e-8 && Math.abs(a.v - b.v) < 1e-8;
}

function addPolygonPoint(points: AbHullDebugVertex[], point: AbHullDebugVertex): void {
  const rounded = {
    u: roundDebugValue(clamp01(point.u)),
    v: roundDebugValue(clamp01(point.v)),
  };
  const last = points[points.length - 1];
  if (!last || !sameDebugPoint(last, rounded)) {
    points.push(rounded);
  }
}

function sortedUnique(values: number[]): number[] {
  return values
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > 1e-8);
}

function simplifyPolygon(points: AbHullDebugVertex[]): AbHullDebugVertex[] {
  const simplified = points.slice();
  let changed = true;
  while (changed && simplified.length >= 3) {
    changed = false;
    for (let i = 0; i < simplified.length; i++) {
      const previous = simplified[(i + simplified.length - 1) % simplified.length];
      const current = simplified[i];
      const next = simplified[(i + 1) % simplified.length];
      const cross = (current.u - previous.u) * (next.v - current.v) -
        (current.v - previous.v) * (next.u - current.u);
      if (Math.abs(cross) < 1e-8) {
        simplified.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return simplified;
}

function suggestedHullToPolygon(hull: AbUnionHexAxisHull): AbHullDebugVertex[] {
  const maxU = clamp01(hull.maxU);
  if (maxU <= 0 || hull.slabs.length === 0) return [];
  const lowerPoints: AbHullDebugVertex[] = [];
  const upperPoints: AbHullDebugVertex[] = [];

  for (const slab of hull.slabs) {
    const height = clamp01(slab.maxV);
    const startU = clamp01(slab.uStart);
    const endU = clamp01(slab.uEnd);
    if (!Number.isFinite(height) || endU < startU) continue;

    const candidates = sortedUnique([
      startU,
      endU,
      slab.minDelta,
      slab.maxDelta,
      height + slab.minDelta,
      height + slab.maxDelta,
    ].map((value) => Math.max(startU, Math.min(endU, value))));

    for (const u of candidates) {
      const lower = Math.max(0, u - slab.maxDelta);
      const upper = Math.min(height, u - slab.minDelta);
      if (upper + 1e-8 < lower) continue;
      addPolygonPoint(lowerPoints, { u, v: lower });
      addPolygonPoint(upperPoints, { u, v: upper });
    }
  }

  const polygon = lowerPoints.concat(upperPoints.reverse());
  if (polygon.length > 1 && sameDebugPoint(polygon[0], polygon[polygon.length - 1])) {
    polygon.pop();
  }
  return polygon.length >= 3 ? simplifyPolygon(polygon) : [];
}

export function loadSuggestedAbHullDebugPolygon(state: AbHullDebugState): void {
  const hull = buildAbUnionLocalHexAxisHull(state.a, state.b, SAMPLE_STEPS, 1 / SAMPLE_STEPS);
  const polygon = suggestedHullToPolygon(hull);
  if (polygon.length < 3) {
    state.status = 'Could not build suggested hull.';
    return;
  }

  state.vertices = polygon;
  state.closed = true;
  state.selectedIndex = null;
  state.status = `Loaded suggested hull with ${polygon.length} vertices.`;
}

function roundDebugValue(value: number): number {
  return Number(value.toFixed(6));
}

function clonePolygon(vertices: AbHullDebugVertex[]): AbHullDebugVertex[] {
  return vertices.map((point) => ({
    u: roundDebugValue(point.u),
    v: roundDebugValue(point.v),
  }));
}

export function exportAbHullDebugExperiment(
  state: AbHullDebugState,
  result: AbHullDebugResult,
): void {
  if (state.vertices.length === 0) {
    state.status = 'Draw a polygon before exporting.';
    return;
  }

  const id = state.exports.reduce((maxId, experiment) => Math.max(maxId, experiment.id), 0) + 1;
  state.exports.push({
    id,
    createdAt: new Date().toISOString(),
    a: roundDebugValue(state.a),
    b: roundDebugValue(state.b),
    sum: roundDebugValue(state.a + state.b),
    closed: state.closed,
    polygon: clonePolygon(state.vertices),
    coverage: {
      checked: state.closed,
      sampleCount: result.sampleCount,
      missedCount: state.closed ? result.missedCount : 0,
    },
  });
  state.status = `Exported experiment ${id}.`;
}

export function clearAbHullDebugExports(state: AbHullDebugState): void {
  state.exports = [];
  state.status = 'Cleared exported experiments.';
}

export function formatAbHullDebugExports(state: AbHullDebugState): string {
  return JSON.stringify({
    version: 1,
    kind: 'ab-hull-debug-experiments',
    experiments: state.exports,
  }, null, 2);
}

function createView(): DebugView {
  const width = VIEW_MAX_X - VIEW_MIN_X;
  const height = VIEW_MAX_Y - VIEW_MIN_Y;
  const scale = Math.min(
    (config.canvasSize - 2 * VIEW_PAD) / width,
    (config.canvasSize - 2 * VIEW_PAD) / height,
  );
  return {
    scale,
    offsetX: VIEW_PAD - VIEW_MIN_X * scale,
    offsetY: config.canvasSize - VIEW_PAD + VIEW_MIN_Y * scale,
  };
}

function localToWorld(point: AbHullDebugVertex): Point {
  return {
    x: point.u - 0.5 * point.v,
    y: (SQRT3 / 2) * point.v,
  };
}

function worldToLocal(point: Point): AbHullDebugVertex {
  const v = point.y / (SQRT3 / 2);
  return {
    u: point.x + 0.5 * v,
    v,
  };
}

function localToCanvas(point: AbHullDebugVertex, view: DebugView): Point {
  const world = localToWorld(point);
  return {
    x: view.offsetX + world.x * view.scale,
    y: view.offsetY - world.y * view.scale,
  };
}

function canvasToLocal(point: Point, view: DebugView): AbHullDebugVertex {
  const world = {
    x: (point.x - view.offsetX) / view.scale,
    y: (view.offsetY - point.y) / view.scale,
  };
  return clampDebugPoint(worldToLocal(world));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInPolygon(point: AbHullDebugVertex, polygon: AbHullDebugVertex[]): boolean {
  if (polygon.length < 3) return false;
  for (let i = 0; i < polygon.length; i++) {
    if (pointOnPolygonEdge(point, polygon[i], polygon[(i + 1) % polygon.length])) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.v > point.v) !== (b.v > point.v);
    if (crosses) {
      const uAtV = ((b.u - a.u) * (point.v - a.v)) / (b.v - a.v) + a.u;
      if (point.u < uAtV) inside = !inside;
    }
  }
  return inside;
}

function pointOnPolygonEdge(point: AbHullDebugVertex, a: AbHullDebugVertex, b: AbHullDebugVertex): boolean {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const edgeLength2 = du * du + dv * dv;
  if (edgeLength2 < 1e-16) return sameDebugPoint(point, a);

  const tolerance = 1e-7;
  const cross = (point.u - a.u) * dv - (point.v - a.v) * du;
  if (Math.abs(cross) / Math.sqrt(edgeLength2) > tolerance) return false;

  const dot = (point.u - a.u) * du + (point.v - a.v) * dv;
  return dot >= -tolerance && dot <= edgeLength2 + tolerance;
}

function sampleRegion(state: AbHullDebugState): DebugSample[] {
  const samples: DebugSample[] = [];
  for (let iu = 0; iu <= SAMPLE_STEPS; iu++) {
    for (let iv = 0; iv <= SAMPLE_STEPS; iv++) {
      const point = { u: iu / SAMPLE_STEPS, v: iv / SAMPLE_STEPS };
      if (!containsAbUnionLocal(point.u, point.v, state.a, state.b)) continue;
      const missed = state.closed && !pointInPolygon(point, state.vertices);
      samples.push({ point, missed });
    }
  }
  return samples;
}

function drawPoint(
  ctx: CanvasRenderingContext2D,
  view: DebugView,
  point: AbHullDebugVertex,
  radius: number,
  fill: string,
  stroke: string,
): void {
  const canvasPoint = localToCanvas(point, view);
  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  view: DebugView,
  point: AbHullDebugVertex,
  text: string,
  dx: number,
  dy: number,
): void {
  const canvasPoint = localToCanvas(point, view);
  ctx.fillStyle = '#334155';
  ctx.fillText(text, canvasPoint.x + dx, canvasPoint.y + dy);
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  view: DebugView,
  points: AbHullDebugVertex[],
  closed = false,
): void {
  if (points.length === 0) return;
  const first = localToCanvas(points[0], view);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = localToCanvas(points[i], view);
    ctx.lineTo(point.x, point.y);
  }
  if (closed) ctx.closePath();
}

function drawGuideLine(
  ctx: CanvasRenderingContext2D,
  view: DebugView,
  start: AbHullDebugVertex,
  end: AbHullDebugVertex,
): void {
  const a = localToCanvas(start, view);
  const b = localToCanvas(end, view);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function vertexText(vertices: AbHullDebugVertex[]): string {
  return vertices.map((point, index) =>
    `${index + 1}: (${point.u.toFixed(4)}, ${point.v.toFixed(4)})`,
  ).join('\n');
}

export function renderAbHullDebug(
  ctx: CanvasRenderingContext2D,
  state: AbHullDebugState,
): AbHullDebugResult {
  const view = createView();
  const samples = sampleRegion(state);
  const outgoingHit = { u: abUnionAdjacentBoundaryHit(state.a), v: 0 };
  const incomingHit = { u: 0, v: abUnionAdjacentBoundaryHit(state.b) };
  const missedCount = samples.reduce((count, sample) => count + (sample.missed ? 1 : 0), 0);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, config.canvasSize, config.canvasSize);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (const value of [0.25, 0.5, 0.75, 1]) {
    drawGuideLine(ctx, view, { u: value, v: 0 }, { u: value, v: 1 });
    drawGuideLine(ctx, view, { u: 0, v: value }, { u: 1, v: value });
  }

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  drawPolyline(ctx, view, [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 1, v: 1 },
    { u: 0, v: 1 },
  ], true);
  ctx.stroke();

  for (const sample of samples) {
    const point = localToCanvas(sample.point, view);
    ctx.fillStyle = sample.missed ? 'rgba(220, 38, 38, 0.72)' : 'rgba(20, 184, 166, 0.34)';
    ctx.fillRect(point.x - 1.15, point.y - 1.15, 2.3, 2.3);
  }

  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 1.4;
  drawGuideLine(ctx, view, outgoingHit, { u: 1, v: 1 - outgoingHit.u });
  drawGuideLine(ctx, view, incomingHit, { u: 1 - incomingHit.v, v: 1 });
  ctx.setLineDash([]);

  drawPoint(ctx, view, { u: 0, v: 0 }, 5, '#0f172a', '#ffffff');
  drawPoint(ctx, view, { u: state.b, v: 0 }, 5, '#fed7aa', '#c2410c');
  drawPoint(ctx, view, { u: 0, v: state.a }, 5, '#fed7aa', '#c2410c');
  drawPoint(ctx, view, outgoingHit, 5.5, '#ddd6fe', '#7c3aed');
  drawPoint(ctx, view, incomingHit, 5.5, '#ddd6fe', '#7c3aed');

  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  drawLabel(ctx, view, { u: 0, v: 0 }, 'V', 7, 7);
  drawLabel(ctx, view, { u: state.b, v: 0 }, '(b,0)', 7, 12);
  drawLabel(ctx, view, { u: 0, v: state.a }, '(0,a)', -42, -8);
  drawLabel(ctx, view, outgoingHit, 'hit', 7, -9);
  drawLabel(ctx, view, incomingHit, 'hit', -35, -8);

  if (state.vertices.length > 0) {
    if (state.closed) {
      drawPolyline(ctx, view, state.vertices, true);
      ctx.fillStyle = 'rgba(124, 58, 237, 0.08)';
      ctx.fill();
    }
    drawPolyline(ctx, view, state.vertices, state.closed);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  state.vertices.forEach((vertex, index) => {
    drawPoint(
      ctx,
      view,
      vertex,
      state.selectedIndex === index ? 6.2 : 5,
      '#ffffff',
      state.selectedIndex === index ? '#2563eb' : '#7c3aed',
    );
  });

  ctx.fillStyle = '#475569';
  ctx.font = '12px monospace';
  ctx.fillText('u axis: V_i -> V_{i+1}', 18, config.canvasSize - 30);
  ctx.fillText('v axis: V_i -> V_{i-1}', 18, config.canvasSize - 14);
  ctx.restore();

  return {
    sampleCount: samples.length,
    missedCount,
    closed: state.closed,
    vertexText: vertexText(state.vertices),
  };
}

function getPointerCanvas(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? config.canvasSize / rect.width : 1;
  const scaleY = rect.height > 0 ? config.canvasSize / rect.height : 1;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function lineConstant(family: AxisFamily, point: AbHullDebugVertex): number {
  if (family === 'u') return point.u;
  if (family === 'v') return point.v;
  return point.u - point.v;
}

function intersection(
  firstFamily: AxisFamily,
  firstPoint: AbHullDebugVertex,
  secondFamily: AxisFamily,
  secondPoint: AbHullDebugVertex,
): AbHullDebugVertex | null {
  if (firstFamily === secondFamily) return null;
  const first = lineConstant(firstFamily, firstPoint);
  const second = lineConstant(secondFamily, secondPoint);
  if (firstFamily === 'u' && secondFamily === 'v') return { u: first, v: second };
  if (firstFamily === 'v' && secondFamily === 'u') return { u: second, v: first };
  if (firstFamily === 'u' && secondFamily === 'd') return { u: first, v: first - second };
  if (firstFamily === 'd' && secondFamily === 'u') return { u: second, v: second - first };
  if (firstFamily === 'v' && secondFamily === 'd') return { u: second + first, v: first };
  if (firstFamily === 'd' && secondFamily === 'v') return { u: first + second, v: second };
  return null;
}

function candidateDistance(
  candidate: AbHullDebugVertex,
  target: AbHullDebugVertex,
  view: DebugView,
): number {
  return distance(localToCanvas(candidate, view), localToCanvas(target, view));
}

function inLooseUnitBox(point: AbHullDebugVertex): boolean {
  return point.u >= -0.03 && point.u <= 1.03 && point.v >= -0.03 && point.v <= 1.03;
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function edgeAxisFamily(start: AbHullDebugVertex, end: AbHullDebugVertex): AxisFamily | null {
  const uGap = Math.abs(start.u - end.u);
  const vGap = Math.abs(start.v - end.v);
  const dGap = Math.abs(start.u - start.v - (end.u - end.v));
  const minGap = Math.min(uGap, vGap, dGap);
  if (minGap > 1e-6) return null;
  if (minGap === uGap) return 'u';
  if (minGap === vGap) return 'v';
  return 'd';
}

function edgeIsAxisAligned(start: AbHullDebugVertex, end: AbHullDebugVertex): boolean {
  return edgeAxisFamily(start, end) !== null;
}

function closestPointOnCanvasSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return start;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}

function hitEdge(
  state: AbHullDebugState,
  point: Point,
  view: DebugView,
): { insertIndex: number; point: AbHullDebugVertex } | null {
  if (state.vertices.length < 2) return null;

  let best: { insertIndex: number; point: AbHullDebugVertex; distance: number } | null = null;
  const edgeCount = state.closed ? state.vertices.length : state.vertices.length - 1;
  for (let index = 0; index < edgeCount; index++) {
    const nextIndex = (index + 1) % state.vertices.length;
    const start = localToCanvas(state.vertices[index], view);
    const end = localToCanvas(state.vertices[nextIndex], view);
    const closest = closestPointOnCanvasSegment(point, start, end);
    const currentDistance = distance(point, closest);
    if (currentDistance > EDGE_HIT_PX || (best && currentDistance >= best.distance)) continue;
    best = {
      insertIndex: index + 1,
      point: clampDebugPoint(canvasToLocal(closest, view)),
      distance: currentDistance,
    };
  }

  return best && !state.vertices.some((vertex) => candidateDistance(vertex, best.point, view) <= HIT_RADIUS_PX)
    ? { insertIndex: best.insertIndex, point: best.point }
    : null;
}

function snapToNeighbor(
  target: AbHullDebugVertex,
  neighbor: AbHullDebugVertex,
  view: DebugView,
): AbHullDebugVertex {
  const delta = target.u - target.v - (neighbor.u - neighbor.v);
  const candidates: AbHullDebugVertex[] = [
    { u: neighbor.u, v: target.v },
    { u: target.u, v: neighbor.v },
    { u: target.u - delta / 2, v: target.v + delta / 2 },
  ].filter(inLooseUnitBox).map(clampDebugPoint);

  return candidates.reduce((best, candidate) =>
    candidateDistance(candidate, target, view) < candidateDistance(best, target, view)
      ? candidate
      : best,
  );
}

function snapMovingVertex(
  state: AbHullDebugState,
  index: number,
  target: AbHullDebugVertex,
  view: DebugView,
): AbHullDebugVertex {
  const previous = index > 0
    ? state.vertices[index - 1]
    : state.closed ? state.vertices[state.vertices.length - 1] : null;
  const next = index < state.vertices.length - 1
    ? state.vertices[index + 1]
    : state.closed ? state.vertices[0] : null;

  if (previous && next) {
    const families: AxisFamily[] = ['u', 'v', 'd'];
    const candidates = families.flatMap((first) =>
      families.flatMap((second) => {
        const candidate = intersection(first, previous, second, next);
        return candidate && inLooseUnitBox(candidate) ? [clampDebugPoint(candidate)] : [];
      }),
    );
    if (candidates.length > 0) {
      return candidates.reduce((best, candidate) =>
        candidateDistance(candidate, target, view) < candidateDistance(best, target, view)
          ? candidate
          : best,
      );
    }
  }

  if (previous) return snapToNeighbor(target, previous, view);
  if (next) return snapToNeighbor(target, next, view);
  return clampDebugPoint(target);
}

function edgeExists(vertices: AbHullDebugVertex[], closed: boolean, fromIndex: number, toIndex: number): boolean {
  if (vertices.length < 2) return false;
  if (closed) return true;
  return fromIndex >= 0 && toIndex >= 0 && fromIndex < vertices.length && toIndex < vertices.length;
}

function adjacentEdgesAligned(state: AbHullDebugState, index: number): boolean {
  const vertices = state.vertices;
  if (vertices.length < 2) return true;
  const previousIndex = index - 1 >= 0 ? index - 1 : state.closed ? vertices.length - 1 : -1;
  const nextIndex = index + 1 < vertices.length ? index + 1 : state.closed ? 0 : -1;

  return (
    !edgeExists(vertices, state.closed, previousIndex, index) ||
    edgeIsAxisAligned(vertices[previousIndex], vertices[index])
  ) && (
    !edgeExists(vertices, state.closed, index, nextIndex) ||
    edgeIsAxisAligned(vertices[index], vertices[nextIndex])
  );
}

function repairCandidate(
  state: AbHullDebugState,
  moveIndex: number,
  target: AbHullDebugVertex,
  view: DebugView,
): { vertices: AbHullDebugVertex[]; distance: number } | null {
  const candidateState: AbHullDebugState = {
    ...state,
    vertices: state.vertices.map((vertex) => ({ ...vertex })),
    selectedIndex: null,
  };
  candidateState.vertices[moveIndex] = snapMovingVertex(candidateState, moveIndex, target, view);
  if (!adjacentEdgesAligned(candidateState, moveIndex)) return null;
  return {
    vertices: candidateState.vertices,
    distance: candidateDistance(candidateState.vertices[moveIndex], target, view),
  };
}

function repairDeletedVertexConnection(
  state: AbHullDebugState,
  oldVertices: AbHullDebugVertex[],
  deletedIndex: number,
): void {
  const vertices = state.vertices;
  if (vertices.length < 2) return;

  const previousIndex = state.closed
    ? positiveMod(deletedIndex - 1, vertices.length)
    : deletedIndex - 1;
  const nextIndex = state.closed
    ? deletedIndex % vertices.length
    : deletedIndex;
  if (
    previousIndex < 0 ||
    nextIndex < 0 ||
    previousIndex >= vertices.length ||
    nextIndex >= vertices.length ||
    edgeIsAxisAligned(vertices[previousIndex], vertices[nextIndex])
  ) {
    return;
  }

  const view = createView();
  const candidates = [
    repairCandidate(state, previousIndex, oldVertices[positiveMod(deletedIndex - 1, oldVertices.length)], view),
    repairCandidate(state, nextIndex, oldVertices[(deletedIndex + 1) % oldVertices.length], view),
  ].filter((candidate): candidate is { vertices: AbHullDebugVertex[]; distance: number } => candidate !== null);
  if (candidates.length === 0) return;

  const best = candidates.reduce((currentBest, candidate) =>
    candidate.distance < currentBest.distance ? candidate : currentBest,
  );
  state.vertices = best.vertices;
}

function hitVertex(
  state: AbHullDebugState,
  point: Point,
  view: DebugView,
): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Infinity;
  state.vertices.forEach((vertex, index) => {
    const currentDistance = distance(point, localToCanvas(vertex, view));
    if (currentDistance <= HIT_RADIUS_PX && currentDistance < bestDistance) {
      bestIndex = index;
      bestDistance = currentDistance;
    }
  });
  return bestIndex;
}

export function setupAbHullDebugInteraction(
  canvas: HTMLCanvasElement,
  isEnabled: () => boolean,
  getState: () => AbHullDebugState,
  render: () => void,
): void {
  let activePointerId: number | null = null;
  let draggingIndex: number | null = null;

  function stop(): void {
    if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
      canvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    draggingIndex = null;
  }

  function onPointerDown(event: PointerEvent): void {
    if (!isEnabled() || !event.isPrimary) return;
    const state = getState();
    const view = createView();
    const canvasPoint = getPointerCanvas(canvas, event);
    const hit = hitVertex(state, canvasPoint, view);
    if (hit !== null) {
      state.selectedIndex = hit;
      draggingIndex = hit;
      activePointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      state.status = `Selected vertex ${hit + 1}.`;
      render();
      event.preventDefault();
      return;
    }

    const edgeHit = hitEdge(state, canvasPoint, view);
    if (edgeHit) {
      state.vertices.splice(edgeHit.insertIndex, 0, edgeHit.point);
      state.selectedIndex = edgeHit.insertIndex;
      state.status = `Inserted vertex ${edgeHit.insertIndex + 1}.`;
      render();
      event.preventDefault();
      return;
    }

    if (!state.closed) {
      const local = canvasToLocal(canvasPoint, view);
      const next = state.vertices.length === 0
        ? local
        : snapToNeighbor(local, state.vertices[state.vertices.length - 1], view);
      state.vertices.push(next);
      state.selectedIndex = state.vertices.length - 1;
      state.status = `Added vertex ${state.vertices.length}.`;
      render();
      event.preventDefault();
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isEnabled()) return;
    const state = getState();
    const view = createView();
    const canvasPoint = getPointerCanvas(canvas, event);
    if (draggingIndex === null || activePointerId !== event.pointerId) {
      const vertexHit = hitVertex(state, canvasPoint, view);
      const edgeHit = vertexHit === null ? hitEdge(state, canvasPoint, view) : null;
      canvas.style.cursor = vertexHit !== null
        ? 'move'
        : edgeHit !== null
          ? 'copy'
          : state.closed ? 'default' : 'crosshair';
      return;
    }

    const local = canvasToLocal(canvasPoint, view);
    state.vertices[draggingIndex] = snapMovingVertex(state, draggingIndex, local, view);
    state.selectedIndex = draggingIndex;
    state.status = `Moved vertex ${draggingIndex + 1}.`;
    render();
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) return;
    stop();
    event.preventDefault();
  }

  function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!isEnabled() || isTypingTarget(event.target)) return;
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const state = getState();
    if (state.selectedIndex === null) return;
    deleteSelectedAbHullDebugVertex(state);
    render();
    event.preventDefault();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', stop);
  window.addEventListener('keydown', onKeyDown);
}
