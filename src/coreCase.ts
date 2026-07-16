import type { Point, TriangleState } from './types';
import { canvasToMath, config, mathToCanvas, scaleToCanvas } from './coords';
import { fitTriangle, type CoverTriangle } from './cover';
import { HEXAGON_VERTICES } from './hexagon';
import {
  abUnionAValues,
  abUnionBValues,
  abUnionStrictTwoLineSupersetSegments,
  containsAbUnionLocal,
  createDefaultAbUnionState,
  renderAbUnion,
  setAbUnionDotValue,
  type AbUnionDotHandle,
  type AbUnionLocalLineSegment,
  type AbUnionLocalRegionVariant,
  type AbUnionRenderResult,
  type AbUnionState,
} from './abUnion';

const STRICT_GAP = 1e-6;
const EDGE_AXIS_EPS = 1e-5;
const BOUNDARY_STEPS = 240;
const BINARY_STEPS = 42;
const TRIANGLE_SUPPORT_TOL = 1e-6;
const TWO_LINE_STROKE = '#c026d3';
const TWO_LINE_FILL = '#fdf4ff';
const DEFAULT_CORE_CASE_OPTIONS = {
  forceSum3: true,
  forceSum5: true,
  hardLimitDrag: false,
  algorithm2Diagonals: false,
  strictTwoLineSuperset: false,
  relaxedPPoints: false,
} as const;

export interface CircleGeometry {
  id: 'C2' | 'C5';
  center: Point;
}

type CoreCaseConstraint = '<= 1' | '= 1' | '> 1';

interface CoreCasePointContext {
  circles: CircleGeometry[];
  aValues: number[];
  bValues: number[];
  localRegionVariant: AbUnionLocalRegionVariant;
  algorithm2Diagonals: boolean;
  algorithm2P: number;
  algorithm2Q: number;
  relaxedPPoints: boolean;
}

interface CoreCasePointDefinition {
  id: string;
  label: string;
  build: (context: CoreCasePointContext) => Point | null;
}

export interface CoreCaseOptions {
  forceSum3: boolean;
  forceSum5: boolean;
  hardLimitDrag: boolean;
  algorithm2Diagonals: boolean;
  strictTwoLineSuperset: boolean;
  relaxedPPoints: boolean;
}

export interface CoreCasePoint {
  id: string;
  label: string;
  point: Point | null;
  enabled: boolean;
}

export interface CoreCaseRegionRow {
  index: number;
  a: number;
  b: number;
  sum: number;
  constraint: string;
  ok: boolean;
}

export interface CoreCaseRenderOptions {
  disabledPointIds?: ReadonlySet<string> | readonly string[];
  intervalPointFractions?: readonly number[];
}

export interface CoreCaseRenderResult {
  base: AbUnionRenderResult;
  aValues: number[];
  bValues: number[];
  tValues: number[];
  rows: CoreCaseRegionRow[];
  points: CoreCasePoint[];
  enabledPointCount: number;
  triangle: CoverTriangle | null;
  strictGap: number;
  localRegionVariant: AbUnionLocalRegionVariant;
  status: string;
}

export interface CoreCaseGraphSample {
  a: number;
  b: number;
  domainOk: boolean;
  domainStatus: string;
  circles: CircleGeometry[];
  points: CoreCasePoint[];
  enabledPointCount: number;
  triangle: CoverTriangle | null;
  side: number | null;
  strictGap: number;
  localRegionVariant: AbUnionLocalRegionVariant;
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

function localRegionVariant(options: Pick<CoreCaseOptions, 'strictTwoLineSuperset'>): AbUnionLocalRegionVariant {
  return options.strictTwoLineSuperset ? 'strict-two-line-superset' : 'exact';
}

function effectiveForceSum3(options: Pick<CoreCaseOptions, 'forceSum3' | 'relaxedPPoints'>): boolean {
  return options.forceSum3 && !options.relaxedPPoints;
}

function effectiveForceSum5(options: Pick<CoreCaseOptions, 'forceSum5' | 'relaxedPPoints'>): boolean {
  return options.forceSum5 && !options.relaxedPPoints;
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

function hasSplitEdgeDots(state: AbUnionState): boolean {
  return state.edgeDots?.some((edge) => edge?.split) ?? false;
}

function writeTValues(state: AbUnionState, t: number[]): void {
  state.edgeDots = Array.from({ length: 6 }, (_, index) => {
    const value = clamp01(t[index] ?? 0.5);
    return { left: value, right: value, split: false };
  });
}

function enforceCoreCaseCommonState(
  state: AbUnionState,
  fixedSums: Array<number | null>,
  defaultActiveRegions: boolean[],
): void {
  state.fixedSums = fixedSums.slice();
  state.sumConstraintModes = fixedSums.map((sum) => sum === null ? 'none' : 'current');
  state.aLocked = Array(6).fill(false);
  state.bLocked = Array(6).fill(false);
  state.centerMode = 'none';
  state.centerLocked = false;
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
    state.activeRegions = defaultActiveRegions.slice();
  }
}

function coreCaseConstraints(options: CoreCaseOptions): readonly CoreCaseConstraint[] {
  return [
    '<= 1',
    '<= 1',
    '<= 1',
    effectiveForceSum3(options) ? '= 1' : '<= 1',
    '> 1',
    effectiveForceSum5(options) ? '= 1' : '<= 1',
  ];
}

function coreCaseFixedSums(options: CoreCaseOptions): Array<number | null> {
  return [
    null,
    null,
    null,
    effectiveForceSum3(options) ? 1 : null,
    null,
    effectiveForceSum5(options) ? 1 : null,
  ];
}

function clampCoreCaseTValues(t: number[], options: CoreCaseOptions): number[] {
  const forceSum3 = effectiveForceSum3(options);
  const forceSum5 = effectiveForceSum5(options);
  let t2 = clamp01(forceSum3 ? (t[2] + t[3]) / 2 : t[2]);
  let t3 = clamp01(forceSum3 ? t2 : t[3]);
  let t4 = clamp01(forceSum5 ? (t[4] + t[5]) / 2 : t[4]);
  let t5 = clamp01(forceSum5 ? t4 : t[5]);

  t4 = Math.max(t4, STRICT_GAP);
  t5 = forceSum5 ? t4 : clamp(t5, 0, t4);

  if (forceSum3) {
    t2 = clamp(t2, 0, Math.max(0, Math.min(t5, t4 - STRICT_GAP)));
    t3 = t2;
  } else {
    t2 = clamp(t2, 0, t5);
    t3 = clamp(t3, 0, Math.max(0, Math.min(t2, t4 - STRICT_GAP)));
  }

  t5 = forceSum5 ? t4 : clamp(t5, t2, t4);
  const t0 = clamp(t[0], t2, t5);
  const t1 = clamp(t[1], t2, t0);
  return [t0, t1, t2, t3, t4, t5];
}

function clampCoreCaseRowAtMostOne(state: AbUnionState, index: number): void {
  const previous = state.edgeDots[mod6(index - 1)];
  const current = state.edgeDots[mod6(index)];
  if (!previous || !current || current.left <= previous.right + 1e-9) return;
  current.left = previous.right;
  if (!current.split || current.right < current.left) {
    current.right = current.left;
  }
}

function clampCoreCaseSplitRows(state: AbUnionState, options: CoreCaseOptions): void {
  const strictPrevious = state.edgeDots[3];
  const strictCurrent = state.edgeDots[4];
  if (strictPrevious && strictCurrent && strictCurrent.left <= strictPrevious.right + STRICT_GAP) {
    strictCurrent.left = clamp01(strictPrevious.right + STRICT_GAP);
    if (!strictCurrent.split || strictCurrent.right < strictCurrent.left) {
      strictCurrent.right = strictCurrent.left;
    }
  }

  for (const index of [0, 1, 2]) {
    clampCoreCaseRowAtMostOne(state, index);
  }
  if (!effectiveForceSum3(options)) {
    clampCoreCaseRowAtMostOne(state, 3);
  }
  if (!effectiveForceSum5(options)) {
    clampCoreCaseRowAtMostOne(state, 5);
  }
}

export function enforceCoreCaseConstraints(
  state: AbUnionState,
  options: CoreCaseOptions = DEFAULT_CORE_CASE_OPTIONS,
): void {
  if (!hasSplitEdgeDots(state)) {
    writeTValues(state, clampCoreCaseTValues(readTValues(state), options));
  } else {
    clampCoreCaseSplitRows(state, options);
  }

  enforceCoreCaseCommonState(state, coreCaseFixedSums(options), [true, true, true, false, true, false]);
}

interface CoreCaseDotSnapshot {
  edgeDots: AbUnionState['edgeDots'];
  lastOptimized: AbUnionState['lastOptimized'];
  status: string;
}

function copyEdgeDots(edgeDots: AbUnionState['edgeDots']): AbUnionState['edgeDots'] {
  return edgeDots.map((edge) => ({ ...edge }));
}

function captureCoreCaseDotSnapshot(state: AbUnionState): CoreCaseDotSnapshot {
  return {
    edgeDots: copyEdgeDots(state.edgeDots),
    lastOptimized: state.lastOptimized,
    status: state.status,
  };
}

function restoreCoreCaseDotSnapshot(state: AbUnionState, snapshot: CoreCaseDotSnapshot): void {
  state.edgeDots = copyEdgeDots(snapshot.edgeDots);
  state.lastOptimized = snapshot.lastOptimized;
  state.status = snapshot.status;
}

function dotEdgeValue(state: AbUnionState, dot: AbUnionDotHandle): number {
  const edge = state.edgeDots[mod6(dot.edge)];
  if (!edge) return 0.5;
  return dot.role === 'right' ? edge.right : edge.left;
}

function hardLimitConstraintOk(sum: number, constraint: CoreCaseConstraint): boolean {
  if (constraint === '= 1') return Math.abs(sum - 1) <= 1e-7;
  if (constraint === '> 1') return sum >= 1 + STRICT_GAP - 1e-9;
  return sum <= 1 + 1e-9;
}

function coreCaseConstraintsSatisfied(state: AbUnionState, constraints: readonly CoreCaseConstraint[]): boolean {
  const aValues = abUnionAValues(state);
  const bValues = abUnionBValues(state);
  return constraints.every((constraint, index) =>
    hardLimitConstraintOk(aValues[index] + bValues[index], constraint),
  );
}

function tryCoreCaseDotValueFromSnapshot(
  state: AbUnionState,
  dot: AbUnionDotHandle,
  value: number,
  constraints: readonly CoreCaseConstraint[],
  snapshot: CoreCaseDotSnapshot,
): boolean {
  restoreCoreCaseDotSnapshot(state, snapshot);
  return setAbUnionDotValue(state, dot, value) && coreCaseConstraintsSatisfied(state, constraints);
}

function moveCoreCaseDotHardLimited(
  state: AbUnionState,
  dot: AbUnionDotHandle,
  value: number,
  constraints: readonly CoreCaseConstraint[],
): void {
  const snapshot = captureCoreCaseDotSnapshot(state);
  const start = dotEdgeValue(state, dot);
  const target = clamp01(value);

  if (tryCoreCaseDotValueFromSnapshot(state, dot, target, constraints, snapshot)) {
    return;
  }

  let valid = start;
  let invalid = target;
  for (let step = 0; step < BINARY_STEPS; step++) {
    const candidate = (valid + invalid) / 2;
    if (tryCoreCaseDotValueFromSnapshot(state, dot, candidate, constraints, snapshot)) {
      valid = candidate;
    } else {
      invalid = candidate;
    }
  }

  if (tryCoreCaseDotValueFromSnapshot(state, dot, valid, constraints, snapshot)) {
    state.status = 'Hard-limit drag: constraint boundary reached.';
  } else {
    restoreCoreCaseDotSnapshot(state, snapshot);
  }
}

export function moveCoreCaseDot(
  state: AbUnionState,
  dot: AbUnionDotHandle,
  value: number,
  options: CoreCaseOptions = DEFAULT_CORE_CASE_OPTIONS,
): void {
  if (options.hardLimitDrag) {
    moveCoreCaseDotHardLimited(state, dot, value, coreCaseConstraints(options));
  } else {
    setAbUnionDotValue(state, dot, value);
  }
}

export function createDefaultCoreCaseState(): AbUnionState {
  const state = createDefaultAbUnionState();
  writeTValues(state, [0.5, 0.42, 0.35, 0.35, 0.55, 0.55]);
  state.activeRegions = [true, true, true, false, true, false];
  enforceCoreCaseConstraints(state);
  state.status = 'Core Case constraints active.';
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

function coreCaseCircleGeometries(
  tValues: number[],
  aValues: number[],
  bValues: number[],
  relaxedPPoints: boolean,
): CircleGeometry[] {
  if (!relaxedPPoints) {
    return circleGeometries(tValues);
  }

  return [
    { id: 'C2', center: pointOnEdge(2, bValues[4]) },
    { id: 'C5', center: pointOnEdge(5, 1 - aValues[4]) },
  ];
}

function containsR4(
  point: Point,
  a4: number,
  b4: number,
  variant: AbUnionLocalRegionVariant,
): boolean {
  const local = localCoordinates(4, point);
  return containsAbUnionLocal(local.u, local.v, a4, b4, variant);
}

function containsRegion(
  point: Point,
  index: number,
  aValues: number[],
  bValues: number[],
  variant: AbUnionLocalRegionVariant,
): boolean {
  const local = localCoordinates(index, point);
  return containsAbUnionLocal(local.u, local.v, aValues[index], bValues[index], variant);
}

function isRedPoint(
  point: Point,
  aValues: number[],
  bValues: number[],
  variant: AbUnionLocalRegionVariant,
): boolean {
  return !Array.from({ length: 6 }, (_, index) => index)
    .some((index) => containsRegion(point, index, aValues, bValues, variant));
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

function boundaryIntersectionsWithCircle(
  circle: CircleGeometry,
  a4: number,
  b4: number,
  variant: AbUnionLocalRegionVariant,
): Point[] {
  const contains = (point: Point) => containsR4(point, a4, b4, variant);
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

function v4CirclePoint(
  circle: CircleGeometry,
  a4: number,
  b4: number,
  variant: AbUnionLocalRegionVariant,
): Point | null {
  return closestCurvePointToV4(boundaryIntersectionsWithCircle(circle, a4, b4, variant));
}

function t4RegionNonempty(a4: number, b4: number): boolean {
  return Number.isFinite(a4) &&
    Number.isFinite(b4) &&
    a4 >= -1e-9 &&
    b4 >= -1e-9 &&
    a4 * a4 + a4 * b4 + b4 * b4 <= 1 + 1e-9;
}

function p3FallbackPoint(a4: number, b4: number): Point | null {
  return t4RegionNonempty(a4, b4) ? pointOnEdge(3, 1 - a4) : null;
}

function p5FallbackPoint(a4: number, b4: number): Point | null {
  return t4RegionNonempty(a4, b4) ? pointOnEdge(4, b4) : null;
}

function diagonalRedWitness(
  index: number,
  aValues: number[],
  bValues: number[],
  variant: AbUnionLocalRegionVariant,
): Point | null {
  const pointAt = (t: number) => scale(t, HEXAGON_VERTICES[index]);
  const red = (point: Point) => isRedPoint(point, aValues, bValues, variant);
  if (!red(pointAt(0))) return null;
  return findBoundaryOnParam(pointAt, red) ?? pointAt(1);
}

function algorithm2QuarticValue(c: number, p: number): number {
  return c ** 4 - c ** 2 + p * c - p ** 2;
}

function algorithm2CStar(p: number, q: number): number {
  const sum = p + q;
  const m = Math.min(p, q);
  const M = Math.max(p, q);
  const transition = sum ** 4 - sum ** 2 + p * q;

  if (transition >= 0) {
    const denominator = 1 + Math.sqrt(Math.max(0, 4 * sum ** 2 - 3));
    return clamp01(2 * M / denominator);
  }

  let low = clamp(sum, 0, 1);
  let high = 1;
  for (let step = 0; step < BINARY_STEPS; step++) {
    const candidate = (low + high) / 2;
    if (algorithm2QuarticValue(candidate, m) <= 0) {
      low = candidate;
    } else {
      high = candidate;
    }
  }
  return clamp01((low + high) / 2);
}

function algorithm2Parameters(state: AbUnionState, aValues: number[], bValues: number[]): { p: number; q: number } {
  const e3 = state.edgeDots[3];
  const e4 = state.edgeDots[4];
  return {
    p: clamp01(1 - (e4?.split ? e4.right : bValues[4])),
    q: clamp01(e3?.split ? e3.left : 1 - aValues[4]),
  };
}

function algorithm2DiagonalPoint(index: number, p: number, q: number): Point {
  const radius = 1 - algorithm2CStar(p, q);
  return scale(radius, HEXAGON_VERTICES[index]);
}

function pointFromLocalCoordinates(index: number, u: number, v: number): Point {
  const vertex = HEXAGON_VERTICES[mod6(index)];
  const out = edgeVector(index);
  const inc = subtract(HEXAGON_VERTICES[mod6(index - 1)], vertex);
  return add(vertex, add(scale(u, out), scale(v, inc)));
}

function strictAbUnionLineJunction(outLen: number, inLen: number): Point | null {
  const sum = outLen + inLen;
  const rho = outLen * outLen + outLen * inLen + inLen * inLen;
  if (sum <= 1 || rho >= 1) return null;

  const h = Math.sqrt(3) / 2;
  const dSquared = 4 * rho - 3;
  if (dSquared < -1e-9) return null;

  const d = Math.sqrt(Math.max(0, dSquared));
  const denominator = 2 * rho;
  const alpha = h * (outLen + 2 * inLen - outLen * d) / denominator;
  const beta = h * (outLen - inLen + sum * d) / denominator;
  const gamma = h * (-outLen + inLen + sum * d) / denominator;
  const delta = h * (2 * outLen + inLen - inLen * d) / denominator;
  const omega = alpha * delta - gamma * beta;
  if (omega <= 1e-12) return null;

  const u = delta * (outLen * alpha - inLen * beta) / omega;
  const v = alpha * (inLen * delta - outLen * gamma) / omega;
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < -1e-9 || v < -1e-9) return null;
  return { x: Math.max(0, u), y: Math.max(0, v) };
}

function t4LineJunctionPoint(
  aValues: number[],
  bValues: number[],
  variant: AbUnionLocalRegionVariant,
): Point | null {
  const a4 = aValues[4];
  const b4 = bValues[4];
  const local = strictAbUnionLineJunction(b4, a4);
  if (local === null) return null;

  const point = pointFromLocalCoordinates(4, local.x, local.y);
  return containsR4(point, a4, b4, variant) ? point : null;
}

function constraintOk(sum: number, constraint: CoreCaseConstraint): boolean {
  if (constraint === '= 1') return Math.abs(sum - 1) <= 1e-7;
  if (constraint === '> 1') return sum > 1;
  return sum <= 1 + 1e-7;
}

function buildRows(
  aValues: number[],
  bValues: number[],
  constraints: readonly CoreCaseConstraint[],
): CoreCaseRegionRow[] {
  return Array.from({ length: 6 }, (_, index) => {
    const sum = aValues[index] + bValues[index];
    const constraint = constraints[index];
    const ok = constraintOk(sum, constraint);
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

function localSegmentToWorld(index: number, segment: AbUnionLocalLineSegment): { start: Point; end: Point } {
  return {
    start: pointFromLocalCoordinates(index, segment.start.x, segment.start.y),
    end: pointFromLocalCoordinates(index, segment.end.x, segment.end.y),
  };
}

function drawTwoLineSupersetSegments(
  ctx: CanvasRenderingContext2D,
  index: number,
  a: number,
  b: number,
): void {
  const localSegments = abUnionStrictTwoLineSupersetSegments(a, b);
  if (localSegments.length === 0) return;

  const segments = localSegments.map((segment) => localSegmentToWorld(index, segment));
  const endpoints = [segments[0].start, segments[0].end, segments[1].end];

  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = TWO_LINE_STROKE;
  ctx.lineWidth = 2.6;
  for (const segment of segments) {
    const start = mathToCanvas(segment.start);
    const end = mathToCanvas(segment.end);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (const endpoint of endpoints) {
    const point = mathToCanvas(endpoint);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4.2, 0, 2 * Math.PI);
    ctx.fillStyle = TWO_LINE_FILL;
    ctx.fill();
    ctx.strokeStyle = TWO_LINE_STROKE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTwoLineSupersetOverlay(
  ctx: CanvasRenderingContext2D,
  aValues: readonly number[],
  bValues: readonly number[],
  variant: AbUnionLocalRegionVariant,
): void {
  if (variant !== 'strict-two-line-superset') return;
  for (let index = 0; index < 6; index++) {
    drawTwoLineSupersetSegments(ctx, index, aValues[index], bValues[index]);
  }
}

function supportPointIds(points: CoreCasePoint[], triangle: CoverTriangle | null): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!triangle) return ids;
  const enabledPoints = points.filter((item): item is CoreCasePoint & { point: Point } =>
    item.enabled && item.point !== null,
  );
  if (enabledPoints.length === 0) return ids;

  for (let sideIndex = 0; sideIndex < triangle.normals.length; sideIndex++) {
    const normal = triangle.normals[sideIndex];
    const lambda = triangle.lambdas[sideIndex];
    const projections = enabledPoints.map((item) => ({
      item,
      value: dot(normal, item.point),
    }));
    const maxProjection = Math.max(...projections.map((projection) => projection.value));
    if (Math.abs(lambda - maxProjection) > TRIANGLE_SUPPORT_TOL) {
      continue;
    }
    for (const projection of projections) {
      if (Math.abs(projection.value - maxProjection) <= TRIANGLE_SUPPORT_TOL) {
        ids.add(projection.item.id);
      }
    }
  }

  return ids;
}

function drawCoreCasePoints(
  ctx: CanvasRenderingContext2D,
  points: CoreCasePoint[],
  supportIds: ReadonlySet<string>,
): void {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const item of points) {
    if (!item.enabled || !item.point) continue;
    const isSupport = supportIds.has(item.id);
    const point = mathToCanvas(item.point);
    ctx.beginPath();
    ctx.arc(point.x, point.y, isSupport ? 6.4 : 5.8, 0, 2 * Math.PI);
    ctx.fillStyle = isSupport ? '#dbeafe' : '#fef3c7';
    ctx.fill();
    ctx.strokeStyle = isSupport ? '#2563eb' : '#92400e';
    ctx.lineWidth = isSupport ? 2.7 : 2;
    ctx.stroke();
    ctx.fillStyle = isSupport ? '#1d4ed8' : '#78350f';
    ctx.fillText(item.id, point.x + 7, point.y - 7);
  }
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, circles: CircleGeometry[], points: CoreCasePoint[], triangle: CoverTriangle | null): void {
  for (const circle of circles) {
    drawCircleOverlay(ctx, circle);
  }
  if (triangle) {
    drawPolygon(ctx, triangle.vertices, '#eab308', 'rgba(250, 204, 21, 0.12)');
  }
  drawCoreCasePoints(ctx, points, supportPointIds(points, triangle));
}

function inLocalHexFootprint(u: number, v: number): boolean {
  return u >= -EDGE_AXIS_EPS &&
    u <= 2 + EDGE_AXIS_EPS &&
    v >= -EDGE_AXIS_EPS &&
    v <= 2 + EDGE_AXIS_EPS &&
    Math.abs(u - v) <= 1 + EDGE_AXIS_EPS;
}

function drawCoreGraphT4Region(
  ctx: CanvasRenderingContext2D,
  a4: number,
  b4: number,
  variant: AbUnionLocalRegionVariant,
): void {
  const step = Math.max(1, Math.round(config.canvasSize / 300));
  ctx.save();
  ctx.fillStyle = 'rgba(132, 204, 22, 0.22)';
  for (let y = 0; y < config.canvasSize; y += step) {
    for (let x = 0; x < config.canvasSize; x += step) {
      const point = canvasToMath({ x: x + step / 2, y: y + step / 2 });
      const local = localCoordinates(4, point);
      if (inLocalHexFootprint(local.u, local.v) && containsAbUnionLocal(local.u, local.v, a4, b4, variant)) {
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}

function drawCoreGraphEdgeMarker(
  ctx: CanvasRenderingContext2D,
  edgeIndex: number,
  value: number,
  label: string,
  color: string,
): void {
  const point = pointOnEdge(edgeIndex, value);
  const canvasPoint = mathToCanvas(point);
  ctx.save();
  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, 7.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvasPoint.x + 8, canvasPoint.y - 8);
  ctx.restore();
}

function drawCoreGraphEdgeMarkers(ctx: CanvasRenderingContext2D, a4: number, b4: number): void {
  drawCoreGraphEdgeMarker(ctx, 3, 1 - a4, 'a4', '#d97706');
  drawCoreGraphEdgeMarker(ctx, 4, b4, 'b4', '#2563eb');
}

export function drawCoreCaseGraphSample(ctx: CanvasRenderingContext2D, sample: CoreCaseGraphSample): void {
  if (!sample.domainOk) return;
  drawCoreGraphT4Region(ctx, sample.a, sample.b, sample.localRegionVariant);
  if (sample.localRegionVariant === 'strict-two-line-superset') {
    drawTwoLineSupersetSegments(ctx, 4, sample.a, sample.b);
  }
  drawOverlay(ctx, sample.circles, sample.points, sample.triangle);
  drawCoreGraphEdgeMarkers(ctx, sample.a, sample.b);
}

const CORE_CASE_POINT_DEFINITIONS: readonly CoreCasePointDefinition[] = [
  {
    id: 'P3',
    label: 'R4/C2',
    build: ({ circles, aValues, bValues, localRegionVariant }) =>
      v4CirclePoint(circles[0], aValues[4], bValues[4], localRegionVariant) ??
      p3FallbackPoint(aValues[4], bValues[4]),
  },
  {
    id: 'P4',
    label: 'T4 line-line junction',
    build: ({ aValues, bValues, localRegionVariant }) => t4LineJunctionPoint(aValues, bValues, localRegionVariant),
  },
  {
    id: 'P5',
    label: 'R4/C5',
    build: ({ circles, aValues, bValues, localRegionVariant }) =>
      v4CirclePoint(circles[1], aValues[4], bValues[4], localRegionVariant) ??
      p5FallbackPoint(aValues[4], bValues[4]),
  },
  {
    id: 'D0',
    label: 'red on O-V0',
    build: ({ aValues, bValues, localRegionVariant, algorithm2Diagonals, algorithm2P, algorithm2Q }) => algorithm2Diagonals
      ? algorithm2DiagonalPoint(0, algorithm2P, algorithm2Q)
      : diagonalRedWitness(0, aValues, bValues, localRegionVariant),
  },
  {
    id: 'D1',
    label: 'red on O-V1',
    build: ({ aValues, bValues, localRegionVariant, algorithm2Diagonals, algorithm2P, algorithm2Q }) => algorithm2Diagonals
      ? algorithm2DiagonalPoint(1, algorithm2P, algorithm2Q)
      : diagonalRedWitness(1, aValues, bValues, localRegionVariant),
  },
  {
    id: 'D2',
    label: 'red on O-V2',
    build: ({ aValues, bValues, localRegionVariant, algorithm2Diagonals, algorithm2P, algorithm2Q }) => algorithm2Diagonals
      ? algorithm2DiagonalPoint(2, algorithm2P, algorithm2Q)
      : diagonalRedWitness(2, aValues, bValues, localRegionVariant),
  },
];

export const CORE_CASE_POINT_IDS = CORE_CASE_POINT_DEFINITIONS.map((definition) => definition.id);

export function isCoreCasePointId(value: string): boolean {
  return CORE_CASE_POINT_IDS.includes(value) || /^I[0-5]$/.test(value);
}

function coreCaseGraphDisabledPointSet(enabledPointIds: readonly string[] | undefined): ReadonlySet<string> | null {
  if (!enabledPointIds) return null;
  const enabled = new Set(enabledPointIds);
  return new Set(CORE_CASE_POINT_IDS.filter((id) => !enabled.has(id)));
}

function coreCaseGraphDomainIssue(a: number, b: number): string | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return 'a,b must be finite';
  }
  if (a < 0 || a > 1 || b < 0 || b > 1) {
    return 'outside 0<=a,b<=1';
  }
  if (a + b <= 1) {
    return 'outside a+b>1';
  }
  if (a * a + a * b + b * b > 1 + 1e-12) {
    return 'outside a^2+ab+b^2<=1';
  }
  return null;
}

export function evaluateCoreCaseGraph(
  a: number,
  b: number,
  enabledPointIds?: readonly string[],
  variant: AbUnionLocalRegionVariant = 'exact',
  relaxedPPoints = false,
): CoreCaseGraphSample {
  const domainIssue = coreCaseGraphDomainIssue(a, b);
  if (domainIssue) {
    return {
      a,
      b,
      domainOk: false,
      domainStatus: domainIssue,
      circles: [],
      points: [],
      enabledPointCount: 0,
      triangle: null,
      side: null,
      strictGap: a + b - 1,
      localRegionVariant: variant,
      status: domainIssue,
    };
  }

  const aValues = [0, 0, 0, 0, a, 0];
  const bValues = [0, 0, 0, 0, b, 0];
  const tValues = [0, 0, 1 - a, 0, 0, b];
  const circles = coreCaseCircleGeometries(tValues, aValues, bValues, relaxedPPoints);
  const points = buildCoreCasePoints(
    {
      circles,
      aValues,
      bValues,
      localRegionVariant: variant,
      algorithm2Diagonals: true,
      algorithm2P: 1 - b,
      algorithm2Q: 1 - a,
      relaxedPPoints,
    },
    coreCaseGraphDisabledPointSet(enabledPointIds),
  );
  const enabledPoints = points.filter((item) => item.enabled);
  const concretePoints = enabledPoints.flatMap((item) => item.point ? [item.point] : []);
  const triangle = enabledPoints.length > 0 && concretePoints.length === enabledPoints.length
    ? fitTriangle('Core f(a,b)', concretePoints, '#eab308')
    : null;
  const missing = enabledPoints.filter((item) => item.point === null).map((item) => item.id);
  const status = enabledPoints.length === 0
    ? 'no points selected'
    : missing.length === 0 ? 'ready' : `missing ${missing.join(', ')}`;

  return {
    a,
    b,
    domainOk: true,
    domainStatus: 'inside domain',
    circles,
    points,
    enabledPointCount: enabledPoints.length,
    triangle,
    side: triangle?.side ?? null,
    strictGap: a + b - 1,
    localRegionVariant: variant,
    status,
  };
}

function disabledPointSet(disabledPointIds: CoreCaseRenderOptions['disabledPointIds']): ReadonlySet<string> | null {
  if (!disabledPointIds) return null;
  return typeof (disabledPointIds as ReadonlySet<string>).has === 'function'
    ? disabledPointIds as ReadonlySet<string>
    : new Set(disabledPointIds as readonly string[]);
}

function buildCoreCasePoints(
  context: CoreCasePointContext,
  disabledIds: ReadonlySet<string> | null,
): CoreCasePoint[] {
  return CORE_CASE_POINT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: context.algorithm2Diagonals && definition.id.startsWith('D')
      ? `algorithm 2 on O-V${definition.id.slice(1)}`
      : context.relaxedPPoints && definition.id === 'P3'
        ? 'R4/virtual C2'
        : context.relaxedPPoints && definition.id === 'P5'
          ? 'R4/virtual C5'
          : definition.label,
    point: definition.build(context),
    enabled: disabledIds === null || !disabledIds.has(definition.id),
  }));
}

function intervalPointFraction(fractions: readonly number[] | undefined, index: number): number {
  const value = fractions?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : 0.5;
}

function buildCoreCaseIntervalPoints(
  state: AbUnionState,
  fractions: readonly number[] | undefined,
  disabledIds: ReadonlySet<string> | null,
): CoreCasePoint[] {
  return state.edgeDots.flatMap((edge, index) => {
    if (!edge.split) return [];

    const id = `I${index}`;
    const fraction = intervalPointFraction(fractions, index);
    return [{
      id,
      label: `e${index} interval point`,
      point: pointOnEdge(index, edge.left + fraction * (edge.right - edge.left)),
      enabled: disabledIds === null || !disabledIds.has(id),
    }];
  });
}

export function renderCoreCase(
  ctx: CanvasRenderingContext2D,
  state: AbUnionState,
  triangleState: TriangleState,
  localCs: number[],
  options: CoreCaseOptions = DEFAULT_CORE_CASE_OPTIONS,
  renderOptions: CoreCaseRenderOptions = {},
): CoreCaseRenderResult {
  enforceCoreCaseConstraints(state, options);
  const variant = localRegionVariant(options);
  const base = renderAbUnion(ctx, state, triangleState, localCs, {
    computeTheta: false,
    localRegionVariant: variant,
  });
  enforceCoreCaseConstraints(state, options);

  const aValues = abUnionAValues(state);
  const bValues = abUnionBValues(state);
  const tValues = readTValues(state);
  const circles = coreCaseCircleGeometries(tValues, aValues, bValues, options.relaxedPPoints);
  const disabledIds = disabledPointSet(renderOptions.disabledPointIds);
  const algorithm2 = algorithm2Parameters(state, aValues, bValues);
  const points = [
    ...buildCoreCasePoints(
      {
        circles,
        aValues,
        bValues,
        localRegionVariant: variant,
        algorithm2Diagonals: options.algorithm2Diagonals,
        algorithm2P: algorithm2.p,
        algorithm2Q: algorithm2.q,
        relaxedPPoints: options.relaxedPPoints,
      },
      disabledIds,
    ),
    ...buildCoreCaseIntervalPoints(state, renderOptions.intervalPointFractions, disabledIds),
  ];
  const enabledPoints = points.filter((item) => item.enabled);
  const concretePoints = enabledPoints.flatMap((item) => item.point ? [item.point] : []);
  const triangle = enabledPoints.length > 0 && concretePoints.length === enabledPoints.length
    ? fitTriangle('Core Case', concretePoints, '#eab308')
    : null;
  drawTwoLineSupersetOverlay(ctx, aValues, bValues, variant);
  drawOverlay(ctx, circles, points, triangle);

  const missing = enabledPoints.filter((item) => item.point === null).map((item) => item.id);
  const status = enabledPoints.length === 0
    ? 'no points selected'
    : missing.length === 0
      ? 'ready'
      : `missing ${missing.join(', ')}`;

  return {
    base,
    aValues,
    bValues,
    tValues,
    rows: buildRows(aValues, bValues, coreCaseConstraints(options)),
    points,
    enabledPointCount: enabledPoints.length,
    triangle,
    strictGap: aValues[4] + bValues[4] - 1,
    localRegionVariant: variant,
    status,
  };
}
