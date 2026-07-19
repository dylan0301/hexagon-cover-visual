import type { Point, ShapeMode, TriangleState } from './types';
import { mathToCanvas, scaleToCanvas } from './coords';
import { pointInTriangle, rayCircleExitDistance, rayPolygonExitDistance } from './geometry';
import { HEXAGON_VERTICES } from './hexagon';

export const CIRCUMRADIUS = 1 / Math.sqrt(3);
const LIGHT_BLUE = '#89CFF0';
const INTERVAL_EPS = 1e-8;

export interface PerimeterIntersectionInterval {
  edgeIndex: number;
  start: number;
  end: number;
}

export interface CPerimeterIntersections {
  kind: 'CE0' | 'CE1' | 'CE2' | 'unsupported';
  intervals: PerimeterIntersectionInterval[];
  reason?: string;
}

export function getVertices(state: TriangleState): [Point, Point, Point] {
  const { position, angle } = state;
  const verts: Point[] = [];
  for (let k = 0; k < 3; k++) {
    const a = angle + Math.PI / 2 + k * (2 * Math.PI / 3);
    verts.push({
      x: position.x + CIRCUMRADIUS * Math.cos(a),
      y: position.y + CIRCUMRADIUS * Math.sin(a),
    });
  }
  return verts as [Point, Point, Point];
}

/** Valid centroid positions such that the origin stays inside the triangle. */
export function getValidRegion(angle: number): [Point, Point, Point] {
  const verts: Point[] = [];
  for (let k = 0; k < 3; k++) {
    const a = angle + Math.PI / 2 + k * (2 * Math.PI / 3);
    verts.push({
      x: -CIRCUMRADIUS * Math.cos(a),
      y: -CIRCUMRADIUS * Math.sin(a),
    });
  }
  return verts as [Point, Point, Point];
}

export function drawTriangle(ctx: CanvasRenderingContext2D, state: TriangleState): void {
  const verts = getVertices(state).map(mathToCanvas);

  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  ctx.lineTo(verts[1].x, verts[1].y);
  ctx.lineTo(verts[2].x, verts[2].y);
  ctx.closePath();
  ctx.strokeStyle = LIGHT_BLUE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawCircle(ctx: CanvasRenderingContext2D, state: TriangleState): void {
  const center = mathToCanvas(state.position);

  ctx.beginPath();
  ctx.arc(center.x, center.y, scaleToCanvas(CIRCUMRADIUS), 0, 2 * Math.PI);
  ctx.strokeStyle = LIGHT_BLUE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  state: TriangleState,
  shapeMode: ShapeMode,
): void {
  if (shapeMode === 'local-c') {
    return;
  }

  if (shapeMode === 'circle') {
    drawCircle(ctx, state);
    return;
  }

  drawTriangle(ctx, state);
}

export function drawControlPoint(ctx: CanvasRenderingContext2D, state: TriangleState): void {
  const cp = mathToCanvas(state.controlPoint);
  const radius = 4;

  ctx.beginPath();
  ctx.arc(cp.x, cp.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = LIGHT_BLUE;
  ctx.fill();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function getInnerGammas(state: TriangleState, shapeMode: ShapeMode): number[] {
  if (shapeMode === 'local-c') {
    return HEXAGON_VERTICES.map(() => 0);
  }

  const verts = shapeMode === 'triangle' ? getVertices(state) : null;
  const origin = { x: 0, y: 0 };

  return HEXAGON_VERTICES.map((vertex) => {
    const distance = shapeMode === 'circle'
      ? rayCircleExitDistance(origin, vertex, state.position, CIRCUMRADIUS)
      : rayPolygonExitDistance(origin, vertex, verts!);
    return distance ?? 0;
  });
}

function segmentIntersectionParameter(a: Point, b: Point, c: Point, d: Point): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;

  if (Math.abs(denom) < INTERVAL_EPS) {
    return null;
  }

  const offset = { x: c.x - a.x, y: c.y - a.y };
  const t = (offset.x * s.y - offset.y * s.x) / denom;
  const u = (offset.x * r.y - offset.y * r.x) / denom;

  if (t < -INTERVAL_EPS || t > 1 + INTERVAL_EPS || u < -INTERVAL_EPS || u > 1 + INTERVAL_EPS) {
    return null;
  }

  return Math.max(0, Math.min(1, t));
}

function pointOnSegment(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  };
}

function intervalOnTriangleSegment(
  start: Point,
  end: Point,
  triangle: [Point, Point, Point],
): [number, number] | null {
  const candidates = [0, 1];

  for (let i = 0; i < triangle.length; i++) {
    const next = (i + 1) % triangle.length;
    const t = segmentIntersectionParameter(start, end, triangle[i], triangle[next]);
    if (t !== null) {
      candidates.push(t);
    }
  }

  const sorted = Array.from(new Set(candidates.map((value) => Math.round(value / INTERVAL_EPS) * INTERVAL_EPS)))
    .map((value) => Math.max(0, Math.min(1, value)))
    .sort((a, b) => a - b);
  const insideSpans: Array<[number, number]> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b - a <= INTERVAL_EPS) {
      continue;
    }

    const midpoint = pointOnSegment(start, end, (a + b) / 2);
    if (pointInTriangle(midpoint, triangle[0], triangle[1], triangle[2])) {
      insideSpans.push([a, b]);
    }
  }

  for (const t of sorted) {
    const point = pointOnSegment(start, end, t);
    if (!pointInTriangle(point, triangle[0], triangle[1], triangle[2])) {
      continue;
    }

    const last = insideSpans[insideSpans.length - 1];
    if (last && Math.abs(last[1] - t) <= INTERVAL_EPS) {
      last[1] = t;
    } else {
      insideSpans.push([t, t]);
    }
  }

  const nondegenerate = insideSpans
    .filter(([a, b]) => b - a > INTERVAL_EPS)
    .sort((a, b) => a[0] - b[0]);

  if (nondegenerate.length === 0) {
    return null;
  }

  return [
    Math.max(0, nondegenerate[0][0]),
    Math.min(1, nondegenerate[nondegenerate.length - 1][1]),
  ];
}

export function getCPerimeterIntersections(state: TriangleState): CPerimeterIntersections {
  const triangle = getVertices(state);
  const intervals: PerimeterIntersectionInterval[] = [];

  for (let i = 0; i < HEXAGON_VERTICES.length; i++) {
    const start = HEXAGON_VERTICES[i];
    const end = HEXAGON_VERTICES[(i + 1) % HEXAGON_VERTICES.length];
    const interval = intervalOnTriangleSegment(start, end, triangle);

    if (interval !== null) {
      intervals.push({
        edgeIndex: i,
        start: interval[0],
        end: interval[1],
      });
    }
  }

  if (intervals.length === 0) {
    return { kind: 'CE0', intervals };
  }
  if (intervals.length === 1) {
    return { kind: 'CE1', intervals };
  }
  if (intervals.length === 2) {
    return { kind: 'CE2', intervals };
  }

  return {
    kind: 'unsupported',
    intervals,
    reason: `expected 0, 1, or 2 edge overlaps; found ${intervals.length}`,
  };
}
