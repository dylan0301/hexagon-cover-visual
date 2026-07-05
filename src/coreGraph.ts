import * as THREE from 'three';
import {
  CORE_CASE_POINT_IDS,
  evaluateCoreCaseGraph,
  type CoreCaseGraphSample,
} from './coreCase';
import type { AbUnionLocalRegionVariant } from './abUnion';

const BOUNDARY_BAND_WIDTH = 0.12;
const DOMAIN_EPS = 1e-5;
const SURFACE_SCALE = 3.2;
const SURFACE_HEIGHT = 1.35;
const HEATMAP_PADDING = 44;
const FONT_SIZE = 12;
const MINIMUM_CURVE_COLOR = '#d946ef';
const MINIMUM_CURVE_Z_OFFSET = 0.035;
const SPECIAL_CURVE_NEIGHBORHOOD_B_WIDTH = 0.03;
const SPECIAL_CURVE_DENSE_B_OFFSETS = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];

export const CORE_GRAPH_SAMPLE_RATES = ['high', 'medium', 'low'] as const;
export type CoreGraphSampleRate = typeof CORE_GRAPH_SAMPLE_RATES[number];

interface SampleProfile {
  aCount: number;
  sCount: number;
  boundaryBandCount: number;
}

interface GridSamples {
  a: number[];
  s: number[];
}

type MinimumCurve = Array<GridNode | null>;

const SAMPLE_PROFILES: Record<CoreGraphSampleRate, SampleProfile> = {
  high: { aCount: 128, sCount: 96, boundaryBandCount: 64 },
  medium: { aCount: 64, sCount: 48, boundaryBandCount: 32 },
  low: { aCount: 32, sCount: 24, boundaryBandCount: 16 },
};

interface GridNode {
  a: number;
  b: number;
  s: number;
  side: number | null;
  t: number;
}

interface GridData {
  samples: GridSamples;
  nodes: GridNode[];
  minimumCurve: MinimumCurve;
  minSide: number;
  maxSide: number;
}

interface CanvasPoint {
  x: number;
  y: number;
}

interface PlotRect {
  x: number;
  y: number;
  size: number;
}

export interface CoreGraphRenderer {
  render(): void;
  resize(): void;
  setSelection(a: number, b: number): void;
  getSelection(): CoreCaseGraphSample;
  setSliceK(value: number): void;
  getSliceK(): number;
  getRange(): { min: number; max: number };
  setSampleRate(value: CoreGraphSampleRate): void;
  getSampleRate(): CoreGraphSampleRate;
  setDenseSpecialCurveSampling(value: boolean): void;
  getDenseSpecialCurveSampling(): boolean;
  setSpecialCurveNeighborhoodOnly(value: boolean): void;
  getSpecialCurveNeighborhoodOnly(): boolean;
  setStrictTwoLineSuperset(value: boolean): void;
  getStrictTwoLineSuperset(): boolean;
  setEnabledPointIds(ids: readonly string[]): void;
  getEnabledPointIds(): string[];
  setOnSelectionChange(callback: (sample: CoreCaseGraphSample) => void): void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function finiteSide(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function normalizeEnabledPointIds(ids: readonly string[]): string[] {
  const requested = new Set(ids);
  return CORE_CASE_POINT_IDS.filter((id) => requested.has(id));
}

function colorStops(t: number): [number, number, number] {
  const stops: Array<[number, number, number, number]> = [
    [0, 37, 99, 235],
    [0.35, 20, 184, 166],
    [0.68, 245, 158, 11],
    [1, 220, 38, 38],
  ];
  const clamped = clamp01(t);
  for (let i = 1; i < stops.length; i++) {
    const previous = stops[i - 1];
    const next = stops[i];
    if (clamped <= next[0]) {
      const local = (clamped - previous[0]) / Math.max(1e-9, next[0] - previous[0]);
      return [
        Math.round(previous[1] + (next[1] - previous[1]) * local),
        Math.round(previous[2] + (next[2] - previous[2]) * local),
        Math.round(previous[3] + (next[3] - previous[3]) * local),
      ];
    }
  }
  return [220, 38, 38];
}

function cssColor(t: number): string {
  const [r, g, b] = colorStops(t);
  return `rgb(${r}, ${g}, ${b})`;
}

function cosine01(index: number, count: number): number {
  if (count <= 0) return 0;
  return 0.5 - 0.5 * Math.cos(Math.PI * index / count);
}

function uniqueSortedSamples(values: number[]): number[] {
  return values
    .map(clamp01)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > 1e-9);
}

function buildASamples(count: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => cosine01(index, count));
}

function buildSSamples(count: number, boundaryBandCount: number): number[] {
  const samples = Array.from({ length: count + 1 }, (_, index) => cosine01(index, count));
  for (let index = 1; index <= boundaryBandCount; index++) {
    const t = BOUNDARY_BAND_WIDTH * (index / boundaryBandCount) ** 2;
    samples.push(t, 1 - t);
  }
  return uniqueSortedSamples(samples);
}

function domainSFromB(a: number, b: number): number | null {
  const bLow = 1 - a + DOMAIN_EPS;
  const bHigh = upperBoundary(a);
  const width = bHigh - bLow;
  if (width <= 1e-12) return null;
  const s = (b - bLow) / width;
  return s >= 0 && s <= 1 ? s : null;
}

function buildSamples(sampleRate: CoreGraphSampleRate, denseCurve: MinimumCurve | null = null): GridSamples {
  const profile = SAMPLE_PROFILES[sampleRate];
  const s = buildSSamples(profile.sCount, profile.boundaryBandCount);
  if (denseCurve !== null) {
    for (const node of denseCurve) {
      if (node === null) continue;
      for (const offset of SPECIAL_CURVE_DENSE_B_OFFSETS) {
        const extraS = domainSFromB(node.a, node.b + offset);
        if (extraS !== null) {
          s.push(extraS);
        }
      }
    }
  }
  return {
    a: buildASamples(profile.aCount),
    s: uniqueSortedSamples(s),
  };
}

function upperBoundary(a: number): number {
  return (-a + Math.sqrt(Math.max(0, 4 - 3 * a * a))) / 2;
}

function sampleDomainNode(a: number, s: number): { a: number; b: number; valid: boolean } {
  const bLow = 1 - a + DOMAIN_EPS;
  const bHigh = upperBoundary(a);
  if (bLow > bHigh || bHigh < 0 || bLow > 1) {
    return { a, b: clamp01(bHigh), valid: false };
  }
  return {
    a,
    b: bLow + (bHigh - bLow) * s,
    valid: true,
  };
}

function buildGrid(
  enabledPointIds: readonly string[],
  sampleRate: CoreGraphSampleRate,
  variant: AbUnionLocalRegionVariant,
  denseCurve: MinimumCurve | null = null,
): GridData {
  const samples = buildSamples(sampleRate, denseCurve);
  const nodes: GridNode[] = [];
  let minSide = Number.POSITIVE_INFINITY;
  let maxSide = Number.NEGATIVE_INFINITY;

  for (const s of samples.s) {
    for (const a of samples.a) {
      const domain = sampleDomainNode(a, s);
      const sample = domain.valid
        ? evaluateCoreCaseGraph(domain.a, domain.b, enabledPointIds, variant)
        : null;
      const side = finiteSide(sample?.side ?? null) ? sample?.side ?? null : null;
      if (side !== null) {
        minSide = Math.min(minSide, side);
        maxSide = Math.max(maxSide, side);
      }
      nodes.push({ a: domain.a, b: domain.b, s, side, t: 0 });
    }
  }

  if (!Number.isFinite(minSide) || !Number.isFinite(maxSide) || maxSide <= minSide) {
    minSide = 0;
    maxSide = 1;
  }

  for (const node of nodes) {
    node.t = node.side === null ? 0 : (node.side - minSide) / (maxSide - minSide);
  }

  return {
    samples,
    nodes,
    minimumCurve: buildMinimumCurve(nodes, samples),
    minSide,
    maxSide,
  };
}

function gridIndex(i: number, j: number, samples: GridSamples): number {
  return j * samples.a.length + i;
}

function buildMinimumCurve(nodes: readonly GridNode[], samples: GridSamples): MinimumCurve {
  return samples.a.map((_, i) => {
    let best: GridNode | null = null;
    for (let j = 1; j < samples.s.length - 1; j++) {
      const previous = nodes[gridIndex(i, j - 1, samples)];
      const node = nodes[gridIndex(i, j, samples)];
      const next = nodes[gridIndex(i, j + 1, samples)];
      if (!finiteSide(previous.side) || !finiteSide(node.side) || !finiteSide(next.side)) {
        continue;
      }
      if (
        node.side <= previous.side &&
        node.side <= next.side &&
        (best === null || node.side < (best.side ?? Number.POSITIVE_INFINITY))
      ) {
        best = node;
      }
    }
    return best;
  });
}

function interpolateCurveB(curve: MinimumCurve, a: number): number | null {
  let previous: GridNode | null = null;
  for (const node of curve) {
    if (node === null) continue;
    if (Math.abs(node.a - a) < 1e-12) return node.b;
    if (node.a > a) {
      if (previous === null) return null;
      const t = (a - previous.a) / Math.max(1e-12, node.a - previous.a);
      return previous.b + (node.b - previous.b) * clamp01(t);
    }
    previous = node;
  }
  return previous !== null && Math.abs(previous.a - a) < 1e-12 ? previous.b : null;
}

function isInSpecialCurveNeighborhood(a: number, b: number, specialCurve: MinimumCurve | null): boolean {
  if (specialCurve === null) return false;
  const curveB = interpolateCurveB(specialCurve, a);
  return curveB !== null && Math.abs(b - curveB) <= SPECIAL_CURVE_NEIGHBORHOOD_B_WIDTH;
}

function cellCenter(nodes: readonly GridNode[]): { a: number; b: number } {
  return {
    a: nodes.reduce((sum, node) => sum + node.a, 0) / nodes.length,
    b: nodes.reduce((sum, node) => sum + node.b, 0) / nodes.length,
  };
}

function isCellVisible(
  nodes: readonly GridNode[],
  specialCurve: MinimumCurve | null,
  specialCurveNeighborhoodOnly: boolean,
): boolean {
  if (!specialCurveNeighborhoodOnly) return true;
  const center = cellCenter(nodes);
  return isInSpecialCurveNeighborhood(center.a, center.b, specialCurve);
}

function surfacePosition(node: GridNode): [number, number, number] {
  return [
    (node.a - 0.5) * SURFACE_SCALE,
    (node.b - 0.5) * SURFACE_SCALE,
    node.t * SURFACE_HEIGHT,
  ];
}

function makeSurfaceGeometry(
  grid: GridData,
  specialCurve: MinimumCurve | null,
  specialCurveNeighborhoodOnly: boolean,
) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const node of grid.nodes) {
    positions.push(...surfacePosition(node));
    const [r, g, b] = colorStops(node.t);
    colors.push(r / 255, g / 255, b / 255);
  }

  for (let j = 0; j < grid.samples.s.length - 1; j++) {
    for (let i = 0; i < grid.samples.a.length - 1; i++) {
      const bottomLeft = gridIndex(i, j, grid.samples);
      const bottomRight = gridIndex(i + 1, j, grid.samples);
      const topLeft = gridIndex(i, j + 1, grid.samples);
      const topRight = gridIndex(i + 1, j + 1, grid.samples);
      if (
        grid.nodes[bottomLeft].side === null ||
        grid.nodes[bottomRight].side === null ||
        grid.nodes[topLeft].side === null ||
        grid.nodes[topRight].side === null
      ) {
        continue;
      }
      if (!isCellVisible(
        [grid.nodes[bottomLeft], grid.nodes[bottomRight], grid.nodes[topRight], grid.nodes[topLeft]],
        specialCurve,
        specialCurveNeighborhoodOnly,
      )) {
        continue;
      }
      indices.push(bottomLeft, bottomRight, topRight, bottomLeft, topRight, topLeft);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeMinimumCurveGeometry(nodes: MinimumCurve, zOffset: number) {
  const positions: number[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const start = nodes[i];
    const end = nodes[i + 1];
    if (start === null || end === null) continue;
    const startPosition = surfacePosition(start);
    const endPosition = surfacePosition(end);
    positions.push(
      startPosition[0],
      startPosition[1],
      startPosition[2] + zOffset,
      endPosition[0],
      endPosition[1],
      endPosition[2] + zOffset,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function makeBaseGrid() {
  const positions: number[] = [];
  const color = new THREE.Color('#94a3b8');

  function pushLine(a0: number, b0: number, a1: number, b1: number): void {
    positions.push((a0 - 0.5) * SURFACE_SCALE, (b0 - 0.5) * SURFACE_SCALE, 0);
    positions.push((a1 - 0.5) * SURFACE_SCALE, (b1 - 0.5) * SURFACE_SCALE, 0);
  }

  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    pushLine(tick, 0, tick, 1);
    pushLine(0, tick, 1, tick);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
  return new THREE.LineSegments(geometry, material);
}

function setCanvasSize2D(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cssSize: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(cssSize * dpr));
  canvas.height = Math.max(1, Math.round(cssSize * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function createCoreGraphRenderer(
  surfaceCanvas: HTMLCanvasElement,
  heatmapCanvas: HTMLCanvasElement,
): CoreGraphRenderer {
  const rawHeatmapContext = heatmapCanvas.getContext('2d');
  if (!rawHeatmapContext) {
    throw new Error('2D canvas not supported');
  }
  const heatmapContext: CanvasRenderingContext2D = rawHeatmapContext;

  let enabledPointIds = CORE_CASE_POINT_IDS.slice();
  let sampleRate: CoreGraphSampleRate = 'low';
  let denseSpecialCurveSampling = false;
  let specialCurveNeighborhoodOnly = false;
  let strictTwoLineSuperset = false;
  let specialCurve: MinimumCurve | null = null;
  let grid = buildGrid(enabledPointIds, sampleRate, currentLocalRegionVariant());
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.up.set(0, 0, 1);

  const webgl = new THREE.WebGLRenderer({
    canvas: surfaceCanvas,
    antialias: true,
  });
  webgl.setClearColor('#ffffff', 1);

  const surface = new THREE.Mesh(
    makeSurfaceGeometry(grid, null, specialCurveNeighborhoodOnly),
    new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.8,
      metalness: 0,
    }),
  );
  scene.add(surface);

  const minimumCurve = new THREE.LineSegments(
    makeMinimumCurveGeometry(grid.minimumCurve, MINIMUM_CURVE_Z_OFFSET),
    new THREE.LineBasicMaterial({ color: MINIMUM_CURVE_COLOR }),
  );
  scene.add(minimumCurve);

  scene.add(makeBaseGrid());
  scene.add(new THREE.AmbientLight('#ffffff', 1.9));
  const light = new THREE.DirectionalLight('#ffffff', 1.4);
  light.position.set(2, -3, 5);
  scene.add(light);

  const markerGeometry = new THREE.SphereGeometry(0.055, 18, 12);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: '#111827' });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  scene.add(marker);

  let surfaceWidth = 1;
  let surfaceHeight = 1;
  let heatmapSize = 1;
  let orbitTheta = -0.85;
  let orbitPhi = 0.65;
  let orbitRadius = 5.2;
  let draggingSurface = false;
  let draggingHeatmap = false;
  let activeSurfacePointer: number | null = null;
  let activeHeatmapPointer: number | null = null;
  let lastSurfacePoint: CanvasPoint | null = null;
  let sliceK = (grid.minSide + grid.maxSide) / 2;
  let selection = evaluateCoreCaseGraph(0.55, 0.55, enabledPointIds, currentLocalRegionVariant());
  let onSelectionChange: ((sample: CoreCaseGraphSample) => void) | null = null;

  function currentLocalRegionVariant(): AbUnionLocalRegionVariant {
    return strictTwoLineSuperset ? 'strict-two-line-superset' : 'exact';
  }

  function nearestValidSelection(): CoreCaseGraphSample | null {
    const nearest = grid.nodes
      .filter((node) => node.side !== null)
      .reduce((best, node) => {
        const score = Math.hypot(node.a - 0.55, node.b - 0.55);
        return score < best.score ? { score, node } : best;
      }, { score: Number.POSITIVE_INFINITY, node: null as GridNode | null }).node;
    return nearest ? evaluateCoreCaseGraph(nearest.a, nearest.b, enabledPointIds, currentLocalRegionVariant()) : null;
  }

  if (!selection.domainOk) {
    selection = nearestValidSelection() ?? selection;
  }

  function getSpecialCurve(): MinimumCurve {
    if (specialCurve === null) {
      specialCurve = buildGrid(CORE_CASE_POINT_IDS, 'high', currentLocalRegionVariant()).minimumCurve;
    }
    return specialCurve;
  }

  function specialCurveForNeighborhood(): MinimumCurve | null {
    return specialCurveNeighborhoodOnly ? getSpecialCurve() : null;
  }

  function refreshSurfaceGeometry(): void {
    const nextGeometry = makeSurfaceGeometry(grid, specialCurveForNeighborhood(), specialCurveNeighborhoodOnly);
    surface.geometry.dispose();
    surface.geometry = nextGeometry;
  }

  function normalizeSide(side: number): number {
    return (side - grid.minSide) / (grid.maxSide - grid.minSide);
  }

  function updateCamera(): void {
    const phi = clamp(orbitPhi, -0.05, 1.25);
    const target = new THREE.Vector3(0, 0, SURFACE_HEIGHT * 0.45);
    camera.position.set(
      orbitRadius * Math.cos(phi) * Math.cos(orbitTheta),
      orbitRadius * Math.cos(phi) * Math.sin(orbitTheta),
      SURFACE_HEIGHT * 0.45 + orbitRadius * Math.sin(phi),
    );
    camera.lookAt(target);
  }

  function updateMarker(): void {
    if (
      !finiteSide(selection.side) ||
      (
        specialCurveNeighborhoodOnly &&
        !isInSpecialCurveNeighborhood(selection.a, selection.b, getSpecialCurve())
      )
    ) {
      marker.visible = false;
      return;
    }
    marker.visible = true;
    const t = normalizeSide(selection.side);
    marker.position.set(
      (selection.a - 0.5) * SURFACE_SCALE,
      (selection.b - 0.5) * SURFACE_SCALE,
      t * SURFACE_HEIGHT + 0.065,
    );
  }

  function getNode(i: number, j: number): GridNode {
    return grid.nodes[gridIndex(i, j, grid.samples)];
  }

  function heatmapPlotRect(): PlotRect {
    const size = Math.max(1, heatmapSize - 2 * HEATMAP_PADDING);
    return { x: HEATMAP_PADDING, y: HEATMAP_PADDING, size };
  }

  function domainToHeatmap(a: number, b: number): CanvasPoint {
    const rect = heatmapPlotRect();
    return {
      x: rect.x + clamp01(a) * rect.size,
      y: rect.y + (1 - clamp01(b)) * rect.size,
    };
  }

  function heatmapToDomain(point: CanvasPoint): { a: number; b: number } {
    const rect = heatmapPlotRect();
    return {
      a: clamp01((point.x - rect.x) / rect.size),
      b: clamp01(1 - (point.y - rect.y) / rect.size),
    };
  }

  function getCanvasPoint(event: PointerEvent, canvas: HTMLCanvasElement, cssSize: number): CanvasPoint {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? cssSize / rect.width : 1;
    const scaleY = rect.height > 0 ? cssSize / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function isInsideHeatmapPlot(point: CanvasPoint): boolean {
    const rect = heatmapPlotRect();
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.size &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.size
    );
  }

  function applySelection(a: number, b: number, emit: boolean): void {
    const sample = evaluateCoreCaseGraph(clamp01(a), clamp01(b), enabledPointIds, currentLocalRegionVariant());
    if (!sample.domainOk) {
      return;
    }
    selection = sample;
    updateMarker();
    drawHeatmap();
    webgl.render(scene, camera);
    if (emit) {
      onSelectionChange?.(selection);
    }
  }

  function updateSelectionFromHeatmap(event: PointerEvent): void {
    const point = getCanvasPoint(event, heatmapCanvas, heatmapSize);
    if (!isInsideHeatmapPlot(point)) {
      return;
    }
    const { a, b } = heatmapToDomain(point);
    applySelection(a, b, true);
  }

  function drawHeatmapFrame(): void {
    const ctx = heatmapContext;
    const rect = heatmapPlotRect();
    ctx.clearRect(0, 0, heatmapSize, heatmapSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, heatmapSize, heatmapSize);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (const tick of [0.25, 0.5, 0.75]) {
      const vertical = domainToHeatmap(tick, 0);
      ctx.beginPath();
      ctx.moveTo(vertical.x, rect.y);
      ctx.lineTo(vertical.x, rect.y + rect.size);
      ctx.stroke();

      const horizontal = domainToHeatmap(0, tick);
      ctx.beginPath();
      ctx.moveTo(rect.x, horizontal.y);
      ctx.lineTo(rect.x + rect.size, horizontal.y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x, rect.y, rect.size, rect.size);

    ctx.fillStyle = '#334155';
    ctx.font = `${FONT_SIZE}px monospace`;
    ctx.fillText('a', rect.x + rect.size + 10, rect.y + rect.size + 4);
    ctx.fillText('b', rect.x - 4, rect.y - 12);
    ctx.fillText('0', rect.x - 10, rect.y + rect.size + FONT_SIZE + 5);
    ctx.fillText('1', rect.x + rect.size - 4, rect.y + rect.size + FONT_SIZE + 5);
    ctx.fillText('1', rect.x - FONT_SIZE - 5, rect.y + 4);
  }

  function drawHeatmapCells(): void {
    const ctx = heatmapContext;
    const neighborhoodCurve = specialCurveForNeighborhood();
    for (let j = 0; j < grid.samples.s.length - 1; j++) {
      for (let i = 0; i < grid.samples.a.length - 1; i++) {
        const corners = [
          getNode(i, j),
          getNode(i + 1, j),
          getNode(i + 1, j + 1),
          getNode(i, j + 1),
        ];
        if (corners.some((node) => node.side === null)) {
          continue;
        }
        if (!isCellVisible(corners, neighborhoodCurve, specialCurveNeighborhoodOnly)) {
          continue;
        }
        const t = corners.reduce((sum, node) => sum + node.t, 0) / corners.length;
        const points = corners.map((node) => domainToHeatmap(node.a, node.b));
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) {
          ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        ctx.fillStyle = cssColor(t);
        ctx.fill();
      }
    }
  }

  function interpolateContourPoint(start: GridNode, end: GridNode, level: number): CanvasPoint {
    const startSide = start.side ?? level;
    const endSide = end.side ?? level;
    const t = clamp01((level - startSide) / Math.max(1e-12, endSide - startSide));
    return domainToHeatmap(
      start.a + (end.a - start.a) * t,
      start.b + (end.b - start.b) * t,
    );
  }

  function drawContour(level: number, color: string, lineWidth: number): void {
    const ctx = heatmapContext;
    const neighborhoodCurve = specialCurveForNeighborhood();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    for (let j = 0; j < grid.samples.s.length - 1; j++) {
      for (let i = 0; i < grid.samples.a.length - 1; i++) {
        const corners = [
          getNode(i, j),
          getNode(i + 1, j),
          getNode(i + 1, j + 1),
          getNode(i, j + 1),
        ];
        if (corners.some((node) => node.side === null)) {
          continue;
        }
        if (!isCellVisible(corners, neighborhoodCurve, specialCurveNeighborhoodOnly)) {
          continue;
        }

        const hits: CanvasPoint[] = [];
        const edges: Array<[GridNode, GridNode]> = [
          [corners[0], corners[1]],
          [corners[1], corners[2]],
          [corners[2], corners[3]],
          [corners[3], corners[0]],
        ];
        for (const [start, end] of edges) {
          const startSide = start.side ?? level;
          const endSide = end.side ?? level;
          if (startSide === endSide) continue;
          if ((level >= startSide && level <= endSide) || (level >= endSide && level <= startSide)) {
            hits.push(interpolateContourPoint(start, end, level));
          }
        }

        if (hits.length === 2) {
          ctx.moveTo(hits[0].x, hits[0].y);
          ctx.lineTo(hits[1].x, hits[1].y);
        } else if (hits.length === 4) {
          ctx.moveTo(hits[0].x, hits[0].y);
          ctx.lineTo(hits[1].x, hits[1].y);
          ctx.moveTo(hits[2].x, hits[2].y);
          ctx.lineTo(hits[3].x, hits[3].y);
        }
      }
    }

    ctx.stroke();
  }

  function drawDomainBoundaries(): void {
    const ctx = heatmapContext;
    ctx.save();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 4]);

    const start = domainToHeatmap(0, 1);
    const end = domainToHeatmap(1, 0);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    for (let step = 0; step <= 240; step++) {
      const a = step / 240;
      const point = domainToHeatmap(a, upperBoundary(a));
      if (step === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCurve(curve: MinimumCurve, color: string, lineWidth: number, haloWidth: number): void {
    const ctx = heatmapContext;

    function strokeCurve(strokeColor: string, strokeWidth: number): void {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      let drawing = false;
      for (const node of curve) {
        if (node === null) {
          drawing = false;
          continue;
        }
        const point = domainToHeatmap(node.a, node.b);
        if (!drawing) {
          ctx.moveTo(point.x, point.y);
          drawing = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    }

    ctx.save();
    strokeCurve('rgba(255, 255, 255, 0.9)', haloWidth);
    strokeCurve(color, lineWidth);
    ctx.restore();
  }

  function drawMinimumCurves(): void {
    drawCurve(grid.minimumCurve, MINIMUM_CURVE_COLOR, 2.4, 5);
  }

  function drawSelectionMarker(): void {
    if (
      specialCurveNeighborhoodOnly &&
      !isInSpecialCurveNeighborhood(selection.a, selection.b, getSpecialCurve())
    ) {
      return;
    }
    const ctx = heatmapContext;
    const point = domainToHeatmap(selection.a, selection.b);
    ctx.save();
    ctx.strokeStyle = finiteSide(selection.side) ? '#111827' : '#64748b';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.4, 0, 2 * Math.PI);
    ctx.fillStyle = finiteSide(selection.side) ? '#111827' : '#64748b';
    ctx.fill();
    ctx.restore();
  }

  function drawHeatmap(): void {
    drawHeatmapFrame();
    drawHeatmapCells();
    drawDomainBoundaries();

    for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
      drawContour(grid.minSide + (grid.maxSide - grid.minSide) * fraction, 'rgba(255, 255, 255, 0.62)', 1.2);
    }
    drawContour(sliceK, '#111827', 2.2);
    drawMinimumCurves();
    drawSelectionMarker();
  }

  function resize(): void {
    const surfaceRect = surfaceCanvas.getBoundingClientRect();
    const nextSurfaceWidth = Math.max(1, Math.round(surfaceRect.width || 600));
    const nextSurfaceHeight = Math.max(1, Math.round(surfaceRect.height || 360));
    const nextDpr = window.devicePixelRatio || 1;
    if (surfaceWidth !== nextSurfaceWidth || surfaceHeight !== nextSurfaceHeight) {
      surfaceWidth = nextSurfaceWidth;
      surfaceHeight = nextSurfaceHeight;
      camera.aspect = surfaceWidth / surfaceHeight;
      camera.updateProjectionMatrix();
      webgl.setPixelRatio(nextDpr);
      webgl.setSize(surfaceWidth, surfaceHeight, false);
    }

    const heatmapRect = heatmapCanvas.getBoundingClientRect();
    const nextHeatmapSize = Math.max(1, Math.round(heatmapRect.width || 600));
    if (heatmapSize !== nextHeatmapSize) {
      heatmapSize = nextHeatmapSize;
      setCanvasSize2D(heatmapCanvas, heatmapContext, heatmapSize);
    }
  }

  function render(): void {
    resize();
    updateCamera();
    updateMarker();
    webgl.render(scene, camera);
    drawHeatmap();
  }

  function rebuildGrid(): void {
    grid = buildGrid(
      enabledPointIds,
      sampleRate,
      currentLocalRegionVariant(),
      denseSpecialCurveSampling ? getSpecialCurve() : null,
    );
    refreshSurfaceGeometry();
    const nextCurveGeometry = makeMinimumCurveGeometry(grid.minimumCurve, MINIMUM_CURVE_Z_OFFSET);
    minimumCurve.geometry.dispose();
    minimumCurve.geometry = nextCurveGeometry;
    sliceK = clamp(sliceK, grid.minSide, grid.maxSide);
    selection = evaluateCoreCaseGraph(selection.a, selection.b, enabledPointIds, currentLocalRegionVariant());
    if (!selection.domainOk) {
      selection = nearestValidSelection() ?? selection;
    }
    render();
  }

  surfaceCanvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    draggingSurface = true;
    activeSurfacePointer = event.pointerId;
    lastSurfacePoint = getCanvasPoint(event, surfaceCanvas, surfaceWidth);
    surfaceCanvas.setPointerCapture(event.pointerId);
    surfaceCanvas.style.cursor = 'grabbing';
    event.preventDefault();
  });

  surfaceCanvas.addEventListener('pointermove', (event) => {
    if (!draggingSurface || activeSurfacePointer !== event.pointerId || lastSurfacePoint === null) {
      return;
    }
    const point = getCanvasPoint(event, surfaceCanvas, surfaceWidth);
    orbitTheta -= (point.x - lastSurfacePoint.x) * 0.012;
    orbitPhi = clamp(orbitPhi + (point.y - lastSurfacePoint.y) * 0.009, -0.05, 1.25);
    lastSurfacePoint = point;
    render();
    event.preventDefault();
  });

  function stopSurfaceDrag(event: PointerEvent): void {
    if (activeSurfacePointer !== event.pointerId) return;
    draggingSurface = false;
    activeSurfacePointer = null;
    lastSurfacePoint = null;
    surfaceCanvas.style.cursor = 'grab';
  }

  surfaceCanvas.addEventListener('pointerup', stopSurfaceDrag);
  surfaceCanvas.addEventListener('pointercancel', stopSurfaceDrag);
  surfaceCanvas.addEventListener('wheel', (event) => {
    orbitRadius = clamp(orbitRadius + event.deltaY * 0.004, 3.2, 8);
    render();
    event.preventDefault();
  }, { passive: false });
  surfaceCanvas.addEventListener('pointerenter', () => {
    if (!draggingSurface) surfaceCanvas.style.cursor = 'grab';
  });
  surfaceCanvas.addEventListener('pointerleave', () => {
    if (!draggingSurface) surfaceCanvas.style.cursor = 'default';
  });

  heatmapCanvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    const point = getCanvasPoint(event, heatmapCanvas, heatmapSize);
    if (!isInsideHeatmapPlot(point)) return;
    draggingHeatmap = true;
    activeHeatmapPointer = event.pointerId;
    heatmapCanvas.setPointerCapture(event.pointerId);
    updateSelectionFromHeatmap(event);
    event.preventDefault();
  });

  heatmapCanvas.addEventListener('pointermove', (event) => {
    if (!draggingHeatmap || activeHeatmapPointer !== event.pointerId) return;
    updateSelectionFromHeatmap(event);
    event.preventDefault();
  });

  function stopHeatmapDrag(event: PointerEvent): void {
    if (activeHeatmapPointer !== event.pointerId) return;
    draggingHeatmap = false;
    activeHeatmapPointer = null;
  }

  heatmapCanvas.addEventListener('pointerup', stopHeatmapDrag);
  heatmapCanvas.addEventListener('pointercancel', stopHeatmapDrag);
  heatmapCanvas.addEventListener('pointermove', (event) => {
    if (draggingHeatmap) return;
    const point = getCanvasPoint(event, heatmapCanvas, heatmapSize);
    heatmapCanvas.style.cursor = isInsideHeatmapPlot(point) ? 'crosshair' : 'default';
  });
  heatmapCanvas.addEventListener('pointerleave', () => {
    if (!draggingHeatmap) heatmapCanvas.style.cursor = 'default';
  });

  updateCamera();
  updateMarker();

  return {
    render,
    resize,
    setSelection(a: number, b: number): void {
      applySelection(a, b, false);
    },
    getSelection(): CoreCaseGraphSample {
      return selection;
    },
    setSliceK(value: number): void {
      sliceK = clamp(value, grid.minSide, grid.maxSide);
      drawHeatmap();
    },
    getSliceK(): number {
      return sliceK;
    },
    getRange(): { min: number; max: number } {
      return { min: grid.minSide, max: grid.maxSide };
    },
    setSampleRate(value: CoreGraphSampleRate): void {
      if (value === sampleRate) return;
      sampleRate = value;
      rebuildGrid();
    },
    getSampleRate(): CoreGraphSampleRate {
      return sampleRate;
    },
    setDenseSpecialCurveSampling(value: boolean): void {
      if (value === denseSpecialCurveSampling) return;
      denseSpecialCurveSampling = value;
      rebuildGrid();
    },
    getDenseSpecialCurveSampling(): boolean {
      return denseSpecialCurveSampling;
    },
    setSpecialCurveNeighborhoodOnly(value: boolean): void {
      if (value === specialCurveNeighborhoodOnly) return;
      specialCurveNeighborhoodOnly = value;
      refreshSurfaceGeometry();
      render();
    },
    getSpecialCurveNeighborhoodOnly(): boolean {
      return specialCurveNeighborhoodOnly;
    },
    setStrictTwoLineSuperset(value: boolean): void {
      if (value === strictTwoLineSuperset) return;
      strictTwoLineSuperset = value;
      specialCurve = null;
      rebuildGrid();
    },
    getStrictTwoLineSuperset(): boolean {
      return strictTwoLineSuperset;
    },
    setEnabledPointIds(ids: readonly string[]): void {
      const normalized = normalizeEnabledPointIds(ids);
      if (sameIds(normalized, enabledPointIds)) return;
      enabledPointIds = normalized;
      rebuildGrid();
    },
    getEnabledPointIds(): string[] {
      return enabledPointIds.slice();
    },
    setOnSelectionChange(callback: (sample: CoreCaseGraphSample) => void): void {
      onSelectionChange = callback;
    },
  };
}
