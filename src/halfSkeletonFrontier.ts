export interface Point {
  x: number;
  y: number;
}

export interface Interval {
  start: number;
  end: number;
}

export interface VSample {
  kind: 'v';
  caseId: string;
  label: string;
  a: number;
  b: number;
}

export interface CSample {
  kind: 'c';
  caseId: 'ce1-m0' | 'ce2-m0';
  label: string;
  edge01: Interval;
  edge50?: Interval;
}

export interface RejectedSample {
  triangleId: 'C' | 'V0';
  reason: string;
}

export interface SamplingStore {
  v: VSample[];
  c: CSample[];
  rejected: RejectedSample[];
}

export type VClassification =
  | { ok: true; sample: VSample }
  | { ok: false; rejected: RejectedSample };

export type CClassification =
  | { ok: true; sample: CSample }
  | { ok: false; rejected: RejectedSample };

export interface VCaseSummary {
  caseId: string;
  label: string;
  samples: VSample[];
  pareto: VSample[];
}

export interface CCaseSummary {
  caseId: CSample['caseId'];
  label: string;
  samples: CSample[];
  maximal: CSample[];
}

const SQRT3 = Math.sqrt(3);
const EPS = 1e-7;

const C = { x: 0, y: 0 };
const V0 = { x: 1, y: 0 };
const V1 = { x: 0.5, y: SQRT3 / 2 };
const V2 = { x: -0.5, y: SQRT3 / 2 };
const V3 = { x: -1, y: 0 };
const V4 = { x: -0.5, y: -SQRT3 / 2 };
const V5 = { x: 0.5, y: -SQRT3 / 2 };
const HEX = [V0, V1, V2, V3, V4, V5];
const MIDPOINTS = HEX.map((vertex) => ({ x: vertex.x / 2, y: vertex.y / 2 }));
const LOCAL_MIDPOINTS = [5, 0, 1];

interface VCase {
  id: string;
  label: string;
  o: number;
  n: number;
  subsetKey: string;
}

const V_CASES: VCase[] = [
  { id: 'vd0-o1-empty', label: 'Vd0 o=1,n=0: empty', o: 1, n: 0, subsetKey: '' },
  { id: 'vd0-o2-m0', label: 'Vd0 o=2,n=0: {M0}', o: 2, n: 0, subsetKey: '0' },
  { id: 'vd1-empty', label: 'Vd1 o=1,n=1: empty', o: 1, n: 1, subsetKey: '' },
  { id: 'vd1-m0', label: 'Vd1 o=1,n=1: {M0}', o: 1, n: 1, subsetKey: '0' },
  { id: 'vd1-m1', label: 'Vd1 o=1,n=1: {M1}', o: 1, n: 1, subsetKey: '1' },
  { id: 'vd1-m5', label: 'Vd1 o=1,n=1: {M5}', o: 1, n: 1, subsetKey: '5' },
  { id: 'vd1-m0-m1', label: 'Vd1 o=1,n=1: {M0,M1}', o: 1, n: 1, subsetKey: '0,1' },
  { id: 'vd1-m0-m5', label: 'Vd1 o=1,n=1: {M0,M5}', o: 1, n: 1, subsetKey: '0,5' },
  { id: 'vd2-m0', label: 'Vd2 o=1,n=2: {M0}', o: 1, n: 2, subsetKey: '0' },
  { id: 'vd2-m0-m1', label: 'Vd2 o=1,n=2: {M0,M1}', o: 1, n: 2, subsetKey: '0,1' },
  { id: 'vd2-m0-m5', label: 'Vd2 o=1,n=2: {M0,M5}', o: 1, n: 2, subsetKey: '0,5' },
  { id: 'vd2-m0-m1-m5', label: 'Vd2 o=1,n=2: {M0,M1,M5}', o: 1, n: 2, subsetKey: '0,1,5' },
  { id: 't3-m1', label: 'T3-like o=2,n=1: {M1}', o: 2, n: 1, subsetKey: '1' },
  { id: 't3-m5', label: 'T3-like o=2,n=1: {M5}', o: 2, n: 1, subsetKey: '5' },
];

export const EMPTY_SAMPLING_STORE: SamplingStore = { v: [], c: [], rejected: [] };

function cross(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function closedPointInTriangle(point: Point, vertices: [Point, Point, Point]): boolean {
  return vertices.every((vertex, index) => cross(vertex, vertices[(index + 1) % 3], point) >= -EPS);
}

function closedPointInHexagon(point: Point): boolean {
  return HEX.every((vertex, index) => cross(vertex, HEX[(index + 1) % HEX.length], point) >= -EPS);
}

function segmentInterval(
  start: Point,
  end: Point,
  vertices: [Point, Point, Point],
): Interval | null {
  let tMin = 0;
  let tMax = 1;
  const direction = { x: end.x - start.x, y: end.y - start.y };

  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const base = cross(a, b, start);
    const delta = (b.x - a.x) * direction.y - (b.y - a.y) * direction.x;
    if (Math.abs(delta) < EPS) {
      if (base < -EPS) return null;
      continue;
    }
    const root = -base / delta;
    if (delta > 0) tMin = Math.max(tMin, root);
    else tMax = Math.min(tMax, root);
    if (tMin > tMax - EPS) return null;
  }

  if (tMax <= tMin + EPS) return null;
  return { start: clamp01(tMin), end: clamp01(tMax) };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isInteriorInterval(interval: Interval): boolean {
  return interval.start > EPS && interval.end < 1 - EPS;
}

function outsideVertexCount(vertices: [Point, Point, Point]): number {
  return vertices.filter((vertex) => !closedPointInHexagon(vertex)).length;
}

function adjacentRayIntersectionCount(vertices: [Point, Point, Point]): number {
  return [
    segmentInterval(C, V5, vertices),
    segmentInterval(C, V1, vertices),
  ].filter((interval) => interval && interval.end > interval.start + EPS).length;
}

function localMidpointSubsetKey(vertices: [Point, Point, Point]): string {
  return LOCAL_MIDPOINTS
    .filter((index) => closedPointInTriangle(MIDPOINTS[index], vertices))
    .sort((a, b) => a - b)
    .join(',');
}

function exactCenterMidpointSubsetKey(vertices: [Point, Point, Point]): string {
  return MIDPOINTS
    .flatMap((point, index) => closedPointInTriangle(point, vertices) ? [index] : [])
    .join(',');
}

function caseFor(o: number, n: number, subsetKey: string): VCase | null {
  return V_CASES.find((candidate) =>
    candidate.o === o && candidate.n === n && candidate.subsetKey === subsetKey,
  ) ?? null;
}

export function classifyV0Sample(vertices: [Point, Point, Point], _strictEps: number): VClassification {
  const aInterval = segmentInterval(V0, V5, vertices);
  const bInterval = segmentInterval(V0, V1, vertices);
  if (!aInterval || !bInterval) {
    return { ok: false, rejected: { triangleId: 'V0', reason: 'T0 does not cover both local boundary branches from V0.' } };
  }

  const o = outsideVertexCount(vertices);
  const n = adjacentRayIntersectionCount(vertices);
  const subsetKey = localMidpointSubsetKey(vertices);
  const matched = caseFor(o, n, subsetKey);
  if (!matched) {
    const subset = subsetKey ? `{M${subsetKey.split(',').join(',M')}}` : 'empty';
    return {
      ok: false,
      rejected: { triangleId: 'V0', reason: `unlisted V0 case o=${o}, n=${n}, subset=${subset}.` },
    };
  }

  return {
    ok: true,
    sample: {
      kind: 'v',
      caseId: matched.id,
      label: matched.label,
      a: clamp01(aInterval.end),
      b: clamp01(bInterval.end),
    },
  };
}

export function classifyCSample(vertices: [Point, Point, Point], _strictEps: number): CClassification {
  const subsetKey = exactCenterMidpointSubsetKey(vertices);
  if (subsetKey !== '0') {
    const subset = subsetKey ? `{M${subsetKey.split(',').join(',M')}}` : 'empty';
    return { ok: false, rejected: { triangleId: 'C', reason: `TC midpoint subset is ${subset}, not exact {M0}.` } };
  }

  const intervals = HEX.map((vertex, index) => ({
    index,
    interval: segmentInterval(vertex, HEX[(index + 1) % HEX.length], vertices),
  })).filter(({ interval }) => interval && interval.end > interval.start + EPS);

  if (intervals.length === 1 && intervals[0].index === 0 && intervals[0].interval && isInteriorInterval(intervals[0].interval)) {
    return {
      ok: true,
      sample: {
        kind: 'c',
        caseId: 'ce1-m0',
        label: 'CE1 exact {M0}: e0,1',
        edge01: intervals[0].interval,
      },
    };
  }

  const edge50 = intervals.find((entry) => entry.index === 5)?.interval;
  const edge01 = intervals.find((entry) => entry.index === 0)?.interval;
  if (intervals.length === 2 && edge50 && edge01) {
    return {
      ok: true,
      sample: {
        kind: 'c',
        caseId: 'ce2-m0',
        label: 'CE2 exact {M0}: e5,0 + e0,1',
        edge50,
        edge01,
      },
    };
  }

  return {
    ok: false,
    rejected: { triangleId: 'C', reason: `TC has ${intervals.length} edge overlap(s), not supported CE1/CE2 exact {M0}.` },
  };
}

function sameVSample(a: VSample, b: VSample): boolean {
  return a.caseId === b.caseId && Math.abs(a.a - b.a) < 5e-5 && Math.abs(a.b - b.b) < 5e-5;
}

function sameCSample(a: CSample, b: CSample): boolean {
  return a.caseId === b.caseId &&
    Math.abs(a.edge01.start - b.edge01.start) < 5e-5 &&
    Math.abs(a.edge01.end - b.edge01.end) < 5e-5 &&
    Math.abs((a.edge50?.start ?? -1) - (b.edge50?.start ?? -1)) < 5e-5 &&
    Math.abs((a.edge50?.end ?? -1) - (b.edge50?.end ?? -1)) < 5e-5;
}

export function addSample(store: SamplingStore, sample: VSample | CSample): SamplingStore {
  if (sample.kind === 'v') {
    if (store.v.some((candidate) => sameVSample(candidate, sample))) return store;
    return { ...store, v: [...store.v, sample] };
  }
  if (store.c.some((candidate) => sameCSample(candidate, sample))) return store;
  return { ...store, c: [...store.c, sample] };
}

export function addRejectedSample(store: SamplingStore, rejected: RejectedSample): SamplingStore {
  const last = store.rejected[store.rejected.length - 1];
  if (last?.triangleId === rejected.triangleId && last.reason === rejected.reason) return store;
  return { ...store, rejected: [...store.rejected.slice(-99), rejected] };
}

function dominatesV(a: VSample, b: VSample): boolean {
  return a.a >= b.a - EPS && a.b >= b.b - EPS && (a.a > b.a + EPS || a.b > b.b + EPS);
}

function containsInterval(a: Interval, b: Interval): boolean {
  return a.start <= b.start + EPS && a.end >= b.end - EPS;
}

function dominatesC(a: CSample, b: CSample): boolean {
  if (a.caseId !== b.caseId) return false;
  if (!containsInterval(a.edge01, b.edge01)) return false;
  if (a.caseId === 'ce2-m0') {
    if (!a.edge50 || !b.edge50 || !containsInterval(a.edge50, b.edge50)) return false;
  }
  return a.edge01.start < b.edge01.start - EPS ||
    a.edge01.end > b.edge01.end + EPS ||
    (a.edge50 !== undefined && b.edge50 !== undefined && (
      a.edge50.start < b.edge50.start - EPS || a.edge50.end > b.edge50.end + EPS
    ));
}

export function summarizeVSamples(samples: VSample[]): VCaseSummary[] {
  return V_CASES.map((caseInfo) => {
    const group = samples.filter((sample) => sample.caseId === caseInfo.id);
    return {
      caseId: caseInfo.id,
      label: caseInfo.label,
      samples: group,
      pareto: group
        .filter((sample) => !group.some((candidate) => dominatesV(candidate, sample)))
        .sort((a, b) => a.a - b.a || b.b - a.b),
    };
  }).filter((summary) => summary.samples.length > 0);
}

export function summarizeCSamples(samples: CSample[]): CCaseSummary[] {
  return (['ce1-m0', 'ce2-m0'] as const).map((caseId) => {
    const group = samples.filter((sample) => sample.caseId === caseId);
    return {
      caseId,
      label: caseId === 'ce1-m0' ? 'CE1 exact {M0}' : 'CE2 exact {M0}',
      samples: group,
      maximal: group.filter((sample) => !group.some((candidate) => dominatesC(candidate, sample))),
    };
  }).filter((summary) => summary.samples.length > 0);
}
