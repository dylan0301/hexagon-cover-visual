import type { Point } from './types';
import { HEXAGON_VERTICES } from './hexagon';

const SQRT3 = Math.sqrt(3);
const UNIT_TRIANGLE_AREA = SQRT3 / 4;
const UNIT_CIRCUMRADIUS = 1 / SQRT3;
const UNIT_INRADIUS = 1 / (2 * SQRT3);
const ANGLE_PERIOD = 2 * Math.PI / 3;
const EPS = 1e-9;
const RESULT_CACHE_LIMIT = 600;

export type AreaConjQuality = 'coarse' | 'high';

export interface AreaConjRequiredPoints {
  vertex: Point;
  aPoint: Point;
  bPoint: Point;
}

export interface AreaConjTriangle {
  center: Point;
  phi: number;
  vertices: Point[];
  intersection: Point[];
}

export interface AreaConjResult {
  index: number;
  a: number;
  b: number;
  sum: number;
  f: number;
  deficit: number;
  feasible: boolean;
  triangle: AreaConjTriangle | null;
  quality: AreaConjQuality;
  evaluations: number;
}

interface SearchSpec {
  thetaSamples: number;
  centerGrid: number;
  refineSteps: number;
}

const resultCache = new Map<string, AreaConjResult>();

function mod6(index: number): number {
  return (index + 6) % 6;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(value: number, point: Point): Point {
  return { x: value * point.x, y: value * point.y };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function area(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += cross(points[i], points[(i + 1) % points.length]);
  }
  return Math.abs(sum) / 2;
}

function centroid(points: Point[]): Point | null {
  if (points.length === 0) return null;
  const signedArea2 = points.reduce((sum, point, index) =>
    sum + cross(point, points[(index + 1) % points.length]),
  0);
  if (Math.abs(signedArea2) < EPS) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }

  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const factor = cross(current, next);
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }
  return {
    x: x / (3 * signedArea2),
    y: y / (3 * signedArea2),
  };
}

function triangleVertices(center: Point, phi: number): Point[] {
  return [0, 1, 2].map((index) => ({
    x: center.x + UNIT_CIRCUMRADIUS * Math.cos(phi + 2 * Math.PI * index / 3),
    y: center.y + UNIT_CIRCUMRADIUS * Math.sin(phi + 2 * Math.PI * index / 3),
  }));
}

function clipByLine(
  polygon: Point[],
  inside: (point: Point) => boolean,
  intersection: (a: Point, b: Point) => Point,
): Point[] {
  if (polygon.length === 0) return [];
  const output: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside) {
      if (!previousInside) output.push(intersection(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersection(previous, current));
    }
  }
  return output;
}

function clipPolygonByHexagon(polygon: Point[]): Point[] {
  let clipped = polygon;
  for (let i = 0; i < 6; i++) {
    const edgeStart = HEXAGON_VERTICES[i];
    const edgeEnd = HEXAGON_VERTICES[mod6(i + 1)];
    const edge = subtract(edgeEnd, edgeStart);
    clipped = clipByLine(
      clipped,
      (point) => cross(edge, subtract(point, edgeStart)) >= -EPS,
      (a, b) => {
        const direction = subtract(b, a);
        const denom = cross(edge, direction);
        const t = Math.abs(denom) < EPS ? 0 : cross(edge, subtract(edgeStart, a)) / denom;
        return add(a, scale(Math.max(0, Math.min(1, t)), direction));
      },
    );
  }
  return clipped;
}

function clipPolygonByLowerDot(polygon: Point[], normal: Point, limit: number): Point[] {
  return clipByLine(
    polygon,
    (point) => dot(normal, point) >= limit - EPS,
    (a, b) => {
      const direction = subtract(b, a);
      const denom = dot(normal, direction);
      const t = Math.abs(denom) < EPS ? 0 : (limit - dot(normal, a)) / denom;
      return add(a, scale(Math.max(0, Math.min(1, t)), direction));
    },
  );
}

function feasibleCenterPolygon(phi: number, points: Point[]): Point[] {
  let polygon: Point[] = [
    { x: -3, y: -3 },
    { x: 3, y: -3 },
    { x: 3, y: 3 },
    { x: -3, y: 3 },
  ];
  const normals = [0, 1, 2].map((index) => ({
    x: -Math.cos(phi + 2 * Math.PI * index / 3),
    y: -Math.sin(phi + 2 * Math.PI * index / 3),
  }));

  for (const point of points) {
    for (const normal of normals) {
      polygon = clipPolygonByLowerDot(polygon, normal, dot(normal, point) - UNIT_INRADIUS);
      if (polygon.length === 0) return [];
    }
  }
  return polygon;
}

function pointInConvexPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const value = cross(subtract(b, a), subtract(point, a));
    if (Math.abs(value) <= EPS) continue;
    const currentSign = Math.sign(value);
    if (sign !== 0 && currentSign !== sign) return false;
    sign = currentSign;
  }
  return true;
}

function bounds(points: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minY: Math.min(box.minY, point.y),
    maxY: Math.max(box.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function candidateCenters(polygon: Point[], gridSteps: number): Point[] {
  const candidates = polygon.slice();
  const center = centroid(polygon);
  if (center) candidates.push(center);

  const box = bounds(polygon);
  const steps = Math.max(1, gridSteps);
  for (let ix = 0; ix <= steps; ix++) {
    for (let iy = 0; iy <= steps; iy++) {
      const point = {
        x: box.minX + (box.maxX - box.minX) * ix / steps,
        y: box.minY + (box.maxY - box.minY) * iy / steps,
      };
      if (pointInConvexPolygon(point, polygon)) {
        candidates.push(point);
      }
    }
  }
  return candidates;
}

function evaluateTriangle(center: Point, phi: number): AreaConjTriangle & { value: number } {
  const vertices = triangleVertices(center, phi);
  const intersection = clipPolygonByHexagon(vertices);
  return {
    center,
    phi,
    vertices,
    intersection,
    value: Math.max(0, Math.min(1, area(intersection) / UNIT_TRIANGLE_AREA)),
  };
}

function refineCenter(
  start: AreaConjTriangle & { value: number },
  phi: number,
  feasible: Point[],
  steps: number,
): { best: AreaConjTriangle & { value: number }; evaluations: number } {
  let best = start;
  let evaluations = 0;
  const box = bounds(feasible);
  let step = Math.max(box.maxX - box.minX, box.maxY - box.minY) / 4;
  const directions: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];

  for (let iter = 0; iter < steps; iter++) {
    let improved = false;
    for (const direction of directions) {
      const length = Math.hypot(direction.x, direction.y) || 1;
      const center = {
        x: best.center.x + step * direction.x / length,
        y: best.center.y + step * direction.y / length,
      };
      if (!pointInConvexPolygon(center, feasible)) continue;
      const candidate = evaluateTriangle(center, phi);
      evaluations++;
      if (candidate.value > best.value) {
        best = candidate;
        improved = true;
      }
    }
    if (!improved) step *= 0.5;
  }

  return { best, evaluations };
}

function searchSpec(quality: AreaConjQuality): SearchSpec {
  return quality === 'high'
    ? { thetaSamples: 144, centerGrid: 8, refineSteps: 10 }
    : { thetaSamples: 48, centerGrid: 4, refineSteps: 0 };
}

function cacheKey(index: number, a: number, b: number, quality: AreaConjQuality): string {
  return `${mod6(index)}:${a.toFixed(6)}:${b.toFixed(6)}:${quality}`;
}

function cacheResult(key: string, result: AreaConjResult): AreaConjResult {
  if (resultCache.size >= RESULT_CACHE_LIMIT) {
    const first = resultCache.keys().next().value as string | undefined;
    if (first) resultCache.delete(first);
  }
  resultCache.set(key, result);
  return result;
}

export function areaConjRequiredPoints(indexInput: number, aInput: number, bInput: number): AreaConjRequiredPoints {
  const index = mod6(indexInput);
  const vertex = HEXAGON_VERTICES[index];
  const previous = HEXAGON_VERTICES[mod6(index - 1)];
  const next = HEXAGON_VERTICES[mod6(index + 1)];
  const a = clamp01(aInput);
  const b = clamp01(bInput);
  return {
    vertex,
    aPoint: add(vertex, scale(a, subtract(previous, vertex))),
    bPoint: add(vertex, scale(b, subtract(next, vertex))),
  };
}

export function computeAreaConjResult(
  index: number,
  aInput: number,
  bInput: number,
  quality: AreaConjQuality,
): AreaConjResult {
  const a = clamp01(aInput);
  const b = clamp01(bInput);
  const key = cacheKey(index, a, b, quality);
  const cached = resultCache.get(key);
  if (cached) return cached;

  const required = areaConjRequiredPoints(index, a, b);
  const points = [required.vertex, required.aPoint, required.bPoint];
  const spec = searchSpec(quality);
  let best: (AreaConjTriangle & { value: number }) | null = null;
  let evaluations = 0;

  for (let thetaIndex = 0; thetaIndex < spec.thetaSamples; thetaIndex++) {
    const phi = ANGLE_PERIOD * thetaIndex / spec.thetaSamples;
    const feasible = feasibleCenterPolygon(phi, points);
    if (feasible.length < 3 || area(feasible) <= EPS) continue;

    for (const center of candidateCenters(feasible, spec.centerGrid)) {
      const candidate = evaluateTriangle(center, phi);
      evaluations++;
      if (!best || candidate.value > best.value) {
        best = candidate;
      }
    }

    if (spec.refineSteps > 0 && best?.phi === phi) {
      const refined = refineCenter(best, phi, feasible, spec.refineSteps);
      evaluations += refined.evaluations;
      if (refined.best.value > best.value) {
        best = refined.best;
      }
    }
  }

  if (!best) {
    return cacheResult(key, {
      index: mod6(index),
      a,
      b,
      sum: a + b,
      f: 0,
      deficit: 1,
      feasible: false,
      triangle: null,
      quality,
      evaluations,
    });
  }

  const f = best.value;
  return cacheResult(key, {
    index: mod6(index),
    a,
    b,
    sum: a + b,
    f,
    deficit: 1 - f,
    feasible: true,
    triangle: {
      center: best.center,
      phi: best.phi,
      vertices: best.vertices,
      intersection: best.intersection,
    },
    quality,
    evaluations,
  });
}
