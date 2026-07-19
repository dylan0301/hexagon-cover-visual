import {
  composeLocalCs,
  composeTwoLocalCs,
  experimentallyCheckComposePairDominatesIdentity,
  gAtLocalC,
  type ComposePairExperimentResult,
} from "./maps";

const BASE_CSS_SIZE = 600;
const BASE_PADDING = 48;
const BASE_FONT_SIZE = 13;
const BASE_SMALL_FONT_SIZE = 11;
const GRID_COLOR = "#e5e7eb";
const AXIS_COLOR = "#94a3b8";
const IDENTITY_COLOR = "#cbd5e1";
const SINGLE_GRAPH_COLOR = "#2563eb";
const COMPOSITION_COLOR = "#b45309";
const HOVER_GRAPH_COLOR = "#facc15";
const PAIR_PASS_COLOR = "#2563eb";
const PAIR_FAIL_COLOR = "#dc2626";
const POINT_COLOR = "#dc2626";
const TEXT_COLOR = "#334155";
const PAIR_CONTROLLER_FILL = "rgba(248, 250, 252, 0.94)";
const PAIR_CONTROLLER_BORDER = "#94a3b8";
const PAIR_TRACE_LIMIT = 2400;
const PAIR_TRACE_EPS = 0.002;
const BASE_PAIR_CONTROLLER_SIZE = 160;
const BASE_PAIR_CONTROLLER_MARGIN = 14;
const BASE_PAIR_HANDLE_RADIUS = 6;
const PAIR_EXPERIMENT_SAMPLES = 512;
const GRAPH_FLATNESS_PX = 0.25;
const MAX_GRAPH_DEPTH = 16;
const MIN_GRAPH_SPAN = 1 / 16384;

export type GraphMode = "composition" | "single" | "pair";

export interface RegionRenderer {
  render(): void;
  resize(cssSize: number): void;
  setMode(mode: GraphMode): void;
  setSingleParameter(value: number): void;
  setLocalCs(localCs: number[]): void;
  setSelectedLocalCs(localCs: number[], label?: string): void;
  setStartValue(value: number): void;
  setHoverLocalC(value: number | null, label?: string): void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

interface GraphPoint {
  x: number;
  y: number;
}

interface CanvasPoint {
  x: number;
  y: number;
}

interface PairParameters {
  c1: number;
  c2: number;
}

interface PairTracePoint extends PairParameters {
  passes: boolean;
}

export function createRegionRenderer(
  canvas: HTMLCanvasElement,
): RegionRenderer {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas not supported");
  }
  const ctx = context;

  let cssSize = BASE_CSS_SIZE;
  let dpr = 0;
  let padding = BASE_PADDING;
  let plotSize = cssSize - 2 * padding;
  let fontSize = BASE_FONT_SIZE;
  let smallFontSize = BASE_SMALL_FONT_SIZE;
  let pairControllerSize = BASE_PAIR_CONTROLLER_SIZE;
  let pairControllerMargin = BASE_PAIR_CONTROLLER_MARGIN;
  let pairHandleRadius = BASE_PAIR_HANDLE_RADIUS;

  let mode: GraphMode = "composition";
  let singleParameter = 0.5;
  let localCs = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  let selectedLocalCs: number[] = [];
  let selectedLocalCsLabel = "";
  let startValue = 0.25;
  let hoverLocalC: number | null = null;
  let hoverLocalCLabel = "";
  let pairParameters: PairParameters = { c1: 0.5, c2: 0.5 };
  const pairTrace: PairTracePoint[] = [];
  let draggingPairController = false;
  let activePointerId: number | null = null;
  let activePointerType = "mouse";

  function scaleFromBase(value: number, minValue: number): number {
    return Math.max(minValue, Math.round((value * cssSize) / BASE_CSS_SIZE));
  }

  function resize(nextCssSize: number): void {
    const roundedCssSize = Math.max(1, Math.round(nextCssSize));
    const nextDpr = window.devicePixelRatio || 1;
    if (roundedCssSize === cssSize && nextDpr === dpr) {
      return;
    }

    cssSize = roundedCssSize;
    dpr = nextDpr;
    padding = scaleFromBase(BASE_PADDING, 28);
    plotSize = Math.max(1, cssSize - 2 * padding);
    fontSize = scaleFromBase(BASE_FONT_SIZE, 11);
    smallFontSize = scaleFromBase(BASE_SMALL_FONT_SIZE, 10);
    pairControllerSize = scaleFromBase(BASE_PAIR_CONTROLLER_SIZE, 96);
    pairControllerMargin = scaleFromBase(BASE_PAIR_CONTROLLER_MARGIN, 8);
    pairHandleRadius = scaleFromBase(BASE_PAIR_HANDLE_RADIUS, 5);

    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function toCanvas(x: number, y: number): CanvasPoint {
    return {
      x: padding + clamp01(x) * plotSize,
      y: cssSize - padding - clamp01(y) * plotSize,
    };
  }

  function distanceToSegment(
    point: CanvasPoint,
    start: CanvasPoint,
    end: CanvasPoint,
  ): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const t = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2),
    );
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }

  function getCanvasPoint(event: PointerEvent): CanvasPoint {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? cssSize / rect.width : 1;
    const scaleY = rect.height > 0 ? cssSize / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function getPairControllerRect(): { x: number; y: number; size: number } {
    return {
      x: cssSize - padding - pairControllerSize - pairControllerMargin,
      y: padding + pairControllerMargin,
      size: pairControllerSize,
    };
  }

  function pairToCanvas(c1: number, c2: number): CanvasPoint {
    const rect = getPairControllerRect();
    return {
      x: rect.x + clamp01(c1) * rect.size,
      y: rect.y + (1 - clamp01(c2)) * rect.size,
    };
  }

  function canvasToPair(point: CanvasPoint): PairParameters {
    const rect = getPairControllerRect();
    return {
      c1: clamp01((point.x - rect.x) / rect.size),
      c2: clamp01(1 - (point.y - rect.y) / rect.size),
    };
  }

  function isInsidePairController(point: CanvasPoint): boolean {
    const rect = getPairControllerRect();
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.size &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.size
    );
  }

  function getPairExperiment(): ComposePairExperimentResult {
    return experimentallyCheckComposePairDominatesIdentity(
      pairParameters.c1,
      pairParameters.c2,
      PAIR_EXPERIMENT_SAMPLES,
    );
  }

  function pushPairTrace(c1: number, c2: number, passes: boolean): void {
    const last = pairTrace[pairTrace.length - 1];
    if (
      last &&
      last.passes === passes &&
      Math.abs(last.c1 - c1) <= PAIR_TRACE_EPS &&
      Math.abs(last.c2 - c2) <= PAIR_TRACE_EPS
    ) {
      return;
    }

    pairTrace.push({ c1, c2, passes });
    if (pairTrace.length > PAIR_TRACE_LIMIT) {
      pairTrace.shift();
    }
  }

  function ensurePairTraceSeeded(): void {
    if (pairTrace.length > 0) {
      return;
    }

    const experiment = getPairExperiment();
    pushPairTrace(pairParameters.c1, pairParameters.c2, experiment.passes);
  }

  function updatePairParametersFromCanvas(point: CanvasPoint): void {
    pairParameters = canvasToPair(point);
    const experiment = getPairExperiment();
    pushPairTrace(pairParameters.c1, pairParameters.c2, experiment.passes);
    renderCanvas();
  }

  function stopPairDragging(): void {
    draggingPairController = false;
    if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
      canvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    activePointerType = "mouse";
  }

  function updateCursor(point: CanvasPoint, pointerType: string): void {
    if (pointerType !== "mouse") {
      return;
    }

    if (mode !== "pair") {
      canvas.style.cursor = "default";
      return;
    }

    if (!isInsidePairController(point)) {
      canvas.style.cursor = "default";
      return;
    }

    const handle = pairToCanvas(pairParameters.c1, pairParameters.c2);
    const nearHandle = Math.hypot(point.x - handle.x, point.y - handle.y) <= 12;
    canvas.style.cursor = draggingPairController
      ? "grabbing"
      : nearHandle
        ? "grab"
        : "crosshair";
  }

  function onPointerMove(event: PointerEvent): void {
    const pointerType =
      activePointerId === event.pointerId ? activePointerType : (event.pointerType || "mouse");
    const point = getCanvasPoint(event);
    if (!draggingPairController) {
      updateCursor(point, pointerType);
      return;
    }

    if (activePointerId !== event.pointerId) {
      return;
    }

    updatePairParametersFromCanvas(point);
    updateCursor(point, pointerType);
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) {
      return;
    }

    const point = getCanvasPoint(event);
    const pointerType = activePointerType;
    stopPairDragging();
    updateCursor(point, pointerType);
  }

  function onPointerCancel(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) {
      return;
    }

    stopPairDragging();
    canvas.style.cursor = "default";
  }

  function onPointerDown(event: PointerEvent): void {
    if (mode !== "pair" || !event.isPrimary) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!isInsidePairController(point)) {
      updateCursor(point, event.pointerType || "mouse");
      return;
    }

    draggingPairController = true;
    activePointerId = event.pointerId;
    activePointerType = event.pointerType || "mouse";
    canvas.setPointerCapture(event.pointerId);
    updatePairParametersFromCanvas(point);
    updateCursor(point, activePointerType);
    event.preventDefault();
  }

  function drawFrame(): void {
    ctx.clearRect(0, 0, cssSize, cssSize);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssSize, cssSize);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText("0", padding - 10, cssSize - padding + fontSize + 5);
    ctx.fillText("1", cssSize - padding - 4, cssSize - padding + fontSize + 5);
    ctx.fillText("1", padding - fontSize - 5, padding + 4);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (const tick of [0.25, 0.5, 0.75]) {
      const vertical = toCanvas(tick, 0);
      ctx.beginPath();
      ctx.moveTo(vertical.x, padding);
      ctx.lineTo(vertical.x, cssSize - padding);
      ctx.stroke();

      const horizontal = toCanvas(0, tick);
      ctx.beginPath();
      ctx.moveTo(padding, horizontal.y);
      ctx.lineTo(cssSize - padding, horizontal.y);
      ctx.stroke();
    }

    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding, padding, plotSize, plotSize);

    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = IDENTITY_COLOR;
    ctx.beginPath();
    const p0 = toCanvas(0, 0);
    const p1 = toCanvas(1, 1);
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function evaluate(x: number): number {
    if (mode === "single") {
      return gAtLocalC(singleParameter, x);
    }
    if (mode === "pair") {
      return composeTwoLocalCs(pairParameters.c1, pairParameters.c2, x);
    }
    return composeLocalCs(localCs, x);
  }

  function evaluateHover(x: number): number {
    return gAtLocalC(hoverLocalC ?? 0, x);
  }

  function evaluateSelectedComposition(x: number): number {
    return composeLocalCs(selectedLocalCs, x);
  }

  function sampleGraphPointsWithEvaluator(evaluator: (x: number) => number): GraphPoint[] {
    const start: GraphPoint = { x: 0, y: evaluator(0) };
    const end: GraphPoint = { x: 1, y: evaluator(1) };
    const output: GraphPoint[] = [start];

    function subdivide(
      left: GraphPoint,
      right: GraphPoint,
      depth: number,
    ): void {
      const span = right.x - left.x;
      if (depth >= MAX_GRAPH_DEPTH || span <= MIN_GRAPH_SPAN) {
        output.push(right);
        return;
      }

      const leftCanvas = toCanvas(left.x, left.y);
      const rightCanvas = toCanvas(right.x, right.y);
      const testFractions = [0.25, 0.5, 0.75];
      let worstDeviation = 0;
      let splitPoint: GraphPoint | null = null;

      for (const fraction of testFractions) {
        const x = left.x + span * fraction;
        const point: GraphPoint = { x, y: evaluator(x) };
        const canvasPoint = toCanvas(point.x, point.y);
        const deviation = distanceToSegment(
          canvasPoint,
          leftCanvas,
          rightCanvas,
        );

        if (deviation > worstDeviation) {
          worstDeviation = deviation;
          splitPoint = point;
        }
      }

      if (worstDeviation <= GRAPH_FLATNESS_PX || splitPoint === null) {
        output.push(right);
        return;
      }

      subdivide(left, splitPoint, depth + 1);
      subdivide(splitPoint, right, depth + 1);
    }

    subdivide(start, end, 0);
    return output;
  }

  function drawGraph(pairExperiment: ComposePairExperimentResult | null): void {
    const points = sampleGraphPointsWithEvaluator(evaluate);
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      const point = toCanvas(points[i].x, points[i].y);
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    ctx.strokeStyle =
      mode === "single"
        ? SINGLE_GRAPH_COLOR
        : mode === "composition"
          ? COMPOSITION_COLOR
          : pairExperiment?.passes
            ? PAIR_PASS_COLOR
            : PAIR_FAIL_COLOR;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function drawHoverGraph(): void {
    if (mode !== "composition" || hoverLocalC === null) {
      return;
    }

    const points = sampleGraphPointsWithEvaluator(evaluateHover);
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      const point = toCanvas(points[i].x, points[i].y);
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    ctx.strokeStyle = HOVER_GRAPH_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = HOVER_GRAPH_COLOR;
    ctx.font = `${smallFontSize}px monospace`;
    ctx.fillText(
      hoverLocalCLabel || `hover g_c, c = ${hoverLocalC.toFixed(3)}`,
      padding,
      padding - 14,
    );
  }

  function drawSelectedCompositionGraph(): void {
    if (mode !== "composition" || selectedLocalCs.length === 0) {
      return;
    }

    const points = sampleGraphPointsWithEvaluator(evaluateSelectedComposition);
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      const point = toCanvas(points[i].x, points[i].y);
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.stroke();

    const x = clamp01(startValue);
    const y = evaluateSelectedComposition(x);
    const point = toCanvas(x, y);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${smallFontSize}px monospace`;
    ctx.fillText(
      selectedLocalCsLabel || `selected compose (${selectedLocalCs.length})`,
      padding,
      padding - 30,
    );
  }

  function drawMarker(): void {
    const x = clamp01(startValue);
    const y = evaluate(x);
    const point = toCanvas(x, y);
    const axisPoint = toCanvas(x, 0);

    ctx.strokeStyle = POINT_COLOR;
    ctx.fillStyle = POINT_COLOR;
    ctx.lineWidth = 1.25;

    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(axisPoint.x, axisPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${fontSize}px monospace`;
    const label =
      mode === "single"
        ? `(${x.toFixed(3)}, g_c(x) = ${y.toFixed(3)})`
        : mode === "composition"
          ? `(${x.toFixed(3)}, G(x) = ${y.toFixed(3)})`
          : `(${x.toFixed(3)}, F(x) = ${y.toFixed(3)})`;
    ctx.fillText(label, padding, fontSize + 10);
  }

  function drawPairController(pairExperiment: ComposePairExperimentResult): void {
    const rect = getPairControllerRect();

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${smallFontSize}px monospace`;
    ctx.fillText("g_c1 o g_c2", rect.x, rect.y - smallFontSize - 7);
    ctx.fillStyle = pairExperiment.passes ? PAIR_PASS_COLOR : PAIR_FAIL_COLOR;
    const status = pairExperiment.passes
      ? `>= t on ${PAIR_EXPERIMENT_SAMPLES + 1} samples`
      : `< t near t = ${pairExperiment.witnessT.toFixed(3)}`;
    ctx.fillText(status, rect.x, rect.y - 4);

    ctx.fillStyle = PAIR_CONTROLLER_FILL;
    ctx.strokeStyle = PAIR_CONTROLLER_BORDER;
    ctx.lineWidth = 1;
    ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
    ctx.strokeRect(rect.x, rect.y, rect.size, rect.size);

    ctx.strokeStyle = GRID_COLOR;
    for (const tick of [0.25, 0.5, 0.75]) {
      const x = rect.x + tick * rect.size;
      const y = rect.y + tick * rect.size;
      ctx.beginPath();
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.size, y);
      ctx.stroke();
    }

    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("c2", rect.x + 6, rect.y + smallFontSize + 1);
    ctx.fillText("c1", rect.x + rect.size - 18, rect.y + rect.size - 8);

    for (const tracePoint of pairTrace) {
      const point = pairToCanvas(tracePoint.c1, tracePoint.c2);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = tracePoint.passes ? PAIR_PASS_COLOR : PAIR_FAIL_COLOR;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const point = pairToCanvas(pairParameters.c1, pairParameters.c2);
    ctx.beginPath();
    ctx.arc(point.x, point.y, pairHandleRadius, 0, 2 * Math.PI);
    ctx.fillStyle = pairExperiment.passes ? PAIR_PASS_COLOR : PAIR_FAIL_COLOR;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawLabels(): void {
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText("x", cssSize - padding + 10, cssSize - padding + 4);
    ctx.fillText("y", padding - 4, padding - 12);

    const title =
      mode === "single"
        ? "g_c"
        : mode === "composition"
          ? "G = compose chain"
          : "F = g_c1 o g_c2";
    ctx.fillText(title, padding, cssSize - 16);
  }

  function renderCanvas(): void {
    ensurePairTraceSeeded();
    const pairExperiment = mode === "pair" ? getPairExperiment() : null;
    drawFrame();
    drawGraph(pairExperiment);
    drawSelectedCompositionGraph();
    drawHoverGraph();
    drawMarker();
    if (pairExperiment) {
      drawPairController(pairExperiment);
    }
    drawLabels();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", (event) => {
    if (!draggingPairController && (event.pointerType || "mouse") === "mouse") {
      canvas.style.cursor = "default";
    }
  });
  canvas.addEventListener("lostpointercapture", () => {
    draggingPairController = false;
    activePointerId = null;
    activePointerType = "mouse";
    canvas.style.cursor = "default";
  });

  resize(BASE_CSS_SIZE);
  ensurePairTraceSeeded();

  return {
    render(): void {
      renderCanvas();
    },
    resize(nextCssSize: number): void {
      resize(nextCssSize);
    },
    setMode(nextMode: GraphMode): void {
      if (nextMode !== "pair") {
        stopPairDragging();
        canvas.style.cursor = "default";
      } else {
        ensurePairTraceSeeded();
      }
      mode = nextMode;
    },
    setSingleParameter(value: number): void {
      singleParameter = clamp01(value);
    },
    setLocalCs(nextLocalCs: number[]): void {
      localCs = nextLocalCs.map(clamp01);
    },
    setSelectedLocalCs(nextLocalCs: number[], label?: string): void {
      selectedLocalCs = nextLocalCs.map(clamp01);
      selectedLocalCsLabel = label ?? "";
    },
    setStartValue(value: number): void {
      startValue = clamp01(value);
    },
    setHoverLocalC(value: number | null, label?: string): void {
      hoverLocalC = value === null ? null : clamp01(value);
      hoverLocalCLabel = value === null ? "" : (label ?? "");
    },
  };
}
