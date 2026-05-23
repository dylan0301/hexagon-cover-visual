import type { Point } from './types';
import { HEXAGON_VERTICES } from './hexagon';
import { fitTriangle, type CoverTriangle } from './cover';
import { buildSymmetricPointTargets } from './symmetricPoints';
import {
  type FreeConstraintStatus,
  type FreeLabel,
  type FreeNamedPointRef,
  type FreeSegment,
  type FreeSegmentRef,
  type FreeState,
  type FreeTargetTPoint,
  type FreeTarget,
  type FreeTriangleId,
  type FreeTriangleState,
  type FreeVd0Coordinate,
  type FreeVd0Mode,
  type FreeValidationResult,
  type FreeValidationSegment,
} from './freeTypes';

const SQRT3 = Math.sqrt(3);
const CIRCUMRADIUS = 1 / SQRT3;
const INRADIUS = 1 / (2 * SQRT3);
const CONSTRAINT_ITERS = 8;
const VD0_SAMPLES = 512;
const VD0_SEARCH_STEPS = 48;
const EPS = 1e-9;
const VD0_FIT_SIDE_TOLERANCE = 1e-8;
const LOTUS_RADIUS = 1;
export const DEFAULT_TARGET_T = 0.3;

const FREE_COLORS: Record<FreeTriangleId, string> = {
  C: '#0ea5e9',
  V0: '#ef4444',
  V1: '#f59e0b',
  V2: '#10b981',
  V3: '#8b5cf6',
  V4: '#ec4899',
  V5: '#14b8a6',
};

export function midpoint(index: number): Point {
  const vertex = HEXAGON_VERTICES[index];
  return { x: vertex.x / 2, y: vertex.y / 2 };
}

export function createDefaultTargetTPoints(): FreeTargetTPoint[] {
  return [{ id: 't1', t: DEFAULT_TARGET_T, fixed: false }];
}

export function targetTPoint(target: Pick<FreeTargetTPoint, 't'>, index: number): Point {
  const vertex = HEXAGON_VERTICES[index];
  const radius = 1 - clamp01(target.t);
  return { x: vertex.x * radius, y: vertex.y * radius };
}

export function getTargetTPoint(state: FreeState, targetTId: string | undefined, index: number): Point | null {
  const target = state.targetTPoints.find((candidate) => candidate.id === targetTId) ?? state.targetTPoints[0];
  return target ? targetTPoint(target, index) : null;
}

export function targetTLabel(index: number, targetTId: string | undefined): string {
  return `P${index}(${targetTId ?? 't1'})`;
}

export function benzenePoint(index: number): Point {
  const current = HEXAGON_VERTICES[index];
  const next = HEXAGON_VERTICES[(index + 1) % 6];
  return {
    x: (current.x + next.x) / 3,
    y: (current.y + next.y) / 3,
  };
}

export function triangleVertices(center: Point, angle: number): [Point, Point, Point] {
  return [0, 1, 2].map((k) => {
    const a = angle + Math.PI / 2 + k * (2 * Math.PI / 3);
    return {
      x: center.x + CIRCUMRADIUS * Math.cos(a),
      y: center.y + CIRCUMRADIUS * Math.sin(a),
    };
  }) as [Point, Point, Point];
}

export function createDefaultFreeState(): FreeState {
  const triangles: FreeTriangleState[] = [
    { id: 'C', center: { x: 0, y: 0 }, angle: 0, fixed: false, hidden: false, midpointConstraints: Array(6).fill(false), edgePointConstraint: null, vd0: { enabled: false, mode: 'max-c', rawSources: {} } },
    ...HEXAGON_VERTICES.map((vertex, index) => ({
      id: `V${index}` as FreeTriangleId,
      center: { x: vertex.x * 0.78, y: vertex.y * 0.78 },
      angle: index * Math.PI / 3,
      fixed: false,
      hidden: false,
      midpointConstraints: Array(6).fill(false),
      edgePointConstraint: null,
      vd0: { enabled: false, mode: 'max-c' as FreeVd0Mode, rawSources: {} },
    })),
  ];

  return {
    target: 'S_HALF',
    targetTPoints: createDefaultTargetTPoints(),
    tool: 'move',
    strictEps: 1e-5,
    selectedTriangleId: 'C',
    triangles,
    labels: [],
    selectedSegments: [],
    pointSeeds: [],
    selectedPointSeedId: null,
    status: 'Free mode ready.',
    sampling: { v: [], c: [], rejected: [] },
  };
}

function isFixedSegmentRef(ref: FreeSegmentRef): boolean {
  return ref.kind === 'hex-edge' || ref.kind === 'half-diagonal';
}

function shouldKeepStaticSegmentRef(ref: FreeSegmentRef): boolean {
  return isFixedSegmentRef(ref) || ref.kind === 'lotus-arc';
}

export function colorForTriangle(id: FreeTriangleId): string {
  return FREE_COLORS[id];
}

export function getTriangle(state: FreeState, id: FreeTriangleId): FreeTriangleState {
  const triangle = state.triangles.find((candidate) => candidate.id === id);
  if (!triangle) {
    throw new Error(`Unknown free triangle ${id}`);
  }
  return triangle;
}

export function allowedMidpointIndices(id: FreeTriangleId): number[] {
  if (id === 'C') {
    return [0, 1, 2, 3, 4, 5];
  }
  const index = Number(id.slice(1));
  return [(index + 5) % 6, index, (index + 1) % 6];
}

export function freeTriangleToCoverTriangle(triangle: FreeTriangleState): CoverTriangle {
  const vertices = triangleVertices(triangle.center, triangle.angle);
  const normals = [0, 1, 2].map((k) => {
    const a = vertices[k];
    const b = vertices[(k + 1) % 3];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dy / length, y: -dx / length };
  });
  const lambdas = normals.map((normal, index) => {
    const vertex = vertices[index];
    return normal.x * vertex.x + normal.y * vertex.y;
  });

  return {
    name: triangle.id,
    color: colorForTriangle(triangle.id),
    center: triangle.center,
    phi: triangle.angle + Math.PI / 2,
    side: 1,
    vertices,
    normals,
    lambdas,
  };
}

export function strictPointInTriangle(point: Point, triangle: FreeTriangleState, strictEps: number): boolean {
  const vertices = triangleVertices(triangle.center, triangle.angle);
  for (let i = 0; i < 3; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross < strictEps - EPS) {
      return false;
    }
  }
  return true;
}

export function namedPointLabel(ref: FreeNamedPointRef): string {
  if (ref.kind === 'O') return 'O';
  if (ref.kind === 'M') return `M${ref.index ?? 0}`;
  if (ref.kind === 'P') return targetTLabel(ref.index ?? 0, ref.targetTId);
  if (ref.kind === 'B') return `B${ref.index ?? 0}`;
  if (ref.kind === 'V') return `V${ref.index ?? 0}`;
  if (ref.kind === 'label') return ref.labelId ?? 'label';
  return 'manual';
}

export function resolveNamedPoint(state: FreeState, ref: FreeNamedPointRef): Point | null {
  if (ref.kind === 'O') return { x: 0, y: 0 };
  if (ref.kind === 'M') return midpoint(ref.index ?? 0);
  if (ref.kind === 'P') return getTargetTPoint(state, ref.targetTId, ref.index ?? 0);
  if (ref.kind === 'B') return benzenePoint(ref.index ?? 0);
  if (ref.kind === 'V') return HEXAGON_VERTICES[ref.index ?? 0] ?? null;
  if (ref.kind === 'manual') return ref.manualPoint ?? null;
  const label = state.labels.find((candidate) => candidate.id === ref.labelId);
  return label?.point ?? null;
}

export function getRequiredPoints(state: FreeState, triangle: FreeTriangleState): Array<{ point: Point; label: string }> {
  const points: Array<{ point: Point; label: string }> = [];
  if (triangle.id === 'C') {
    points.push({ point: { x: 0, y: 0 }, label: 'O' });
  } else {
    const index = Number(triangle.id.slice(1));
    points.push({ point: HEXAGON_VERTICES[index], label: triangle.id });
  }

  triangle.midpointConstraints.forEach((enabled, index) => {
    if (enabled) {
      points.push({ point: midpoint(index), label: `M${index}` });
    }
  });

  const target = triangle.edgePointConstraint
    ? resolveNamedPoint(state, triangle.edgePointConstraint.point)
    : null;
  if (target) {
    points.push({ point: target, label: namedPointLabel(triangle.edgePointConstraint!.point) });
  }

  return points;
}

function edgeInwardNormal(angle: number, edgeIndex: number): Point {
  const vertices = triangleVertices({ x: 0, y: 0 }, angle);
  const a = vertices[edgeIndex];
  const b = vertices[(edgeIndex + 1) % 3];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function edgeInwardNormalBaseAngle(edgeIndex: number): number {
  const normal = edgeInwardNormal(0, edgeIndex);
  return Math.atan2(normal.y, normal.x);
}

function closestAngle(current: number, candidates: number[]): number {
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const shifted = current + Math.atan2(Math.sin(candidate - current), Math.cos(candidate - current));
    const distance = Math.abs(shifted - current);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = shifted;
    }
  }
  return best;
}

export function projectTriangleToConstraints(state: FreeState, triangle: FreeTriangleState): void {
  const edgeConstraint = triangle.edgePointConstraint;
  const target = edgeConstraint ? resolveNamedPoint(state, edgeConstraint.point) : null;
  if (edgeConstraint && target) {
    const q = { x: target.x - triangle.center.x, y: target.y - triangle.center.y };
    const length = Math.hypot(q.x, q.y);
    if (length >= INRADIUS + EPS) {
      const alpha = Math.atan2(q.y, q.x);
      const delta = Math.acos(Math.max(-1, Math.min(1, -INRADIUS / length)));
      const base = edgeInwardNormalBaseAngle(edgeConstraint.edgeIndex);
      triangle.angle = closestAngle(triangle.angle, [alpha + delta - base, alpha - delta - base]);
    }
  }

  for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
    let changed = false;
    const required = getRequiredPoints(state, triangle);
    const relVertices = triangleVertices({ x: 0, y: 0 }, triangle.angle);
    for (const { point } of required) {
      for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
        const a = relVertices[edgeIndex];
        const b = relVertices[(edgeIndex + 1) % 3];
        const edge = { x: b.x - a.x, y: b.y - a.y };
        const normal = { x: -edge.y, y: edge.x };
        const limit = edge.x * (point.y - a.y) - edge.y * (point.x - a.x) - state.strictEps;
        const current = normal.x * triangle.center.x + normal.y * triangle.center.y;
        if (current <= limit + EPS) {
          continue;
        }
        const len2 = normal.x * normal.x + normal.y * normal.y;
        const amount = (current - limit) / len2;
        triangle.center = {
          x: triangle.center.x - amount * normal.x,
          y: triangle.center.y - amount * normal.y,
        };
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function strictIntervalOnSegment(start: Point, end: Point, triangle: FreeTriangleState, strictEps: number): [number, number] | null {
  let tMin = 0;
  let tMax = 1;
  const vertices = triangleVertices(triangle.center, triangle.angle);
  const direction = { x: end.x - start.x, y: end.y - start.y };

  for (let i = 0; i < 3; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const base = edge.x * (start.y - a.y) - edge.y * (start.x - a.x);
    const delta = edge.x * direction.y - edge.y * direction.x;
    const required = Math.max(0, strictEps);

    if (Math.abs(delta) < EPS) {
      if (base < required - EPS) {
        return null;
      }
      continue;
    }

    const root = (required - base) / delta;
    if (delta > 0) {
      tMin = Math.max(tMin, root);
    } else {
      tMax = Math.min(tMax, root);
    }
    if (tMin > tMax + EPS) {
      return null;
    }
  }

  if (tMax < tMin + EPS) {
    return null;
  }
  return [Math.max(0, tMin), Math.min(1, tMax)];
}

function normalizeIncreasingRange(startAngle: number, sweep: number): { min: number; max: number } {
  return sweep >= 0
    ? { min: startAngle, max: startAngle + sweep }
    : { min: startAngle + sweep, max: startAngle };
}

function intersectIntervalLists(a: Array<[number, number]>, b: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const first of a) {
    for (const second of b) {
      const start = Math.max(first[0], second[0]);
      const end = Math.min(first[1], second[1]);
      if (end >= start + EPS) {
        out.push([start, end]);
      }
    }
  }
  return mergeIntervals(out);
}

function angleInequalityIntervals(
  cosCoeff: number,
  sinCoeff: number,
  constant: number,
  minAngle: number,
  maxAngle: number,
): Array<[number, number]> {
  const amplitude = Math.hypot(cosCoeff, sinCoeff);
  if (amplitude < EPS) {
    return constant >= -EPS ? [[minAngle, maxAngle]] : [];
  }

  const threshold = -constant / amplitude;
  if (threshold <= -1 + EPS) return [[minAngle, maxAngle]];
  if (threshold > 1 - EPS) return [];

  const center = Math.atan2(sinCoeff, cosCoeff);
  const radius = Math.acos(Math.max(-1, Math.min(1, threshold)));
  const intervals: Array<[number, number]> = [];
  const firstK = Math.floor((minAngle - center - radius) / (2 * Math.PI)) - 1;
  const lastK = Math.ceil((maxAngle - center + radius) / (2 * Math.PI)) + 1;
  for (let k = firstK; k <= lastK; k++) {
    const offset = center + k * 2 * Math.PI;
    const start = Math.max(minAngle, offset - radius);
    const end = Math.min(maxAngle, offset + radius);
    if (end >= start + EPS) {
      intervals.push([start, end]);
    }
  }
  return mergeIntervals(intervals);
}

function strictIntervalOnArc(
  arc: NonNullable<FreeSegment['arc']>,
  triangle: FreeTriangleState,
  strictEps: number,
): [number, number][] {
  const vertices = triangleVertices(triangle.center, triangle.angle);
  const angleRange = normalizeIncreasingRange(arc.startAngle, arc.sweep);
  let allowed: Array<[number, number]> = [[angleRange.min, angleRange.max]];

  for (let i = 0; i < 3; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const base = edge.x * (arc.center.y - a.y) - edge.y * (arc.center.x - a.x) - Math.max(0, strictEps);
    const cosCoeff = -arc.radius * edge.y;
    const sinCoeff = arc.radius * edge.x;
    allowed = intersectIntervalLists(
      allowed,
      angleInequalityIntervals(cosCoeff, sinCoeff, base, angleRange.min, angleRange.max),
    );
    if (allowed.length === 0) return [];
  }

  return allowed.map(([thetaStart, thetaEnd]) => {
    const t0 = (thetaStart - arc.startAngle) / arc.sweep;
    const t1 = (thetaEnd - arc.startAngle) / arc.sweep;
    return [clamp01(Math.min(t0, t1)), clamp01(Math.max(t0, t1))] as [number, number];
  });
}

function mergeIntervals(intervals: Array<[number, number] | null>): Array<[number, number]> {
  const valid = intervals
    .filter((interval): interval is [number, number] => interval !== null)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of valid) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1] + EPS) {
      merged.push([...interval]);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }
  return merged;
}

function gapsFromIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  const gaps: Array<[number, number]> = [];
  let cursor = 0;
  for (const [start, end] of intervals) {
    if (start > cursor + EPS) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1 - EPS) gaps.push([cursor, 1]);
  return gaps;
}

function classicalAdmissibleOrdered(a: number, b: number, c: number, strictInput: number): boolean {
  const strict = Math.max(0, strictInput);
  const sum = a + b;
  const circle = a * a + a * b + b * b;
  if (circle > 1 - strict + EPS) {
    return false;
  }

  const transition = sum ** 4 - sum * sum + a * b;
  const cell1 =
    sum <= 1 - strict + EPS &&
    transition <= -strict + EPS &&
    c ** 4 - c * c + a * c - a * a <= -strict + EPS;
  const cell2 =
    sum <= 1 - strict + EPS &&
    transition >= strict - EPS &&
    (sum * sum - 1) * c * c + b * c - b * b <= -strict + EPS;
  const cell3 =
    sum >= 1 + strict - EPS &&
    c <= 0.5 - strict + EPS &&
    (a * a - 1) * c * c + (2 * a * b * b + b) * c + (b ** 4 - b * b) <= -strict + EPS;

  return cell1 || cell2 || cell3;
}

function classicalAdmissible(aInput: number, bInput: number, cInput: number, strictInput: number): boolean {
  const a = Math.max(0, Math.min(1, aInput));
  const b = Math.max(0, Math.min(1, bInput));
  const c = Math.max(0, Math.min(1, cInput));
  if (a <= b + EPS) {
    return classicalAdmissibleOrdered(a, b, c, strictInput);
  }
  return classicalAdmissibleOrdered(b, a, c, strictInput);
}

function maxClassicalCoordinate(mode: FreeVd0Mode, a: number, b: number, c: number, strictEps: number): number {
  const predicate = (value: number): boolean => {
    if (mode === 'max-c') return classicalAdmissible(a, b, value, strictEps);
    if (mode === 'max-a') return classicalAdmissible(value, b, c, strictEps);
    return classicalAdmissible(a, value, c, strictEps);
  };
  if (predicate(1)) return 1;

  const step = 1 / VD0_SAMPLES;
  let lo = -1;
  let hi = 1;
  for (let i = VD0_SAMPLES - 1; i >= 0; i--) {
    const value = step * i;
    if (predicate(value)) {
      lo = value;
      hi = Math.min(1, value + step);
      break;
    }
  }
  if (lo < 0) return 0;

  for (let i = 0; i < VD0_SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (predicate(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.max(0, Math.min(1, lo));
}

function farthestGapEndExcludingTriangle(
  state: FreeState,
  excludedId: FreeTriangleId,
  start: Point,
  end: Point,
): number {
  const intervals = mergeIntervals(
    state.triangles
      .filter((triangle) => triangle.id !== excludedId)
      .map((triangle) => strictIntervalOnSegment(start, end, triangle, state.strictEps)),
  );
  const gaps = gapsFromIntervals(intervals);
  return gaps.reduce((max, gap) => Math.max(max, gap[1]), 0);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function branchForVd0Coordinate(triangle: FreeTriangleState, coordinate: FreeVd0Coordinate): { start: Point; end: Point } | null {
  if (triangle.id === 'C') return null;
  const index = Number(triangle.id.slice(1));
  const vertex = HEXAGON_VERTICES[index];
  if (coordinate === 'a') return { start: vertex, end: HEXAGON_VERTICES[(index + 5) % 6] };
  if (coordinate === 'b') return { start: vertex, end: HEXAGON_VERTICES[(index + 1) % 6] };
  return { start: vertex, end: { x: 0, y: 0 } };
}

function segmentParameter(start: Point, end: Point, point: Point, tolerance: number): number | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPS) return null;
  const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const t = clamp01(rawT);
  const closest = { x: start.x + t * dx, y: start.y + t * dy };
  const distance = Math.hypot(point.x - closest.x, point.y - closest.y);
  if (rawT < -tolerance || rawT > 1 + tolerance || distance > tolerance) {
    return null;
  }
  return t;
}

function resolvedVd0RawSourceValue(
  state: FreeState,
  triangle: FreeTriangleState,
  coordinate: FreeVd0Coordinate,
  ref: FreeNamedPointRef | null | undefined,
): number | null {
  if (!ref) return null;
  const branch = branchForVd0Coordinate(triangle, coordinate);
  const point = resolveNamedPoint(state, ref);
  if (!branch || !point) return null;
  return segmentParameter(branch.start, branch.end, point, Math.max(1e-5, state.strictEps * 4));
}

export interface FreeVd0RawSourceOption {
  ref: FreeNamedPointRef;
  label: string;
  value: number;
}

export function getFreeVd0RawSourceOptions(
  state: FreeState,
  triangle: FreeTriangleState,
  coordinate: FreeVd0Coordinate,
): FreeVd0RawSourceOption[] {
  if (triangle.id === 'C') return [];
  const vertexIndex = Number(triangle.id.slice(1));
  const refs: FreeNamedPointRef[] = [
    { kind: 'V', index: vertexIndex },
    ...[0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'M', index }) as FreeNamedPointRef),
    ...state.targetTPoints.flatMap((target) =>
      [0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'P', index, targetTId: target.id }) as FreeNamedPointRef),
    ),
    ...[0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'B', index }) as FreeNamedPointRef),
    ...state.labels.map((label) => ({ kind: 'label', labelId: label.id }) as FreeNamedPointRef),
  ];
  return refs.flatMap((ref) => {
    const value = resolvedVd0RawSourceValue(state, triangle, coordinate, ref);
    return value === null ? [] : [{ ref, label: namedPointLabel(ref), value }];
  });
}

export interface FreeVd0Status {
  ok: boolean;
  message: string | null;
  warnings: string[];
  raw: { a: number; b: number; c: number };
  rawSourceLabels: Partial<Record<FreeVd0Coordinate, string>>;
  target: { a: number; b: number; c: number };
  max: number;
}

interface FreeVd0Target {
  raw: { a: number; b: number; c: number };
  rawSourceLabels: Partial<Record<FreeVd0Coordinate, string>>;
  warnings: string[];
  a: number;
  b: number;
  c: number;
  max: number;
  points: Point[];
}

export function getFreeVd0Status(state: FreeState, triangle: FreeTriangleState): FreeVd0Status | null {
  const target = getFreeVd0Target(state, triangle);
  if (!target) return null;
  return {
    ok: true,
    message: target.warnings.length > 0 ? target.warnings.join(', ') : null,
    warnings: target.warnings,
    raw: target.raw,
    rawSourceLabels: target.rawSourceLabels,
    target: { a: target.a, b: target.b, c: target.c },
    max: target.max,
  };
}

function pointOnSegment(start: Point, end: Point, value: number): Point {
  return {
    x: start.x + value * (end.x - start.x),
    y: start.y + value * (end.y - start.y),
  };
}

function vd0TargetPoints(index: number, a: number, b: number, c: number): Point[] {
  const vertex = HEXAGON_VERTICES[index];
  return [
    vertex,
    pointOnSegment(vertex, HEXAGON_VERTICES[(index + 5) % 6], a),
    pointOnSegment(vertex, HEXAGON_VERTICES[(index + 1) % 6], b),
    pointOnSegment(vertex, { x: 0, y: 0 }, c),
  ];
}

function closedPointInPlacedUnitTriangle(point: Point, triangle: FreeTriangleState): boolean {
  const vertices = triangleVertices(triangle.center, triangle.angle);
  for (let i = 0; i < 3; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross < 0) {
      return false;
    }
  }
  return true;
}

function placedUnitTriangleContainsPoints(points: Point[], triangle: FreeTriangleState): boolean {
  return points.every((point) => closedPointInPlacedUnitTriangle(point, triangle));
}

function getFreeVd0Target(state: FreeState, triangle: FreeTriangleState): FreeVd0Target | null {
  if (triangle.id === 'C' || !triangle.vd0.enabled) {
    return null;
  }

  const index = Number(triangle.id.slice(1));
  const vertex = HEXAGON_VERTICES[index];
  const rawSourceLabels: Partial<Record<FreeVd0Coordinate, string>> = {};
  const warnings: string[] = [];
  const rawSources = triangle.vd0.rawSources ?? {};
  const automatic = {
    a: farthestGapEndExcludingTriangle(state, triangle.id, vertex, HEXAGON_VERTICES[(index + 5) % 6]),
    b: farthestGapEndExcludingTriangle(state, triangle.id, vertex, HEXAGON_VERTICES[(index + 1) % 6]),
    c: farthestGapEndExcludingTriangle(state, triangle.id, vertex, { x: 0, y: 0 }),
  };
  const manualValue = (coordinate: FreeVd0Coordinate): number => {
    const source = rawSources[coordinate];
    if (!source) return automatic[coordinate];
    const value = resolvedVd0RawSourceValue(state, triangle, coordinate, source);
    const label = namedPointLabel(source);
    if (value === null) {
      warnings.push(`${coordinate} source ${label} invalid; using auto`);
      return automatic[coordinate];
    }
    rawSourceLabels[coordinate] = label;
    return value;
  };
  let a = manualValue('a');
  let b = manualValue('b');
  let c = manualValue('c');
  const raw = { a, b, c };
  const max = maxClassicalCoordinate(triangle.vd0.mode, a, b, c, state.strictEps);

  if (triangle.vd0.mode === 'max-c') c = max;
  if (triangle.vd0.mode === 'max-a') a = max;
  if (triangle.vd0.mode === 'max-b') b = max;

  return {
    raw,
    rawSourceLabels,
    warnings,
    a,
    b,
    c,
    max,
    points: vd0TargetPoints(index, a, b, c),
  };
}

export function autoPlaceFreeVd0Triangle(state: FreeState, triangle: FreeTriangleState): { ok: true } | { ok: false; reason: string } {
  const target = getFreeVd0Target(state, triangle);
  if (!target) {
    return { ok: true };
  }

  const index = Number(triangle.id.slice(1));
  const fitTarget = (a: number, b: number, c: number): { points: Point[]; fitted: CoverTriangle; placedTriangle: FreeTriangleState } => {
    const points = vd0TargetPoints(index, a, b, c);
    const fitted = fitTriangle(triangle.id, points, colorForTriangle(triangle.id));
    return {
      points,
      fitted,
      placedTriangle: {
        ...triangle,
        center: fitted.center,
        angle: fitted.phi - Math.PI / 2,
      },
    };
  };
  const fitsUnit = (candidate: ReturnType<typeof fitTarget>): boolean =>
    candidate.fitted.side <= 1 + VD0_FIT_SIDE_TOLERANCE
    && placedUnitTriangleContainsPoints(candidate.points, candidate.placedTriangle);

  let placement = fitTarget(target.a, target.b, target.c);
  if (!fitsUnit(placement)) {
    let lo = 0;
    let hi = target.max;
    let best: typeof placement | null = null;
    for (let i = 0; i < VD0_SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2;
      const candidate = fitTarget(
        triangle.vd0.mode === 'max-a' ? mid : target.a,
        triangle.vd0.mode === 'max-b' ? mid : target.b,
        triangle.vd0.mode === 'max-c' ? mid : target.c,
      );
      if (fitsUnit(candidate)) {
        lo = mid;
        best = candidate;
      } else {
        hi = mid;
      }
    }
    if (!best) {
      return { ok: false, reason: `Vd0 auto-place failed; fitted side=${placement.fitted.side.toFixed(6)}.` };
    }
    placement = best;
  }

  triangle.fixed = false;
  triangle.hidden = false;
  triangle.center = placement.fitted.center;
  triangle.angle = placement.fitted.phi - Math.PI / 2;
  return { ok: true };
}

export function autoPlaceAllFreeVd0Triangles(state: FreeState): { ok: true } | { ok: false; failedIds: FreeTriangleId[] } {
  const failedIds: FreeTriangleId[] = [];
  for (let i = 0; i < 6; i++) {
    const triangle = state.triangles.find((candidate) => candidate.id === `V${i}` as FreeTriangleId);
    if (!triangle?.vd0.enabled) continue;
    const result = autoPlaceFreeVd0Triangle(state, triangle);
    if (!result.ok) {
      failedIds.push(triangle.id);
    }
  }
  return failedIds.length === 0 ? { ok: true } : { ok: false, failedIds };
}

export function validateFreeState(state: FreeState): FreeValidationResult {
  const visibleOrHiddenTriangles = state.triangles;
  const segments: FreeValidationSegment[] = [];
  const checkSegment = (kind: 'edge' | 'diag', index: number, start: Point, end: Point): void => {
    const intervals = mergeIntervals(
      visibleOrHiddenTriangles.map((triangle) => strictIntervalOnSegment(start, end, triangle, state.strictEps)),
    );
    segments.push({ kind, index, intervals, gaps: gapsFromIntervals(intervals) });
  };

  if (state.target !== 'LOTUS') {
    for (let i = 0; i < 6; i++) {
      checkSegment('edge', i, HEXAGON_VERTICES[i], HEXAGON_VERTICES[(i + 1) % 6]);
    }
  }
  if (state.target === 'S' || state.target === 'BENZENE') {
    for (let i = 0; i < 6; i++) {
      checkSegment('diag', i, { x: 0, y: 0 }, HEXAGON_VERTICES[i]);
    }
  }
  if (state.target === 'LOTUS') {
    for (const component of lotusComponents()) {
      const intervals = mergeIntervals(
        component.arc
          ? visibleOrHiddenTriangles.flatMap((triangle) => strictIntervalOnArc(component.arc!, triangle, state.strictEps))
          : visibleOrHiddenTriangles.map((triangle) => strictIntervalOnSegment(component.start, component.end, triangle, state.strictEps)),
      );
      segments.push({
        kind: component.arc ? 'lotus-arc' : 'lotus-line',
        index: component.ref.index,
        label: component.label,
        arc: component.arc,
        intervals,
        gaps: gapsFromIntervals(intervals),
      });
    }
  }

  const pointFailures: string[] = [];
  const points: Array<{ label: string; point: Point }> = [];
  if (state.target === 'S_HALF' || state.target === 'S_T' || state.target === 'BENZENE') {
    points.push(
      ...(state.target === 'BENZENE' ? [] : [{ label: 'O', point: { x: 0, y: 0 } }]),
      ...(state.target === 'BENZENE'
        ? [0, 1, 2, 3, 4, 5].map((i) => ({ label: `B${i}`, point: benzenePoint(i) }))
        : [0, 1, 2, 3, 4, 5].map((i) => ({ label: `M${i}`, point: midpoint(i) }))),
      ...(state.target === 'S_T'
        ? state.targetTPoints.flatMap((target) =>
          [0, 1, 2, 3, 4, 5].map((i) => ({ label: targetTLabel(i, target.id), point: targetTPoint(target, i) })),
        )
        : []),
    );
  }
  points.push(...buildSymmetricPointTargets(state.pointSeeds).map((target) => ({
    label: target.label,
    point: target.point,
  })));
  for (const { label, point } of points) {
    if (!state.triangles.some((triangle) => strictPointInTriangle(point, triangle, state.strictEps))) {
      pointFailures.push(label);
    }
  }

  const constraintStatuses = state.triangles.map((triangle): FreeConstraintStatus => {
    const messages: string[] = [];
    for (const { point, label } of getRequiredPoints(state, triangle)) {
      if (!strictPointInTriangle(point, triangle, state.strictEps)) {
        messages.push(`misses ${label}`);
      }
    }
    if (triangle.edgePointConstraint) {
      const point = resolveNamedPoint(state, triangle.edgePointConstraint.point);
      if (!point) {
        messages.push(`missing ${namedPointLabel(triangle.edgePointConstraint.point)}`);
      } else {
        const vertices = triangleVertices(triangle.center, triangle.angle);
        const a = vertices[triangle.edgePointConstraint.edgeIndex];
        const b = vertices[(triangle.edgePointConstraint.edgeIndex + 1) % 3];
        const distance = Math.abs((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x));
        if (distance > Math.max(1e-5, state.strictEps * 4)) {
          messages.push(`edge misses ${namedPointLabel(triangle.edgePointConstraint.point)}`);
        }
      }
    }
    const vd0Status = state.target === 'LOTUS' ? null : getFreeVd0Status(state, triangle);
    if (vd0Status?.message) {
      messages.push(vd0Status.message);
    }
    return { triangleId: triangle.id, ok: messages.length === 0, messages };
  });

  return {
    coverageOk: segments.every((segment) => segment.gaps.length === 0) && pointFailures.length === 0,
    constraintsOk: constraintStatuses.every((status) => status.ok),
    segments,
    pointFailures,
    constraintStatuses,
  };
}

export function skeletonSegments(state: FreeState): FreeSegment[] {
  const segments: FreeSegment[] = [];
  for (let i = 0; i < 6; i++) {
    segments.push({
      ref: { kind: 'hex-edge', index: i },
      start: HEXAGON_VERTICES[i],
      end: HEXAGON_VERTICES[(i + 1) % 6],
      label: `e${i}`,
    });
    segments.push({
      ref: { kind: 'half-diagonal', index: i },
      start: { x: 0, y: 0 },
      end: HEXAGON_VERTICES[i],
      label: `r${i}`,
    });
  }
  for (const triangle of state.triangles) {
    if (triangle.hidden) continue;
    const vertices = triangleVertices(triangle.center, triangle.angle);
    for (let i = 0; i < 3; i++) {
      segments.push({
        ref: { kind: 'triangle-edge', index: i, triangleId: triangle.id },
        start: vertices[i],
        end: vertices[(i + 1) % 3],
        label: `${triangle.id}.edge${i}`,
      });
    }
  }
  if (state.target === 'LOTUS') {
    segments.push(...lotusComponents().filter((component) => component.arc));
  }
  return segments;
}

export function lotusComponents(): FreeSegment[] {
  const components: FreeSegment[] = [];
  for (let i = 0; i < 6; i++) {
    const current = HEXAGON_VERTICES[i];
    const next = HEXAGON_VERTICES[(i + 1) % 6];
    components.push({
      ref: { kind: 'hex-edge', index: i },
      start: current,
      end: next,
      label: `perimeter e${i}`,
    });
  }
  for (let i = 0; i < 6; i++) {
    const current = HEXAGON_VERTICES[i];
    const previous = HEXAGON_VERTICES[(i + 5) % 6];
    const next = HEXAGON_VERTICES[(i + 1) % 6];
    const leftStartAngle = Math.atan2(-previous.y, -previous.x);
    const leftEndAngle = Math.atan2(current.y - previous.y, current.x - previous.x);
    const rightStartAngle = Math.atan2(-next.y, -next.x);
    const rightEndAngle = Math.atan2(current.y - next.y, current.x - next.x);
    components.push({
      ref: { kind: 'lotus-arc', index: i * 2 },
      start: { x: 0, y: 0 },
      end: current,
      label: `L${i}:left`,
      arc: {
        center: previous,
        radius: LOTUS_RADIUS,
        startAngle: leftStartAngle,
        sweep: signedAngleDelta(leftStartAngle, leftEndAngle),
      },
    });
    components.push({
      ref: { kind: 'lotus-arc', index: i * 2 + 1 },
      start: { x: 0, y: 0 },
      end: current,
      label: `L${i}:right`,
      arc: {
        center: next,
        radius: LOTUS_RADIUS,
        startAngle: rightStartAngle,
        sweep: signedAngleDelta(rightStartAngle, rightEndAngle),
      },
    });
  }
  return components;
}

function signedAngleDelta(startAngle: number, endAngle: number): number {
  return Math.atan2(Math.sin(endAngle - startAngle), Math.cos(endAngle - startAngle));
}

export function sameSegmentRef(a: FreeSegmentRef, b: FreeSegmentRef): boolean {
  return a.kind === b.kind && a.index === b.index && a.triangleId === b.triangleId;
}

export function getSegmentByRef(state: FreeState, ref: FreeSegmentRef): FreeSegment | null {
  return skeletonSegments(state).find((segment) => sameSegmentRef(segment.ref, ref)) ?? null;
}

function pointOnArc(arc: NonNullable<FreeSegment['arc']>, t: number): Point {
  const angle = arc.startAngle + arc.sweep * t;
  return {
    x: arc.center.x + arc.radius * Math.cos(angle),
    y: arc.center.y + arc.radius * Math.sin(angle),
  };
}

function arcLineIntersection(arcSegment: FreeSegment, lineSegment: FreeSegment): Point | null {
  if (!arcSegment.arc) return null;
  const d = { x: lineSegment.end.x - lineSegment.start.x, y: lineSegment.end.y - lineSegment.start.y };
  const f = { x: lineSegment.start.x - arcSegment.arc.center.x, y: lineSegment.start.y - arcSegment.arc.center.y };
  const a = d.x * d.x + d.y * d.y;
  const b = 2 * (f.x * d.x + f.y * d.y);
  const c = f.x * f.x + f.y * f.y - arcSegment.arc.radius * arcSegment.arc.radius;
  const disc = b * b - 4 * a * c;
  if (a < EPS || disc < -EPS) return null;
  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  for (const tLine of [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)]) {
    if (tLine < -EPS || tLine > 1 + EPS) continue;
    const point = {
      x: lineSegment.start.x + clamp01(tLine) * d.x,
      y: lineSegment.start.y + clamp01(tLine) * d.y,
    };
    const rawAngle = Math.atan2(point.y - arcSegment.arc.center.y, point.x - arcSegment.arc.center.x);
    const relative = Math.atan2(
      Math.sin(rawAngle - arcSegment.arc.startAngle),
      Math.cos(rawAngle - arcSegment.arc.startAngle),
    );
    const tArc = relative / arcSegment.arc.sweep;
    if (tArc >= -EPS && tArc <= 1 + EPS) {
      return pointOnArc(arcSegment.arc, clamp01(tArc));
    }
  }
  return null;
}

export function segmentIntersection(a: FreeSegment, b: FreeSegment): Point | null {
  if (a.arc && !b.arc) return arcLineIntersection(a, b);
  if (!a.arc && b.arc) return arcLineIntersection(b, a);
  if (a.arc || b.arc) return null;
  const r = { x: a.end.x - a.start.x, y: a.end.y - a.start.y };
  const s = { x: b.end.x - b.start.x, y: b.end.y - b.start.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < EPS) return null;
  const q = { x: b.start.x - a.start.x, y: b.start.y - a.start.y };
  const t = (q.x * s.y - q.y * s.x) / denom;
  const u = (q.x * r.y - q.y * r.x) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.start.x + t * r.x, y: a.start.y + t * r.y };
}

export function refreshLabels(state: FreeState): void {
  for (const label of state.labels) {
    const recomputeStatic = label.mode === 'static' && (
      label.first?.kind === 'lotus-arc' || label.second?.kind === 'lotus-arc'
    );
    if (label.mode === 'static' && !recomputeStatic) {
      continue;
    }
    if (!label.first || !label.second) {
      label.point = null;
      continue;
    }
    const first = getSegmentByRef(state, label.first);
    const second = getSegmentByRef(state, label.second);
    label.point = first && second ? segmentIntersection(first, second) : null;
  }
}

function nextLabelId(state: FreeState, mode: FreeLabel['mode']): string {
  const prefix = mode === 'dynamic' ? 'D' : 'S';
  const max = state.labels.reduce((currentMax, label) => {
    if (label.mode !== mode || !label.id.startsWith(prefix)) return currentMax;
    const value = Number.parseInt(label.id.slice(prefix.length), 10);
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return `${prefix}${max + 1}`;
}

export function createLabel(
  state: FreeState,
  first: FreeSegmentRef,
  second: FreeSegmentRef,
  mode: FreeLabel['mode'],
): FreeLabel | null {
  const arcCount = (first.kind === 'lotus-arc' ? 1 : 0) + (second.kind === 'lotus-arc' ? 1 : 0);
  if (arcCount > 0 && (arcCount !== 1 || (first.kind !== 'triangle-edge' && second.kind !== 'triangle-edge'))) {
    return null;
  }
  const firstSegment = getSegmentByRef(state, first);
  const secondSegment = getSegmentByRef(state, second);
  if (!firstSegment || !secondSegment) return null;
  const point = segmentIntersection(firstSegment, secondSegment);
  if (!point) return null;
  const id = nextLabelId(state, mode);
  return {
    id,
    name: id,
    mode,
    first: mode === 'dynamic' || arcCount > 0 || shouldKeepStaticSegmentRef(first) ? first : null,
    second: mode === 'dynamic' || arcCount > 0 || shouldKeepStaticSegmentRef(second) ? second : null,
    point,
  };
}

export function describeTarget(target: FreeTarget): string {
  if (target === 'S') return 'S';
  if (target === 'S_T') return 'S_t';
  if (target === 'BENZENE') return 'Benzene';
  if (target === 'LOTUS') return 'Lotus';
  return 'S_{1/2}';
}
