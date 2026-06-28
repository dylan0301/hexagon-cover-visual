import type { Point, TriangleState } from './types';
import { mathToCanvas, scaleToCanvas } from './coords';
import { fitTriangle, type CoverTriangle } from './cover';
import { HEXAGON_VERTICES } from './hexagon';
import {
  abUnionAValues,
  abUnionBValues,
  containsAbUnionLocal,
  createDefaultAbUnionState,
  renderAbUnion,
  setAbUnionDotValue,
  type AbUnionDotHandle,
  type AbUnionRenderResult,
  type AbUnionState,
} from './abUnion';

const STRICT_GAP = 1e-6;
const EDGE_AXIS_EPS = 1e-5;
const BOUNDARY_STEPS = 240;
const BINARY_STEPS = 42;
const DEFAULT_CORE_CASE_OPTIONS = {
  forceSum3: true,
  forceSum5: true,
  hardLimitDrag: false,
  algorithm2Diagonals: false,
} as const;

interface CircleGeometry {
  id: 'C2' | 'C5';
  center: Point;
}

type CoreCaseConstraint = '<= 1' | '= 1' | '> 1';

interface CoreCasePointContext {
  circles: CircleGeometry[];
  aValues: number[];
  bValues: number[];
  algorithm2Diagonals: boolean;
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
  enabledPointIds?: ReadonlySet<string> | readonly string[];
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
  return ['<= 1', '<= 1', '<= 1', options.forceSum3 ? '= 1' : '<= 1', '> 1', options.forceSum5 ? '= 1' : '<= 1'];
}

function coreCaseFixedSums(options: CoreCaseOptions): Array<number | null> {
  return [null, null, null, options.forceSum3 ? 1 : null, null, options.forceSum5 ? 1 : null];
}

function clampCoreCaseTValues(t: number[], options: CoreCaseOptions): number[] {
  let t2 = clamp01(options.forceSum3 ? (t[2] + t[3]) / 2 : t[2]);
  let t3 = clamp01(options.forceSum3 ? t2 : t[3]);
  let t4 = clamp01(options.forceSum5 ? (t[4] + t[5]) / 2 : t[4]);
  let t5 = clamp01(options.forceSum5 ? t4 : t[5]);

  t4 = Math.max(t4, STRICT_GAP);
  t5 = options.forceSum5 ? t4 : clamp(t5, 0, t4);

  if (options.forceSum3) {
    t2 = clamp(t2, 0, Math.max(0, Math.min(t5, t4 - STRICT_GAP)));
    t3 = t2;
  } else {
    t2 = clamp(t2, 0, t5);
    t3 = clamp(t3, 0, Math.max(0, Math.min(t2, t4 - STRICT_GAP)));
  }

  t5 = options.forceSum5 ? t4 : clamp(t5, t2, t4);
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
  if (!options.forceSum3) {
    clampCoreCaseRowAtMostOne(state, 3);
  }
  if (!options.forceSum5) {
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

function containsR4(point: Point, a4: number, b4: number): boolean {
  const local = localCoordinates(4, point);
  return containsAbUnionLocal(local.u, local.v, a4, b4);
}

function containsRegion(point: Point, index: number, aValues: number[], bValues: number[]): boolean {
  const local = localCoordinates(index, point);
  return containsAbUnionLocal(local.u, local.v, aValues[index], bValues[index]);
}

function isRedPoint(point: Point, aValues: number[], bValues: number[]): boolean {
  return !Array.from({ length: 6 }, (_, index) => index)
    .some((index) => containsRegion(point, index, aValues, bValues));
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

function v4CirclePoint(circle: CircleGeometry, a4: number, b4: number): Point | null {
  return closestCurvePointToV4(boundaryIntersectionsWithCircle(circle, a4, b4));
}

function diagonalRedWitness(index: number, aValues: number[], bValues: number[]): Point | null {
  const pointAt = (t: number) => scale(t, HEXAGON_VERTICES[index]);
  const red = (point: Point) => isRedPoint(point, aValues, bValues);
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

function algorithm2DiagonalPoint(index: number, aValues: number[], bValues: number[]): Point {
  const p = 1 - bValues[4];
  const q = 1 - aValues[4];
  const radius = 1 - algorithm2CStar(p, q);
  return scale(radius, HEXAGON_VERTICES[index]);
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

function drawCoreCasePoints(ctx: CanvasRenderingContext2D, points: CoreCasePoint[]): void {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const item of points) {
    if (!item.enabled || !item.point) continue;
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

function drawOverlay(ctx: CanvasRenderingContext2D, circles: CircleGeometry[], points: CoreCasePoint[], triangle: CoverTriangle | null): void {
  for (const circle of circles) {
    drawCircleOverlay(ctx, circle);
  }
  if (triangle) {
    drawPolygon(ctx, triangle.vertices, '#eab308', 'rgba(250, 204, 21, 0.12)');
  }
  drawCoreCasePoints(ctx, points);
}

const CORE_CASE_POINT_DEFINITIONS: readonly CoreCasePointDefinition[] = [
  {
    id: 'P3',
    label: 'R4/C2',
    build: ({ circles, aValues, bValues }) => v4CirclePoint(circles[0], aValues[4], bValues[4]),
  },
  {
    id: 'P5',
    label: 'R4/C5',
    build: ({ circles, aValues, bValues }) => v4CirclePoint(circles[1], aValues[4], bValues[4]),
  },
  {
    id: 'D0',
    label: 'red on O-V0',
    build: ({ aValues, bValues, algorithm2Diagonals }) => algorithm2Diagonals
      ? algorithm2DiagonalPoint(0, aValues, bValues)
      : diagonalRedWitness(0, aValues, bValues),
  },
  {
    id: 'D1',
    label: 'red on O-V1',
    build: ({ aValues, bValues, algorithm2Diagonals }) => algorithm2Diagonals
      ? algorithm2DiagonalPoint(1, aValues, bValues)
      : diagonalRedWitness(1, aValues, bValues),
  },
  {
    id: 'D2',
    label: 'red on O-V2',
    build: ({ aValues, bValues, algorithm2Diagonals }) => algorithm2Diagonals
      ? algorithm2DiagonalPoint(2, aValues, bValues)
      : diagonalRedWitness(2, aValues, bValues),
  },
];

export const CORE_CASE_POINT_IDS = CORE_CASE_POINT_DEFINITIONS.map((definition) => definition.id);

export function isCoreCasePointId(value: string): boolean {
  return CORE_CASE_POINT_IDS.includes(value);
}

function enabledPointSet(enabledPointIds: CoreCaseRenderOptions['enabledPointIds']): ReadonlySet<string> | null {
  if (!enabledPointIds) return null;
  return typeof (enabledPointIds as ReadonlySet<string>).has === 'function'
    ? enabledPointIds as ReadonlySet<string>
    : new Set(enabledPointIds as readonly string[]);
}

function buildCoreCasePoints(
  context: CoreCasePointContext,
  enabledIds: ReadonlySet<string> | null,
): CoreCasePoint[] {
  return CORE_CASE_POINT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: context.algorithm2Diagonals && definition.id.startsWith('D')
      ? `algorithm 2 on O-V${definition.id.slice(1)}`
      : definition.label,
    point: definition.build(context),
    enabled: enabledIds === null || enabledIds.has(definition.id),
  }));
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
  const base = renderAbUnion(ctx, state, triangleState, localCs, { computeTheta: false });
  enforceCoreCaseConstraints(state, options);

  const aValues = abUnionAValues(state);
  const bValues = abUnionBValues(state);
  const tValues = readTValues(state);
  const circles = circleGeometries(tValues);
  const points = buildCoreCasePoints(
    { circles, aValues, bValues, algorithm2Diagonals: options.algorithm2Diagonals },
    enabledPointSet(renderOptions.enabledPointIds),
  );
  const enabledPoints = points.filter((item) => item.enabled);
  const concretePoints = enabledPoints.flatMap((item) => item.point ? [item.point] : []);
  const triangle = enabledPoints.length > 0 && concretePoints.length === enabledPoints.length
    ? fitTriangle('Core Case', concretePoints, '#eab308')
    : null;
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
    status,
  };
}
