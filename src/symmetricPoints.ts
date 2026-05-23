import { HEXAGON_VERTICES } from './hexagon';
import type { Point } from './types';

const EPS = 1e-9;

export interface SymmetricPointSeed {
  id: string;
  point: Point;
}

export interface SymmetricPointTarget {
  seedId: string;
  index: number;
  label: string;
  point: Point;
}

function rotate(point: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function nearlySamePoint(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= EPS;
}

export function pointInHexagon(point: Point): boolean {
  for (let i = 0; i < HEXAGON_VERTICES.length; i++) {
    const a = HEXAGON_VERTICES[i];
    const b = HEXAGON_VERTICES[(i + 1) % HEXAGON_VERTICES.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross < -EPS) {
      return false;
    }
  }
  return true;
}

export function d6Orbit(point: Point): Point[] {
  const reflected = { x: point.x, y: -point.y };
  const candidates = [point, reflected].flatMap((base) =>
    Array.from({ length: 6 }, (_, index) => rotate(base, index * Math.PI / 3)),
  );
  const unique: Point[] = [];
  for (const candidate of candidates) {
    if (!unique.some((existing) => nearlySamePoint(existing, candidate))) {
      unique.push(candidate);
    }
  }
  return unique;
}

export function buildSymmetricPointTargets(seeds: SymmetricPointSeed[]): SymmetricPointTarget[] {
  return seeds.flatMap((seed) =>
    d6Orbit(seed.point).map((point, index) => ({
      seedId: seed.id,
      index,
      label: `${seed.id}.${index + 1}`,
      point,
    })),
  );
}

export function nextPointSeedId(seeds: SymmetricPointSeed[]): string {
  const used = new Set(seeds.map((seed) => seed.id));
  let index = seeds.length + 1;
  while (used.has(`Q${index}`)) {
    index++;
  }
  return `Q${index}`;
}

export function sanitizePointSeeds(value: unknown): SymmetricPointSeed[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const used = new Set<string>();
  return value.flatMap((candidate, index): SymmetricPointSeed[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const seed = candidate as { id?: unknown; point?: unknown };
    const rawPoint = seed.point as Partial<Point> | undefined;
    if (
      !rawPoint ||
      typeof rawPoint.x !== 'number' ||
      typeof rawPoint.y !== 'number' ||
      !Number.isFinite(rawPoint.x) ||
      !Number.isFinite(rawPoint.y)
    ) {
      return [];
    }
    const point = { x: rawPoint.x, y: rawPoint.y };
    if (!pointInHexagon(point)) {
      return [];
    }
    const rawId = typeof seed.id === 'string' && /^[A-Za-z0-9_-]+$/.test(seed.id) ? seed.id : `Q${index + 1}`;
    let id = rawId;
    let suffix = 2;
    while (used.has(id)) {
      id = `${rawId}_${suffix}`;
      suffix++;
    }
    used.add(id);
    return [{ id, point }];
  });
}
