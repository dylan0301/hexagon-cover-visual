import './style.css';
import type { Point, ShapeMode, TriangleState } from './types';
import { config, mathToCanvas, scaleToCanvas, setCanvasSize } from './coords';
import { drawHexagon, HEXAGON_VERTICES } from './hexagon';
import {
  computeChainValuesForLocalCs,
  getAdmissibleOrderedSource,
  getEffectiveStrictEps,
  getStrictEps,
  isCustomAdmissibleOrderedSourceActive,
  isStrictCheckEnabled,
  resetAdmissibleOrderedSource,
  setAdmissibleOrderedSource,
  setStrictCheckEnabled,
  setStrictEps,
} from './maps';
import {
  drawControlPoint,
  drawShape,
  getCPerimeterIntersections,
  getInnerGammas,
  CIRCUMRADIUS,
  type CPerimeterIntersections,
  type PerimeterIntersectionInterval,
} from './triangle';
import { setupInteraction } from './interaction';
import { createRegionRenderer, type GraphMode } from './region';
import {
  buildCentralCoverTriangle,
  computeCoverResult,
  type CoverChainDirection,
  type CoverResult,
  type CoverSegmentReport,
  type CoverTriangle,
} from './cover';
import {
  buildSymmetricPointTargets,
  nextPointSeedId,
  pointInHexagon,
  sanitizePointSeeds,
  type SymmetricPointSeed,
  type SymmetricPointTarget,
} from './symmetricPoints';
import {
  allowedMidpointIndices,
  autoPlaceAllFreeVd0Triangles,
  benzenePoint,
  colorForTriangle,
  createDefaultTargetTPoints,
  createDefaultFreeState,
  DEFAULT_TARGET_T,
  describeTarget,
  getSegmentByRef,
  getFreeVd0Status,
  getFreeVd0RawSourceOptions,
  getTriangle,
  lotusComponents,
  midpoint,
  namedPointLabel,
  projectTriangleToConstraints,
  refreshLabels,
  sameSegmentRef,
  targetTLabel,
  targetTPoint,
  triangleVertices,
  validateFreeState,
} from './freeGeometry';
import { setupFreeInteraction } from './freeInteraction';
import type {
  FreeNamedPointRef,
  FreeLabel,
  FreeSegment,
  FreeSegmentRef,
  FreeState,
  FreeTarget,
  FreeTool,
  FreeTriangleId,
  FreeValidationSegment,
  FreeVd0Coordinate,
  FreeVd0Mode,
  FreeValidationResult,
} from './freeTypes';
import {
  EMPTY_SAMPLING_STORE,
  addRejectedSample,
  addSample,
  classifyCSample,
  classifyV0Sample,
  summarizeCSamples,
  summarizeVSamples,
  type CSample,
  type CCaseSummary,
  type RejectedSample,
  type SamplingStore,
  type VCaseSummary,
  type VSample,
} from './halfSkeletonFrontier';
import {
  abUnionCoincidenceTargets,
  abUnionAValues,
  abUnionBValues,
  clearAbUnionFMarks,
  createDefaultAbUnionState,
  deleteAbUnionLabel,
  deleteSelectedAbUnionFMark,
  optimizeAbUnionTheta,
  renderAbUnion,
  renderAbUnionBoundaryControls,
  requestAbUnionThetaOptimization,
  refreshAbUnionDeltaConstraints,
  setAbUnionCoincidenceLock,
  setAbUnionLock,
  setAbUnionPreset,
  setAbUnionSumConstraint,
  setAbUnionTool,
  snapAbUnionLabelToEdge,
  setupAbUnionInteraction,
  type AbUnionCenterMode,
  type AbUnionCoincidenceRole,
  type AbUnionPreset,
  type AbUnionQuality,
  type AbUnionBoundaryRenderResult,
  type AbUnionRenderResult,
  type AbUnionSumConstraintMode,
  type AbUnionTool,
} from './abUnion';
import {
  clearAbHullDebugPolygon,
  clearAbHullDebugExports,
  closeAbHullDebugPolygon,
  createDefaultAbHullDebugState,
  deleteSelectedAbHullDebugVertex,
  exportAbHullDebugExperiment,
  formatAbHullDebugExports,
  loadSuggestedAbHullDebugPolygon,
  renderAbHullDebug,
  resetAbHullDebugExample,
  setAbHullDebugParameter,
  setupAbHullDebugInteraction,
  undoAbHullDebugVertex,
  type AbHullDebugResult,
} from './abHullDebug';
import {
  createDefaultConj0521State,
  createDefaultConj0525State,
  renderConj0521,
  renderConj0525,
  type Conj0521RenderResult,
} from './conj0521';
import {
  areaConjRequiredPoints,
  computeAreaConjResult,
  type AreaConjQuality,
  type AreaConjResult,
} from './areaConjecture';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const MAX_CANVAS_SIZE = 600;

// Graph canvas (right side)
const regionCanvas = document.getElementById('region-canvas') as HTMLCanvasElement;
const regionRenderer = createRegionRenderer(regionCanvas);
const graphPanel = document.getElementById('graph-panel') as HTMLDivElement;
const shapeTitle = document.getElementById('shape-title') as HTMLDivElement;
const gammaValues = document.getElementById('gamma-values') as HTMLDivElement;
const localCBounds = document.getElementById('local-c-bounds') as HTMLDivElement;
const localCValues = document.getElementById('local-c-values') as HTMLDivElement;
const cSlider = document.getElementById('c-slider') as HTMLInputElement;
const cValueLabel = document.getElementById('c-value') as HTMLSpanElement;
const sliderRow = document.getElementById('slider-row') as HTMLDivElement;
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-button'));
const shapeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.shape-button'));
const admissibleEditor = document.getElementById('admissible-editor') as HTMLTextAreaElement;
const admissibleStatus = document.getElementById('admissible-status') as HTMLDivElement;
const admissibleResetButton = document.getElementById('admissible-reset') as HTMLButtonElement;
const controllerState = document.getElementById('controller-state') as HTMLTextAreaElement;
const controllerStateStatus = document.getElementById('controller-state-status') as HTMLDivElement;
const controllerStateCopyButton = document.getElementById('controller-state-copy') as HTMLButtonElement;
const controllerStateLoadButton = document.getElementById('controller-state-load') as HTMLButtonElement;
const strictCheckToggle = document.getElementById('strict-check-toggle') as HTMLInputElement;
const strictEpsControls = document.getElementById('strict-eps-controls') as HTMLDivElement;
const strictEpsSlider = document.getElementById('strict-eps-slider') as HTMLInputElement;
const strictEpsValueLabel = document.getElementById('strict-eps-value') as HTMLSpanElement;
const strictEpsInput = document.getElementById('strict-eps-input') as HTMLInputElement;
const strictEpsMaxInput = document.getElementById('strict-eps-max-input') as HTMLInputElement;
const coverOverlayToggle = document.getElementById('cover-overlay-toggle') as HTMLInputElement;
const coverOverlayToggleRow = document.getElementById('cover-overlay-toggle-row') as HTMLLabelElement;
const coverOverlayStatus = document.getElementById('cover-overlay-status') as HTMLDivElement;
const pointToolPanel = document.getElementById('point-tool-panel') as HTMLDivElement;
const pointToolToggle = document.getElementById('point-tool-toggle') as HTMLButtonElement;
const pointDeleteButton = document.getElementById('point-delete') as HTMLButtonElement;
const pointClearButton = document.getElementById('point-clear') as HTMLButtonElement;
const pointToolStatus = document.getElementById('point-tool-status') as HTMLSpanElement;
const ceStatus = document.getElementById('ce-status') as HTMLDivElement;
const ceControls = document.getElementById('ce-controls') as HTMLDivElement;
const ceIntervalSelect = document.getElementById('ce-interval-select') as HTMLSelectElement;
const ceDirectionSelect = document.getElementById('ce-direction-select') as HTMLSelectElement;
const ceStartResetButton = document.getElementById('ce-start-reset') as HTMLButtonElement;
const ceChainStatus = document.getElementById('ce-chain-status') as HTMLDivElement;
const freePanel = document.getElementById('free-panel') as HTMLDivElement;
const freeStatus = document.getElementById('free-status') as HTMLDivElement;
const freeControls = document.getElementById('free-controls') as HTMLDivElement;
const freeStateJson = document.getElementById('free-state-json') as HTMLTextAreaElement;
const freeStateStatus = document.getElementById('free-state-status') as HTMLDivElement;
const freeStateCopyButton = document.getElementById('free-state-copy') as HTMLButtonElement;
const freeStateLoadButton = document.getElementById('free-state-load') as HTMLButtonElement;
const abUnionPanel = document.getElementById('ab-union-panel') as HTMLDivElement;
const abUnionPanelTitle = document.getElementById('ab-union-panel-title') as HTMLDivElement;
const abUnionControls = document.getElementById('ab-union-controls') as HTMLDivElement;

const triangleState: TriangleState = {
  position: { x: 0, y: 0 },
  angle: 0,
  controlPoint: { x: 0, y: 0 },
};
const DEFAULT_STRICT_EPS_UPPER_BOUND = 0.0001;
let startValue = 0.25;
let graphMode: GraphMode = 'composition';
let shapeMode: ShapeMode = 'triangle';
let currentLocalCMaxima = Array(6).fill(1);
let manualLocalCs = Array(6).fill(0.5);
let admissibleEditorTimer: number | null = null;
let hoveredHalfDiagonalIndex: number | null = null;
let selectedHalfDiagonalIndices: number[] = [];
let strictEpsUpperBound = DEFAULT_STRICT_EPS_UPPER_BOUND;
let showCoverOverlay = false;
let pointToolActive = false;
let ceDirection: CoverChainDirection = 'ccw';
let ce2SelectedIntervalIndex = 0;
let ceStartOverrides: Record<string, number> = {};
let currentChain: ChainDescriptor | null = null;
let freeState: FreeState = createDefaultFreeState();
let freeInitializedFromCurrent = false;
let currentFreeValidation: FreeValidationResult | null = null;
let freeInteractionApi: ReturnType<typeof setupFreeInteraction> | null = null;
let sampleModeSavedTriangleStates: Partial<Record<FreeTriangleId, { hidden: boolean; fixed: boolean }>> | null = null;
let currentV0Sample: VSample | RejectedSample | null = null;
let currentCSample: CSample | RejectedSample | null = null;
let showAllSamplePoints = false;
let abUnionState = createDefaultAbUnionState();
let abHullDebugState = createDefaultAbHullDebugState();
let areaConjState = createDefaultAbUnionState();
let conj0521State = createDefaultConj0521State();
let conj0525State = createDefaultConj0525State();
let currentAbHullDebugResult: AbHullDebugResult | null = null;
let areaConstraintDelta = 0.000001;

interface MaxAreaState {
  a: number;
  b: number;
  quality: AreaConjQuality;
  result: AreaConjResult;
  dirty: boolean;
  sumConstraintMode: AbUnionSumConstraintMode;
}

const maxAreaState: MaxAreaState = {
  a: 0.2,
  b: 0.5,
  quality: 'coarse',
  result: computeAreaConjResult(0, 0.2, 0.5, 'coarse'),
  dirty: false,
  sumConstraintMode: 'none',
};

let areaConjQuality: AreaConjQuality = 'coarse';
let areaConjResults: AreaConjResult[] = [];
let areaConjDirty = true;

interface ControllerSnapshot {
  version: 4;
  shapeMode: ShapeMode;
  graphMode: GraphMode;
  startValue: number;
  singleParameter: number;
  triangleState: TriangleState;
  manualLocalCs: number[];
  selectedHalfDiagonalIndices: number[];
  admissibleSource: string;
  strictCheckEnabled: boolean;
  strictEps: number;
  strictEpsUpperBound: number;
  showCoverOverlay: boolean;
  ceDirection: CoverChainDirection;
  ce2SelectedIntervalIndex: number;
  ceStartOverrides: Record<string, number>;
  pointSeeds: SymmetricPointSeed[];
  selectedPointSeedId: string | null;
}

type RawControllerSnapshot = Omit<Partial<ControllerSnapshot>, 'version' | 'pointSeeds'> & {
  version?: 1 | 2 | 3 | 4;
  pointSeeds?: unknown;
};

function getResponsiveCanvasSize(target: HTMLCanvasElement): number {
  const rect = target.getBoundingClientRect();
  return Math.max(1, Math.min(MAX_CANVAS_SIZE, Math.round(rect.width)));
}

function resizeHiDPICanvas(
  target: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  cssSize: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  target.width = Math.round(cssSize * dpr);
  target.height = Math.round(cssSize * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function syncCanvasSizes(): void {
  const mainCanvasSize = getResponsiveCanvasSize(canvas);
  setCanvasSize(mainCanvasSize);
  resizeHiDPICanvas(canvas, ctx, mainCanvasSize);
  regionRenderer.resize(getResponsiveCanvasSize(regionCanvas));
}

function formatTuple(values: number[]): string {
  return `(${values.map((value) => value.toFixed(3)).join(', ')})`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeSelectedPointSeed(): void {
  if (
    freeState.selectedPointSeedId &&
    !freeState.pointSeeds.some((seed) => seed.id === freeState.selectedPointSeedId)
  ) {
    freeState.selectedPointSeedId = null;
  }
}

function pointSeedStatusText(): string {
  normalizeSelectedPointSeed();
  const seedCount = freeState.pointSeeds.length;
  const pointCount = buildSymmetricPointTargets(freeState.pointSeeds).length;
  const selected = freeState.selectedPointSeedId ? `; selected ${freeState.selectedPointSeedId}` : '';
  return `${seedCount} seed${seedCount === 1 ? '' : 's'}, ${pointCount} D6 point${pointCount === 1 ? '' : 's'}${selected}`;
}

function addPointSeed(point: Point): void {
  if (!pointInHexagon(point)) {
    return;
  }
  const id = nextPointSeedId(freeState.pointSeeds);
  freeState.pointSeeds.push({ id, point });
  freeState.selectedPointSeedId = id;
  freeState.status = `Created point seed ${id}.`;
}

function movePointSeed(seedId: string, point: Point): void {
  if (!pointInHexagon(point)) {
    return;
  }
  const seed = freeState.pointSeeds.find((candidate) => candidate.id === seedId);
  if (!seed) {
    return;
  }
  seed.point = point;
  freeState.selectedPointSeedId = seedId;
}

function selectPointSeed(seedId: string): void {
  if (freeState.pointSeeds.some((seed) => seed.id === seedId)) {
    freeState.selectedPointSeedId = seedId;
  }
}

function deleteSelectedPointSeed(): void {
  const selected = freeState.selectedPointSeedId;
  if (!selected) {
    return;
  }
  freeState.pointSeeds = freeState.pointSeeds.filter((seed) => seed.id !== selected);
  freeState.selectedPointSeedId = null;
  freeState.status = `Deleted point seed ${selected}.`;
}

function clearPointSeeds(): void {
  if (freeState.pointSeeds.length === 0) {
    return;
  }
  freeState.pointSeeds = [];
  freeState.selectedPointSeedId = null;
  freeState.status = 'Cleared point seeds.';
}

function drawMarker(ctx2d: CanvasRenderingContext2D, x: number, y: number, fill: string, stroke?: string): void {
  const point = mathToCanvas({ x, y });
  ctx2d.beginPath();
  ctx2d.arc(point.x, point.y, 5, 0, 2 * Math.PI);
  ctx2d.fillStyle = fill;
  ctx2d.fill();
  if (stroke) {
    ctx2d.strokeStyle = stroke;
    ctx2d.lineWidth = 2;
    ctx2d.stroke();
  }
}

function drawSymmetricPoints(ctx2d: CanvasRenderingContext2D, failureLabels: Set<string>): void {
  const targets = buildSymmetricPointTargets(freeState.pointSeeds);
  if (targets.length === 0) {
    return;
  }

  ctx2d.save();
  for (const target of targets) {
    const point = mathToCanvas(target.point);
    ctx2d.beginPath();
    ctx2d.arc(point.x, point.y, 4.5, 0, 2 * Math.PI);
    ctx2d.fillStyle = failureLabels.has(target.label) ? '#dc2626' : '#2563eb';
    ctx2d.fill();
    ctx2d.strokeStyle = '#ffffff';
    ctx2d.lineWidth = 1.5;
    ctx2d.stroke();
  }

  for (const seed of freeState.pointSeeds) {
    const point = mathToCanvas(seed.point);
    ctx2d.beginPath();
    ctx2d.arc(point.x, point.y, 8, 0, 2 * Math.PI);
    ctx2d.strokeStyle = seed.id === freeState.selectedPointSeedId ? '#f59e0b' : '#0f172a';
    ctx2d.lineWidth = seed.id === freeState.selectedPointSeedId ? 2.5 : 1.5;
    ctx2d.stroke();
  }
  ctx2d.restore();
}

interface PointCoverageResult {
  targets: SymmetricPointTarget[];
  failures: string[];
}

function pointInCoverTriangle(point: Point, triangle: CoverTriangle): boolean {
  return triangle.normals.every((normal, index) =>
    normal.x * point.x + normal.y * point.y <= triangle.lambdas[index] + 1e-9,
  );
}

function pointInCurrentCircle(point: Point): boolean {
  return Math.hypot(point.x - triangleState.position.x, point.y - triangleState.position.y) <= CIRCUMRADIUS + 1e-9;
}

function computeNonFreePointCoverage(coverResult: CoverResult | null): PointCoverageResult {
  const targets = buildSymmetricPointTargets(freeState.pointSeeds);
  if (targets.length === 0) {
    return { targets, failures: [] };
  }
  const cTriangle = shapeMode === 'triangle' ? buildCentralCoverTriangle(triangleState) : null;
  const triangles = coverResult?.vTriangles ?? [];
  const failures = targets.flatMap((target) => {
    const coveredByCentral = cTriangle !== null
      ? pointInCoverTriangle(target.point, cTriangle)
      : shapeMode === 'circle' && pointInCurrentCircle(target.point);
    const covered = coveredByCentral || triangles.some((triangle) => pointInCoverTriangle(target.point, triangle));
    return covered ? [] : [target.label];
  });
  return { targets, failures };
}

function radialPoint(index: number, radius: number): { x: number; y: number } {
  const vertex = HEXAGON_VERTICES[index];
  return {
    x: vertex.x * radius,
    y: vertex.y * radius,
  };
}

function localCPoint(index: number, localC: number): { x: number; y: number } {
  return radialPoint(index, 1 - localC);
}

function edgePoint(index: number, value: number): { x: number; y: number } {
  const current = HEXAGON_VERTICES[index];
  const previous = HEXAGON_VERTICES[(index + 5) % 6];
  return {
    x: current.x + value * (previous.x - current.x),
    y: current.y + value * (previous.y - current.y),
  };
}

function nextEdgePoint(index: number, value: number): Point {
  const current = HEXAGON_VERTICES[index];
  const next = HEXAGON_VERTICES[(index + 1) % 6];
  return {
    x: current.x + value * (next.x - current.x),
    y: current.y + value * (next.y - current.y),
  };
}

function canonicalEdgePoint(edgeIndex: number, value: number): Point {
  return nextEdgePoint(edgeIndex, value);
}

function segmentPoint(start: Point, end: Point, value: number): Point {
  return {
    x: start.x + value * (end.x - start.x),
    y: start.y + value * (end.y - start.y),
  };
}

interface ChainDescriptor {
  activeCe: boolean;
  direction: CoverChainDirection;
  vertexOrder: number[];
  localCs: number[];
  start: number;
  defaultStart: number;
  ceStartKey: string | null;
  target: number | null;
  values: number[];
  finalValue: number;
  passes: boolean | null;
  selectedInterval: PerimeterIntersectionInterval | null;
}

function drawPropagationMarkers(ctx2d: CanvasRenderingContext2D, chain: ChainDescriptor): void {
  for (let i = 0; i < 6; i++) {
    const vertexIndex = chain.vertexOrder[i] ?? i;
    const point = chain.direction === 'ccw'
      ? edgePoint(vertexIndex, chain.values[i])
      : nextEdgePoint(vertexIndex, chain.values[i]);
    drawMarker(ctx2d, point.x, point.y, i === 0 ? '#ea580c' : '#0f172a');
  }

  const finalVertexIndex = chain.vertexOrder[0] ?? 0;
  const finalPoint = chain.activeCe && chain.selectedInterval !== null
    ? (
        chain.direction === 'ccw'
          ? edgePoint(finalVertexIndex, chain.values[6])
          : nextEdgePoint(finalVertexIndex, chain.values[6])
      )
    : edgePoint(0, chain.values[6]);
  drawMarker(ctx2d, finalPoint.x, finalPoint.y, '#fff', '#dc2626');
}

function getLocalCMaxima(gammas: number[]): number[] {
  const strict = getEffectiveStrictEps();
  return gammas.map((gamma) => clamp01(1 + strict - gamma));
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function getDirectionalOrder(interval: PerimeterIntersectionInterval, direction: CoverChainDirection): number[] {
  if (direction === 'ccw') {
    const start = (interval.edgeIndex + 1) % 6;
    return Array.from({ length: 6 }, (_, offset) => (start + offset) % 6);
  }

  return Array.from({ length: 6 }, (_, offset) => positiveMod(interval.edgeIndex - offset, 6));
}

function getCeStartAndTarget(
  interval: PerimeterIntersectionInterval,
  direction: CoverChainDirection,
): { start: number; target: number } {
  if (direction === 'ccw') {
    return {
      start: clamp01(1 - interval.end),
      target: clamp01(1 - interval.start),
    };
  }

  return {
    start: clamp01(interval.start),
    target: clamp01(interval.end),
  };
}

function getCeIntervalSlot(ce: CPerimeterIntersections): number | null {
  if (ce.kind === 'CE1') {
    return 0;
  }
  if (ce.kind === 'CE2') {
    return ce2SelectedIntervalIndex;
  }
  return null;
}

function getCeStartKey(
  interval: PerimeterIntersectionInterval,
  direction: CoverChainDirection,
  slot: number,
): string {
  return `${direction}:e${interval.edgeIndex}:i${slot}`;
}

function sanitizeCeStartOverrides(input: unknown): Record<string, number> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }

  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      output[key] = clamp01(value);
    }
  }
  return output;
}

function getSelectedCeInterval(ce: CPerimeterIntersections): PerimeterIntersectionInterval | null {
  if (ce.kind === 'CE1') {
    return ce.intervals[0] ?? null;
  }
  if (ce.kind !== 'CE2') {
    return null;
  }

  if (ce2SelectedIntervalIndex >= ce.intervals.length) {
    ce2SelectedIntervalIndex = 0;
    ceIntervalSelect.value = '0';
  }

  return ce.intervals[ce2SelectedIntervalIndex] ?? ce.intervals[0] ?? null;
}

function buildChainDescriptor(
  localCs: number[],
  ce: CPerimeterIntersections | null,
): ChainDescriptor {
  const selectedInterval = ce === null ? null : getSelectedCeInterval(ce);
  const intervalSlot = ce === null ? null : getCeIntervalSlot(ce);

  if (selectedInterval === null || intervalSlot === null) {
    const values = computeChainValuesForLocalCs(localCs, startValue);
    return {
      activeCe: false,
      direction: 'ccw',
      vertexOrder: [0, 1, 2, 3, 4, 5],
      localCs,
      start: startValue,
      defaultStart: startValue,
      ceStartKey: null,
      target: null,
      values,
      finalValue: values[values.length - 1] ?? startValue,
      passes: null,
      selectedInterval: null,
    };
  }

  const vertexOrder = getDirectionalOrder(selectedInterval, ceDirection);
  const orderedLocalCs = vertexOrder.map((index) => localCs[index] ?? 0);
  const { start: defaultStart, target } = getCeStartAndTarget(selectedInterval, ceDirection);
  const ceStartKey = getCeStartKey(selectedInterval, ceDirection, intervalSlot);
  const start = ceStartOverrides[ceStartKey] ?? defaultStart;
  const values = computeChainValuesForLocalCs(orderedLocalCs, start);
  const finalValue = values[values.length - 1] ?? start;

  return {
    activeCe: true,
    direction: ceDirection,
    vertexOrder,
    localCs: orderedLocalCs,
    start,
    defaultStart,
    ceStartKey,
    target,
    values,
    finalValue,
    passes: finalValue <= target + 1e-6,
    selectedInterval,
  };
}

function clampToLocalCMax(value: number, maxValue: number): number {
  return Math.max(0, Math.min(maxValue, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function clampStrictEpsUpperBound(value: number): number {
  const clamped = clampNonNegative(value);
  return clamped > 0 ? clamped : DEFAULT_STRICT_EPS_UPPER_BOUND;
}

function clampStrictEpsValue(value: number, upperBound: number): number {
  return Math.min(clampStrictEpsUpperBound(upperBound), clampNonNegative(value));
}

function formatStrictEps(value: number): string {
  return clampNonNegative(value).toFixed(7);
}

function getStrictEpsStep(upperBound: number): string {
  const safeUpperBound = clampStrictEpsUpperBound(upperBound);
  return Math.max(safeUpperBound / 1000, 1e-9).toString();
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Point>;
  return typeof candidate.x === 'number' && Number.isFinite(candidate.x)
    && typeof candidate.y === 'number' && Number.isFinite(candidate.y);
}

function isShapeMode(value: unknown): value is ShapeMode {
  return value === 'triangle' ||
    value === 'local-c' ||
    value === 'circle' ||
    value === 'free' ||
    value === 'ab-union' ||
    value === 'ab-hull-debug' ||
    value === 'max-area' ||
    value === 'area-conj' ||
    value === 'conj-0521' ||
    value === 'conj-0525';
}

function isGraphMode(value: unknown): value is GraphMode {
  return value === 'composition' || value === 'single' || value === 'pair';
}

function isCeDirection(value: unknown): value is CoverChainDirection {
  return value === 'ccw' || value === 'cw';
}

function formatControllerSnapshot(snapshot: ControllerSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

function setControllerStateStatus(text: string, isError = false): void {
  controllerStateStatus.textContent = text;
  controllerStateStatus.style.color = isError ? '#b91c1c' : '#475569';
}

function getControllerSnapshot(): ControllerSnapshot {
  return {
    version: 4,
    shapeMode,
    graphMode,
    startValue: clamp01(startValue),
    singleParameter: clamp01(parseFloat(cSlider.value)),
    triangleState: {
      position: { ...triangleState.position },
      angle: triangleState.angle,
      controlPoint: { ...triangleState.controlPoint },
    },
    manualLocalCs: manualLocalCs.map(clamp01),
    selectedHalfDiagonalIndices: selectedHalfDiagonalIndices.slice(),
    admissibleSource: admissibleEditor.value,
    strictCheckEnabled: isStrictCheckEnabled(),
    strictEps: getStrictEps(),
    strictEpsUpperBound,
    showCoverOverlay,
    ceDirection,
    ce2SelectedIntervalIndex,
    ceStartOverrides: sanitizeCeStartOverrides(ceStartOverrides),
    pointSeeds: freeState.pointSeeds.map((seed) => ({ id: seed.id, point: { ...seed.point } })),
    selectedPointSeedId: freeState.selectedPointSeedId,
  };
}

function syncControllerSnapshot(): void {
  controllerState.value = formatControllerSnapshot(getControllerSnapshot());
  setControllerStateStatus('Snapshot updates automatically.');
}

function parseControllerSnapshot(raw: string): ControllerSnapshot {
  const parsed = JSON.parse(raw) as RawControllerSnapshot;

  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4) {
    throw new Error('Unsupported snapshot version.');
  }
  if (!isShapeMode(parsed.shapeMode)) {
    throw new Error('Invalid shapeMode.');
  }
  if (!isGraphMode(parsed.graphMode)) {
    throw new Error('Invalid graphMode.');
  }
  if (typeof parsed.startValue !== 'number' || !Number.isFinite(parsed.startValue)) {
    throw new Error('Invalid startValue.');
  }
  if (typeof parsed.singleParameter !== 'number' || !Number.isFinite(parsed.singleParameter)) {
    throw new Error('Invalid singleParameter.');
  }
  if (typeof parsed.triangleState !== 'object' || parsed.triangleState === null) {
    throw new Error('Invalid triangleState.');
  }
  if (!isPoint(parsed.triangleState.position) || !isPoint(parsed.triangleState.controlPoint)) {
    throw new Error('Invalid triangleState points.');
  }
  if (typeof parsed.triangleState.angle !== 'number' || !Number.isFinite(parsed.triangleState.angle)) {
    throw new Error('Invalid triangleState angle.');
  }
  if (!Array.isArray(parsed.manualLocalCs) || parsed.manualLocalCs.length !== 6) {
    throw new Error('manualLocalCs must be an array of length 6.');
  }
  if (!parsed.manualLocalCs.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('manualLocalCs must contain only finite numbers.');
  }
  if (!Array.isArray(parsed.selectedHalfDiagonalIndices)) {
    throw new Error('selectedHalfDiagonalIndices must be an array.');
  }
  if (!parsed.selectedHalfDiagonalIndices.every((value) => Number.isInteger(value) && value >= 0 && value < 6)) {
    throw new Error('selectedHalfDiagonalIndices must contain integers from 0 to 5.');
  }
  if (typeof parsed.admissibleSource !== 'string') {
    throw new Error('Invalid admissibleSource.');
  }
  if ('strictCheckEnabled' in parsed && typeof parsed.strictCheckEnabled !== 'boolean') {
    throw new Error('Invalid strictCheckEnabled.');
  }
  if ('strictEps' in parsed && (typeof parsed.strictEps !== 'number' || !Number.isFinite(parsed.strictEps))) {
    throw new Error('Invalid strictEps.');
  }
  if (
    'strictEpsUpperBound' in parsed
    && (
      typeof parsed.strictEpsUpperBound !== 'number'
      || !Number.isFinite(parsed.strictEpsUpperBound)
      || parsed.strictEpsUpperBound <= 0
    )
  ) {
    throw new Error('Invalid strictEpsUpperBound.');
  }
  if ('showCoverOverlay' in parsed && typeof parsed.showCoverOverlay !== 'boolean') {
    throw new Error('Invalid showCoverOverlay.');
  }
  if ('ceDirection' in parsed && !isCeDirection(parsed.ceDirection)) {
    throw new Error('Invalid ceDirection.');
  }
  if (
    'ce2SelectedIntervalIndex' in parsed
    && (
      typeof parsed.ce2SelectedIntervalIndex !== 'number'
      || !Number.isInteger(parsed.ce2SelectedIntervalIndex)
      || parsed.ce2SelectedIntervalIndex < 0
      || parsed.ce2SelectedIntervalIndex > 1
    )
  ) {
    throw new Error('Invalid ce2SelectedIntervalIndex.');
  }
  if (
    'ceStartOverrides' in parsed
    && (
      typeof parsed.ceStartOverrides !== 'object'
      || parsed.ceStartOverrides === null
      || Array.isArray(parsed.ceStartOverrides)
    )
  ) {
    throw new Error('Invalid ceStartOverrides.');
  }

  const parsedStrictEpsUpperBound = clampStrictEpsUpperBound(
    parsed.strictEpsUpperBound ?? DEFAULT_STRICT_EPS_UPPER_BOUND,
  );

  const pointSeeds = sanitizePointSeeds(parsed.pointSeeds);
  const selectedPointSeedId = typeof parsed.selectedPointSeedId === 'string' &&
    pointSeeds.some((seed) => seed.id === parsed.selectedPointSeedId)
    ? parsed.selectedPointSeedId
    : null;

  return {
    version: 4,
    shapeMode: parsed.shapeMode,
    graphMode: parsed.graphMode,
    startValue: clamp01(parsed.startValue),
    singleParameter: clamp01(parsed.singleParameter),
    triangleState: {
      position: { ...parsed.triangleState.position },
      angle: parsed.triangleState.angle,
      controlPoint: { ...parsed.triangleState.controlPoint },
    },
    manualLocalCs: parsed.manualLocalCs.map(clamp01),
    selectedHalfDiagonalIndices: Array.from(new Set(parsed.selectedHalfDiagonalIndices)),
    admissibleSource: parsed.admissibleSource,
    strictCheckEnabled: parsed.strictCheckEnabled ?? false,
    strictEps: clampStrictEpsValue(parsed.strictEps ?? 0, parsedStrictEpsUpperBound),
    strictEpsUpperBound: parsedStrictEpsUpperBound,
    showCoverOverlay: parsed.showCoverOverlay ?? false,
    ceDirection: parsed.ceDirection ?? 'ccw',
    ce2SelectedIntervalIndex: parsed.ce2SelectedIntervalIndex ?? 0,
    ceStartOverrides: sanitizeCeStartOverrides(parsed.ceStartOverrides),
    pointSeeds,
    selectedPointSeedId,
  };
}

function loadControllerSnapshot(raw: string): void {
  const snapshot = parseControllerSnapshot(raw);
  const admissibleResult = setAdmissibleOrderedSource(snapshot.admissibleSource);
  if (!admissibleResult.ok) {
    throw new Error(`Admissible source compile error: ${admissibleResult.error}`);
  }

  shapeMode = snapshot.shapeMode;
  graphMode = snapshot.graphMode;
  startValue = snapshot.startValue;
  cSlider.value = snapshot.singleParameter.toFixed(2);
  cValueLabel.textContent = snapshot.singleParameter.toFixed(2);
  triangleState.position = { ...snapshot.triangleState.position };
  triangleState.angle = snapshot.triangleState.angle;
  triangleState.controlPoint = { ...snapshot.triangleState.controlPoint };
  manualLocalCs = snapshot.manualLocalCs.slice();
  selectedHalfDiagonalIndices = snapshot.selectedHalfDiagonalIndices.slice();
  hoveredHalfDiagonalIndex = null;
  admissibleEditor.value = snapshot.admissibleSource;
  strictEpsUpperBound = snapshot.strictEpsUpperBound;
  showCoverOverlay = snapshot.showCoverOverlay;
  ceDirection = snapshot.ceDirection;
  ce2SelectedIntervalIndex = snapshot.ce2SelectedIntervalIndex;
  ceStartOverrides = { ...snapshot.ceStartOverrides };
  freeState.pointSeeds = snapshot.pointSeeds.map((seed) => ({ id: seed.id, point: { ...seed.point } }));
  freeState.selectedPointSeedId = snapshot.selectedPointSeedId;
  ceDirectionSelect.value = ceDirection;
  ceIntervalSelect.value = ce2SelectedIntervalIndex.toString();
  setStrictCheckEnabled(snapshot.strictCheckEnabled);
  setStrictEps(snapshot.strictEps);
  syncStrictCheckControls();
  syncAdmissibleEditorStatus();
  syncModeButtons();
  render();
  syncControllerSnapshot();
  setControllerStateStatus('Snapshot loaded.');
}

function drawLocalCControls(
  ctx2d: CanvasRenderingContext2D,
  maxima: number[],
  currentLocalCs: number[],
): void {
  const handles = currentLocalCs.map((value, index) => localCPoint(index, value));

  ctx2d.save();
  ctx2d.strokeStyle = '#fef3c7';
  ctx2d.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const start = mathToCanvas(localCPoint(i, maxima[i]));
    const end = mathToCanvas(HEXAGON_VERTICES[i]);
    ctx2d.beginPath();
    ctx2d.moveTo(start.x, start.y);
    ctx2d.lineTo(end.x, end.y);
    ctx2d.stroke();
  }

  ctx2d.beginPath();
  handles.forEach((point, index) => {
    const canvasPoint = mathToCanvas(point);
    if (index === 0) {
      ctx2d.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx2d.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  ctx2d.closePath();
  ctx2d.fillStyle = 'rgba(254, 240, 138, 0.18)';
  ctx2d.strokeStyle = '#fde68a';
  ctx2d.lineWidth = 1.5;
  ctx2d.fill();
  ctx2d.stroke();

  for (const point of handles) {
    const canvasPoint = mathToCanvas(point);
    ctx2d.beginPath();
    ctx2d.arc(canvasPoint.x, canvasPoint.y, 6, 0, 2 * Math.PI);
    ctx2d.fillStyle = '#facc15';
    ctx2d.fill();
    ctx2d.strokeStyle = '#a16207';
    ctx2d.lineWidth = 1.5;
    ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawHoveredHalfDiagonal(ctx2d: CanvasRenderingContext2D, index: number | null): void {
  if (index === null) {
    return;
  }

  ctx2d.save();
  const start = mathToCanvas({ x: 0, y: 0 });
  const end = mathToCanvas(HEXAGON_VERTICES[index]);
  ctx2d.strokeStyle = '#facc15';
  ctx2d.lineWidth = 4;
  ctx2d.beginPath();
  ctx2d.moveTo(start.x, start.y);
  ctx2d.lineTo(end.x, end.y);
  ctx2d.stroke();
  ctx2d.restore();
}

function drawSelectedHalfDiagonals(ctx2d: CanvasRenderingContext2D, indices: number[]): void {
  if (indices.length === 0) {
    return;
  }

  ctx2d.save();
  ctx2d.strokeStyle = '#f59e0b';
  ctx2d.lineWidth = 3;
  for (const index of indices) {
    const start = mathToCanvas({ x: 0, y: 0 });
    const end = mathToCanvas(HEXAGON_VERTICES[index]);
    ctx2d.beginPath();
    ctx2d.moveTo(start.x, start.y);
    ctx2d.lineTo(end.x, end.y);
    ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawCoverTriangleOverlay(ctx2d: CanvasRenderingContext2D, triangles: CoverTriangle[]): void {
  ctx2d.save();
  for (const triangle of triangles) {
    const vertices = triangle.vertices.map(mathToCanvas);
    ctx2d.beginPath();
    ctx2d.moveTo(vertices[0].x, vertices[0].y);
    ctx2d.lineTo(vertices[1].x, vertices[1].y);
    ctx2d.lineTo(vertices[2].x, vertices[2].y);
    ctx2d.closePath();
    ctx2d.fillStyle = `${triangle.color}29`;
    ctx2d.strokeStyle = triangle.color;
    ctx2d.lineWidth = 2;
    ctx2d.fill();
    ctx2d.stroke();

    const label = mathToCanvas(triangle.center);
    ctx2d.fillStyle = triangle.side >= 1 - 1e-9 ? '#b91c1c' : triangle.color;
    ctx2d.font = '13px monospace';
    ctx2d.fillText(triangle.name, label.x + 6, label.y - 6);
  }
  ctx2d.restore();
}

function drawCoverageGaps(ctx2d: CanvasRenderingContext2D, segments: Array<CoverSegmentReport | FreeValidationSegment>): void {
  ctx2d.save();
  ctx2d.strokeStyle = '#dc2626';
  ctx2d.lineWidth = 5;
  ctx2d.lineCap = 'round';

  for (const segment of segments) {
    if ('arc' in segment && segment.arc) {
      for (const [gapStart, gapEnd] of segment.gaps) {
        drawArcInterval(ctx2d, segment.arc, gapStart, gapEnd);
      }
      continue;
    }
    const start = segment.kind === 'edge'
      ? HEXAGON_VERTICES[segment.index]
      : segment.kind === 'diag'
        ? { x: 0, y: 0 }
        : lotusComponents().find((component) => component.label === ('label' in segment ? segment.label : undefined))?.start ?? { x: 0, y: 0 };
    const end = segment.kind === 'edge'
      ? HEXAGON_VERTICES[(segment.index + 1) % 6]
      : segment.kind === 'diag'
        ? HEXAGON_VERTICES[segment.index]
        : lotusComponents().find((component) => component.label === ('label' in segment ? segment.label : undefined))?.end ?? { x: 0, y: 0 };

    for (const [gapStart, gapEnd] of segment.gaps) {
      const canvasStart = mathToCanvas(segmentPoint(start, end, gapStart));
      const canvasEnd = mathToCanvas(segmentPoint(start, end, gapEnd));
      ctx2d.beginPath();
      ctx2d.moveTo(canvasStart.x, canvasStart.y);
      ctx2d.lineTo(canvasEnd.x, canvasEnd.y);
      ctx2d.stroke();
    }
  }

  ctx2d.restore();
}

function drawArcInterval(
  ctx2d: CanvasRenderingContext2D,
  arc: NonNullable<FreeSegment['arc']>,
  startT: number,
  endT: number,
): void {
  const center = mathToCanvas(arc.center);
  const startAngle = -(arc.startAngle + arc.sweep * startT);
  const endAngle = -(arc.startAngle + arc.sweep * endT);
  ctx2d.beginPath();
  ctx2d.arc(center.x, center.y, scaleToCanvas(arc.radius), startAngle, endAngle, arc.sweep > 0);
  ctx2d.stroke();
}

function drawLotusTarget(ctx2d: CanvasRenderingContext2D): void {
  ctx2d.save();
  ctx2d.strokeStyle = '#0f766e';
  ctx2d.lineWidth = 3;
  ctx2d.lineCap = 'round';
  for (const component of lotusComponents()) {
    if (component.arc) {
      drawArcInterval(ctx2d, component.arc, 0, 1);
    } else {
      const start = mathToCanvas(component.start);
      const end = mathToCanvas(component.end);
      ctx2d.beginPath();
      ctx2d.moveTo(start.x, start.y);
      ctx2d.lineTo(end.x, end.y);
      ctx2d.stroke();
    }
  }
  ctx2d.restore();
}

function drawCeIntervals(
  ctx2d: CanvasRenderingContext2D,
  intervals: PerimeterIntersectionInterval[],
  selectedInterval: PerimeterIntersectionInterval | null,
): void {
  if (intervals.length === 0) {
    return;
  }

  ctx2d.save();
  ctx2d.lineCap = 'round';
  ctx2d.font = '13px monospace';

  intervals.forEach((interval, index) => {
    const isSelected = selectedInterval === interval;
    const start = mathToCanvas(canonicalEdgePoint(interval.edgeIndex, interval.start));
    const end = mathToCanvas(canonicalEdgePoint(interval.edgeIndex, interval.end));
    const labelPoint = mathToCanvas(canonicalEdgePoint(interval.edgeIndex, (interval.start + interval.end) / 2));

    ctx2d.beginPath();
    ctx2d.moveTo(start.x, start.y);
    ctx2d.lineTo(end.x, end.y);
    ctx2d.strokeStyle = isSelected ? '#2563eb' : '#38bdf8';
    ctx2d.lineWidth = isSelected ? 7 : 5;
    ctx2d.stroke();

    ctx2d.fillStyle = isSelected ? '#1d4ed8' : '#0369a1';
    ctx2d.fillText(index === 0 ? 'AB' : 'CD', labelPoint.x + 5, labelPoint.y - 5);
  });

  ctx2d.restore();
}

function formatInterval(interval: PerimeterIntersectionInterval, label: string): string {
  return `${label}: e${interval.edgeIndex} [${interval.start.toFixed(3)}, ${interval.end.toFixed(3)}]`;
}

function getSelectedLocalCsForChain(chain: ChainDescriptor, localCs: number[]): number[] {
  const selected = new Set(selectedHalfDiagonalIndices);
  const orderedIndices = chain.activeCe ? chain.vertexOrder : [0, 1, 2, 3, 4, 5];
  return orderedIndices
    .filter((index) => selected.has(index))
    .map((index) => localCs[index] ?? 0);
}

function getSelectedLocalCsLabel(chain: ChainDescriptor): string {
  if (selectedHalfDiagonalIndices.length === 0) {
    return '';
  }

  const selected = new Set(selectedHalfDiagonalIndices);
  const orderedIndices = chain.activeCe ? chain.vertexOrder : [0, 1, 2, 3, 4, 5];
  const labels = orderedIndices
    .filter((index) => selected.has(index))
    .map((index) => `V${index}`)
    .join(' -> ');

  return labels.length === 0 ? '' : `selected ${labels}`;
}

function getHoverLocalCLabel(chain: ChainDescriptor, index: number, localC: number): string {
  if (!chain.activeCe) {
    return `hover V${index}: g_c, c = ${localC.toFixed(3)}`;
  }

  const chainPosition = chain.vertexOrder.indexOf(index);
  const suffix = chainPosition < 0 ? '' : `, step ${chainPosition + 1}`;
  return `hover V${index}${suffix}: g_c, c = ${localC.toFixed(3)}`;
}

function summarizeCe(ce: CPerimeterIntersections | null): string {
  if (ce === null) {
    return 'CE: triangle mode only';
  }

  if (ce.kind === 'unsupported') {
    return `CE: unsupported (${ce.reason ?? 'degenerate position'})`;
  }

  if (ce.intervals.length === 0) {
    return 'CE0: no perimeter interval';
  }

  return `${ce.kind}: ${ce.intervals.map((interval, index) =>
    formatInterval(interval, index === 0 ? 'AB' : 'CD'),
  ).join('; ')}`;
}

function summarizeCeChain(chain: ChainDescriptor): string {
  if (!chain.activeCe || chain.target === null || chain.passes === null) {
    return 'CE chain inactive';
  }

  const status = chain.passes ? 'PASS' : 'FAIL';
  const order = chain.vertexOrder.map((index) => `V${index}`).join(' -> ');
  return `${status}: ${chain.direction}; start ${chain.start.toFixed(3)} -> ${chain.finalValue.toFixed(3)} <= target ${chain.target.toFixed(3)}; ${order}`;
}

function syncCeControls(ce: CPerimeterIntersections | null): void {
  const active = shapeMode === 'triangle' && ce !== null && (ce.kind === 'CE1' || ce.kind === 'CE2');
  ceControls.hidden = !active;
  ceIntervalSelect.hidden = ce?.kind !== 'CE2';
  ceIntervalSelect.parentElement!.hidden = ce?.kind !== 'CE2';
  ceDirectionSelect.disabled = !active;
  ceIntervalSelect.disabled = ce?.kind !== 'CE2';
  ceStartResetButton.disabled = !active;
  ceDirectionSelect.value = ceDirection;
  ceIntervalSelect.value = ce2SelectedIntervalIndex.toString();
}

function getCurrentStartValueSegment(): { start: Point; end: Point } {
  const chain = currentChain;
  if (chain?.activeCe && chain.selectedInterval !== null) {
    const vertexIndex = chain.vertexOrder[0] ?? 0;
    const current = HEXAGON_VERTICES[vertexIndex];
    const adjacent = chain.direction === 'ccw'
      ? HEXAGON_VERTICES[(vertexIndex + 5) % 6]
      : HEXAGON_VERTICES[(vertexIndex + 1) % 6];
    return { start: current, end: adjacent };
  }

  return {
    start: HEXAGON_VERTICES[0],
    end: HEXAGON_VERTICES[5],
  };
}

function setCurrentStartValue(value: number): void {
  const chain = currentChain;
  if (chain?.activeCe && chain.ceStartKey !== null) {
    ceStartOverrides = {
      ...ceStartOverrides,
      [chain.ceStartKey]: clamp01(value),
    };
    return;
  }

  startValue = clamp01(value);
}

function resetCurrentCeStart(): void {
  const key = currentChain?.ceStartKey;
  if (!key) {
    return;
  }

  const { [key]: _removed, ...remaining } = ceStartOverrides;
  ceStartOverrides = remaining;
  render();
}

function summarizeCoverResult(result: CoverResult, pointCoverage: PointCoverageResult): string {
  const gapSegments = result.segments
    .filter((segment) => segment.gaps.length > 0)
    .map((segment) => `${segment.kind} ${segment.index}`);
  const sizeText = result.tooLargeTriangles.length === 0
    ? 'perimeter sides < 1'
    : `perimeter side >= 1: ${result.tooLargeTriangles.join(', ')}`;
  const pointText = pointCoverage.targets.length === 0
    ? ''
    : pointCoverage.failures.length === 0
      ? `; D6 points PASS (${pointCoverage.targets.length})`
      : `; D6 missing ${pointCoverage.failures.slice(0, 8).join(', ')}${pointCoverage.failures.length > 8 ? ', ...' : ''}`;

  if (gapSegments.length === 0 && pointCoverage.failures.length === 0) {
    return `cover: PASS; ${sizeText}${pointText}`;
  }

  const gapText = gapSegments.length > 0
    ? `gaps on ${gapSegments.slice(0, 6).join(', ')}${gapSegments.length > 6 ? ', ...' : ''}`
    : 'no segment gaps';
  return `cover: ${gapText}; ${sizeText}${pointText}`;
}

function initializeFreeFromCurrentIfNeeded(): void {
  if (freeInitializedFromCurrent) {
    return;
  }
  const gammas = getInnerGammas(triangleState, 'triangle');
  const localCs = getLocalCMaxima(gammas);
  const ce = getCPerimeterIntersections(triangleState);
  const chain = buildChainDescriptor(localCs, ce);
  const result = computeCoverResult(
    triangleState,
    chain.localCs,
    chain.start,
    getEffectiveStrictEps(),
    chain.vertexOrder,
    chain.direction,
  );
  const next = createDefaultFreeState();
  next.strictEps = getEffectiveStrictEps();
  next.pointSeeds = freeState.pointSeeds.map((seed) => ({ id: seed.id, point: { ...seed.point } }));
  next.selectedPointSeedId = freeState.selectedPointSeedId;
  getTriangle(next, 'C').center = { ...triangleState.position };
  getTriangle(next, 'C').angle = triangleState.angle;
  for (const coverTriangle of result.vTriangles) {
    const triangle = getTriangle(next, coverTriangle.name as FreeTriangleId);
    triangle.center = { ...coverTriangle.center };
    triangle.angle = coverTriangle.phi - Math.PI / 2;
  }
  freeState = next;
  freeInitializedFromCurrent = true;
  refreshLabels(freeState);
}

function drawFreeMode(ctx2d: CanvasRenderingContext2D, validation: FreeValidationResult): void {
  ctx2d.save();
  if (freeState.target === 'LOTUS') {
    drawLotusTarget(ctx2d);
  }
  for (const triangle of freeState.triangles) {
    if (triangle.hidden) {
      continue;
    }
    const vertices = triangleVertices(triangle.center, triangle.angle).map(mathToCanvas);
    const color = colorForTriangle(triangle.id);
    ctx2d.beginPath();
    ctx2d.moveTo(vertices[0].x, vertices[0].y);
    ctx2d.lineTo(vertices[1].x, vertices[1].y);
    ctx2d.lineTo(vertices[2].x, vertices[2].y);
    ctx2d.closePath();
    ctx2d.fillStyle = `${color}22`;
    ctx2d.strokeStyle = triangle.id === freeState.selectedTriangleId ? '#111827' : color;
    ctx2d.lineWidth = triangle.id === freeState.selectedTriangleId ? 3 : 2;
    ctx2d.fill();
    ctx2d.stroke();
    const center = mathToCanvas(triangle.center);
    ctx2d.fillStyle = triangle.fixed ? '#64748b' : color;
    ctx2d.font = '13px monospace';
    ctx2d.fillText(triangle.id, center.x + 5, center.y - 5);

    ctx2d.font = '12px monospace';
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
      const start = vertices[edgeIndex];
      const end = vertices[(edgeIndex + 1) % 3];
      const labelPoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      const selectedEdge = freeState.selectedSegments.some((segment) =>
        sameSegmentRef(segment, { kind: 'triangle-edge', triangleId: triangle.id, index: edgeIndex }),
      );
      ctx2d.fillStyle = selectedEdge || triangle.id === freeState.selectedTriangleId ? '#111827' : color;
      ctx2d.fillText(`${triangle.id}:e${edgeIndex}`, labelPoint.x + 4, labelPoint.y - 4);
    }
  }

  drawCoverageGaps(ctx2d, validation.segments);
  drawFreeSelectedSegments(ctx2d);

  ctx2d.font = '12px monospace';
  for (let i = 0; i < 6; i++) {
    const point = mathToCanvas(midpoint(i));
    ctx2d.beginPath();
    ctx2d.arc(point.x, point.y, 4, 0, 2 * Math.PI);
    ctx2d.fillStyle = validation.pointFailures.includes(`M${i}`) ? '#dc2626' : '#0f172a';
    ctx2d.fill();
    ctx2d.fillText(`M${i}`, point.x + 5, point.y - 5);
  }

  if (freeState.target === 'S_T') {
    for (const target of freeState.targetTPoints) {
      for (let i = 0; i < 6; i++) {
        const label = targetTLabel(i, target.id);
        const point = mathToCanvas(targetTPoint(target, i));
        ctx2d.beginPath();
        ctx2d.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx2d.fillStyle = validation.pointFailures.includes(label) ? '#dc2626' : '#f97316';
        ctx2d.fill();
        ctx2d.strokeStyle = target.fixed ? '#92400e' : '#7c2d12';
        ctx2d.lineWidth = target.fixed ? 2 : 1.5;
        ctx2d.stroke();
        ctx2d.fillStyle = '#7c2d12';
        ctx2d.fillText(label, point.x + 7, point.y + 12);
      }
    }
  }

  if (freeState.target === 'BENZENE') {
    for (let i = 0; i < 6; i++) {
      const point = mathToCanvas(benzenePoint(i));
      ctx2d.beginPath();
      ctx2d.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx2d.fillStyle = validation.pointFailures.includes(`B${i}`) ? '#dc2626' : '#7c3aed';
      ctx2d.fill();
      ctx2d.strokeStyle = '#4c1d95';
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();
      ctx2d.fillStyle = '#4c1d95';
      ctx2d.fillText(`B${i}`, point.x + 7, point.y - 7);
    }
  }

  drawSymmetricPoints(ctx2d, new Set(validation.pointFailures));

  for (const label of freeState.labels) {
    if (!label.point) {
      continue;
    }
    const point = mathToCanvas(label.point);
    ctx2d.beginPath();
    ctx2d.arc(point.x, point.y, 5, 0, 2 * Math.PI);
    ctx2d.fillStyle = '#2563eb';
    ctx2d.fill();
    ctx2d.fillText(label.name, point.x + 6, point.y - 6);
  }
  ctx2d.restore();
}

function drawFreeSelectedSegments(ctx2d: CanvasRenderingContext2D): void {
  if (freeState.selectedSegments.length === 0) {
    return;
  }

  ctx2d.save();
  ctx2d.lineCap = 'round';
  for (const selected of freeState.selectedSegments) {
    const segment = getSegmentByRef(freeState, selected);
    if (!segment) {
      continue;
    }
    const start = mathToCanvas(segment.start);
    const end = mathToCanvas(segment.end);
    ctx2d.beginPath();
    ctx2d.moveTo(start.x, start.y);
    ctx2d.lineTo(end.x, end.y);
    ctx2d.strokeStyle = '#facc15';
    ctx2d.lineWidth = 6;
    ctx2d.stroke();
    const labelPoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    ctx2d.fillStyle = '#92400e';
    ctx2d.font = '13px monospace';
    ctx2d.fillText(segment.label, labelPoint.x + 6, labelPoint.y + 14);
  }
  ctx2d.restore();
}

function namedPointOptions(selected: FreeNamedPointRef | null): string {
  const refs: FreeNamedPointRef[] = [
    { kind: 'O' },
    ...[0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'M', index }) as FreeNamedPointRef),
    ...freeState.targetTPoints.flatMap((target) =>
      [0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'P', index, targetTId: target.id }) as FreeNamedPointRef),
    ),
    ...[0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'B', index }) as FreeNamedPointRef),
    ...[0, 1, 2, 3, 4, 5].map((index) => ({ kind: 'V', index }) as FreeNamedPointRef),
    ...freeState.labels.map((label) => ({ kind: 'label', labelId: label.id }) as FreeNamedPointRef),
  ];
  const options = refs.map((ref) => {
    const value = encodeNamedPointRef(ref);
    return `<option value="${value}"${sameNamedPointRef(ref, selected) ? ' selected' : ''}>${namedPointLabel(ref)}</option>`;
  }).join('');
  const manual = selected?.kind === 'manual' ? selected : { kind: 'manual', manualPoint: { x: 0, y: 0 } } as FreeNamedPointRef;
  return `${options}<option value="${encodeNamedPointRef(manual)}"${selected?.kind === 'manual' ? ' selected' : ''}>manual</option>`;
}

function vd0RawSourceOptions(triangleId: FreeTriangleId, coordinate: FreeVd0Coordinate): string {
  const triangle = getTriangle(freeState, triangleId);
  const selected = triangle.vd0.rawSources?.[coordinate] ?? null;
  const options = getFreeVd0RawSourceOptions(freeState, triangle, coordinate);
  const selectedIsValid = options.some((option) => sameNamedPointRef(option.ref, selected));
  const autoSelected = selected === null || selected === undefined;
  const optionHtml = options.map((option) => {
    const value = encodeNamedPointRef(option.ref);
    const selectedAttr = sameNamedPointRef(option.ref, selected) ? ' selected' : '';
    return `<option value="${value}"${selectedAttr}>${option.label} (${option.value.toFixed(3)})</option>`;
  }).join('');
  const invalidHtml = selected && !selectedIsValid
    ? `<option value="${encodeNamedPointRef(selected)}" selected>${namedPointLabel(selected)} (invalid)</option>`
    : '';
  return `<option value=""${autoSelected ? ' selected' : ''}>auto</option>${optionHtml}${invalidHtml}`;
}

function formatVd0RawStatus(status: NonNullable<ReturnType<typeof getFreeVd0Status>>, maxLabel: string): string {
  const raw = (coordinate: FreeVd0Coordinate): string => {
    const source = status.rawSourceLabels[coordinate];
    return `${coordinate}=${status.raw[coordinate].toFixed(3)}${source ? `(${source})` : ''}`;
  };
  return `raw ${raw('a')}, ${raw('b')}, ${raw('c')}; ${maxLabel}=${status.max.toFixed(3)}`;
}

function sameNamedPointRef(a: FreeNamedPointRef, b: FreeNamedPointRef | null): boolean {
  return !!b && a.kind === b.kind && a.index === b.index && a.targetTId === b.targetTId && a.labelId === b.labelId;
}

function encodeNamedPointRef(ref: FreeNamedPointRef): string {
  if (ref.kind === 'O') return 'O';
  if (ref.kind === 'M') return `M:${ref.index ?? 0}`;
  if (ref.kind === 'P') return `PT:${ref.targetTId ?? freeState.targetTPoints[0]?.id ?? 't1'}:${ref.index ?? 0}`;
  if (ref.kind === 'B') return `B:${ref.index ?? 0}`;
  if (ref.kind === 'V') return `V:${ref.index ?? 0}`;
  if (ref.kind === 'label') return `L:${ref.labelId ?? ''}`;
  const point = ref.manualPoint ?? { x: 0, y: 0 };
  return `P:${point.x},${point.y}`;
}

function decodeNamedPointRef(value: string): FreeNamedPointRef | null {
  if (value === 'O') return { kind: 'O' };
  const [kind, raw] = value.split(':');
  if (kind === 'M') return { kind: 'M', index: clampInteger(raw, 0, 5) };
  if (kind === 'PT') {
    const parts = value.split(':');
    if (parts.length >= 3) {
      return { kind: 'P', targetTId: parts[1], index: clampInteger(parts[2], 0, 5) };
    }
    return { kind: 'P', targetTId: freeState.targetTPoints[0]?.id ?? 't1', index: clampInteger(raw, 0, 5) };
  }
  if (kind === 'B') return { kind: 'B', index: clampInteger(raw, 0, 5) };
  if (kind === 'V') return { kind: 'V', index: clampInteger(raw, 0, 5) };
  if (kind === 'L') return { kind: 'label', labelId: raw };
  if (kind === 'P') {
    const [x, y] = raw.split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { kind: 'manual', manualPoint: { x, y } };
    }
  }
  return null;
}

function clampInteger(value: string | undefined, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function formatFreeSnapshot(): string {
  return JSON.stringify({ ...freeState, version: 7 }, null, 2);
}

type RawFreeSnapshot = Partial<Omit<FreeState, 'targetTPoints'>> & {
  version?: number;
  targetT?: number;
  targetTFixed?: boolean;
  targetTPoints?: unknown;
  pointSeeds?: unknown;
};

function isFreeSegmentRef(value: unknown): value is FreeSegmentRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<FreeSegmentRef>;
  if (typeof ref.index !== 'number' || !Number.isInteger(ref.index)) return false;
  if (ref.kind === 'hex-edge' || ref.kind === 'half-diagonal' || ref.kind === 'lotus-arc') return true;
  return ref.kind === 'triangle-edge' && (
    ref.triangleId === 'C' ||
    ref.triangleId === 'V0' ||
    ref.triangleId === 'V1' ||
    ref.triangleId === 'V2' ||
    ref.triangleId === 'V3' ||
    ref.triangleId === 'V4' ||
    ref.triangleId === 'V5'
  );
}

function isFreeTool(value: unknown): value is FreeTool {
  return value === 'move' || value === 'd-mark' || value === 's-mark' || value === 'sample' || value === 'point';
}

function isAbUnionCoincidenceRole(value: unknown): value is AbUnionCoincidenceRole {
  return value === 'shared' || value === 'left' || value === 'right';
}

function isFreeTarget(value: unknown): value is FreeTarget {
  return value === 'S_HALF' || value === 'S_T' || value === 'S' || value === 'BENZENE' || value === 'LOTUS';
}

function isFixedFreeSegmentRef(value: unknown): value is FreeSegmentRef {
  return isFreeSegmentRef(value) && (value.kind === 'hex-edge' || value.kind === 'half-diagonal');
}

function isStaticFreeLabelRef(value: unknown): boolean {
  return isFixedFreeSegmentRef(value) || (isFreeSegmentRef(value) && value.kind === 'lotus-arc');
}

function isFreeLabel(value: unknown): value is FreeLabel {
  if (!value || typeof value !== 'object') return false;
  const label = value as Partial<FreeLabel>;
  if (typeof label.id !== 'string' || typeof label.name !== 'string') return false;
  if (label.mode !== 'dynamic' && label.mode !== 'static') return false;
  if (
    label.point !== null &&
    (!label.point || typeof label.point.x !== 'number' || typeof label.point.y !== 'number')
  ) {
    return false;
  }
  if (label.mode === 'dynamic') {
    return isFreeSegmentRef(label.first) && isFreeSegmentRef(label.second);
  }
  if (label.point === null) return false;
  const first = label.first;
  const second = label.second;
  if (
    isFreeSegmentRef(first) &&
    isFreeSegmentRef(second) &&
    ((first.kind === 'lotus-arc' && second.kind === 'triangle-edge') ||
      (first.kind === 'triangle-edge' && second.kind === 'lotus-arc'))
  ) {
    return true;
  }
  return (first === null || first === undefined || isStaticFreeLabelRef(first)) &&
    (second === null || second === undefined || isStaticFreeLabelRef(second));
}

function setFreeStateStatus(text: string, isError = false): void {
  freeStateStatus.textContent = text;
  freeStateStatus.style.color = isError ? '#b91c1c' : '#475569';
}

function sanitizeSamplingStore(value: unknown): SamplingStore {
  if (!value || typeof value !== 'object') return { v: [], c: [], rejected: [] };
  const raw = value as Partial<SamplingStore>;
  const v = Array.isArray(raw.v) ? raw.v.filter((sample): sample is VSample =>
    sample?.kind === 'v' &&
    typeof sample.caseId === 'string' &&
    typeof sample.label === 'string' &&
    typeof sample.a === 'number' &&
    typeof sample.b === 'number',
  ) : [];
  const c = Array.isArray(raw.c) ? raw.c.filter((sample): sample is CSample =>
    sample?.kind === 'c' &&
    (sample.caseId === 'ce1-m0' || sample.caseId === 'ce2-m0') &&
    typeof sample.label === 'string' &&
    typeof sample.edge01?.start === 'number' &&
    typeof sample.edge01?.end === 'number' &&
    (
      sample.caseId === 'ce1-m0' ||
      (typeof sample.edge50?.start === 'number' && typeof sample.edge50?.end === 'number')
    ),
  ) : [];
  const rejected = Array.isArray(raw.rejected) ? raw.rejected.filter((sample): sample is RejectedSample =>
    (sample?.triangleId === 'C' || sample?.triangleId === 'V0') && typeof sample.reason === 'string',
  ) : [];
  return { v, c, rejected };
}

function sanitizeTargetTPoints(value: unknown, legacyT?: number, legacyFixed?: boolean): FreeState['targetTPoints'] {
  if (Array.isArray(value)) {
    const used = new Set<string>();
    const points = value.flatMap((candidate, index): FreeState['targetTPoints'] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const point = candidate as { id?: unknown; t?: unknown; fixed?: unknown };
      if (typeof point.t !== 'number' || !Number.isFinite(point.t)) return [];
      const rawId = typeof point.id === 'string' && /^[A-Za-z0-9_-]+$/.test(point.id) ? point.id : `t${index + 1}`;
      let id = rawId;
      let suffix = 2;
      while (used.has(id)) {
        id = `${rawId}_${suffix}`;
        suffix++;
      }
      used.add(id);
      return [{
        id,
        t: clamp01(point.t),
        fixed: typeof point.fixed === 'boolean' ? point.fixed : false,
      }];
    });
    if (points.length > 0) return points;
  }
  if (typeof legacyT === 'number' && Number.isFinite(legacyT)) {
    return [{ id: 't1', t: clamp01(legacyT), fixed: legacyFixed ?? false }];
  }
  return createDefaultTargetTPoints();
}

function normalizeTargetTRef(ref: FreeNamedPointRef | undefined): void {
  if (!ref || ref.kind !== 'P') return;
  const ids = new Set(freeState.targetTPoints.map((point) => point.id));
  if (!ref.targetTId || !ids.has(ref.targetTId)) {
    ref.targetTId = freeState.targetTPoints[0]?.id ?? 't1';
  }
}

function loadFreeSnapshot(raw: string): void {
  const parsed = JSON.parse(raw) as RawFreeSnapshot;
  if (
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4 && parsed.version !== 5 && parsed.version !== 6 && parsed.version !== 7) ||
    !Array.isArray(parsed.triangles) ||
    parsed.triangles.length !== 7
  ) {
    throw new Error('Invalid free snapshot.');
  }
  if (parsed.target !== undefined && !isFreeTarget(parsed.target)) {
    throw new Error('Invalid free snapshot target.');
  }
  if (parsed.tool !== undefined && !isFreeTool(parsed.tool)) {
    throw new Error('Invalid free snapshot tool.');
  }
  if (parsed.targetT !== undefined && (typeof parsed.targetT !== 'number' || !Number.isFinite(parsed.targetT))) {
    throw new Error('Invalid free snapshot t.');
  }
  if (parsed.targetTFixed !== undefined && typeof parsed.targetTFixed !== 'boolean') {
    throw new Error('Invalid free snapshot targetTFixed.');
  }
  if (parsed.labels !== undefined && !Array.isArray(parsed.labels)) {
    throw new Error('Invalid free snapshot labels.');
  }
  const labels = Array.isArray(parsed.labels) ? parsed.labels : [];
  if (!labels.every(isFreeLabel)) {
    throw new Error('Invalid free snapshot labels.');
  }
  const defaults = createDefaultFreeState();
  const pointSeeds = sanitizePointSeeds(parsed.pointSeeds);
  const selectedPointSeedId = typeof parsed.selectedPointSeedId === 'string' &&
    pointSeeds.some((seed) => seed.id === parsed.selectedPointSeedId)
    ? parsed.selectedPointSeedId
    : null;
  freeState = {
    ...defaults,
    ...parsed,
    target: parsed.version === 1 && parsed.target === 'LOTUS' ? defaults.target : parsed.target ?? defaults.target,
    targetTPoints: sanitizeTargetTPoints(parsed.targetTPoints, parsed.targetT, parsed.targetTFixed),
    triangles: parsed.triangles.map((triangle, index) => ({
      ...defaults.triangles[index],
      ...triangle,
      vd0: {
        ...defaults.triangles[index].vd0,
        ...triangle.vd0,
        rawSources: {
          ...defaults.triangles[index].vd0.rawSources,
          ...triangle.vd0?.rawSources,
        },
      },
    })) as FreeState['triangles'],
    labels,
    selectedSegments: [],
    pointSeeds,
    selectedPointSeedId,
    sampling: parsed.version === 4 || parsed.version === 5 || parsed.version === 6 || parsed.version === 7 ? sanitizeSamplingStore(parsed.sampling) : { v: [], c: [], rejected: [] },
  } as FreeState;
  delete (freeState as RawFreeSnapshot).targetT;
  delete (freeState as RawFreeSnapshot).targetTFixed;
  for (const triangle of freeState.triangles) {
    normalizeTargetTRef(triangle.edgePointConstraint?.point);
    for (const coordinate of ['a', 'b', 'c'] as FreeVd0Coordinate[]) {
      normalizeTargetTRef(triangle.vd0.rawSources?.[coordinate]);
    }
  }
  sampleModeSavedTriangleStates = null;
  freeInitializedFromCurrent = true;
  refreshLabels(freeState);
}

function syncFreeStrictEps(projectConstraints = false): void {
  const nextStrictEps = getEffectiveStrictEps();
  if (freeState.strictEps === nextStrictEps) {
    return;
  }
  freeState.strictEps = nextStrictEps;
  if (projectConstraints) {
    for (const triangle of freeState.triangles) {
      projectTriangleToConstraints(freeState, triangle);
    }
    refreshLabels(freeState);
  }
}

function samplingStore(): SamplingStore {
  if (!freeState.sampling) {
    freeState.sampling = { ...EMPTY_SAMPLING_STORE, v: [], c: [], rejected: [] };
  }
  return freeState.sampling;
}

function enterSampleMode(): void {
  if (!sampleModeSavedTriangleStates) {
    sampleModeSavedTriangleStates = {};
    for (const triangle of freeState.triangles) {
      if (triangle.id !== 'C' && triangle.id !== 'V0') {
        sampleModeSavedTriangleStates[triangle.id] = { hidden: triangle.hidden, fixed: triangle.fixed };
      }
    }
  }
  for (const triangle of freeState.triangles) {
    if (triangle.id === 'C' || triangle.id === 'V0') {
      triangle.hidden = false;
      triangle.fixed = false;
      continue;
    }
    triangle.hidden = true;
    triangle.fixed = true;
  }
  if (freeState.selectedTriangleId !== 'C' && freeState.selectedTriangleId !== 'V0') {
    freeState.selectedTriangleId = 'V0';
  }
  freeState.selectedSegments = [];
}

function leaveSampleMode(): void {
  if (!sampleModeSavedTriangleStates) return;
  for (const triangle of freeState.triangles) {
    const saved = sampleModeSavedTriangleStates[triangle.id];
    if (!saved) continue;
    triangle.hidden = saved.hidden;
    triangle.fixed = saved.fixed;
  }
  sampleModeSavedTriangleStates = null;
}

function setFreeTool(nextTool: FreeTool): void {
  if (freeState.tool === 'sample' && nextTool !== 'sample') {
    leaveSampleMode();
  }
  freeState.tool = nextTool;
  if (nextTool === 'sample') {
    enterSampleMode();
    freeState.status = 'Sample mode: move or rotate C and V0 to record live samples.';
  } else if (nextTool === 'd-mark') {
    freeState.status = 'D-mark mode: click two intersecting segments.';
  } else if (nextTool === 's-mark') {
    freeState.status = 'S-mark mode: click two intersecting segments.';
  } else if (nextTool === 'point') {
    freeState.selectedSegments = [];
    freeState.status = 'Point mode: click inside the hexagon to add a seed; drag seed handles to move them.';
  } else {
    freeState.status = 'Move mode: drag selected triangles.';
  }
}

function captureCurrentSample(): void {
  if (freeState.tool !== 'sample') return;
  enterSampleMode();
  const store = samplingStore();
  const v0 = getTriangle(freeState, 'V0');
  const c = getTriangle(freeState, 'C');
  const vResult = classifyV0Sample(triangleVertices(v0.center, v0.angle), freeState.strictEps);
  const cResult = classifyCSample(triangleVertices(c.center, c.angle), freeState.strictEps);

  if (vResult.ok) {
    freeState.sampling = addSample(store, vResult.sample);
    currentV0Sample = vResult.sample;
  } else {
    freeState.sampling = addRejectedSample(store, vResult.rejected);
    currentV0Sample = vResult.rejected;
  }

  if (cResult.ok) {
    freeState.sampling = addSample(samplingStore(), cResult.sample);
    currentCSample = cResult.sample;
  } else {
    freeState.sampling = addRejectedSample(samplingStore(), cResult.rejected);
    currentCSample = cResult.rejected;
  }
}

function autoPlaceAllFreeVd0FromControls(): void {
  syncFreeStrictEps();
  if (freeState.target === 'LOTUS') {
    return;
  }
  if (!freeState.triangles.some((triangle) => triangle.id !== 'C' && triangle.vd0.enabled)) {
    return;
  }
  const result = autoPlaceAllFreeVd0Triangles(freeState);
  refreshLabels(freeState);
  const failureText = result.ok ? '' : result.failedIds.map((id) => {
    const triangle = getTriangle(freeState, id);
    const status = getFreeVd0Status(freeState, triangle);
    const maxLabel = triangle.vd0.mode === 'max-c' ? 'max c' : triangle.vd0.mode === 'max-a' ? 'max a' : 'max b';
    return status
      ? `${id} raw=(${status.raw.a.toFixed(3)}, ${status.raw.b.toFixed(3)}, ${status.raw.c.toFixed(3)}), ${maxLabel}=${status.max.toFixed(3)}`
      : id;
  }).join('; ');
  freeState.status = result.ok
    ? 'Vd0 auto-placed enabled triangles.'
    : `Vd0 auto-place failed: ${failureText}.`;
}

function summarizeFreeValidation(validation: FreeValidationResult): string {
  const gapSegments = validation.segments
    .filter((segment) => segment.gaps.length > 0)
    .map((segment) => {
      if (freeState.target === 'LOTUS') {
        const firstGap = segment.gaps[0];
        const gapText = firstGap ? ` [${firstGap[0].toFixed(3)}, ${firstGap[1].toFixed(3)}]` : '';
        return `${segment.label ?? `${segment.kind} ${segment.index}`}${gapText}`;
      }
      return `${segment.kind} ${segment.index}`;
    });
  const parts = [
    `${describeTarget(freeState.target)}: ${validation.coverageOk ? 'cover PASS' : 'cover FAIL'}`,
    validation.constraintsOk ? 'constraints PASS' : 'constraints FAIL',
  ];
  if (gapSegments.length > 0) {
    parts.push(`gaps ${gapSegments.slice(0, 5).join(', ')}${gapSegments.length > 5 ? ', ...' : ''}`);
  }
  if (validation.pointFailures.length > 0) {
    parts.push(`missing ${validation.pointFailures.join(', ')}`);
  }
  return parts.join('; ');
}

function samplePointToSvg(point: { a: number; b: number }, size: { width: number; height: number; pad: number }): { x: number; y: number } {
  const innerWidth = size.width - 2 * size.pad;
  const innerHeight = size.height - 2 * size.pad;
  return {
    x: size.pad + point.a * innerWidth,
    y: size.height - size.pad - point.b * innerHeight,
  };
}

function colorForSampleCase(caseId: string): string {
  const colors: Record<string, string> = {
    'vd0-o1-empty': 'hsl(214, 84%, 48%)',
    'vd0-o2-m0': 'hsl(188, 86%, 38%)',
    'vd1-empty': 'hsl(132, 68%, 38%)',
    'vd1-m0': 'hsl(82, 78%, 36%)',
    'vd1-m1': 'hsl(48, 90%, 42%)',
    'vd1-m5': 'hsl(25, 88%, 48%)',
    'vd1-m0-m1': 'hsl(0, 76%, 50%)',
    'vd1-m0-m5': 'hsl(326, 74%, 46%)',
    'vd2-m0': 'hsl(276, 78%, 50%)',
    'vd2-m0-m1': 'hsl(250, 76%, 54%)',
    'vd2-m0-m5': 'hsl(226, 75%, 52%)',
    'vd2-m0-m1-m5': 'hsl(170, 82%, 34%)',
    't3-m1': 'hsl(30, 10%, 28%)',
    't3-m5': 'hsl(210, 13%, 18%)',
  };
  return colors[caseId] ?? '#0f766e';
}

function sampleAxis(size: { width: number; height: number; pad: number }, xLabel: string, yLabel: string): string {
  const innerWidth = size.width - 2 * size.pad;
  const innerHeight = size.height - 2 * size.pad;
  const ticks = Array.from({ length: 11 }, (_, index) => {
    const value = index / 10;
    const x = size.pad + value * innerWidth;
    const y = size.height - size.pad - value * innerHeight;
    const label = index === 0 || index === 5 || index === 10 ? value.toString() : '';
    return `
      <line class="half-frontier-tick" x1="${x}" y1="${size.height - size.pad}" x2="${x}" y2="${size.height - size.pad + 4}" />
      <line class="half-frontier-tick" x1="${size.pad - 4}" y1="${y}" x2="${size.pad}" y2="${y}" />
      ${label ? `<text class="half-frontier-tick-label" x="${x}" y="${size.height - size.pad + 18}" text-anchor="middle">${label}</text>` : ''}
      ${label ? `<text class="half-frontier-tick-label" x="${size.pad - 8}" y="${y + 4}" text-anchor="end">${label}</text>` : ''}
    `;
  }).join('');
  return `
    <line x1="${size.pad}" y1="${size.height - size.pad}" x2="${size.width - size.pad}" y2="${size.height - size.pad}" />
    <line x1="${size.pad}" y1="${size.pad}" x2="${size.pad}" y2="${size.height - size.pad}" />
    ${ticks}
    <text x="${size.width - size.pad}" y="${size.height - 8}" text-anchor="end">${xLabel}</text>
    <text x="10" y="${size.pad}" text-anchor="start">${yLabel}</text>
  `;
}

function renderVSamplePlot(summaries: VCaseSummary[]): string {
  const size = { width: 720, height: 420, pad: 54 };
  const axis = sampleAxis(size, 'a', 'b');
  const points = summaries.flatMap((summary) => {
    const visibleSamples = showAllSamplePoints ? summary.samples : summary.pareto;
    return visibleSamples.map((point) => {
      const svgPoint = samplePointToSvg(point, size);
      const isPareto = summary.pareto.includes(point);
      const className = showAllSamplePoints && !isPareto ? ' class="half-frontier-nonfront"' : '';
      return `<circle${className} cx="${svgPoint.x}" cy="${svgPoint.y}" r="${isPareto ? 3 : 2.2}" style="fill:${colorForSampleCase(point.caseId)}" />`;
    });
  }).join('');
  const current = currentV0Sample && 'kind' in currentV0Sample && currentV0Sample.kind === 'v'
    ? (() => {
        const point = samplePointToSvg(currentV0Sample, size);
        return `<circle class="half-frontier-selected" cx="${point.x}" cy="${point.y}" r="4" style="fill:${colorForSampleCase(currentV0Sample.caseId)}" />`;
      })()
    : '';
  const legend = summaries.filter((summary) =>
    showAllSamplePoints ? summary.samples.length > 0 : summary.pareto.length > 0,
  ).map((summary) => `
    <div class="half-frontier-legend-item">
      <span class="half-frontier-swatch" style="background:${colorForSampleCase(summary.caseId)}"></span>
      <span>${escapeHtml(summary.label)}</span>
    </div>
  `).join('');
  return `
    <div class="half-frontier-v-plot-block">
      <svg class="half-frontier-plot half-frontier-v-plot" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="V0 sampling plot">${axis}${points}${current}</svg>
      <div class="half-frontier-legend" aria-label="V0 sampling color legend">${legend || '<div class="free-small-status">No front points.</div>'}</div>
    </div>
  `;
}

function endpointPointToSvg(point: { start: number; end: number }, size: { width: number; height: number; pad: number }): { x: number; y: number } {
  return samplePointToSvg({ a: point.start, b: point.end }, size);
}

function ce2Hue(index: number, count: number): string {
  const t = count <= 1 ? 0 : index / (count - 1);
  return `hsl(${Math.round(220 - 220 * t)}, 78%, 46%)`;
}

function endpointAxis(size: { width: number; height: number; pad: number }, xLabel: string, yLabel: string): string {
  return sampleAxis(size, xLabel, yLabel);
}

function renderCe1EndpointPlot(summary: CCaseSummary | undefined): string {
  const size = { width: 500, height: 210, pad: 42 };
  const visibleSamples = summary ? showAllSamplePoints ? summary.samples : summary.maximal : [];
  const points = visibleSamples.map((sample) => {
    const point = endpointPointToSvg(sample.edge01, size);
    const isMaximal = summary?.maximal.includes(sample) ?? false;
    const className = isMaximal ? 'half-frontier-endpoint is-maximal' : 'half-frontier-endpoint half-frontier-nonfront';
    return `<circle class="${className}" cx="${point.x}" cy="${point.y}" r="${isMaximal ? 4 : 2.2}" />`;
  }).join('');
  const current = currentCSample &&
    !('reason' in currentCSample) &&
    currentCSample.caseId === 'ce1-m0'
    ? (() => {
        const point = endpointPointToSvg(currentCSample.edge01, size);
        return `<circle class="half-frontier-selected" cx="${point.x}" cy="${point.y}" r="4" />`;
      })()
    : '';
  return `<svg class="half-frontier-plot" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="CE1 endpoint plot">${endpointAxis(size, 'start e01', 'end e01')}${points}${current}</svg>`;
}

function renderCe2EndpointPlot(summary: CCaseSummary | undefined, edge: 'edge50' | 'edge01', label: string): string {
  const size = { width: 500, height: 210, pad: 42 };
  const samples = summary ? showAllSamplePoints ? summary.samples : summary.maximal : [];
  const ordered = samples
    .map((sample, index) => ({ sample, index }))
    .sort((a, b) => (a.sample.edge50?.start ?? 0) - (b.sample.edge50?.start ?? 0));
  const points = ordered.map(({ sample }, index) => {
    const interval = edge === 'edge50' ? sample.edge50 : sample.edge01;
    if (!interval) return '';
    const point = endpointPointToSvg(interval, size);
    const color = ce2Hue(index, Math.max(1, ordered.length));
    const isMaximal = summary?.maximal.includes(sample) ?? false;
    const className = isMaximal ? 'half-frontier-endpoint is-maximal' : 'half-frontier-endpoint half-frontier-nonfront';
    return `<circle class="${className}" cx="${point.x}" cy="${point.y}" r="${isMaximal ? 4 : 2.2}" style="fill:${color};stroke:${color}" />`;
  }).join('');
  const current = currentCSample &&
    !('reason' in currentCSample) &&
    currentCSample.caseId === 'ce2-m0'
    ? (() => {
        const interval = edge === 'edge50' ? currentCSample.edge50 : currentCSample.edge01;
        if (!interval) return '';
        const point = endpointPointToSvg(interval, size);
        return `<circle class="half-frontier-selected" cx="${point.x}" cy="${point.y}" r="4" />`;
      })()
    : '';
  return `<svg class="half-frontier-plot" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="${label} endpoint plot">${endpointAxis(size, `start ${label}`, `end ${label}`)}${points}${current}</svg>`;
}

function renderCSamplePlot(summaries: CCaseSummary[]): string {
  const ce1 = summaries.find((summary) => summary.caseId === 'ce1-m0');
  const ce2 = summaries.find((summary) => summary.caseId === 'ce2-m0');
  return `
    <div class="half-frontier-subtitle">CE1 e01 endpoints</div>
    ${renderCe1EndpointPlot(ce1)}
    <div class="half-frontier-subtitle">CE2 e50 endpoints</div>
    ${renderCe2EndpointPlot(ce2, 'edge50', 'e50')}
    <div class="half-frontier-subtitle">CE2 e01 endpoints matched by color</div>
    ${renderCe2EndpointPlot(ce2, 'edge01', 'e01')}
  `;
}

function currentSampleText(sample: VSample | CSample | RejectedSample | null): string {
  if (!sample) return 'none';
  if ('reason' in sample) return `rejected: ${sample.reason}`;
  if (sample.kind === 'v') return `${sample.label}; a=${sample.a.toFixed(4)}, b=${sample.b.toFixed(4)}`;
  const e50 = sample.edge50 ? `; e50=[${sample.edge50.start.toFixed(3)}, ${sample.edge50.end.toFixed(3)}]` : '';
  return `${sample.label}; e01=[${sample.edge01.start.toFixed(3)}, ${sample.edge01.end.toFixed(3)}]${e50}`;
}

function renderSamplingPanel(): string {
  const store = samplingStore();
  const vSummaries = summarizeVSamples(store.v);
  const cSummaries = summarizeCSamples(store.c);
  const groupText = [
    ...vSummaries.map((summary) => `${summary.label}: ${summary.samples.length} (${summary.pareto.length} Pareto)`),
    ...cSummaries.map((summary) => `${summary.label}: ${summary.samples.length} (${summary.maximal.length} maximal)`),
  ].join('; ');
  const graphs = freeState.tool === 'sample'
    ? `${renderVSamplePlot(vSummaries)}${renderCSamplePlot(cSummaries)}`
    : '';

  return `
    <div class="half-frontier-panel">
      <div class="half-frontier-title">sampling</div>
      <div class="half-frontier-controls">
        <button type="button" class="free-button" data-clear-samples>clear samples</button>
        <label><input type="checkbox" data-show-all-samples${showAllSamplePoints ? ' checked' : ''}/>show all points</label>
      </div>
      <div class="free-small-status">current V0: ${escapeHtml(currentSampleText(currentV0Sample))}</div>
      <div class="free-small-status">current C: ${escapeHtml(currentSampleText(currentCSample))}</div>
      ${graphs}
      <div class="free-small-status">${escapeHtml(groupText || 'No samples yet. Select the sample tool and move C or V0.')}</div>
      <div class="free-small-status">rejected=${store.rejected.length}</div>
    </div>
  `;
}

function nextTargetTId(): string {
  const used = new Set(freeState.targetTPoints.map((point) => point.id));
  let index = freeState.targetTPoints.length + 1;
  while (used.has(`t${index}`)) index++;
  return `t${index}`;
}

function clearTargetTReferences(targetTId: string): void {
  for (const triangle of freeState.triangles) {
    if (triangle.edgePointConstraint?.point.kind === 'P' && triangle.edgePointConstraint.point.targetTId === targetTId) {
      triangle.edgePointConstraint = null;
    }
    for (const coordinate of ['a', 'b', 'c'] as FreeVd0Coordinate[]) {
      const source = triangle.vd0.rawSources?.[coordinate];
      if (source?.kind === 'P' && source.targetTId === targetTId) {
        delete triangle.vd0.rawSources[coordinate];
      }
    }
  }
}

function renderFreePanel(validation: FreeValidationResult): void {
  const targetButtons = (['S_HALF', 'S_T', 'S', 'BENZENE', 'LOTUS'] as FreeTarget[]).map((target) =>
    `<button type="button" class="free-button${freeState.target === target ? ' is-active' : ''}" data-free-target="${target}">${describeTarget(target)}</button>`,
  ).join('');
  const targetTControls = freeState.target === 'S_T'
    ? `
      <button type="button" class="free-button" data-add-target-t>add t</button>
      ${freeState.targetTPoints.map((target) => `
        <span class="free-target-t-row">
          <strong>${escapeHtml(target.id)}</strong>
          <input class="free-target-t-input" type="number" min="0" max="1" step="0.001" value="${target.t.toFixed(3)}" data-target-t-value="${escapeHtml(target.id)}"/>
          <label><input type="checkbox" data-target-t-fixed="${escapeHtml(target.id)}"${target.fixed ? ' checked' : ''}/>lock</label>
          <button type="button" class="free-button" data-delete-target-t="${escapeHtml(target.id)}"${freeState.targetTPoints.length <= 1 ? ' disabled' : ''}>delete</button>
        </span>
      `).join('')}`
    : '';
  const toolButtons = (['move', 'd-mark', 's-mark', 'sample', 'point'] as FreeTool[]).map((tool) =>
    `<button type="button" class="free-button${freeState.tool === tool ? ' is-active' : ''}" data-free-tool="${tool}">${tool}</button>`,
  ).join('');
  const pointControls = `
    <div class="free-toolbar">
      points
      <button type="button" class="free-button" data-delete-point-seed${freeState.selectedPointSeedId ? '' : ' disabled'}>delete selected</button>
      <button type="button" class="free-button" data-clear-point-seeds${freeState.pointSeeds.length > 0 ? '' : ' disabled'}>clear</button>
      <span class="free-small-status">${escapeHtml(pointSeedStatusText())}</span>
    </div>`;
  const statuses = new Map(validation.constraintStatuses.map((status) => [status.triangleId, status]));

  const triangleRows = freeState.triangles.map((triangle) => {
    const status = statuses.get(triangle.id);
    const midpoints = allowedMidpointIndices(triangle.id).map((index) =>
      `<label><input type="checkbox" data-midpoint="${triangle.id}:${index}"${triangle.midpointConstraints[index] ? ' checked' : ''}/>M${index}</label>`,
    ).join('');
    const vd0Status = getFreeVd0Status(freeState, triangle);
    const vd0MaxLabel = triangle.vd0.mode === 'max-c' ? 'max c' : triangle.vd0.mode === 'max-a' ? 'max a' : 'max b';
    const vd0RawControls = (['a', 'b', 'c'] as FreeVd0Coordinate[]).map((coordinate) => `
      <label>${coordinate}
        <select data-vd0-raw-source="${triangle.id}:${coordinate}"${triangle.vd0.enabled ? '' : ' disabled'}>
          ${vd0RawSourceOptions(triangle.id, coordinate)}
        </select>
      </label>
    `).join('');
    const vd0Controls = triangle.id === 'C' || freeState.target === 'LOTUS' ? '' : `
      <label><input type="checkbox" data-vd0-enabled="${triangle.id}"${triangle.vd0.enabled ? ' checked' : ''}/>Vd0</label>
      <label>Vd0 mode
        <select data-vd0-mode="${triangle.id}"${triangle.vd0.enabled ? '' : ' disabled'}>
          <option value="max-c"${triangle.vd0.mode === 'max-c' ? ' selected' : ''}>max c from a,b</option>
          <option value="max-a"${triangle.vd0.mode === 'max-a' ? ' selected' : ''}>max a from b,c</option>
          <option value="max-b"${triangle.vd0.mode === 'max-b' ? ' selected' : ''}>max b from c,a</option>
        </select>
      </label>
      ${vd0RawControls}
      ${vd0Status ? `<span class="free-small-status">${formatVd0RawStatus(vd0Status, vd0MaxLabel)}</span>` : ''}`;
    const edge = triangle.edgePointConstraint;
    const manualPoint = edge?.point.kind === 'manual' ? edge.point.manualPoint : null;
    const edgeControls = `
      <label>edge
        <select data-edge-index="${triangle.id}">
          <option value="">none</option>
          ${[0, 1, 2].map((index) => `<option value="${index}"${edge?.edgeIndex === index ? ' selected' : ''}>${index}</option>`).join('')}
        </select>
      </label>
      <label>point
        <select data-edge-point="${triangle.id}">
          ${namedPointOptions(edge?.point ?? null)}
        </select>
      </label>
      ${manualPoint ? `
        <label>x <input class="free-manual-input" type="number" step="0.001" value="${manualPoint.x}" data-manual-x="${triangle.id}"/></label>
        <label>y <input class="free-manual-input" type="number" step="0.001" value="${manualPoint.y}" data-manual-y="${triangle.id}"/></label>
      ` : ''}`;
    return `
      <div class="free-triangle-row${triangle.id === freeState.selectedTriangleId ? ' is-selected' : ''}${status?.ok === false ? ' is-bad' : ''}">
        <button type="button" class="free-button free-name" data-select-triangle="${triangle.id}">${triangle.id}</button>
        <label><input type="checkbox" data-fixed="${triangle.id}"${triangle.fixed ? ' checked' : ''}/>fixed</label>
        <label><input type="checkbox" data-hidden="${triangle.id}"${triangle.hidden ? ' checked' : ''}${freeState.tool === 'sample' && triangle.id !== 'C' && triangle.id !== 'V0' ? ' disabled' : ''}/>hidden</label>
        ${midpoints}
        ${vd0Controls}
        ${edgeControls}
        <span class="free-small-status">${status?.ok ? 'ok' : status?.messages.join(', ')}</span>
      </div>`;
  }).join('');

  const labelRows = freeState.labels.map((label) =>
    `<div class="free-label-row">${label.name}: ${label.point ? `(${label.point.x.toFixed(3)}, ${label.point.y.toFixed(3)})` : 'invalid'} <button type="button" class="free-button" data-delete-label="${label.id}">delete</button></div>`,
  ).join('');

  freeStatus.textContent = summarizeFreeValidation(validation);
  freeStatus.style.color = validation.coverageOk && validation.constraintsOk ? '#047857' : '#b91c1c';
  freeControls.innerHTML = `
    <div class="free-toolbar">target ${targetButtons}${targetTControls}</div>
    <div class="free-toolbar">tool ${toolButtons}</div>
    ${pointControls}
    ${renderSamplingPanel()}
    <div class="free-row"><span>${freeState.status}</span></div>
    ${triangleRows}
    <div class="free-row"><strong>labels</strong></div>
    ${labelRows || '<div class="free-small-status">No labels. Use d-mark or s-mark and click two intersecting segments.</div>'}
  `;
  freeStateJson.value = formatFreeSnapshot();
}

function formatAbUnionDegrees(radians: number): string {
  return `${(radians * 180 / Math.PI).toFixed(1)} deg`;
}

function abUnionCenterLabel(mode: AbUnionCenterMode): string {
  if (mode === 'none') return 'none';
  if (mode === 'circle') return 'circle';
  if (mode === 'local-c') return 'manual c_i hull';
  return 'triangle';
}

function formatAbUnionValues(label: string, values: number[]): string {
  return `${label} = (${values.map((value) => value.toFixed(4)).join(', ')})`;
}

function abUnionOverlayLabel(): string {
  const overlays = [
    abUnionState.showOriginalRegion ? 'original' : null,
    abUnionState.useAxisAlignedHull ? 'hex-axis hull' : null,
  ].filter((label): label is string => label !== null);
  return overlays.join(' + ') || 'none';
}

function renderAbUnionPanel(result: AbUnionRenderResult): void {
  const thetaDeg = abUnionState.theta * 180 / Math.PI;
  const thetaManualDisabled = abUnionState.autoOptimizeTheta ? ' disabled' : '';
  const lastOptimized = abUnionState.lastOptimized
    ? `best L*=${abUnionState.lastOptimized.L.toFixed(5)} at ${formatAbUnionDegrees(abUnionState.lastOptimized.theta)}`
    : 'best L*: not optimized';
  const equalityWarning = result.minEqualityGap < 1e-3
    ? '<div class="ab-union-warning">close to equality; apparent L &lt; 1 may be a near-degenerate artifact</div>'
    : '';
  const centerContainsText = abUnionState.centerMode === 'none'
    ? 'n/a'
    : result.centerContains ? 'yes' : `no (${result.centerFailures})`;
  const centerContainsClass = abUnionState.centerMode === 'none'
    ? ''
    : result.centerContains ? 'ab-union-ok' : 'ab-union-bad';
  const farPairText = !abUnionState.showFarPair
    ? 'off'
    : result.farPair === null
      ? 'no red points'
      : result.farPair.exceedsUnit
        ? `found d=${result.farPair.distance.toFixed(5)}`
        : `best d=${result.farPair.distance.toFixed(5)} <= 1`;
  const farPairClass = result.farPair?.exceedsUnit ? 'ab-union-bad' : '';
  const fMarkText = result.fMarkCount === 0
    ? 'none'
    : result.fMarkDistance !== null
      ? `distance=${result.fMarkDistance.toFixed(5)}`
      : result.fMarkTriangleSide !== null
        ? `side=${result.fMarkTriangleSide.toFixed(5)}`
        : `${result.fMarkCount} dot${result.fMarkCount === 1 ? '' : 's'}`;
  const toolLabels: Record<AbUnionTool, string> = {
    move: 'Move',
    add: 'Add',
    delete: 'Delete',
    'd-mark': 'd-mark',
    's-mark': 's-mark',
    'f-mark': 'f mark',
  };
  const toolControls = (['move', 'add', 'delete', 'd-mark', 's-mark', 'f-mark'] as AbUnionTool[]).map((tool) => `
    <button type="button" class="free-button${abUnionState.tool === tool ? ' is-active' : ''}" data-ab-tool="${tool}">${toolLabels[tool]}</button>
  `).join('');
  const regionRowsHtml = result.regionRows.map((row) => {
    const currentTitle = row.sumConstraintMode === 'current' && row.fixedSum !== null
      ? `fix current a${row.index}+b${row.index} = ${row.fixedSum.toFixed(4)}`
      : `fix current a${row.index}+b${row.index}`;
    return `
      <tr class="${abUnionState.activeRegions[row.index] ? 'ab-union-active-row' : ''}${row.equality ? ' ab-union-equality-row' : ''}">
        <td>R${row.index}</td>
        <td><input type="checkbox" title="include a${row.index} in the same-a group" data-ab-lock-kind="a" data-ab-lock-index="${row.index}"${row.aLocked ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="include b${row.index} in the same-b group" data-ab-lock-kind="b" data-ab-lock-index="${row.index}"${row.bLocked ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="${currentTitle}" data-ab-sum-mode="current" data-ab-sum-index="${row.index}"${row.sumConstraintMode === 'current' ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="fix a${row.index}+b${row.index} = 1" data-ab-sum-mode="one" data-ab-sum-index="${row.index}"${row.sumConstraintMode === 'one' ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="fix a${row.index}+b${row.index} = ${formatAreaNumber(1 + areaConstraintDelta)}" data-ab-sum-mode="one-plus-delta" data-ab-sum-index="${row.index}"${row.sumConstraintMode === 'one-plus-delta' ? ' checked' : ''}/></td>
        <td>${row.a.toFixed(4)}</td>
        <td>${row.b.toFixed(4)}</td>
        <td>${row.sum.toFixed(4)}</td>
        <td>${row.distance.toFixed(4)}</td>
        <td>${row.equality ? 'yes' : 'no'}</td>
        <td><span class="ab-union-pill ${row.state}">${row.state}</span></td>
      </tr>
    `;
  }).join('');
  const edgeRowsHtml = result.edgeRows.map((row) => `
    <tr>
      <td>e${row.index}</td>
      <td>${row.split ? 'two' : 'one'}</td>
      <td>${row.left.toFixed(4)}</td>
      <td>${row.right.toFixed(4)}</td>
    </tr>
  `).join('');
  const regionVisibilityControls = Array.from({ length: 6 }, (_, index) => `
    <label><input type="checkbox" data-ab-region-visible="${index}"${abUnionState.regionVisible[index] ? ' checked' : ''}/>R${index}</label>
  `).join('');
  const labelRows = abUnionState.labels.map((label) => {
    const targets = abUnionCoincidenceTargets(abUnionState, label.id).map((target) => `
      <button type="button" class="free-button" data-ab-snap-label="${escapeHtml(label.id)}" data-ab-snap-edge="${target.edge}" data-ab-snap-role="${target.role}"${label.point ? '' : ' disabled'}>snap ${escapeHtml(target.label)}</button>
      <label><input type="checkbox" data-ab-coincidence-label="${escapeHtml(label.id)}" data-ab-coincidence-edge="${target.edge}" data-ab-coincidence-role="${target.role}"${target.locked ? ' checked' : ''}${label.point ? '' : ' disabled'}/>lock ${escapeHtml(target.label)}</label>
    `).join('');
    return `<div class="free-label-row">${escapeHtml(label.name)}: ${label.point ? `(${label.point.x.toFixed(3)}, ${label.point.y.toFixed(3)})` : 'invalid'} ${targets}<button type="button" class="free-button" data-ab-delete-label="${escapeHtml(label.id)}">delete</button></div>`;
  }).join('');

  abUnionControls.innerHTML = `
    <div class="ab-union-toolbar">
      <span>tool</span>
      ${toolControls}
    </div>
    <div class="ab-union-toolbar">
      <span>f marks</span>
      <button type="button" class="free-button" data-ab-fmark-delete${abUnionState.selectedFMarkId ? '' : ' disabled'}>delete selected</button>
      <button type="button" class="free-button" data-ab-fmark-clear${result.fMarkCount > 0 ? '' : ' disabled'}>clear</button>
      <span class="free-small-status">${escapeHtml(fMarkText)}</span>
    </div>
    <div class="ab-union-toolbar">
      <label><input type="checkbox" data-ab-show-original${abUnionState.showOriginalRegion ? ' checked' : ''}/>original AB union</label>
      <label><input type="checkbox" data-ab-axis-hull${abUnionState.useAxisAlignedHull ? ' checked' : ''}/>hex-axis hull</label>
      <label><input type="checkbox" data-ab-show-theta${abUnionState.showThetaTriangle ? ' checked' : ''}/>show purple triangle</label>
      <label><input type="checkbox" data-ab-auto-theta${abUnionState.autoOptimizeTheta ? ' checked' : ''}/>auto optimize theta</label>
      <label><input type="checkbox" data-ab-show-far-pair${abUnionState.showFarPair ? ' checked' : ''}/>show red pair &gt; 1</label>
      <label><input type="checkbox" data-ab-clip-sectors${abUnionState.clipToCornerSectors ? ' checked' : ''}/>clip to corner sectors</label>
      <label><input type="checkbox" data-ab-center-locked${abUnionState.centerLocked ? ' checked' : ''}/>lock center</label>
      <label>center
        <select data-ab-center-mode>
          <option value="none"${abUnionState.centerMode === 'none' ? ' selected' : ''}>none</option>
          <option value="triangle"${abUnionState.centerMode === 'triangle' ? ' selected' : ''}>triangle</option>
          <option value="circle"${abUnionState.centerMode === 'circle' ? ' selected' : ''}>circle</option>
          <option value="local-c"${abUnionState.centerMode === 'local-c' ? ' selected' : ''}>manual c_i hull</option>
        </select>
      </label>
      <label>quality
        <select data-ab-quality>
          <option value="coarse"${abUnionState.quality === 'coarse' ? ' selected' : ''}>coarse</option>
          <option value="high"${abUnionState.quality === 'high' ? ' selected' : ''}>high</option>
          <option value="adaptive"${abUnionState.quality === 'adaptive' ? ' selected' : ''}>adaptive</option>
        </select>
      </label>
    </div>
    <div class="ab-union-toolbar">
      <span>visible regions</span>
      ${regionVisibilityControls}
    </div>
    <div class="ab-union-toolbar">
      <button type="button" class="free-button" data-ab-preset="equality">equality</button>
      <button type="button" class="free-button" data-ab-preset="midpoint">midpoints</button>
      ${areaDeltaControlHtml()}
    </div>
    <div class="ab-union-row">
      <label for="ab-union-theta">theta = <span>${thetaDeg.toFixed(1)} deg</span></label>
      <input id="ab-union-theta" type="range" min="0" max="120" step="0.5" value="${thetaDeg.toFixed(1)}" data-ab-theta${thetaManualDisabled}/>
    </div>
    <div class="ab-union-toolbar">
      <button type="button" class="free-button" data-ab-optimize${thetaManualDisabled}>optimize theta</button>
    </div>
    <div class="ab-union-readout">
      <span>L(theta)</span><strong>${result.currentL.toFixed(5)}</strong>
      <span>${escapeHtml(lastOptimized)}</span><strong>${abUnionState.lastOptimized && abUnionState.lastOptimized.L < 1 ? '&lt; 1' : ''}</strong>
      <span>uncovered pixels</span><strong>${result.uncoveredCount}</strong>
      <span>analysis points</span><strong>${result.analysisCount}</strong>
      <span>active boundaries</span><strong>${escapeHtml(result.activeLabel)}</strong>
      <span>center shape</span><strong>${escapeHtml(abUnionCenterLabel(abUnionState.centerMode))}</strong>
      <span>center contains U</span><strong class="${centerContainsClass}">${escapeHtml(centerContainsText)}</strong>
      <span>red pair search</span><strong class="${farPairClass}">${escapeHtml(farPairText)}</strong>
      <span>f marks</span><strong>${escapeHtml(fMarkText)}</strong>
      <span>region clip</span><strong>${abUnionState.clipToCornerSectors ? 'corner sectors' : 'off'}</strong>
      <span>compute model</span><strong>${abUnionState.useAxisAlignedHull ? 'hex-axis hull' : 'exact'}</strong>
      <span>visible overlays</span><strong>${escapeHtml(abUnionOverlayLabel())}</strong>
      <span>theta mode</span><strong>${abUnionState.autoOptimizeTheta ? 'auto' : 'manual'}</strong>
      <span>min |a_i+b_i-1|</span><strong>${result.minEqualityGap.toExponential(3)}</strong>
    </div>
    ${equalityWarning}
    <div class="free-row"><span>${escapeHtml(abUnionState.status)}</span></div>
    <div class="free-row"><strong>labels</strong></div>
    ${labelRows || '<div class="free-small-status">No labels. Use d-mark or s-mark and click two intersecting sources.</div>'}
    <div class="ab-union-section-title">edge dots</div>
    <table class="ab-union-table">
      <thead><tr><th>edge</th><th>dots</th><th>left</th><th>right</th></tr></thead>
      <tbody>${edgeRowsHtml}</tbody>
    </table>
    <div class="ab-union-section-title">region data</div>
    <table class="ab-union-table">
      <thead><tr><th>R_i</th><th>same a</th><th>same b</th><th>fix current</th><th>=1</th><th>=1+delta</th><th>a_i</th><th>b_i</th><th>a_i+b_i</th><th>d_i</th><th>eq?</th><th>state</th></tr></thead>
      <tbody>${regionRowsHtml}</tbody>
    </table>
  `;
}

const AB_HULL_DEBUG_PARAM_STEP = '0.000001';
const AB_HULL_DEBUG_WHEEL_STEP = 0.001;

function isAbHullDebugParam(value: string | undefined): value is 'a' | 'b' {
  return value === 'a' || value === 'b';
}

function formatAbHullDebugParameter(value: number): string {
  return value.toFixed(6);
}

function applyAbHullDebugParameterInput(target: HTMLInputElement): boolean {
  const debugParam = target.dataset.hullDebugParam;
  if (!isAbHullDebugParam(debugParam)) return false;
  setAbHullDebugParameter(abHullDebugState, debugParam, Number(target.value));
  return true;
}

function syncAbHullDebugParameterControls(): void {
  const values = {
    a: formatAbHullDebugParameter(abHullDebugState.a),
    b: formatAbHullDebugParameter(abHullDebugState.b),
  };
  for (const key of ['a', 'b'] as const) {
    abUnionControls
      .querySelectorAll<HTMLInputElement>(`input[data-hull-debug-param="${key}"]`)
      .forEach((input) => {
        input.value = values[key];
      });
  }
  const sum = abUnionControls.querySelector<HTMLElement>('[data-hull-debug-sum]');
  if (sum) {
    sum.textContent = `a+b=${formatAbHullDebugParameter(abHullDebugState.a + abHullDebugState.b)}`;
  }
}

function renderAbHullDebugPanel(result: AbHullDebugResult): void {
  const coverageClass = result.closed && result.missedCount === 0
    ? 'ab-union-ok'
    : result.closed ? 'ab-union-bad' : '';
  const coverageText = result.closed
    ? result.missedCount === 0
      ? `contains all ${result.sampleCount} samples`
      : `misses ${result.missedCount} of ${result.sampleCount}`
    : `${result.sampleCount} exact samples; polygon open`;
  const exportCount = abHullDebugState.exports.length;
  const noSuggestedHull = abHullDebugState.a + abHullDebugState.b >= 1 - 1e-9;
  const aValue = formatAbHullDebugParameter(abHullDebugState.a);
  const bValue = formatAbHullDebugParameter(abHullDebugState.b);

  abUnionControls.innerHTML = `
    <div class="ab-union-toolbar">
      <label>a
        <input type="range" min="0" max="1" step="${AB_HULL_DEBUG_PARAM_STEP}" value="${aValue}" data-hull-debug-param="a"/>
      </label>
      <input class="ab-hull-debug-number" type="number" min="0" max="1" step="${AB_HULL_DEBUG_PARAM_STEP}" value="${aValue}" data-hull-debug-param="a"/>
      <label>b
        <input type="range" min="0" max="1" step="${AB_HULL_DEBUG_PARAM_STEP}" value="${bValue}" data-hull-debug-param="b"/>
      </label>
      <input class="ab-hull-debug-number" type="number" min="0" max="1" step="${AB_HULL_DEBUG_PARAM_STEP}" value="${bValue}" data-hull-debug-param="b"/>
      <span class="free-small-status" data-hull-debug-sum>a+b=${formatAbHullDebugParameter(abHullDebugState.a + abHullDebugState.b)}</span>
    </div>
    <div class="ab-union-toolbar">
      <button type="button" class="free-button" data-hull-debug-close${abHullDebugState.vertices.length >= 3 && !abHullDebugState.closed ? '' : ' disabled'}>close polygon</button>
      <button type="button" class="free-button" data-hull-debug-undo${abHullDebugState.vertices.length > 0 ? '' : ' disabled'}>undo</button>
      <button type="button" class="free-button" data-hull-debug-delete${abHullDebugState.selectedIndex !== null && (!abHullDebugState.closed || abHullDebugState.vertices.length > 3) ? '' : ' disabled'}>delete selected dot</button>
      <button type="button" class="free-button" data-hull-debug-clear${abHullDebugState.vertices.length > 0 ? '' : ' disabled'}>clear</button>
      <button type="button" class="free-button" data-hull-debug-suggested${noSuggestedHull ? ' disabled' : ''}>load suggested hull</button>
      <button type="button" class="free-button" data-hull-debug-reset>reset example</button>
    </div>
    <div class="ab-union-toolbar">
      <button type="button" class="free-button" data-hull-debug-export${abHullDebugState.vertices.length > 0 ? '' : ' disabled'}>export current</button>
      <button type="button" class="free-button" data-hull-debug-copy-exports${exportCount > 0 ? '' : ' disabled'}>copy json</button>
      <button type="button" class="free-button" data-hull-debug-clear-exports${exportCount > 0 ? '' : ' disabled'}>clear exports</button>
      <span class="free-small-status">${exportCount} exported</span>
    </div>
    <div class="ab-union-readout">
      <span>coverage</span><strong class="${coverageClass}">${escapeHtml(coverageText)}</strong>
      <span>vertices</span><strong>${abHullDebugState.vertices.length}${abHullDebugState.closed ? ' closed' : ''}</strong>
      <span>edge directions</span><strong>u, v, u-v</strong>
      <span>status</span><strong>${escapeHtml(abHullDebugState.status)}</strong>
    </div>
    <div class="ab-union-section-title">current polygon</div>
    <textarea id="ab-hull-debug-vertices" readonly spellcheck="false">${escapeHtml(result.vertexText)}</textarea>
    <div class="ab-union-section-title">experiment json</div>
    <textarea id="ab-hull-debug-export-json" readonly spellcheck="false">${escapeHtml(formatAbHullDebugExports(abHullDebugState))}</textarea>
  `;
}

const AREA_PARAM_STEP = '0.000001';
const AREA_WHEEL_STEP = 0.001;
const AREA_DELTA_STEP = '0.0001';
const AREA_DELTA_MIN = 0.000001;
const AREA_DELTA_MAX = 0.159999;
const AREA_ONE_SUM_CONSTRAINT_TOLERANCE = 1e-12;
const AREA_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];

function isAreaQuality(value: string): value is AreaConjQuality {
  return value === 'coarse' || value === 'high';
}

function isAreaSumConstraintMode(value: string | undefined): value is AbUnionSumConstraintMode {
  return value === 'none' || value === 'current' || value === 'one' || value === 'one-plus-delta';
}

function isMaxAreaParam(value: string | undefined): value is 'a' | 'b' {
  return value === 'a' || value === 'b';
}

function formatAreaNumber(value: number): string {
  return value.toFixed(6);
}

function clampAreaDelta(value: number): number {
  if (!Number.isFinite(value)) return areaConstraintDelta;
  return Math.max(AREA_DELTA_MIN, Math.min(AREA_DELTA_MAX, value));
}

function areaSumTarget(mode: AbUnionSumConstraintMode): number | null {
  if (mode === 'one') return 1 - AREA_ONE_SUM_CONSTRAINT_TOLERANCE;
  if (mode === 'one-plus-delta') return 1 + areaConstraintDelta;
  return null;
}

function areaSumModeText(mode: AbUnionSumConstraintMode): string {
  if (mode === 'current') return 'current';
  if (mode === 'one') return 'a+b=1';
  if (mode === 'one-plus-delta') return `a+b=${formatAreaNumber(1 + areaConstraintDelta)}`;
  return 'off';
}

function areaDeltaControlHtml(): string {
  return `
    <label>delta
      <input class="ab-hull-debug-number" type="number" min="${AREA_DELTA_MIN}" max="${AREA_DELTA_MAX}" step="${AREA_DELTA_STEP}" value="${formatAreaNumber(areaConstraintDelta)}" data-area-delta/>
    </label>
  `;
}

function setAreaConstraintDelta(rawValue: number): boolean {
  if (!Number.isFinite(rawValue)) return false;
  areaConstraintDelta = clampAreaDelta(rawValue);
  refreshAbUnionDeltaConstraints(abUnionState, areaConstraintDelta);
  refreshAbUnionDeltaConstraints(areaConjState, areaConstraintDelta);
  if (maxAreaState.sumConstraintMode === 'one-plus-delta') {
    applyMaxAreaSumConstraint('a');
    recomputeMaxArea();
  }
  if (areaConjState.sumConstraintModes.includes('one-plus-delta')) {
    markAreaConjDirty();
    recomputeAreaConjResults();
  }
  return true;
}

function applyAreaDeltaInput(target: HTMLInputElement): boolean {
  if (target.dataset.areaDelta === undefined) return false;
  const updated = setAreaConstraintDelta(Number(target.value));
  target.value = formatAreaNumber(areaConstraintDelta);
  return updated;
}

function clampAreaPartForTarget(value: number, target: number): number {
  return Math.max(Math.max(0, target - 1), Math.min(Math.min(1, target), value));
}

function applyMaxAreaSumConstraint(preserve: 'a' | 'b'): void {
  const target = areaSumTarget(maxAreaState.sumConstraintMode);
  if (target === null) return;
  const preserved = clampAreaPartForTarget(maxAreaState[preserve], target);
  maxAreaState[preserve] = preserved;
  maxAreaState[preserve === 'a' ? 'b' : 'a'] = clamp01(target - preserved);
  maxAreaState.dirty = true;
}

function applyMaxAreaParameterInput(target: HTMLInputElement, commit: boolean): boolean {
  const param = target.dataset.maxAreaParam;
  if (!isMaxAreaParam(param)) return false;
  setMaxAreaParameter(param, Number(target.value), commit);
  return true;
}

function setMaxAreaParameter(key: 'a' | 'b', rawValue: number, commit: boolean): void {
  if (!Number.isFinite(rawValue)) return;
  const target = areaSumTarget(maxAreaState.sumConstraintMode);
  if (target === null) {
    maxAreaState[key] = clamp01(rawValue);
  } else {
    const value = clampAreaPartForTarget(rawValue, target);
    maxAreaState[key] = value;
    maxAreaState[key === 'a' ? 'b' : 'a'] = clamp01(target - value);
  }
  maxAreaState.dirty = true;
  if (commit) {
    recomputeMaxArea();
  }
}

function setMaxAreaSumConstraint(mode: AbUnionSumConstraintMode): void {
  maxAreaState.sumConstraintMode = mode === 'current' ? 'none' : mode;
  applyMaxAreaSumConstraint('a');
  recomputeMaxArea();
}

function recomputeMaxArea(): void {
  maxAreaState.result = computeAreaConjResult(0, maxAreaState.a, maxAreaState.b, maxAreaState.quality);
  maxAreaState.dirty = false;
}

function markAreaConjDirty(): void {
  areaConjDirty = true;
}

function recomputeAreaConjResults(): void {
  const aValues = abUnionAValues(areaConjState);
  const bValues = abUnionBValues(areaConjState);
  areaConjResults = Array.from({ length: 6 }, (_, index) =>
    computeAreaConjResult(index, aValues[index], bValues[index], areaConjQuality),
  );
  areaConjDirty = false;
}

function ensureAreaConjResults(): void {
  if (areaConjResults.length !== 6) {
    recomputeAreaConjResults();
  }
}

function drawAreaPolygon(
  ctx2d: CanvasRenderingContext2D,
  points: Point[],
  stroke: string,
  fill: string,
  lineWidth = 2,
): void {
  if (points.length === 0) return;
  const canvasPoints = points.map(mathToCanvas);
  ctx2d.beginPath();
  ctx2d.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  for (const point of canvasPoints.slice(1)) {
    ctx2d.lineTo(point.x, point.y);
  }
  ctx2d.closePath();
  ctx2d.fillStyle = fill;
  ctx2d.strokeStyle = stroke;
  ctx2d.lineWidth = lineWidth;
  ctx2d.fill();
  ctx2d.stroke();
}

function drawAreaMarker(ctx2d: CanvasRenderingContext2D, point: Point, label: string, color: string): void {
  const canvasPoint = mathToCanvas(point);
  ctx2d.beginPath();
  ctx2d.arc(canvasPoint.x, canvasPoint.y, 4.7, 0, 2 * Math.PI);
  ctx2d.fillStyle = '#ffffff';
  ctx2d.fill();
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = 1.8;
  ctx2d.stroke();
  ctx2d.fillStyle = color;
  ctx2d.font = '12px monospace';
  ctx2d.fillText(label, canvasPoint.x + 6, canvasPoint.y - 6);
}

function drawAreaConjResult(ctx2d: CanvasRenderingContext2D, result: AreaConjResult, color: string): void {
  if (!result.triangle) return;
  drawAreaPolygon(ctx2d, result.triangle.vertices, color, `${color}16`, 1.8);
  drawAreaPolygon(ctx2d, result.triangle.intersection, color, `${color}24`, 1.2);
  const center = mathToCanvas(result.triangle.center);
  ctx2d.fillStyle = color;
  ctx2d.font = '12px monospace';
  ctx2d.fillText(`f${result.index}`, center.x + 5, center.y - 5);
}

function drawMaxAreaMode(ctx2d: CanvasRenderingContext2D): void {
  drawHexagon(ctx2d);
  const required = areaConjRequiredPoints(0, maxAreaState.a, maxAreaState.b);
  if (!maxAreaState.dirty) {
    drawAreaConjResult(ctx2d, maxAreaState.result, '#0ea5e9');
  }
  drawAreaMarker(ctx2d, required.vertex, 'V0', '#0f172a');
  drawAreaMarker(ctx2d, required.aPoint, 'a', '#d97706');
  drawAreaMarker(ctx2d, required.bPoint, 'b', '#2563eb');
}

function syncMaxAreaParameterControls(): void {
  const values = {
    a: formatAreaNumber(maxAreaState.a),
    b: formatAreaNumber(maxAreaState.b),
  };
  for (const key of ['a', 'b'] as const) {
    abUnionControls
      .querySelectorAll<HTMLInputElement>(`input[data-max-area-param="${key}"]`)
      .forEach((input) => {
        input.value = values[key];
      });
  }
  const recompute = abUnionControls.querySelector<HTMLButtonElement>('[data-max-area-recompute]');
  if (recompute) {
    recompute.disabled = !maxAreaState.dirty;
  }
}

function renderMaxAreaCanvasAndReadouts(): void {
  ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
  drawMaxAreaMode(ctx);

  gammaValues.textContent = `max area: a=${formatAreaNumber(maxAreaState.a)}, b=${formatAreaNumber(maxAreaState.b)}, a+b=${formatAreaNumber(maxAreaState.a + maxAreaState.b)}`;
  localCBounds.textContent = `f(a,b)=${formatAreaNumber(maxAreaState.result.f)}, 1-f=${formatAreaNumber(maxAreaState.result.deficit)}`;
  localCValues.textContent = maxAreaState.dirty
    ? 'stale: recompute after commit'
    : `quality=${maxAreaState.quality}, constraint=${areaSumModeText(maxAreaState.sumConstraintMode)}, evaluations=${maxAreaState.result.evaluations}`;
  ceStatus.textContent = 'Max Area: CE/g-chain inactive';
  ceStatus.style.color = '#475569';
  ceChainStatus.textContent = maxAreaState.result.feasible ? 'realizing triangle found' : 'infeasible; using f=0';
  ceChainStatus.style.color = maxAreaState.result.feasible ? '#047857' : '#b91c1c';
  coverOverlayStatus.textContent = 'Max Area owns triangle overlay';
  coverOverlayStatus.style.color = '#64748b';
}

function renderMaxAreaPanel(): void {
  const result = maxAreaState.result;
  const status = maxAreaState.dirty
    ? 'stale: release slider or press Enter to recompute'
    : result.feasible ? 'ready' : 'infeasible; using f=0';
  const statusClass = maxAreaState.dirty ? 'ab-union-pill is-warn' : result.feasible ? 'ab-union-pill is-good' : 'ab-union-pill empty';
  const triangleText = result.triangle
    ? `center=(${result.triangle.center.x.toFixed(4)}, ${result.triangle.center.y.toFixed(4)}), theta=${(result.triangle.phi * 180 / Math.PI).toFixed(2)} deg`
    : 'none';
  const constraintText = areaSumModeText(maxAreaState.sumConstraintMode);

  abUnionControls.innerHTML = `
    <div class="ab-union-toolbar">
      <label>a
        <input type="range" min="0" max="1" step="${AREA_PARAM_STEP}" value="${formatAreaNumber(maxAreaState.a)}" data-max-area-param="a"/>
      </label>
      <input class="ab-hull-debug-number" type="number" min="0" max="1" step="${AREA_PARAM_STEP}" value="${formatAreaNumber(maxAreaState.a)}" data-max-area-param="a"/>
      <label>b
        <input type="range" min="0" max="1" step="${AREA_PARAM_STEP}" value="${formatAreaNumber(maxAreaState.b)}" data-max-area-param="b"/>
      </label>
      <input class="ab-hull-debug-number" type="number" min="0" max="1" step="${AREA_PARAM_STEP}" value="${formatAreaNumber(maxAreaState.b)}" data-max-area-param="b"/>
      <label>quality
        <select data-max-area-quality>
          <option value="coarse"${maxAreaState.quality === 'coarse' ? ' selected' : ''}>coarse</option>
          <option value="high"${maxAreaState.quality === 'high' ? ' selected' : ''}>high</option>
        </select>
      </label>
      <button type="button" class="free-button" data-max-area-recompute${maxAreaState.dirty ? '' : ' disabled'}>recompute</button>
    </div>
    <div class="ab-union-toolbar">
      <span>sum constraint</span>
      <label><input type="checkbox" data-max-area-sum-mode="one"${maxAreaState.sumConstraintMode === 'one' ? ' checked' : ''}/>a+b=1</label>
      <label><input type="checkbox" data-max-area-sum-mode="one-plus-delta"${maxAreaState.sumConstraintMode === 'one-plus-delta' ? ' checked' : ''}/>a+b=1+delta</label>
      ${areaDeltaControlHtml()}
    </div>
    <div class="ab-union-readout">
      <span>status</span><strong><span class="${statusClass}">${escapeHtml(status)}</span></strong>
      <span>a</span><strong>${formatAreaNumber(maxAreaState.a)}</strong>
      <span>b</span><strong>${formatAreaNumber(maxAreaState.b)}</strong>
      <span>a+b</span><strong>${formatAreaNumber(maxAreaState.a + maxAreaState.b)}</strong>
      <span>constraint</span><strong>${escapeHtml(constraintText)}</strong>
      <span>delta</span><strong>${formatAreaNumber(areaConstraintDelta)}</strong>
      <span>f(a,b)</span><strong>${formatAreaNumber(result.f)}</strong>
      <span>1-f(a,b)</span><strong>${formatAreaNumber(result.deficit)}</strong>
      <span>quality</span><strong>${escapeHtml(maxAreaState.quality)}</strong>
      <span>evaluations</span><strong>${result.evaluations}</strong>
      <span>realizer</span><strong>${escapeHtml(triangleText)}</strong>
    </div>
  `;
}

function areaConjToolText(tool: AbUnionTool): string {
  if (tool === 'd-mark') return 'd-mark';
  if (tool === 's-mark') return 's-mark';
  if (tool === 'f-mark') return 'f mark';
  return tool[0].toUpperCase() + tool.slice(1);
}

function areaConjFMarkText(result: AbUnionBoundaryRenderResult | null): string {
  if (!result || result.fMarkCount === 0) return 'none';
  if (result.fMarkDistance !== null) return `distance=${result.fMarkDistance.toFixed(5)}`;
  return `${result.fMarkCount} dot${result.fMarkCount === 1 ? '' : 's'}`;
}

function renderAreaConjPanel(boundary: AbUnionBoundaryRenderResult): void {
  ensureAreaConjResults();
  const toolControls = (['move', 'add', 'delete', 'd-mark', 's-mark', 'f-mark'] as AbUnionTool[]).map((tool) => {
    const disabled = tool === 'd-mark' || tool === 's-mark';
    return `
      <button type="button" class="free-button${areaConjState.tool === tool ? ' is-active' : ''}" data-area-tool="${tool}"${disabled ? ' disabled' : ''}>${areaConjToolText(tool)}</button>
    `;
  }).join('');
  const totalF = areaConjResults.reduce((sum, result) => sum + result.f, 0);
  const totalDeficit = areaConjResults.reduce((sum, result) => sum + result.deficit, 0);
  const infeasibleCount = areaConjResults.filter((result) => !result.feasible).length;
  const gtOneCount = boundary.regionRows.filter((row) => row.sum > 1 + 1e-9).length;
  const staleText = areaConjDirty ? 'stale: current dots changed; f rows update after commit' : 'ready';
  const staleClass = areaConjDirty ? 'ab-union-pill is-warn' : 'ab-union-pill is-good';
  const regionRowsHtml = boundary.regionRows.map((row) => {
    const result = areaConjResults[row.index];
    const feasibleClass = result?.feasible ? 'active' : 'empty';
    const currentTitle = row.sumConstraintMode === 'current' && row.fixedSum !== null
      ? `fix current a${row.index}+b${row.index} = ${row.fixedSum.toFixed(4)}`
      : `fix current a${row.index}+b${row.index}`;
    return `
      <tr class="${areaConjState.activeRegions[row.index] ? 'ab-union-active-row' : ''}${row.sum > 1 + 1e-9 ? ' ab-union-equality-row' : ''}">
        <td>R${row.index}</td>
        <td><input type="checkbox" title="include a${row.index} in the same-a group" data-area-lock-kind="a" data-area-lock-index="${row.index}"${row.aLocked ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="include b${row.index} in the same-b group" data-area-lock-kind="b" data-area-lock-index="${row.index}"${row.bLocked ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="${currentTitle}" data-area-sum-mode="current" data-area-sum-index="${row.index}"${row.sumConstraintMode === 'current' ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="fix a${row.index}+b${row.index} = 1" data-area-sum-mode="one" data-area-sum-index="${row.index}"${row.sumConstraintMode === 'one' ? ' checked' : ''}/></td>
        <td><input type="checkbox" title="fix a${row.index}+b${row.index} = ${formatAreaNumber(1 + areaConstraintDelta)}" data-area-sum-mode="one-plus-delta" data-area-sum-index="${row.index}"${row.sumConstraintMode === 'one-plus-delta' ? ' checked' : ''}/></td>
        <td>${row.a.toFixed(4)}</td>
        <td>${row.b.toFixed(4)}</td>
        <td>${row.sum.toFixed(4)}</td>
        <td>${result ? result.f.toFixed(6) : '0.000000'}</td>
        <td>${result ? result.deficit.toFixed(6) : '1.000000'}</td>
        <td><span class="ab-union-pill ${feasibleClass}">${result?.feasible ? 'ok' : 'f=0'}</span></td>
      </tr>
    `;
  }).join('');
  const edgeRowsHtml = boundary.edgeRows.map((row) => `
    <tr>
      <td>e${row.index}</td>
      <td>${row.split ? 'two' : 'one'}</td>
      <td>${row.left.toFixed(4)}</td>
      <td>${row.right.toFixed(4)}</td>
    </tr>
  `).join('');

  abUnionControls.innerHTML = `
    <div class="ab-union-toolbar">
      <span>tool</span>
      ${toolControls}
    </div>
    <div class="ab-union-toolbar">
      <span>f marks</span>
      <button type="button" class="free-button" data-area-fmark-delete${areaConjState.selectedFMarkId ? '' : ' disabled'}>delete selected</button>
      <button type="button" class="free-button" data-area-fmark-clear${boundary.fMarkCount > 0 ? '' : ' disabled'}>clear</button>
      <span class="free-small-status">${escapeHtml(areaConjFMarkText(boundary))}</span>
    </div>
    <div class="ab-union-toolbar">
      <label>quality
        <select data-area-quality>
          <option value="coarse"${areaConjQuality === 'coarse' ? ' selected' : ''}>coarse</option>
          <option value="high"${areaConjQuality === 'high' ? ' selected' : ''}>high</option>
        </select>
      </label>
      <button type="button" class="free-button" data-area-recompute${areaConjDirty ? '' : ' disabled'}>recompute f</button>
      <button type="button" class="free-button" data-area-preset="equality">equality</button>
      <button type="button" class="free-button" data-area-preset="midpoint">midpoints</button>
      ${areaDeltaControlHtml()}
    </div>
    <div class="ab-union-readout">
      <span>status</span><strong><span class="${staleClass}">${escapeHtml(staleText)}</span></strong>
      <span>Σ f_i</span><strong>${totalF.toFixed(6)}</strong>
      <span>Σ (1-f_i)</span><strong>${totalDeficit.toFixed(6)}</strong>
      <span>rows with a_i+b_i &gt; 1</span><strong>${gtOneCount}</strong>
      <span>infeasible rows</span><strong>${infeasibleCount}</strong>
      <span>active boundaries</span><strong>${escapeHtml(boundary.activeLabel)}</strong>
      <span>quality</span><strong>${escapeHtml(areaConjQuality)}</strong>
      <span>delta</span><strong>${formatAreaNumber(areaConstraintDelta)}</strong>
      <span>f marks</span><strong>${escapeHtml(areaConjFMarkText(boundary))}</strong>
    </div>
    <div class="free-row"><span>${escapeHtml(areaConjState.status)}</span></div>
    <div class="ab-union-section-title">region data</div>
    <table class="ab-union-table">
      <thead><tr><th>R_i</th><th>same a</th><th>same b</th><th>fix current</th><th>=1</th><th>=1+delta</th><th>a_i</th><th>b_i</th><th>a_i+b_i</th><th>f_i</th><th>1-f_i</th><th>state</th></tr></thead>
      <tbody>${regionRowsHtml}</tbody>
    </table>
    <div class="ab-union-section-title">edge dots</div>
    <table class="ab-union-table">
      <thead><tr><th>edge</th><th>dots</th><th>left</th><th>right</th></tr></thead>
      <tbody>${edgeRowsHtml}</tbody>
    </table>
  `;
}

function countWord(count: number): string {
  if (count === 4) return 'four';
  if (count === 5) return 'five';
  return count.toString();
}

function renderConjPanel(result: Conj0521RenderResult, constraintsTitle: string): void {
  const rowHtml = result.rows.map((row) => `
    <tr>
      <td>R${row.index}</td>
      <td>${row.a.toFixed(4)}</td>
      <td>${row.b.toFixed(4)}</td>
      <td>${row.sum.toFixed(4)}</td>
      <td>${escapeHtml(row.constraint)}</td>
      <td><span class="ab-union-pill ${row.ok ? 'is-good' : 'is-warn'}">${row.ok ? 'ok' : 'check'}</span></td>
    </tr>
  `).join('');
  const pointHtml = result.points.map((item) => `
    <tr>
      <td>${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.label)}</td>
      <td>${item.point ? item.point.x.toFixed(5) : 'missing'}</td>
      <td>${item.point ? item.point.y.toFixed(5) : 'missing'}</td>
    </tr>
  `).join('');
  const sideText = result.triangle ? result.triangle.side.toFixed(6) : 'missing points';
  const sideClass = result.triangle && result.triangle.side <= 1
    ? 'ab-union-ok'
    : result.triangle ? 'ab-union-bad' : '';
  const pointCount = result.points.length;

  abUnionControls.innerHTML = `
    <div class="ab-union-readout">
      <span>${pointCount}-point triangle side</span><strong class="${sideClass}">${escapeHtml(sideText)}</strong>
      <span>a4+b4-1</span><strong>${result.strictGap.toExponential(3)}</strong>
      <span>X values</span><strong>${escapeHtml(formatTuple(result.tValues))}</strong>
      <span>status</span><strong>${escapeHtml(result.status)}</strong>
    </div>
    <div class="ab-union-section-title">${escapeHtml(constraintsTitle)}</div>
    <table class="ab-union-table">
      <thead><tr><th>R</th><th>a</th><th>b</th><th>a+b</th><th>constraint</th><th>state</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
    <div class="ab-union-section-title">${countWord(pointCount)} points</div>
    <table class="ab-union-table">
      <thead><tr><th>id</th><th>source</th><th>x</th><th>y</th></tr></thead>
      <tbody>${pointHtml}</tbody>
    </table>
  `;
}

function toggleSelectedHalfDiagonal(index: number): void {
  const existingIndex = selectedHalfDiagonalIndices.indexOf(index);
  if (existingIndex >= 0) {
    selectedHalfDiagonalIndices = selectedHalfDiagonalIndices.filter((value) => value !== index);
    return;
  }

  selectedHalfDiagonalIndices = [...selectedHalfDiagonalIndices, index];
}

function isCoverOverlayAvailable(): boolean {
  return shapeMode !== 'free' &&
    shapeMode !== 'ab-union' &&
    shapeMode !== 'ab-hull-debug' &&
    shapeMode !== 'max-area' &&
    shapeMode !== 'area-conj' &&
    shapeMode !== 'conj-0521' &&
    shapeMode !== 'conj-0525';
}

function syncPointToolControls(): void {
  normalizeSelectedPointSeed();
  const visible = shapeMode !== 'free' &&
    shapeMode !== 'ab-union' &&
    shapeMode !== 'ab-hull-debug' &&
    shapeMode !== 'max-area' &&
    shapeMode !== 'area-conj' &&
    shapeMode !== 'conj-0521' &&
    shapeMode !== 'conj-0525';
  pointToolPanel.hidden = !visible;
  pointToolToggle.classList.toggle('is-active', visible && pointToolActive);
  pointDeleteButton.disabled = !freeState.selectedPointSeedId;
  pointClearButton.disabled = freeState.pointSeeds.length === 0;
  pointToolStatus.textContent = pointSeedStatusText();
}

function syncModeButtons(): void {
  if (shapeMode === 'triangle') {
    shapeTitle.textContent = 'C-triangle';
  } else if (shapeMode === 'circle') {
    shapeTitle.textContent = 'C-circle';
  } else if (shapeMode === 'free') {
    shapeTitle.textContent = 'Free mode';
  } else if (shapeMode === 'ab-union') {
    shapeTitle.textContent = 'ab union';
  } else if (shapeMode === 'ab-hull-debug') {
    shapeTitle.textContent = 'AB hull debug';
  } else if (shapeMode === 'max-area') {
    shapeTitle.textContent = 'Max Area';
  } else if (shapeMode === 'area-conj') {
    shapeTitle.textContent = 'Area Conj';
  } else if (shapeMode === 'conj-0521') {
    shapeTitle.textContent = '0521 conj';
  } else if (shapeMode === 'conj-0525') {
    shapeTitle.textContent = '0525 conj';
  } else {
    shapeTitle.textContent = 'c_i controls';
  }
  for (const button of shapeButtons) {
    button.classList.toggle('is-active', button.dataset.shapeMode === shapeMode);
  }
  for (const button of modeButtons) {
    button.classList.toggle('is-active', button.dataset.mode === graphMode);
  }
  const freeActive = shapeMode === 'free';
  const abUnionActive = shapeMode === 'ab-union';
  const abHullDebugActive = shapeMode === 'ab-hull-debug';
  const maxAreaActive = shapeMode === 'max-area';
  const areaConjActive = shapeMode === 'area-conj';
  const conjActive = shapeMode === 'conj-0521' || shapeMode === 'conj-0525';
  sliderRow.hidden = freeActive || abUnionActive || abHullDebugActive || maxAreaActive || areaConjActive || conjActive || graphMode !== 'single';
  cSlider.disabled = freeActive || abUnionActive || abHullDebugActive || maxAreaActive || areaConjActive || conjActive || graphMode !== 'single';
  graphPanel.hidden = freeActive || abUnionActive || abHullDebugActive || maxAreaActive || areaConjActive || conjActive;
  freePanel.hidden = !freeActive;
  abUnionPanel.hidden = !abUnionActive && !abHullDebugActive && !maxAreaActive && !areaConjActive && !conjActive;
  abUnionPanelTitle.textContent = abHullDebugActive
    ? 'AB hull debug'
    : shapeMode === 'max-area' ? 'Max Area'
      : shapeMode === 'area-conj' ? 'Area Conj'
        : shapeMode === 'conj-0521' ? '0521 conj'
          : shapeMode === 'conj-0525' ? '0525 conj' : 'ab union region';
  freeInteractionApi?.setEnabled(freeActive);
  coverOverlayToggle.disabled = !isCoverOverlayAvailable();
  coverOverlayToggle.checked = showCoverOverlay && isCoverOverlayAvailable();
  coverOverlayToggleRow.classList.toggle('is-disabled', !isCoverOverlayAvailable());
  syncPointToolControls();
}

function setAdmissibleStatus(text: string, isError = false): void {
  admissibleStatus.textContent = text;
  admissibleStatus.style.color = isError ? '#b91c1c' : '#475569';
}

function syncStrictCheckControls(): void {
  const strictEps = clampStrictEpsValue(getStrictEps(), strictEpsUpperBound);
  if (strictEps !== getStrictEps()) {
    setStrictEps(strictEps);
  }

  const upperBound = clampStrictEpsUpperBound(strictEpsUpperBound);
  if (upperBound !== strictEpsUpperBound) {
    strictEpsUpperBound = upperBound;
  }

  const step = getStrictEpsStep(strictEpsUpperBound);
  strictCheckToggle.checked = isStrictCheckEnabled();
  strictEpsControls.hidden = !isStrictCheckEnabled();
  strictEpsSlider.min = '0';
  strictEpsSlider.max = strictEpsUpperBound.toString();
  strictEpsSlider.step = step;
  strictEpsSlider.value = strictEps.toString();
  strictEpsInput.min = '0';
  strictEpsInput.max = strictEpsUpperBound.toString();
  strictEpsInput.step = step;
  strictEpsInput.value = formatStrictEps(strictEps);
  strictEpsValueLabel.textContent = formatStrictEps(strictEps);
  strictEpsMaxInput.min = step;
  strictEpsMaxInput.step = step;
  strictEpsMaxInput.value = formatStrictEps(strictEpsUpperBound);
}

function syncAdmissibleEditorStatus(): void {
  setAdmissibleStatus(
    isCustomAdmissibleOrderedSourceActive()
      ? 'Custom ordered predicate active.'
      : 'Default ordered predicate active.',
  );
}

function applyAdmissibleEditorSource(): void {
  const result = setAdmissibleOrderedSource(admissibleEditor.value);
  if (!result.ok) {
    setAdmissibleStatus(`Compile error: ${result.error}`, true);
    return;
  }

  syncAdmissibleEditorStatus();
  render();
}

function render(): void {
  syncPointToolControls();
  if (shapeMode === 'free') {
    initializeFreeFromCurrentIfNeeded();
    syncFreeStrictEps();
    captureCurrentSample();
    refreshLabels(freeState);
    currentFreeValidation = validateFreeState(freeState);

    ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
    drawHexagon(ctx);
    drawFreeMode(ctx, currentFreeValidation);

    gammaValues.textContent = 'free mode: seven independent unit triangles';
    localCBounds.textContent = freeState.target === 'S_T'
      ? `target = ${describeTarget(freeState.target)}, ${freeState.targetTPoints.map((target) => `${target.id}=${target.t.toFixed(3)}`).join(', ')}`
      : `target = ${describeTarget(freeState.target)}`;
    localCValues.textContent = `selected = ${freeState.selectedTriangleId}; tool = ${freeState.tool}`;
    ceStatus.textContent = 'CE/g-chain inactive in Free mode';
    ceChainStatus.textContent = 'Free mode uses direct covering checks';
    coverOverlayStatus.textContent = 'Free mode owns triangle overlay';
    regionRenderer.render();
    renderFreePanel(currentFreeValidation);
    syncControllerSnapshot();
    return;
  }

  if (shapeMode === 'ab-union') {
    manualLocalCs = manualLocalCs.map((value) => clampToLocalCMax(value, 1));

    ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
    drawHexagon(ctx);
    const abResult = renderAbUnion(ctx, abUnionState, triangleState, manualLocalCs);

    gammaValues.textContent = `${formatAbUnionValues('a', abUnionAValues(abUnionState))}; ${formatAbUnionValues('b', abUnionBValues(abUnionState))}`;
    localCBounds.textContent = `center = ${abUnionCenterLabel(abUnionState.centerMode)}, quality = ${abUnionState.quality}, compute = ${abUnionState.useAxisAlignedHull ? 'hex-axis hull' : 'exact'}`;
    localCValues.textContent = `L(theta) = ${abResult.currentL.toFixed(5)}, min equality gap = ${abResult.minEqualityGap.toExponential(3)}`;
    ceStatus.textContent = 'ab union: CE/g-chain inactive';
    ceStatus.style.color = '#475569';
    ceChainStatus.textContent = abUnionState.centerMode === 'none'
      ? 'center containment inactive'
      : abResult.centerContains
        ? 'center containment PASS on sampled U'
        : `center containment FAIL on ${abResult.centerFailures} sampled points`;
    ceChainStatus.style.color = abUnionState.centerMode === 'none'
      ? '#64748b'
      : abResult.centerContains ? '#047857' : '#b91c1c';
    coverOverlayStatus.textContent = `ab union overlays: ${abUnionOverlayLabel()}`;
    coverOverlayStatus.style.color = '#475569';
    renderAbUnionPanel(abResult);
    syncControllerSnapshot();
    return;
  }

  if (shapeMode === 'ab-hull-debug') {
    ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
    const result = renderAbHullDebug(ctx, abHullDebugState);
    currentAbHullDebugResult = result;

    gammaValues.textContent = `hull debug: a=${formatAbHullDebugParameter(abHullDebugState.a)}, b=${formatAbHullDebugParameter(abHullDebugState.b)}, a+b=${formatAbHullDebugParameter(abHullDebugState.a + abHullDebugState.b)}`;
    localCBounds.textContent = 'local view: full hex footprint in u,v coordinates';
    localCValues.textContent = result.closed
      ? result.missedCount === 0
        ? 'drawn polygon contains sampled exact set'
        : `drawn polygon misses ${result.missedCount} sampled points`
      : 'click vertices, then close polygon';
    ceStatus.textContent = 'Hull debug: diagnostic drawing mode';
    ceStatus.style.color = '#475569';
    ceChainStatus.textContent = 'Snaps to hex-axis directions: u, v, and u-v';
    ceChainStatus.style.color = '#475569';
    coverOverlayStatus.textContent = 'Hull debug does not change ab union masks';
    coverOverlayStatus.style.color = '#64748b';
    regionRenderer.render();
    renderAbHullDebugPanel(result);
    syncControllerSnapshot();
    return;
  }

  if (shapeMode === 'max-area') {
    renderMaxAreaCanvasAndReadouts();
    regionRenderer.render();
    renderMaxAreaPanel();
    syncControllerSnapshot();
    return;
  }

  if (shapeMode === 'area-conj') {
    ensureAreaConjResults();
    if (areaConjState.tool === 'd-mark' || areaConjState.tool === 's-mark') {
      setAbUnionTool(areaConjState, 'move');
    }

    ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
    drawHexagon(ctx);
    if (!areaConjDirty) {
      for (const result of areaConjResults) {
        drawAreaConjResult(ctx, result, AREA_COLORS[result.index] ?? '#0f172a');
      }
    }
    const boundary = renderAbUnionBoundaryControls(ctx, areaConjState, { showFMarkTriangle: false });

    const totalF = areaConjResults.reduce((sum, result) => sum + result.f, 0);
    const totalDeficit = areaConjResults.reduce((sum, result) => sum + result.deficit, 0);
    gammaValues.textContent = `${formatAbUnionValues('a', abUnionAValues(areaConjState))}; ${formatAbUnionValues('b', abUnionBValues(areaConjState))}`;
    localCBounds.textContent = `Σf=${totalF.toFixed(6)}, Σ(1-f)=${totalDeficit.toFixed(6)}, quality=${areaConjQuality}`;
    localCValues.textContent = areaConjDirty
      ? 'stale: f rows update after commit'
      : `rows with a_i+b_i>1: ${boundary.regionRows.filter((row) => row.sum > 1 + 1e-9).length}`;
    ceStatus.textContent = 'Area Conj: CE/g-chain inactive';
    ceStatus.style.color = '#475569';
    ceChainStatus.textContent = areaConjDirty ? 'area values stale during edit' : 'area values current';
    ceChainStatus.style.color = areaConjDirty ? '#c2410c' : '#047857';
    coverOverlayStatus.textContent = 'Area Conj overlays: maximizing f_i triangles';
    coverOverlayStatus.style.color = '#475569';
    regionRenderer.render();
    renderAreaConjPanel(boundary);
    syncControllerSnapshot();
    return;
  }

  if (shapeMode === 'conj-0521') {
    manualLocalCs = manualLocalCs.map((value) => clampToLocalCMax(value, 1));

    ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
    drawHexagon(ctx);
    const result = renderConj0521(ctx, conj0521State, triangleState, manualLocalCs);

    gammaValues.textContent = `${formatAbUnionValues('a', result.aValues)}; ${formatAbUnionValues('b', result.bValues)}`;
    localCBounds.textContent = `0521 slice: a1+b1=a3+b3=a5+b5=1, a4+b4>1`;
    localCValues.textContent = result.triangle
      ? `4-point side = ${result.triangle.side.toFixed(6)}, uncovered samples = ${result.base.uncoveredCount}`
      : `4-point side unavailable: ${result.status}`;
    ceStatus.textContent = '0521 conj: CE/g-chain inactive';
    ceStatus.style.color = '#475569';
    ceChainStatus.textContent = `strict gap a4+b4-1 = ${result.strictGap.toExponential(3)}`;
    ceChainStatus.style.color = result.strictGap > 0 ? '#047857' : '#b91c1c';
    coverOverlayStatus.textContent = '0521 overlays: circles, four points, enclosing triangle';
    coverOverlayStatus.style.color = '#475569';
    regionRenderer.render();
    renderConjPanel(result, '0521 constraints');
    syncControllerSnapshot();
    return;
  }

  if (shapeMode === 'conj-0525') {
    manualLocalCs = manualLocalCs.map((value) => clampToLocalCMax(value, 1));

    ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
    drawHexagon(ctx);
    const result = renderConj0525(ctx, conj0525State, triangleState, manualLocalCs);

    gammaValues.textContent = `${formatAbUnionValues('a', result.aValues)}; ${formatAbUnionValues('b', result.bValues)}`;
    localCBounds.textContent = '0525 slice: a3+b3=a5+b5=1, a4+b4>1, a0+b0,a1+b1,a2+b2<=1';
    localCValues.textContent = result.triangle
      ? `5-point side = ${result.triangle.side.toFixed(6)}, uncovered samples = ${result.base.uncoveredCount}`
      : `5-point side unavailable: ${result.status}`;
    ceStatus.textContent = '0525 conj: CE/g-chain inactive';
    ceStatus.style.color = '#475569';
    ceChainStatus.textContent = `strict gap a4+b4-1 = ${result.strictGap.toExponential(3)}`;
    ceChainStatus.style.color = result.strictGap > 0 ? '#047857' : '#b91c1c';
    coverOverlayStatus.textContent = '0525 overlays: circles, five points, enclosing triangle';
    coverOverlayStatus.style.color = '#475569';
    regionRenderer.render();
    renderConjPanel(result, '0525 constraints');
    syncControllerSnapshot();
    return;
  }

  let gammas: number[];
  let maxima: number[];
  let localCs: number[];
  const strict = getEffectiveStrictEps();

  if (shapeMode === 'local-c') {
    gammas = Array(6).fill(0);
    maxima = Array(6).fill(1);
    manualLocalCs = manualLocalCs.map((value) => clampToLocalCMax(value, 1));
    localCs = manualLocalCs.slice();
  } else {
    gammas = getInnerGammas(triangleState, shapeMode);
    maxima = getLocalCMaxima(gammas);
    localCs = maxima;
  }
  currentLocalCMaxima = maxima.slice();
  const ce = shapeMode === 'triangle' ? getCPerimeterIntersections(triangleState) : null;
  const chain = buildChainDescriptor(localCs, ce);
  currentChain = chain;
  const needsPointCoverage = freeState.pointSeeds.length > 0;
  const coverResult = isCoverOverlayAvailable() && (showCoverOverlay || needsPointCoverage)
    ? computeCoverResult(
        triangleState,
        chain.localCs,
        chain.start,
        strict,
        chain.vertexOrder,
        chain.direction,
        shapeMode === 'triangle',
      )
    : null;
  const pointCoverage = computeNonFreePointCoverage(coverResult);
  syncCeControls(ce);

  ctx.clearRect(0, 0, config.canvasSize, config.canvasSize);
  drawHexagon(ctx);
  if (coverResult && showCoverOverlay) {
    drawCoverTriangleOverlay(ctx, coverResult.vTriangles);
  }
  drawSelectedHalfDiagonals(ctx, selectedHalfDiagonalIndices);
  drawHoveredHalfDiagonal(ctx, hoveredHalfDiagonalIndex);
  drawShape(ctx, triangleState, shapeMode);
  if (shapeMode === 'triangle') {
    drawControlPoint(ctx, triangleState);
    drawCeIntervals(ctx, ce?.intervals ?? [], chain.selectedInterval);
  }
  drawSymmetricPoints(ctx, new Set(pointCoverage.failures));

  if (shapeMode === 'local-c') {
    gammaValues.textContent = 'manual c_i mode';
    localCBounds.textContent = `max c = ${formatTuple(maxima)}`;
    localCValues.textContent = `c = ${formatTuple(localCs)}`;
    drawLocalCControls(ctx, maxima, localCs);
  } else {
    gammaValues.textContent = `γ = ${formatTuple(gammas)}`;
    localCBounds.textContent = strict > 0
      ? `1 - γ + strictEps = ${formatTuple(maxima)}`
      : `1 - γ = ${formatTuple(maxima)}`;
    localCValues.textContent = `c = ${formatTuple(localCs)}`;
  }
  ceStatus.textContent = summarizeCe(ce);
  ceStatus.style.color = ce?.kind === 'unsupported' ? '#b91c1c' : '#475569';
  ceChainStatus.textContent = summarizeCeChain(chain);
  ceChainStatus.style.color = chain.passes === null ? '#475569' : chain.passes ? '#047857' : '#b91c1c';
  drawPropagationMarkers(ctx, chain);
  if (coverResult && showCoverOverlay) {
    drawCoverageGaps(ctx, coverResult.segments);
    coverOverlayStatus.textContent = summarizeCoverResult(coverResult, pointCoverage);
    coverOverlayStatus.style.color = coverResult.coverageOk && pointCoverage.failures.length === 0 && coverResult.tooLargeTriangles.length === 0
      ? '#047857'
      : '#b91c1c';
  } else if (coverResult) {
    coverOverlayStatus.textContent = summarizeCoverResult(coverResult, pointCoverage);
    coverOverlayStatus.style.color = coverResult.coverageOk && pointCoverage.failures.length === 0 && coverResult.tooLargeTriangles.length === 0
      ? '#047857'
      : '#b91c1c';
  } else if (!isCoverOverlayAvailable()) {
    coverOverlayStatus.textContent = 'Free mode owns triangle overlay';
    coverOverlayStatus.style.color = '#64748b';
  } else {
    coverOverlayStatus.textContent = 'cover overlay off';
    coverOverlayStatus.style.color = '#475569';
  }

  regionRenderer.setMode(graphMode);
  regionRenderer.setSingleParameter(parseFloat(cSlider.value));
  regionRenderer.setLocalCs(chain.localCs);
  regionRenderer.setSelectedLocalCs(
    getSelectedLocalCsForChain(chain, localCs),
    getSelectedLocalCsLabel(chain),
  );
  regionRenderer.setStartValue(chain.start);
  regionRenderer.setHoverLocalC(
    hoveredHalfDiagonalIndex === null ? null : localCs[hoveredHalfDiagonalIndex] ?? null,
    hoveredHalfDiagonalIndex === null
      ? undefined
      : getHoverLocalCLabel(chain, hoveredHalfDiagonalIndex, localCs[hoveredHalfDiagonalIndex] ?? 0),
  );
  regionRenderer.render();
  syncControllerSnapshot();
}

// Slider for c parameter
cSlider.addEventListener('input', () => {
  const c = parseFloat(cSlider.value);
  cValueLabel.textContent = c.toFixed(2);
  render();
});

strictCheckToggle.addEventListener('change', () => {
  setStrictCheckEnabled(strictCheckToggle.checked);
  syncStrictCheckControls();
  syncFreeStrictEps(shapeMode === 'free');
  render();
});

strictEpsSlider.addEventListener('input', () => {
  setStrictEps(clampStrictEpsValue(parseFloat(strictEpsSlider.value), strictEpsUpperBound));
  syncStrictCheckControls();
  syncFreeStrictEps(shapeMode === 'free');
  render();
});

strictEpsInput.addEventListener('change', () => {
  setStrictEps(clampStrictEpsValue(parseFloat(strictEpsInput.value), strictEpsUpperBound));
  syncStrictCheckControls();
  syncFreeStrictEps(shapeMode === 'free');
  render();
});

strictEpsMaxInput.addEventListener('change', () => {
  strictEpsUpperBound = clampStrictEpsUpperBound(parseFloat(strictEpsMaxInput.value));
  setStrictEps(clampStrictEpsValue(getStrictEps(), strictEpsUpperBound));
  syncStrictCheckControls();
  syncFreeStrictEps(shapeMode === 'free');
  render();
});

coverOverlayToggle.addEventListener('change', () => {
  showCoverOverlay = coverOverlayToggle.checked && isCoverOverlayAvailable();
  syncModeButtons();
  render();
});

pointToolToggle.addEventListener('click', () => {
  pointToolActive = !pointToolActive;
  syncPointToolControls();
  render();
});

pointDeleteButton.addEventListener('click', () => {
  deleteSelectedPointSeed();
  render();
});

pointClearButton.addEventListener('click', () => {
  clearPointSeeds();
  render();
});

ceDirectionSelect.addEventListener('change', () => {
  if (isCeDirection(ceDirectionSelect.value)) {
    ceDirection = ceDirectionSelect.value;
    render();
  }
});

ceIntervalSelect.addEventListener('change', () => {
  ce2SelectedIntervalIndex = ceIntervalSelect.value === '1' ? 1 : 0;
  render();
});

ceStartResetButton.addEventListener('click', resetCurrentCeStart);

cValueLabel.textContent = parseFloat(cSlider.value).toFixed(2);
admissibleEditor.value = getAdmissibleOrderedSource();
syncStrictCheckControls();
syncAdmissibleEditorStatus();

admissibleEditor.addEventListener('input', () => {
  if (admissibleEditorTimer !== null) {
    window.clearTimeout(admissibleEditorTimer);
  }
  admissibleEditorTimer = window.setTimeout(() => {
    applyAdmissibleEditorSource();
  }, 250);
});

admissibleResetButton.addEventListener('click', () => {
  if (admissibleEditorTimer !== null) {
    window.clearTimeout(admissibleEditorTimer);
    admissibleEditorTimer = null;
  }
  resetAdmissibleOrderedSource();
  admissibleEditor.value = getAdmissibleOrderedSource();
  syncAdmissibleEditorStatus();
  render();
});

controllerStateCopyButton.addEventListener('click', async () => {
  syncControllerSnapshot();
  try {
    await navigator.clipboard.writeText(controllerState.value);
    setControllerStateStatus('Snapshot copied.');
  } catch {
    controllerState.select();
    setControllerStateStatus('Clipboard unavailable. JSON selected for manual copy.');
  }
});

controllerStateLoadButton.addEventListener('click', () => {
  try {
    loadControllerSnapshot(controllerState.value);
  } catch (error) {
    setControllerStateStatus(
      error instanceof Error ? error.message : 'Failed to load snapshot.',
      true,
    );
  }
});

freeControls.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const targetButton = target.closest<HTMLButtonElement>('[data-free-target]');
  if (targetButton) {
    freeState.target = targetButton.dataset.freeTarget as FreeTarget;
    render();
    return;
  }
  const toolButton = target.closest<HTMLButtonElement>('[data-free-tool]');
  if (toolButton) {
    setFreeTool(toolButton.dataset.freeTool as FreeTool);
    render();
    return;
  }
  const clearSamplesButton = target.closest<HTMLButtonElement>('[data-clear-samples]');
  if (clearSamplesButton) {
    freeState.sampling = { v: [], c: [], rejected: [] };
    currentV0Sample = null;
    currentCSample = null;
    freeState.status = 'Cleared sampling data.';
    render();
    return;
  }
  const deletePointSeedButton = target.closest<HTMLButtonElement>('[data-delete-point-seed]');
  if (deletePointSeedButton) {
    deleteSelectedPointSeed();
    render();
    return;
  }
  const clearPointSeedsButton = target.closest<HTMLButtonElement>('[data-clear-point-seeds]');
  if (clearPointSeedsButton) {
    clearPointSeeds();
    render();
    return;
  }
  const addTargetTButton = target.closest<HTMLButtonElement>('[data-add-target-t]');
  if (addTargetTButton) {
    freeState.targetTPoints.push({ id: nextTargetTId(), t: DEFAULT_TARGET_T, fixed: false });
    freeState.status = 'Added S_t point position.';
    refreshLabels(freeState);
    render();
    return;
  }
  const deleteTargetTButton = target.closest<HTMLButtonElement>('[data-delete-target-t]');
  if (deleteTargetTButton) {
    const id = deleteTargetTButton.dataset.deleteTargetT;
    if (id && freeState.targetTPoints.length > 1) {
      freeState.targetTPoints = freeState.targetTPoints.filter((candidate) => candidate.id !== id);
      clearTargetTReferences(id);
      freeState.status = `Deleted ${id}.`;
      refreshLabels(freeState);
      render();
    }
    return;
  }
  const selectButton = target.closest<HTMLButtonElement>('[data-select-triangle]');
  if (selectButton) {
    freeState.selectedTriangleId = selectButton.dataset.selectTriangle as FreeTriangleId;
    render();
    return;
  }
  const deleteButton = target.closest<HTMLButtonElement>('[data-delete-label]');
  if (deleteButton) {
    const id = deleteButton.dataset.deleteLabel;
    freeState.labels = freeState.labels.filter((label) => label.id !== id);
    for (const triangle of freeState.triangles) {
      if (triangle.edgePointConstraint?.point.kind === 'label' && triangle.edgePointConstraint.point.labelId === id) {
        triangle.edgePointConstraint = null;
      }
      for (const coordinate of ['a', 'b', 'c'] as FreeVd0Coordinate[]) {
        const source = triangle.vd0.rawSources?.[coordinate];
        if (source?.kind === 'label' && source.labelId === id) {
          delete triangle.vd0.rawSources[coordinate];
        }
      }
    }
    freeState.status = `Deleted ${id}.`;
    refreshLabels(freeState);
    render();
  }
});

freeControls.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if ('showAllSamples' in target.dataset) {
    showAllSamplePoints = (target as HTMLInputElement).checked;
    render();
    return;
  }
  const targetTFixed = target.dataset.targetTFixed;
  if (targetTFixed) {
    const point = freeState.targetTPoints.find((candidate) => candidate.id === targetTFixed);
    if (point) {
      point.fixed = (target as HTMLInputElement).checked;
    }
    render();
    return;
  }
  const targetTValue = target.dataset.targetTValue;
  if (targetTValue) {
    const point = freeState.targetTPoints.find((candidate) => candidate.id === targetTValue);
    const value = Number((target as HTMLInputElement).value);
    if (point && Number.isFinite(value)) {
      point.t = clamp01(value);
      refreshLabels(freeState);
    }
    render();
    return;
  }
  const fixed = target.dataset.fixed;
  if (fixed) {
    const triangle = getTriangle(freeState, fixed as FreeTriangleId);
    triangle.fixed = (target as HTMLInputElement).checked;
    if (!triangle.fixed) {
      triangle.hidden = false;
    }
    render();
    return;
  }
  const hidden = target.dataset.hidden;
  if (hidden) {
    const triangle = getTriangle(freeState, hidden as FreeTriangleId);
    triangle.hidden = (target as HTMLInputElement).checked;
    if (triangle.hidden) {
      triangle.fixed = true;
    }
    render();
    return;
  }
  const midpointSetting = target.dataset.midpoint;
  if (midpointSetting) {
    const [id, rawIndex] = midpointSetting.split(':');
    const triangle = getTriangle(freeState, id as FreeTriangleId);
    const index = clampInteger(rawIndex, 0, 5);
    triangle.midpointConstraints[index] = (target as HTMLInputElement).checked;
    projectTriangleToConstraints(freeState, triangle);
    refreshLabels(freeState);
    render();
    return;
  }
  const vd0Enabled = target.dataset.vd0Enabled;
  if (vd0Enabled) {
    const triangle = getTriangle(freeState, vd0Enabled as FreeTriangleId);
    triangle.vd0.enabled = (target as HTMLInputElement).checked;
    if (triangle.vd0.enabled) {
      autoPlaceAllFreeVd0FromControls();
    }
    render();
    return;
  }
  const vd0Mode = target.dataset.vd0Mode;
  if (vd0Mode) {
    const triangle = getTriangle(freeState, vd0Mode as FreeTriangleId);
    if (target.value === 'max-c' || target.value === 'max-a' || target.value === 'max-b') {
      triangle.vd0.mode = target.value as FreeVd0Mode;
      if (triangle.vd0.enabled) {
        autoPlaceAllFreeVd0FromControls();
      }
      render();
    }
    return;
  }
  const vd0RawSource = target.dataset.vd0RawSource;
  if (vd0RawSource) {
    const [id, coordinate] = vd0RawSource.split(':') as [FreeTriangleId, FreeVd0Coordinate];
    const triangle = getTriangle(freeState, id);
    if (coordinate !== 'a' && coordinate !== 'b' && coordinate !== 'c') {
      return;
    }
    if (!triangle.vd0.rawSources) {
      triangle.vd0.rawSources = {};
    }
    if (target.value === '') {
      delete triangle.vd0.rawSources[coordinate];
    } else {
      const source = decodeNamedPointRef(target.value);
      if (source?.kind === 'V' || source?.kind === 'M' || source?.kind === 'P' || source?.kind === 'B' || source?.kind === 'label') {
        triangle.vd0.rawSources[coordinate] = source;
      }
    }
    if (triangle.vd0.enabled) {
      autoPlaceAllFreeVd0FromControls();
    }
    render();
    return;
  }
  const edgeIndexTarget = target.dataset.edgeIndex;
  if (edgeIndexTarget) {
    const triangle = getTriangle(freeState, edgeIndexTarget as FreeTriangleId);
    if (target.value === '') {
      triangle.edgePointConstraint = null;
    } else {
      triangle.edgePointConstraint = {
        edgeIndex: clampInteger(target.value, 0, 2),
        point: triangle.edgePointConstraint?.point ?? { kind: 'O' },
      };
      projectTriangleToConstraints(freeState, triangle);
    }
    refreshLabels(freeState);
    render();
    return;
  }
  const edgePointTarget = target.dataset.edgePoint;
  if (edgePointTarget) {
    const triangle = getTriangle(freeState, edgePointTarget as FreeTriangleId);
    const point = decodeNamedPointRef(target.value);
    if (point) {
      triangle.edgePointConstraint = {
        edgeIndex: triangle.edgePointConstraint?.edgeIndex ?? 0,
        point,
      };
      projectTriangleToConstraints(freeState, triangle);
      refreshLabels(freeState);
      render();
    }
    return;
  }
  const manualXTarget = target.dataset.manualX;
  const manualYTarget = target.dataset.manualY;
  if (manualXTarget || manualYTarget) {
    const triangle = getTriangle(freeState, (manualXTarget ?? manualYTarget) as FreeTriangleId);
    if (!triangle.edgePointConstraint || triangle.edgePointConstraint.point.kind !== 'manual') {
      return;
    }
    const current = triangle.edgePointConstraint.point.manualPoint ?? { x: 0, y: 0 };
    const nextValue = Number(target.value);
    if (!Number.isFinite(nextValue)) {
      return;
    }
    triangle.edgePointConstraint.point.manualPoint = manualXTarget
      ? { x: nextValue, y: current.y }
      : { x: current.x, y: nextValue };
    projectTriangleToConstraints(freeState, triangle);
    refreshLabels(freeState);
    render();
  }
});

freeStateCopyButton.addEventListener('click', async () => {
  freeStateJson.value = formatFreeSnapshot();
  try {
    await navigator.clipboard.writeText(freeStateJson.value);
    setFreeStateStatus('Free snapshot copied.');
  } catch {
    freeStateJson.select();
    setFreeStateStatus('Clipboard unavailable. JSON selected for manual copy.');
  }
});

freeStateLoadButton.addEventListener('click', () => {
  try {
    loadFreeSnapshot(freeStateJson.value);
    setFreeStateStatus('Free snapshot loaded.');
    render();
  } catch (error) {
    setFreeStateStatus(error instanceof Error ? error.message : 'Failed to load free snapshot.', true);
  }
});

abUnionControls.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.hullDebugClose !== undefined) {
    closeAbHullDebugPolygon(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugUndo !== undefined) {
    undoAbHullDebugVertex(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugDelete !== undefined) {
    deleteSelectedAbHullDebugVertex(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugClear !== undefined) {
    clearAbHullDebugPolygon(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugReset !== undefined) {
    resetAbHullDebugExample(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugSuggested !== undefined) {
    loadSuggestedAbHullDebugPolygon(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugExport !== undefined) {
    if (currentAbHullDebugResult) {
      exportAbHullDebugExperiment(abHullDebugState, currentAbHullDebugResult);
    }
    render();
    return;
  }
  if (target.dataset.hullDebugClearExports !== undefined) {
    clearAbHullDebugExports(abHullDebugState);
    render();
    return;
  }
  if (target.dataset.hullDebugCopyExports !== undefined) {
    const exportCount = abHullDebugState.exports.length;
    if (exportCount === 0) {
      abHullDebugState.status = 'No exported experiments to copy.';
      render();
      return;
    }
    try {
      await navigator.clipboard.writeText(formatAbHullDebugExports(abHullDebugState));
      abHullDebugState.status = `Copied ${exportCount} exported experiment${exportCount === 1 ? '' : 's'} as JSON.`;
      render();
    } catch {
      abHullDebugState.status = 'Clipboard unavailable. JSON selected for manual copy.';
      render();
      const textarea = document.getElementById('ab-hull-debug-export-json') as HTMLTextAreaElement | null;
      textarea?.focus();
      textarea?.select();
    }
    return;
  }
  const areaTool = target.dataset.areaTool;
  if (areaTool === 'move' || areaTool === 'add' || areaTool === 'delete' || areaTool === 'f-mark') {
    setAbUnionTool(areaConjState, areaTool);
    render();
    return;
  }
  if (target.dataset.areaFmarkDelete !== undefined) {
    deleteSelectedAbUnionFMark(areaConjState);
    render();
    return;
  }
  if (target.dataset.areaFmarkClear !== undefined) {
    clearAbUnionFMarks(areaConjState);
    render();
    return;
  }
  if (target.dataset.areaRecompute !== undefined) {
    recomputeAreaConjResults();
    render();
    return;
  }
  const areaPreset = target.dataset.areaPreset as AbUnionPreset | undefined;
  if (areaPreset) {
    setAbUnionPreset(areaConjState, areaPreset);
    markAreaConjDirty();
    recomputeAreaConjResults();
    render();
    return;
  }
  if (target.dataset.maxAreaRecompute !== undefined) {
    recomputeMaxArea();
    render();
    return;
  }
  const tool = target.dataset.abTool;
  if (tool === 'move' || tool === 'add' || tool === 'delete' || tool === 'd-mark' || tool === 's-mark' || tool === 'f-mark') {
    setAbUnionTool(abUnionState, tool);
    render();
    return;
  }
  if (target.dataset.abFmarkDelete !== undefined) {
    deleteSelectedAbUnionFMark(abUnionState);
    render();
    return;
  }
  if (target.dataset.abFmarkClear !== undefined) {
    clearAbUnionFMarks(abUnionState);
    render();
    return;
  }
  const snapLabel = target.dataset.abSnapLabel;
  const snapRole = target.dataset.abSnapRole;
  if (snapLabel && isAbUnionCoincidenceRole(snapRole)) {
    const edge = Number(target.dataset.abSnapEdge);
    if (Number.isInteger(edge) && edge >= 0 && edge < 6) {
      snapAbUnionLabelToEdge(abUnionState, snapLabel, edge, snapRole);
      render();
    }
    return;
  }
  const deleteLabel = target.dataset.abDeleteLabel;
  if (deleteLabel) {
    deleteAbUnionLabel(abUnionState, deleteLabel);
    render();
    return;
  }
  const preset = target.dataset.abPreset as AbUnionPreset | undefined;
  if (preset) {
    setAbUnionPreset(abUnionState, preset);
    render();
    return;
  }
  if (target.dataset.abOptimize !== undefined) {
    if (abUnionState.autoOptimizeTheta) return;
    abUnionState.lastOptimized = optimizeAbUnionTheta(abUnionState);
    abUnionState.theta = abUnionState.lastOptimized.theta;
    abUnionState.thetaOptimizationPending = false;
    render();
    return;
  }
});

abUnionControls.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const debugParam = target.dataset.hullDebugParam;
  if (isAbHullDebugParam(debugParam)) {
    if (target.type === 'number') return;
    setAbHullDebugParameter(abHullDebugState, debugParam, Number(target.value));
    syncAbHullDebugParameterControls();
    return;
  }
  if (target.dataset.maxAreaParam !== undefined) {
    if (target.type === 'number') return;
    applyMaxAreaParameterInput(target, false);
    syncMaxAreaParameterControls();
    renderMaxAreaCanvasAndReadouts();
    return;
  }
  if (target.dataset.abTheta !== undefined) {
    if (abUnionState.autoOptimizeTheta) return;
    abUnionState.theta = Math.max(0, Math.min(120, Number(target.value))) * Math.PI / 180;
    abUnionState.lastOptimized = null;
    render();
  }
});

abUnionControls.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (applyAreaDeltaInput(target)) {
    render();
    event.preventDefault();
    return;
  }
  if (applyMaxAreaParameterInput(target, true)) {
    render();
    event.preventDefault();
    return;
  }
  if (!applyAbHullDebugParameterInput(target)) return;
  render();
  event.preventDefault();
});

abUnionControls.addEventListener('wheel', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (shapeMode === 'max-area') {
    const param = target.dataset.maxAreaParam;
    if (!isMaxAreaParam(param) || event.deltaY === 0) return;
    const direction = event.deltaY < 0 ? 1 : -1;
    setMaxAreaParameter(param, maxAreaState[param] + direction * AREA_WHEEL_STEP, true);
    render();
    event.preventDefault();
    return;
  }
  if (shapeMode !== 'ab-hull-debug') return;
  const debugParam = target.dataset.hullDebugParam;
  if (!isAbHullDebugParam(debugParam) || event.deltaY === 0) return;
  const direction = event.deltaY < 0 ? 1 : -1;
  setAbHullDebugParameter(
    abHullDebugState,
    debugParam,
    abHullDebugState[debugParam] + direction * AB_HULL_DEBUG_WHEEL_STEP,
  );
  render();
  event.preventDefault();
});

abUnionControls.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && applyAreaDeltaInput(target)) {
    render();
    return;
  }
  if (target instanceof HTMLInputElement && applyMaxAreaParameterInput(target, true)) {
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.maxAreaSumMode !== undefined) {
    const mode = target.checked ? target.dataset.maxAreaSumMode : 'none';
    if (isAreaSumConstraintMode(mode)) {
      setMaxAreaSumConstraint(mode);
      render();
    }
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.maxAreaQuality !== undefined) {
    if (isAreaQuality(target.value)) {
      maxAreaState.quality = target.value;
      recomputeMaxArea();
      render();
    }
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.areaQuality !== undefined) {
    if (isAreaQuality(target.value)) {
      areaConjQuality = target.value;
      markAreaConjDirty();
      recomputeAreaConjResults();
      render();
    }
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.areaSumMode !== undefined) {
    const index = Number(target.dataset.areaSumIndex);
    const mode = target.checked ? target.dataset.areaSumMode : 'none';
    if (Number.isInteger(index) && index >= 0 && index < 6) {
      if (isAreaSumConstraintMode(mode)) {
        setAbUnionSumConstraint(areaConjState, index, mode, areaConstraintDelta);
      }
      markAreaConjDirty();
      recomputeAreaConjResults();
      render();
    }
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.areaLockKind !== undefined) {
    const index = Number(target.dataset.areaLockIndex);
    const kind = target.dataset.areaLockKind;
    if (Number.isInteger(index) && index >= 0 && index < 6) {
      if (kind === 'a' || kind === 'b') {
        setAbUnionLock(areaConjState, kind, index, target.checked);
      }
      markAreaConjDirty();
      recomputeAreaConjResults();
      render();
    }
    return;
  }
  if (target instanceof HTMLInputElement && applyAbHullDebugParameterInput(target)) {
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abShowOriginal !== undefined) {
    abUnionState.showOriginalRegion = target.checked;
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abShowTheta !== undefined) {
    abUnionState.showThetaTriangle = target.checked;
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abAutoTheta !== undefined) {
    abUnionState.autoOptimizeTheta = target.checked;
    if (target.checked) {
      requestAbUnionThetaOptimization(abUnionState);
    }
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abShowFarPair !== undefined) {
    abUnionState.showFarPair = target.checked;
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abClipSectors !== undefined) {
    abUnionState.clipToCornerSectors = target.checked;
    requestAbUnionThetaOptimization(abUnionState);
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abAxisHull !== undefined) {
    abUnionState.useAxisAlignedHull = target.checked;
    requestAbUnionThetaOptimization(abUnionState);
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abCenterLocked !== undefined) {
    abUnionState.centerLocked = target.checked;
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abCoincidenceLabel !== undefined) {
    const edge = Number(target.dataset.abCoincidenceEdge);
    const role = target.dataset.abCoincidenceRole;
    if (Number.isInteger(edge) && edge >= 0 && edge < 6 && isAbUnionCoincidenceRole(role)) {
      setAbUnionCoincidenceLock(abUnionState, target.dataset.abCoincidenceLabel, edge, role, target.checked);
      render();
    }
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abRegionVisible !== undefined) {
    const index = Number(target.dataset.abRegionVisible);
    if (Number.isInteger(index) && index >= 0 && index < 6) {
      abUnionState.regionVisible[index] = target.checked;
      render();
    }
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abSumMode !== undefined) {
    const index = Number(target.dataset.abSumIndex);
    const mode = target.checked ? target.dataset.abSumMode : 'none';
    if (Number.isInteger(index) && index >= 0 && index < 6) {
      if (isAreaSumConstraintMode(mode)) {
        setAbUnionSumConstraint(abUnionState, index, mode, areaConstraintDelta);
      }
      render();
    }
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.abLockKind !== undefined) {
    const index = Number(target.dataset.abLockIndex);
    const kind = target.dataset.abLockKind;
    if (Number.isInteger(index) && index >= 0 && index < 6) {
      if (kind === 'a' || kind === 'b') {
        setAbUnionLock(abUnionState, kind, index, target.checked);
      }
      render();
    }
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.abCenterMode !== undefined) {
    const value = target.value;
    if (value === 'none' || value === 'triangle' || value === 'circle' || value === 'local-c') {
      abUnionState.centerMode = value as AbUnionCenterMode;
      render();
    }
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.abQuality !== undefined) {
    const value = target.value;
    if (value === 'coarse' || value === 'high' || value === 'adaptive') {
      abUnionState.quality = value as AbUnionQuality;
      requestAbUnionThetaOptimization(abUnionState);
      render();
    }
  }
});

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode as GraphMode | undefined;
    if (!mode) return;
    graphMode = mode;
    syncModeButtons();
    render();
  });
}

for (const button of shapeButtons) {
  button.addEventListener('click', () => {
    const mode = button.dataset.shapeMode as ShapeMode | undefined;
    if (!mode) return;
    shapeMode = mode;
    syncModeButtons();
    render();
  });
}

setupInteraction(
  canvas,
  triangleState,
  () => shapeMode,
  () => currentLocalCMaxima,
  () => manualLocalCs,
  (index, value) => {
    manualLocalCs[index] = clampToLocalCMax(value, currentLocalCMaxima[index] ?? 1);
  },
  render,
  (value) => {
    setCurrentStartValue(value);
  },
  getCurrentStartValueSegment,
  (index) => {
    if (hoveredHalfDiagonalIndex === index) {
      return;
    }
    hoveredHalfDiagonalIndex = index;
    render();
  },
  (index) => {
    toggleSelectedHalfDiagonal(index);
    render();
  },
  {
    isActive: () => pointToolActive,
    seeds: () => freeState.pointSeeds,
    create: addPointSeed,
    move: movePointSeed,
    select: selectPointSeed,
  },
);

setupAbUnionInteraction(
  canvas,
  () => shapeMode === 'ab-union',
  () => abUnionState,
  triangleState,
  () => manualLocalCs,
  (index, value) => {
    manualLocalCs[index] = clampToLocalCMax(value, 1);
  },
  render,
);

setupAbHullDebugInteraction(
  canvas,
  () => shapeMode === 'ab-hull-debug',
  () => abHullDebugState,
  render,
);

setupAbUnionInteraction(
  canvas,
  () => shapeMode === 'area-conj',
  () => areaConjState,
  triangleState,
  () => manualLocalCs,
  (index, value) => {
    manualLocalCs[index] = clampToLocalCMax(value, 1);
  },
  render,
  {
    onPreviewChange: markAreaConjDirty,
    onCommitChange: recomputeAreaConjResults,
  },
);

setupAbUnionInteraction(
  canvas,
  () => shapeMode === 'conj-0521',
  () => conj0521State,
  triangleState,
  () => manualLocalCs,
  (index, value) => {
    manualLocalCs[index] = clampToLocalCMax(value, 1);
  },
  render,
);

setupAbUnionInteraction(
  canvas,
  () => shapeMode === 'conj-0525',
  () => conj0525State,
  triangleState,
  () => manualLocalCs,
  (index, value) => {
    manualLocalCs[index] = clampToLocalCMax(value, 1);
  },
  render,
);

freeInteractionApi = setupFreeInteraction(canvas, () => freeState, render, () => {
  if (freeState.tool !== 'sample') {
    autoPlaceAllFreeVd0FromControls();
  }
  render();
});
window.addEventListener('resize', () => {
  syncCanvasSizes();
  render();
});

syncCanvasSizes();
syncModeButtons();
render();
