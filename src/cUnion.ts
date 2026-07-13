import type { Point, TriangleState } from './types';
import { HEXAGON_VERTICES } from './hexagon';
import {
  getCPerimeterIntersections,
  getValidRegion,
  getVertices,
} from './triangle';

export type CUnionCeFilter = 'ce1' | 'ce2' | 'both';
export type CUnionModelStatus = 'ready';
export type CUnionBuildPhase = 'orientations' | 'contours' | 'ready';

export interface CUnionCounts {
  orientationCount: number;
  feasibleCellCount: number;
  ce1CellCount: number;
  ce2CellCount: number;
  ce1CoveragePolygonCount: number;
  ce2CoveragePolygonCount: number;
}

export interface CUnionBuildStatus {
  phase: CUnionBuildPhase;
  progress: number;
  completedOrientations: number;
  totalOrientations: number;
  counts: CUnionCounts;
}

export interface CUnionModel {
  readonly status: CUnionModelStatus;
  readonly counts: CUnionCounts;
  readonly orientationCount: number;
  readonly boundaryRayCount: number;
}

export interface CUnionCoverage {
  readonly filter: CUnionCeFilter;
  readonly strictEps: number;
  readonly polygonCount: number;
  readonly polygons: readonly (readonly Point[])[];
}

export interface CUnionArc {
  center: Point;
  radius: number;
  startAngle: number;
  sweep: number;
}

export const C_UNION_ORIENTATION_COUNT = 2048;
export const C_UNION_BOUNDARY_RAY_COUNT = 4096;

const ANGLE_PERIOD = 2 * Math.PI / 3;
const INRADIUS = 1 / (2 * Math.sqrt(3));
const GEOMETRY_EPS = 1e-10;
const CLASSIFICATION_EPS = 1e-9;
const CELL_AREA_EPS = 1e-12;
const LINE_DEDUP_EPS = 1e-9;
const INTERVAL_EPS = 1e-9;
const ORIENTATION_YIELD_STRIDE = 16;
const CONTOUR_YIELD_STRIDE = 32;
const COVERAGE_CACHE_LIMIT = 4;
const ZERO: Point = { x: 0, y: 0 };
const M4: Point = {
  x: HEXAGON_VERTICES[4].x / 2,
  y: HEXAGON_VERTICES[4].y / 2,
};
const MIDPOINTS: Point[] = HEXAGON_VERTICES.map((vertex) => ({
  x: vertex.x / 2,
  y: vertex.y / 2,
}));
const BOUNDARY_DIRECTIONS: Point[] = Array.from(
  { length: C_UNION_BOUNDARY_RAY_COUNT },
  (_, index) => {
    const angle = 2 * Math.PI * index / C_UNION_BOUNDARY_RAY_COUNT;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  },
);

interface Line {
  normal: Point;
  constant: number;
}

interface CUnionCell {
  centers: Point[];
  triangle: [Point, Point, Point];
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CoveragePiece {
  polygon: Point[];
  bounds: Bounds;
}

interface CUnionCoverageInternal extends CUnionCoverage {
  pieces: CoveragePiece[];
}

interface LayerCoveragePair {
  ce1: CUnionCoverageInternal;
  ce2: CUnionCoverageInternal;
}

interface CUnionModelInternal extends CUnionModel {
  cells: Record<'ce1' | 'ce2', CUnionCell[]>;
  boundaries: Record<CUnionCeFilter, Point[]>;
  layerCoverageCache: Map<number, LayerCoveragePair>;
  coverageCache: Map<string, CUnionCoverageInternal>;
}

let cachedModel: CUnionModelInternal | null = null;
let activeBuild: Promise<CUnionModelInternal> | null = null;
let activeBuildProgress = 0;
const progressListeners = new Set<(progress: number) => void>();

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function signedArea2(polygon: readonly Point[]): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index++) {
    area += cross(polygon[index], polygon[(index + 1) % polygon.length]);
  }
  return area;
}

function polygonBounds(polygon: readonly Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function samePoint(a: Point, b: Point, eps = GEOMETRY_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function cleanPolygon(input: Point[]): Point[] {
  const polygon: Point[] = [];
  for (const point of input) {
    if (polygon.length === 0 || !samePoint(point, polygon[polygon.length - 1])) {
      polygon.push(point);
    }
  }
  if (polygon.length > 1 && samePoint(polygon[0], polygon[polygon.length - 1])) {
    polygon.pop();
  }

  let changed = true;
  while (changed && polygon.length >= 3) {
    changed = false;
    for (let index = 0; index < polygon.length; index++) {
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const first = subtract(current, previous);
      const second = subtract(next, current);
      if (
        Math.abs(cross(first, second)) <= GEOMETRY_EPS
        && dot(first, second) >= -GEOMETRY_EPS
      ) {
        polygon.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return polygon;
}

function lineFromPoints(start: Point, end: Point): Line {
  const edge = subtract(end, start);
  const normal = { x: -edge.y, y: edge.x };
  return { normal, constant: dot(normal, start) };
}

function normalizeLine(line: Line): Line | null {
  const length = Math.hypot(line.normal.x, line.normal.y);
  if (length <= GEOMETRY_EPS) return null;

  let normal = { x: line.normal.x / length, y: line.normal.y / length };
  let constant = line.constant / length;
  if (
    normal.x < -GEOMETRY_EPS
    || (Math.abs(normal.x) <= GEOMETRY_EPS && normal.y < 0)
  ) {
    normal = { x: -normal.x, y: -normal.y };
    constant = -constant;
  }
  return { normal, constant };
}

function deduplicateLines(lines: Line[]): Line[] {
  const result: Line[] = [];
  for (const candidate of lines) {
    const normalized = normalizeLine(candidate);
    if (!normalized) continue;
    const duplicate = result.some((line) =>
      Math.abs(line.normal.x - normalized.normal.x) <= LINE_DEDUP_EPS
      && Math.abs(line.normal.y - normalized.normal.y) <= LINE_DEDUP_EPS
      && Math.abs(line.constant - normalized.constant) <= LINE_DEDUP_EPS,
    );
    if (!duplicate) result.push(normalized);
  }
  return result;
}

function clipByLine(polygon: readonly Point[], line: Line, keepPositive: boolean): Point[] {
  if (polygon.length === 0) return [];
  const result: Point[] = [];
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentValue = dot(line.normal, current) - line.constant;
    const nextValue = dot(line.normal, next) - line.constant;
    const currentInside = keepPositive
      ? currentValue >= -GEOMETRY_EPS
      : currentValue <= GEOMETRY_EPS;
    const nextInside = keepPositive
      ? nextValue >= -GEOMETRY_EPS
      : nextValue <= GEOMETRY_EPS;

    if (currentInside) result.push(current);
    if (currentInside !== nextInside) {
      const denominator = currentValue - nextValue;
      const t = Math.abs(denominator) <= GEOMETRY_EPS
        ? 0
        : currentValue / denominator;
      result.push({
        x: current.x + t * (next.x - current.x),
        y: current.y + t * (next.y - current.y),
      });
    }
  }
  return cleanPolygon(result);
}

function clipToConvexPolygon(subject: Point[], clipper: readonly Point[]): Point[] {
  let result = subject;
  for (let index = 0; index < clipper.length; index++) {
    result = clipByLine(
      result,
      lineFromPoints(clipper[index], clipper[(index + 1) % clipper.length]),
      true,
    );
    if (result.length < 3) return [];
  }
  return result;
}

function convexHull(input: Point[]): Point[] {
  const sorted = [...input]
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((point, index, points) => index === 0 || !samePoint(point, points[index - 1]));
  if (sorted.length <= 2) return sorted;

  const turn = (origin: Point, a: Point, b: Point): number =>
    cross(subtract(a, origin), subtract(b, origin));
  const lower: Point[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2
      && turn(lower[lower.length - 2], lower[lower.length - 1], point) <= GEOMETRY_EPS
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (
      upper.length >= 2
      && turn(upper[upper.length - 2], upper[upper.length - 1], point) <= GEOMETRY_EPS
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function translatedValidRegion(angle: number, point: Point): Point[] {
  return getValidRegion(angle).map((center) => ({
    x: center.x + point.x,
    y: center.y + point.y,
  }));
}

function edgeIntersectionCenterRegion(
  triangle: readonly Point[],
  start: Point,
  end: Point,
): Point[] {
  const candidates: Point[] = [];
  for (const vertex of triangle) {
    candidates.push(
      { x: start.x - vertex.x, y: start.y - vertex.y },
      { x: end.x - vertex.x, y: end.y - vertex.y },
    );
  }
  return convexHull(candidates);
}

function polygonMean(polygon: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const point of polygon) {
    x += point.x;
    y += point.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

function pointStrictlyInTriangle(point: Point, triangle: readonly Point[]): boolean {
  for (let index = 0; index < triangle.length; index++) {
    const start = triangle[index];
    const end = triangle[(index + 1) % triangle.length];
    if (cross(subtract(end, start), subtract(point, start)) <= CLASSIFICATION_EPS) {
      return false;
    }
  }
  return true;
}

function classifyCell(
  centers: Point[],
  angle: number,
): 'ce1' | 'ce2' | null {
  const center = polygonMean(centers);
  const state: TriangleState = {
    position: center,
    angle,
    controlPoint: center,
  };
  const placedTriangle = getVertices(state);

  for (let index = 0; index < MIDPOINTS.length; index++) {
    if (index !== 4 && pointStrictlyInTriangle(MIDPOINTS[index], placedTriangle)) {
      return null;
    }
  }

  const kind = getCPerimeterIntersections(state).kind;
  if (kind === 'CE1') return 'ce1';
  if (kind === 'CE2') return 'ce2';
  return null;
}

function partitionOrientation(angle: number): {
  feasibleCellCount: number;
  ce1: CUnionCell[];
  ce2: CUnionCell[];
} {
  const triangle = getVertices({ position: ZERO, angle, controlPoint: ZERO });
  let feasible = translatedValidRegion(angle, ZERO);
  feasible = clipToConvexPolygon(feasible, translatedValidRegion(angle, M4));
  const v4 = HEXAGON_VERTICES[4];
  const leftNormal = { x: -v4.y, y: v4.x };
  feasible = clipByLine(feasible, { normal: leftNormal, constant: 0 }, true);
  if (feasible.length < 3 || Math.abs(signedArea2(feasible)) <= 2 * CELL_AREA_EPS) {
    return { feasibleCellCount: 0, ce1: [], ce2: [] };
  }

  const arrangementLines: Line[] = [];
  for (let midpointIndex = 0; midpointIndex < MIDPOINTS.length; midpointIndex++) {
    if (midpointIndex === 4) continue;
    const region = translatedValidRegion(angle, MIDPOINTS[midpointIndex]);
    for (let index = 0; index < region.length; index++) {
      arrangementLines.push(lineFromPoints(region[index], region[(index + 1) % region.length]));
    }
  }

  for (let edgeIndex = 0; edgeIndex < HEXAGON_VERTICES.length; edgeIndex++) {
    const hitRegion = edgeIntersectionCenterRegion(
      triangle,
      HEXAGON_VERTICES[edgeIndex],
      HEXAGON_VERTICES[(edgeIndex + 1) % HEXAGON_VERTICES.length],
    );
    for (let index = 0; index < hitRegion.length; index++) {
      arrangementLines.push(
        lineFromPoints(hitRegion[index], hitRegion[(index + 1) % hitRegion.length]),
      );
    }
  }

  let cells: Point[][] = [feasible];
  for (const line of deduplicateLines(arrangementLines)) {
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (const point of feasible) {
      const value = dot(line.normal, point) - line.constant;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    }
    if (minValue >= -GEOMETRY_EPS || maxValue <= GEOMETRY_EPS) continue;

    const nextCells: Point[][] = [];
    for (const cell of cells) {
      const negative = clipByLine(cell, line, false);
      const positive = clipByLine(cell, line, true);
      if (
        negative.length >= 3
        && Math.abs(signedArea2(negative)) > 2 * CELL_AREA_EPS
      ) {
        nextCells.push(negative);
      }
      if (
        positive.length >= 3
        && Math.abs(signedArea2(positive)) > 2 * CELL_AREA_EPS
      ) {
        nextCells.push(positive);
      }
    }
    cells = nextCells;
  }

  const ce1: CUnionCell[] = [];
  const ce2: CUnionCell[] = [];
  for (const centers of cells) {
    const layer = classifyCell(centers, angle);
    if (layer) {
      const cell = { centers, triangle };
      (layer === 'ce1' ? ce1 : ce2).push(cell);
    }
  }
  return { feasibleCellCount: cells.length, ce1, ce2 };
}

function normalizedStrictEps(strictEps: number): number {
  if (!Number.isFinite(strictEps)) return 0;
  return Math.max(0, strictEps);
}

function buildCoveragePieces(cells: readonly CUnionCell[], strictEps: number): CoveragePiece[] {
  if (strictEps > INRADIUS + GEOMETRY_EPS) return [];
  const scale = Math.max(0, 1 - strictEps / INRADIUS);
  const result: CoveragePiece[] = [];
  for (const cell of cells) {
    const erodedTriangle = cell.triangle.map((vertex) => ({
      x: vertex.x * scale,
      y: vertex.y * scale,
    }));
    const sums: Point[] = [];
    for (const center of cell.centers) {
      for (const vertex of erodedTriangle) {
        sums.push({ x: center.x + vertex.x, y: center.y + vertex.y });
      }
    }
    const polygon = convexHull(sums);
    if (polygon.length >= 3 && Math.abs(signedArea2(polygon)) > 2 * CELL_AREA_EPS) {
      result.push({ polygon, bounds: polygonBounds(polygon) });
    }
  }
  return result;
}

function publicCoverage(
  filter: 'ce1' | 'ce2',
  strictEps: number,
  pieces: CoveragePiece[],
): CUnionCoverageInternal {
  return {
    filter,
    strictEps,
    polygonCount: pieces.length,
    polygons: pieces.map((piece) => piece.polygon),
    pieces,
  };
}

function getLayerCoverage(
  model: CUnionModelInternal,
  strictEps: number,
): LayerCoveragePair {
  const cached = model.layerCoverageCache.get(strictEps);
  if (cached) {
    model.layerCoverageCache.delete(strictEps);
    model.layerCoverageCache.set(strictEps, cached);
    return cached;
  }
  const pair = {
    ce1: publicCoverage('ce1', strictEps, buildCoveragePieces(model.cells.ce1, strictEps)),
    ce2: publicCoverage('ce2', strictEps, buildCoveragePieces(model.cells.ce2, strictEps)),
  };
  model.layerCoverageCache.set(strictEps, pair);
  while (model.layerCoverageCache.size > COVERAGE_CACHE_LIMIT) {
    const oldestEps = model.layerCoverageCache.keys().next().value;
    if (oldestEps === undefined) break;
    model.layerCoverageCache.delete(oldestEps);
    for (const filter of ['ce1', 'ce2', 'both'] as const) {
      model.coverageCache.delete(`${filter}:${oldestEps}`);
    }
  }
  return pair;
}

function rayIntervalOnConvexPolygon(direction: Point, polygon: readonly Point[]): [number, number] | null {
  let tMin = 0;
  let tMax = Infinity;
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index];
    const edge = subtract(polygon[(index + 1) % polygon.length], start);
    const base = cross(edge, { x: -start.x, y: -start.y });
    const slope = cross(edge, direction);
    if (Math.abs(slope) <= GEOMETRY_EPS) {
      if (base < -GEOMETRY_EPS) return null;
      continue;
    }
    const root = -base / slope;
    if (slope > 0) {
      tMin = Math.max(tMin, root);
    } else {
      tMax = Math.min(tMax, root);
    }
    if (tMin > tMax + GEOMETRY_EPS) return null;
  }
  if (!Number.isFinite(tMax) || tMax < Math.max(0, tMin) - GEOMETRY_EPS) return null;
  return [Math.max(0, tMin), Math.max(0, tMax)];
}

async function buildRadialBoundary(
  coverage: CUnionCoverageInternal,
  progressStart: number,
  progressEnd: number,
  reportProgress: (progress: number) => void,
): Promise<{ points: Point[]; radii: Float64Array }> {
  const radii = new Float64Array(C_UNION_BOUNDARY_RAY_COUNT);
  const total = Math.max(1, coverage.pieces.length);
  for (let pieceIndex = 0; pieceIndex < coverage.pieces.length; pieceIndex++) {
    const polygon = coverage.pieces[pieceIndex].polygon;
    for (let rayIndex = 0; rayIndex < BOUNDARY_DIRECTIONS.length; rayIndex++) {
      const interval = rayIntervalOnConvexPolygon(BOUNDARY_DIRECTIONS[rayIndex], polygon);
      if (interval && interval[1] > radii[rayIndex]) radii[rayIndex] = interval[1];
    }
    if ((pieceIndex + 1) % CONTOUR_YIELD_STRIDE === 0) {
      reportProgress(
        progressStart + (progressEnd - progressStart) * (pieceIndex + 1) / total,
      );
      await yieldToHost();
    }
  }
  reportProgress(progressEnd);
  return {
    radii,
    points: BOUNDARY_DIRECTIONS.map((direction, index) => ({
      x: direction.x * radii[index],
      y: direction.y * radii[index],
    })),
  };
}

function emptyCounts(): CUnionCounts {
  return {
    orientationCount: C_UNION_ORIENTATION_COUNT,
    feasibleCellCount: 0,
    ce1CellCount: 0,
    ce2CellCount: 0,
    ce1CoveragePolygonCount: 0,
    ce2CoveragePolygonCount: 0,
  };
}

function reportBuildProgress(progress: number): void {
  activeBuildProgress = Math.max(activeBuildProgress, Math.max(0, Math.min(1, progress)));
  for (const listener of progressListeners) {
    try {
      listener(activeBuildProgress);
    } catch {
      // A UI progress callback must not invalidate the geometry build.
    }
  }
}

function yieldToHost(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function buildModel(): Promise<CUnionModelInternal> {
  const cells: CUnionModelInternal['cells'] = { ce1: [], ce2: [] };
  const counts = emptyCounts();
  reportBuildProgress(0);

  for (let index = 0; index < C_UNION_ORIENTATION_COUNT; index++) {
    const angle = ANGLE_PERIOD * index / C_UNION_ORIENTATION_COUNT;
    const result = partitionOrientation(angle);
    counts.feasibleCellCount += result.feasibleCellCount;
    cells.ce1.push(...result.ce1);
    cells.ce2.push(...result.ce2);
    if ((index + 1) % ORIENTATION_YIELD_STRIDE === 0) {
      reportBuildProgress(0.72 * (index + 1) / C_UNION_ORIENTATION_COUNT);
      await yieldToHost();
    }
  }

  counts.ce1CellCount = cells.ce1.length;
  counts.ce2CellCount = cells.ce2.length;
  const model: CUnionModelInternal = {
    status: 'ready',
    counts,
    orientationCount: C_UNION_ORIENTATION_COUNT,
    boundaryRayCount: C_UNION_BOUNDARY_RAY_COUNT,
    cells,
    boundaries: { ce1: [], ce2: [], both: [] },
    layerCoverageCache: new Map(),
    coverageCache: new Map(),
  };

  const closureCoverage = getLayerCoverage(model, 0);
  counts.ce1CoveragePolygonCount = closureCoverage.ce1.polygonCount;
  counts.ce2CoveragePolygonCount = closureCoverage.ce2.polygonCount;
  const totalPieces = Math.max(1, closureCoverage.ce1.polygonCount + closureCoverage.ce2.polygonCount);
  const splitProgress = 0.72 + 0.27 * closureCoverage.ce1.polygonCount / totalPieces;
  const ce1Boundary = await buildRadialBoundary(
    closureCoverage.ce1,
    0.72,
    splitProgress,
    reportBuildProgress,
  );
  const ce2Boundary = await buildRadialBoundary(
    closureCoverage.ce2,
    splitProgress,
    0.99,
    reportBuildProgress,
  );
  model.boundaries.ce1 = ce1Boundary.points;
  model.boundaries.ce2 = ce2Boundary.points;
  model.boundaries.both = BOUNDARY_DIRECTIONS.map((direction, index) => {
    const radius = Math.max(ce1Boundary.radii[index], ce2Boundary.radii[index]);
    return { x: direction.x * radius, y: direction.y * radius };
  });
  reportBuildProgress(1);
  return model;
}

/** Builds and page-lifetime caches the sampled C-union model. */
export async function buildCUnionModel(
  onProgress?: (progress: number) => void,
): Promise<CUnionModel> {
  if (cachedModel) {
    onProgress?.(1);
    return cachedModel;
  }
  if (onProgress) {
    progressListeners.add(onProgress);
    onProgress(activeBuildProgress);
  }
  if (!activeBuild) {
    activeBuildProgress = 0;
    activeBuild = buildModel().then((model) => {
      cachedModel = model;
      return model;
    }).catch((error: unknown) => {
      activeBuild = null;
      activeBuildProgress = 0;
      throw error;
    });
  }

  try {
    return await activeBuild;
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

function internalModel(model: CUnionModel): CUnionModelInternal {
  return model as CUnionModelInternal;
}

function internalCoverage(coverage: CUnionCoverage): CUnionCoverageInternal {
  return coverage as CUnionCoverageInternal;
}

export function getCUnionCoverage(
  modelInput: CUnionModel,
  filter: CUnionCeFilter,
  strictEps: number,
): CUnionCoverage {
  const model = internalModel(modelInput);
  const eps = normalizedStrictEps(strictEps);
  const cacheKey = `${filter}:${eps}`;
  const cached = model.coverageCache.get(cacheKey);
  if (cached) {
    getLayerCoverage(model, eps);
    model.coverageCache.delete(cacheKey);
    model.coverageCache.set(cacheKey, cached);
    return cached;
  }

  const layers = getLayerCoverage(model, eps);
  if (filter !== 'both') {
    const coverage = layers[filter];
    model.coverageCache.set(cacheKey, coverage);
    return coverage;
  }

  const pieces = [...layers.ce1.pieces, ...layers.ce2.pieces];
  const coverage: CUnionCoverageInternal = {
    filter,
    strictEps: eps,
    polygonCount: pieces.length,
    polygons: pieces.map((piece) => piece.polygon),
    pieces,
  };
  model.coverageCache.set(cacheKey, coverage);
  return coverage;
}

function pointInConvexPolygon(point: Point, polygon: readonly Point[]): boolean {
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (cross(subtract(end, start), subtract(point, start)) < -GEOMETRY_EPS) {
      return false;
    }
  }
  return true;
}

export function cUnionContainsPoint(coverageInput: CUnionCoverage, point: Point): boolean {
  const coverage = internalCoverage(coverageInput);
  for (const piece of coverage.pieces) {
    const bounds = piece.bounds;
    if (
      point.x < bounds.minX - GEOMETRY_EPS
      || point.x > bounds.maxX + GEOMETRY_EPS
      || point.y < bounds.minY - GEOMETRY_EPS
      || point.y > bounds.maxY + GEOMETRY_EPS
    ) {
      continue;
    }
    if (pointInConvexPolygon(point, piece.polygon)) return true;
  }
  return false;
}

function intervalOnSegment(
  polygon: readonly Point[],
  start: Point,
  end: Point,
): [number, number] | null {
  const direction = subtract(end, start);
  let tMin = 0;
  let tMax = 1;
  for (let index = 0; index < polygon.length; index++) {
    const edgeStart = polygon[index];
    const edge = subtract(polygon[(index + 1) % polygon.length], edgeStart);
    const base = cross(edge, subtract(start, edgeStart));
    const delta = cross(edge, direction);
    if (Math.abs(delta) <= GEOMETRY_EPS) {
      if (base < -GEOMETRY_EPS) return null;
      continue;
    }
    const root = -base / delta;
    if (delta > 0) {
      tMin = Math.max(tMin, root);
    } else {
      tMax = Math.min(tMax, root);
    }
    if (tMin > tMax + INTERVAL_EPS) return null;
  }
  tMin = Math.max(0, tMin);
  tMax = Math.min(1, tMax);
  return tMax >= tMin + INTERVAL_EPS ? [tMin, tMax] : null;
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1] + INTERVAL_EPS) {
      merged.push([interval[0], interval[1]]);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }
  return merged;
}

export function cUnionIntervalsOnSegment(
  coverageInput: CUnionCoverage,
  start: Point,
  end: Point,
): Array<[number, number]> {
  const coverage = internalCoverage(coverageInput);
  const segmentBounds: Bounds = {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
  const intervals: Array<[number, number]> = [];
  for (const piece of coverage.pieces) {
    if (
      piece.bounds.maxX < segmentBounds.minX - GEOMETRY_EPS
      || piece.bounds.minX > segmentBounds.maxX + GEOMETRY_EPS
      || piece.bounds.maxY < segmentBounds.minY - GEOMETRY_EPS
      || piece.bounds.minY > segmentBounds.maxY + GEOMETRY_EPS
    ) {
      continue;
    }
    const interval = intervalOnSegment(piece.polygon, start, end);
    if (interval) intervals.push(interval);
  }
  return mergeIntervals(intervals);
}

function intersectIntervalLists(
  first: Array<[number, number]>,
  second: Array<[number, number]>,
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (const a of first) {
    for (const b of second) {
      const start = Math.max(a[0], b[0]);
      const end = Math.min(a[1], b[1]);
      if (end >= start + INTERVAL_EPS) result.push([start, end]);
    }
  }
  return mergeIntervals(result);
}

function angleInequalityIntervals(
  cosCoefficient: number,
  sinCoefficient: number,
  constant: number,
  minAngle: number,
  maxAngle: number,
): Array<[number, number]> {
  const amplitude = Math.hypot(cosCoefficient, sinCoefficient);
  if (amplitude <= GEOMETRY_EPS) {
    return constant >= -GEOMETRY_EPS ? [[minAngle, maxAngle]] : [];
  }

  const threshold = -(constant + GEOMETRY_EPS) / amplitude;
  if (threshold <= -1) return [[minAngle, maxAngle]];
  if (threshold > 1) return [];

  const center = Math.atan2(sinCoefficient, cosCoefficient);
  const radius = Math.acos(Math.max(-1, Math.min(1, threshold)));
  const result: Array<[number, number]> = [];
  const firstTurn = Math.floor((minAngle - center - radius) / (2 * Math.PI)) - 1;
  const lastTurn = Math.ceil((maxAngle - center + radius) / (2 * Math.PI)) + 1;
  for (let turn = firstTurn; turn <= lastTurn; turn++) {
    const shiftedCenter = center + turn * 2 * Math.PI;
    const start = Math.max(minAngle, shiftedCenter - radius);
    const end = Math.min(maxAngle, shiftedCenter + radius);
    if (end >= start + INTERVAL_EPS) result.push([start, end]);
  }
  return mergeIntervals(result);
}

function intervalsOnArcForPolygon(
  polygon: readonly Point[],
  arc: CUnionArc,
): Array<[number, number]> {
  if (Math.abs(arc.sweep) <= GEOMETRY_EPS) {
    const point = {
      x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
      y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
    };
    return pointInConvexPolygon(point, polygon) ? [[0, 1]] : [];
  }

  const minAngle = Math.min(arc.startAngle, arc.startAngle + arc.sweep);
  const maxAngle = Math.max(arc.startAngle, arc.startAngle + arc.sweep);
  let allowed: Array<[number, number]> = [[minAngle, maxAngle]];
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index];
    const edge = subtract(polygon[(index + 1) % polygon.length], start);
    const centerOffset = subtract(arc.center, start);
    const constant = cross(edge, centerOffset);
    const cosCoefficient = -arc.radius * edge.y;
    const sinCoefficient = arc.radius * edge.x;
    allowed = intersectIntervalLists(
      allowed,
      angleInequalityIntervals(
        cosCoefficient,
        sinCoefficient,
        constant,
        minAngle,
        maxAngle,
      ),
    );
    if (allowed.length === 0) return [];
  }

  return allowed.map(([startAngle, endAngle]) => {
    const first = (startAngle - arc.startAngle) / arc.sweep;
    const second = (endAngle - arc.startAngle) / arc.sweep;
    return [
      Math.max(0, Math.min(1, Math.min(first, second))),
      Math.max(0, Math.min(1, Math.max(first, second))),
    ];
  });
}

export function cUnionIntervalsOnArc(
  coverageInput: CUnionCoverage,
  arc: CUnionArc,
): Array<[number, number]> {
  const coverage = internalCoverage(coverageInput);
  const intervals = coverage.pieces.flatMap((piece) =>
    intervalsOnArcForPolygon(piece.polygon, arc),
  );
  return mergeIntervals(intervals);
}

export function cUnionBoundaryPoints(
  modelInput: CUnionModel,
  filter: CUnionCeFilter,
): readonly Point[] {
  return internalModel(modelInput).boundaries[filter];
}
