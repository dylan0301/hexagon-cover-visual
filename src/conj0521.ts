import type { Point, TriangleState } from './types';
import { mathToCanvas, scaleToCanvas } from './coords';
import { fitTriangle, type CoverTriangle } from './cover';
import { HEXAGON_VERTICES } from './hexagon';
import { admissible } from './maps';
import {
  abUnionAValues,
  abUnionBValues,
  containsAbUnionLocal,
  createDefaultAbUnionState,
  renderAbUnion,
  type AbUnionRenderResult,
  type AbUnionState,
} from './abUnion';

const STRICT_GAP = 1e-6;
const EDGE_AXIS_EPS = 1e-5;
const BOUNDARY_STEPS = 240;
const BINARY_STEPS = 42;

interface CircleGeometry {
  id: 'C2' | 'C5';
  center: Point;
}

export interface Conj0521Point {
  id: string;
  label: string;
  point: Point | null;
}

export interface Conj0521RegionRow {
  index: number;
  a: number;
  b: number;
  sum: number;
  constraint: string;
  ok: boolean;
}

export interface Conj0521RenderResult {
  base: AbUnionRenderResult;
  aValues: number[];
  bValues: number[];
  tValues: number[];
  rows: Conj0521RegionRow[];
  points: Conj0521Point[];
  triangle: CoverTriangle | null;
  strictGap: number;
  status: string;
}

function mod6(index: number): number {
  return (index + 6) % 6;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(value: number, point: Point): Point {
  return { x: value * point.x, y: value * point.y };
}

function edgeVector(index: number): Point {
  const start = HEXAGON_VERTICES[mod6(index)];
  const end = HEXAGON_VERTICES[mod6(index + 1)];
  return subtract(end, start);
}

function pointOnEdge(index: number, value: number): Point {
  const start = HEXAGON_VERTICES[mod6(index)];
  return add(start, scale(clamp01(value), edgeVector(index)));
}

function localCoordinates(index: number, point: Point): { u: number; v: number } {
  const vertex = HEXAGON_VERTICES[mod6(index)];
  const out = edgeVector(index);
  const inc = subtract(HEXAGON_VERTICES[mod6(index - 1)], vertex);
  const relative = subtract(point, vertex);
  const dOut = dot(relative, out);
  const dIn = dot(relative, inc);
  return {
    u: (4 / 3) * (dOut + 0.5 * dIn),
    v: (4 / 3) * (0.5 * dOut + dIn),
  };
}

function readTValues(state: AbUnionState): number[] {
  return Array.from({ length: 6 }, (_, index) => {
    const edge = state.edgeDots?.[index];
    if (!edge) return 0.5;
    return clamp01((edge.left + (edge.split ? edge.right : edge.left)) / 2);
  });
}

function writeTValues(state: AbUnionState, t: number[]): void {
  state.edgeDots = Array.from({ length: 6 }, (_, index) => {
    const value = clamp01(t[index] ?? 0.5);
    return { left: value, right: value, split: false };
  });
}

export function enforceConj0521Constraints(state: AbUnionState): void {
  const t = readTValues(state);
  const t0Input = clamp01((t[0] + t[1]) / 2);
  let t2 = clamp01((t[2] + t[3]) / 2);
  let t4 = clamp01((t[4] + t[5]) / 2);

  if (t4 - t2 < STRICT_GAP) {
    const center = clamp((t2 + t4) / 2, STRICT_GAP / 2, 1 - STRICT_GAP / 2);
    t2 = center - STRICT_GAP / 2;
    t4 = center + STRICT_GAP / 2;
  }

  const t0 = clamp(t0Input, t2, t4);
  writeTValues(state, [t0, t0, t2, t2, t4, t4]);

  state.fixedSums = [null, 1, null, 1, null, 1];
  state.aLocked = Array(6).fill(false);
  state.bLocked = Array(6).fill(false);
  state.centerMode = 'none';
  state.centerLocked = false;
  state.tool = 'move';
  state.showThetaTriangle = false;
  state.showFarPair = false;
  state.showOriginalRegion = true;
  state.useAxisAlignedHull = false;
  state.clipToCornerSectors = false;
  state.regionVisible = Array(6).fill(true);
  state.selectedMarkSources = [];
  state.coincidenceLocks = [];
  state.labels = [];
  state.fMarks = [];
  state.selectedFMarkId = null;
  if (!Array.isArray(state.activeRegions) || state.activeRegions.length !== 6) {
    state.activeRegions = [false, false, false, false, true, false];
  }
}

export function createDefaultConj0521State(): AbUnionState {
  const state = createDefaultAbUnionState();
  writeTValues(state, [0.45, 0.45, 0.35, 0.35, 0.55, 0.55]);
  state.activeRegions = [false, false, false, false, true, false];
  enforceConj0521Constraints(state);
  state.status = '0521 constraints active.';
  return state;
}

function circleGeometries(tValues: number[]): CircleGeometry[] {
  const x2 = pointOnEdge(2, tValues[2]);
  const x5 = pointOnEdge(5, tValues[5]);
  return [
    { id: 'C2', center: x2 },
    { id: 'C5', center: x5 },
  ];
}

function containsR4(point: Point, a4: number, b4: number): boolean {
  const local = localCoordinates(4, point);
  return containsAbUnionLocal(local.u, local.v, a4, b4);
}

function findBoundaryOnParam(
  pointAt: (t: number) => Point,
  contains: (point: Point) => boolean,
  startT = 0,
  endT = 1,
  startInside = contains(pointAt(startT)),
): Point | null {
  let previousT = startT;
  let previousInside = startInside;
  const steps = Math.max(1, Math.ceil((endT - startT) * BOUNDARY_STEPS));

  for (let step = 1; step <= steps; step++) {
    const currentT = startT + (endT - startT) * step / steps;
    const currentInside = contains(pointAt(currentT));
    if (currentInside !== previousInside) {
      let low = previousT;
      let high = currentT;
      let lowInside = previousInside;
      for (let iter = 0; iter < BINARY_STEPS; iter++) {
        const mid = (low + high) / 2;
        const midInside = contains(pointAt(mid));
        if (midInside === lowInside) {
          low = mid;
          lowInside = midInside;
        } else {
          high = mid;
        }
      }
      return pointAt((low + high) / 2);
    }
    previousT = currentT;
    previousInside = currentInside;
  }

  return null;
}

function pointOnCircle(circle: CircleGeometry, t: number): Point {
  const angle = 2 * Math.PI * t;
  return {
    x: circle.center.x + Math.cos(angle),
    y: circle.center.y + Math.sin(angle),
  };
}

function boundaryIntersectionsWithCircle(circle: CircleGeometry, a4: number, b4: number): Point[] {
  const contains = (point: Point) => containsR4(point, a4, b4);
  const points: Point[] = [];
  let previousT = 0;
  let previousInside = contains(pointOnCircle(circle, 0));

  for (let step = 1; step <= BOUNDARY_STEPS; step++) {
    const currentT = step / BOUNDARY_STEPS;
    const currentInside = contains(pointOnCircle(circle, currentT));
    if (currentInside !== previousInside) {
      const hit = findBoundaryOnParam(
        (t) => pointOnCircle(circle, t),
        contains,
        previousT,
        currentT,
        previousInside,
      );
      if (hit && !points.some((point) => distance(point, hit) <= 1e-6)) {
        points.push(hit);
      }
    }
    previousT = currentT;
    previousInside = currentInside;
  }

  return points;
}

function isR4BoundaryCurvePoint(point: Point): boolean {
  const local = localCoordinates(4, point);
  return local.u > EDGE_AXIS_EPS && local.v > EDGE_AXIS_EPS;
}

function closestCurvePointToV4(points: Point[]): Point | null {
  const curvePoints = points.filter(isR4BoundaryCurvePoint);
  if (curvePoints.length === 0) return null;
  const target = HEXAGON_VERTICES[4];
  return curvePoints.reduce((best, point) => (
    distance(point, target) < distance(best, target) ? point : best
  ));
}

function maxAdmissibleC(a: number, b: number): number {
  const steps = 256;
  let best = admissible(a, b, 0) ? 0 : -1;
  let bestIndex = best >= 0 ? 0 : -1;

  for (let index = 1; index <= steps; index++) {
    const c = index / steps;
    if (admissible(a, b, c)) {
      best = c;
      bestIndex = index;
    }
  }

  if (best < 0) return 0;
  if (bestIndex >= steps) return 1;

  let low = best;
  let high = (bestIndex + 1) / steps;
  for (let iter = 0; iter < BINARY_STEPS; iter++) {
    const mid = (low + high) / 2;
    if (admissible(a, b, mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return clamp01(low);
}

function maxCPoint(index: number, a: number, b: number): Point {
  const c = maxAdmissibleC(a, b);
  return scale(1 - c, HEXAGON_VERTICES[index]);
}

function buildRows(aValues: number[], bValues: number[]): Conj0521RegionRow[] {
  return Array.from({ length: 6 }, (_, index) => {
    const sum = aValues[index] + bValues[index];
    let constraint = 'free';
    let ok = true;
    if (index === 1 || index === 3 || index === 5) {
      constraint = '= 1';
      ok = Math.abs(sum - 1) <= 1e-7;
    } else if (index === 4) {
      constraint = '> 1';
      ok = sum > 1;
    } else if (index === 0 || index === 2) {
      constraint = '<= 1';
      ok = sum <= 1 + 1e-7;
    }
    return { index, a: aValues[index], b: bValues[index], sum, constraint, ok };
  });
}

function drawCircleOverlay(ctx: CanvasRenderingContext2D, circle: CircleGeometry): void {
  const center = mathToCanvas(circle.center);
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, scaleToCanvas(1), 0, 2 * Math.PI);
  ctx.strokeStyle = circle.id === 'C2' ? '#ea580c' : '#0f766e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Point[], stroke: string, fill: string): void {
  if (points.length === 0) return;
  const canvasPoints = points.map(mathToCanvas);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  for (const point of canvasPoints.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.4;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawConjPoints(ctx: CanvasRenderingContext2D, points: Conj0521Point[]): void {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const item of points) {
    if (!item.point) continue;
    const point = mathToCanvas(item.point);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5.8, 0, 2 * Math.PI);
    ctx.fillStyle = '#fef3c7';
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#78350f';
    ctx.fillText(item.id, point.x + 7, point.y - 7);
  }
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, circles: CircleGeometry[], points: Conj0521Point[], triangle: CoverTriangle | null): void {
  for (const circle of circles) {
    drawCircleOverlay(ctx, circle);
  }
  if (triangle) {
    drawPolygon(ctx, triangle.vertices, '#eab308', 'rgba(250, 204, 21, 0.12)');
  }
  drawConjPoints(ctx, points);
}

export function renderConj0521(
  ctx: CanvasRenderingContext2D,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
): Conj0521RenderResult {
  enforceConj0521Constraints(state);
  const base = renderAbUnion(ctx, state, triangleState, localCs);
  enforceConj0521Constraints(state);

  const aValues = abUnionAValues(state);
  const bValues = abUnionBValues(state);
  const tValues = readTValues(state);
  const circles = circleGeometries(tValues);
  const p3 = closestCurvePointToV4(boundaryIntersectionsWithCircle(circles[0], aValues[4], bValues[4]));
  const p5 = closestCurvePointToV4(boundaryIntersectionsWithCircle(circles[1], aValues[4], bValues[4]));
  const points: Conj0521Point[] = [
    { id: 'P3', label: 'R4/C2', point: p3 },
    { id: 'P5', label: 'R4/C5', point: p5 },
    { id: 'G0', label: 'V0 max c', point: maxCPoint(0, aValues[0], bValues[0]) },
    { id: 'G2', label: 'V2 max c', point: maxCPoint(2, aValues[2], bValues[2]) },
  ];
  const concretePoints = points.flatMap((item) => item.point ? [item.point] : []);
  const triangle = concretePoints.length === points.length
    ? fitTriangle('0521', concretePoints, '#eab308')
    : null;
  drawOverlay(ctx, circles, points, triangle);

  const missing = points.filter((item) => item.point === null).map((item) => item.id);
  const status = missing.length === 0
    ? 'ready'
    : `missing ${missing.join(', ')}`;

  return {
    base,
    aValues,
    bValues,
    tValues,
    rows: buildRows(aValues, bValues),
    points,
    triangle,
    strictGap: aValues[4] + bValues[4] - 1,
    status,
  };
}
