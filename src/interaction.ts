import type { Point, ShapeMode, TriangleState, InteractionState } from './types';
import { canvasToMath, config, scaleToMath } from './coords';
import {
  closestPointOnSegment,
  clampPointToCircle,
  clampPointToTriangle,
  distance,
  distanceToCircleBorder,
  distanceToSegment,
  distanceToTriangleBorder,
  pointInCircle,
  pointInTriangle,
  rotatePoint,
} from './geometry';
import { HEXAGON_VERTICES } from './hexagon';
import { CIRCUMRADIUS, getVertices, getValidRegion } from './triangle';
import { pointInHexagon, type SymmetricPointSeed } from './symmetricPoints';

const LOCAL_C_HIT_PX = 8;
const LOCAL_C_RAY_HIT_PX = 10;
const CONTROL_POINT_HIT_PX = 8;
const BORDER_HIT_PX = 6;
const START_EDGE_HIT_PX = 8;
const HALF_DIAGONAL_HIT_PX = 10;
const CLICK_CANCEL_DISTANCE_PX = 6;
const POINT_SEED_HIT_PX = 9;
const PEN_HIT_SCALE = 1.35;
const TOUCH_HIT_SCALE = 1.75;

export interface StartValueSegment {
  start: Point;
  end: Point;
}

export interface PointToolInteraction {
  isActive(): boolean;
  seeds(): SymmetricPointSeed[];
  create(point: Point): void;
  move(seedId: string, point: Point): void;
  select(seedId: string): void;
}

export function setupInteraction(
  canvas: HTMLCanvasElement,
  state: TriangleState,
  getShapeMode: () => ShapeMode,
  getLocalCMaxima: () => number[],
  getLocalCs: () => number[],
  onLocalCChange: (index: number, value: number) => void,
  render: () => void,
  onStartValueSelect?: (value: number) => void,
  getStartValueSegment?: () => StartValueSegment | null,
  onHalfDiagonalHover?: (index: number | null) => void,
  onHalfDiagonalToggle?: (index: number) => void,
  pointTool?: PointToolInteraction,
): void {
  let interaction: InteractionState = { kind: 'idle' };
  let activePointerId: number | null = null;
  let activePointerType = 'mouse';

  type HitTarget =
    | { kind: 'local-c-handle'; index: number }
    | { kind: 'control-point' }
    | { kind: 'border' }
    | { kind: 'interior' }
    | { kind: 'none' };

  function getHitScale(pointerType: string): number {
    if (pointerType === 'touch') return TOUCH_HIT_SCALE;
    if (pointerType === 'pen') return PEN_HIT_SCALE;
    return 1;
  }

  function getPointerMath(e: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? config.canvasSize / rect.width : 1;
    const scaleY = rect.height > 0 ? config.canvasSize / rect.height : 1;
    return canvasToMath({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  }

  function localCPoint(index: number, localC: number): Point {
    const vertex = HEXAGON_VERTICES[index];
    const radius = 1 - localC;
    return {
      x: vertex.x * radius,
      y: vertex.y * radius,
    };
  }

  function getLocalCHandleIndex(mouse: Point, pointerType: string): number | null {
    if (getShapeMode() !== 'local-c') {
      return null;
    }

    const maxDistance = scaleToMath(LOCAL_C_HIT_PX * getHitScale(pointerType));
    let bestIndex: number | null = null;
    let bestDistance = Infinity;
    const localCs = getLocalCs();

    for (let i = 0; i < localCs.length; i++) {
      const handle = localCPoint(i, localCs[i]);
      const handleDistance = distance(mouse, handle);
      if (handleDistance > maxDistance || handleDistance >= bestDistance) {
        continue;
      }
      bestDistance = handleDistance;
      bestIndex = i;
    }

    return bestIndex;
  }

  function getLocalCRayIndex(mouse: Point, pointerType: string): number | null {
    if (getShapeMode() !== 'local-c') {
      return null;
    }

    const maxDistance = scaleToMath(LOCAL_C_RAY_HIT_PX * getHitScale(pointerType));
    let bestIndex: number | null = null;
    let bestDistance = Infinity;

    for (let i = 0; i < 6; i++) {
      const maxLocalC = Math.max(0, Math.min(1, getLocalCMaxima()[i] ?? 0));
      const boundary = localCPoint(i, maxLocalC);
      const vertex = HEXAGON_VERTICES[i];
      const rayDistance = distanceToSegment(mouse, boundary, vertex);
      if (rayDistance > maxDistance || rayDistance >= bestDistance) {
        continue;
      }
      bestDistance = rayDistance;
      bestIndex = i;
    }

    return bestIndex;
  }

  function projectLocalC(mouse: Point, index: number): number {
    const maxLocalC = Math.max(0, Math.min(1, getLocalCMaxima()[index] ?? 0));
    const boundary = localCPoint(index, maxLocalC);
    const vertex = HEXAGON_VERTICES[index];
    const closest = closestPointOnSegment(mouse, boundary, vertex);
    return Math.max(0, Math.min(maxLocalC, distance(closest, vertex)));
  }

  function getHalfDiagonalHoverIndex(mouse: Point, pointerType: string): number | null {
    const maxDistance = scaleToMath(HALF_DIAGONAL_HIT_PX * getHitScale(pointerType));
    let bestIndex: number | null = null;
    let bestDistance = Infinity;

    for (let i = 0; i < HEXAGON_VERTICES.length; i++) {
      const vertex = HEXAGON_VERTICES[i];
      const diagonalDistance = distanceToSegment(mouse, { x: 0, y: 0 }, vertex);
      if (diagonalDistance > maxDistance || diagonalDistance >= bestDistance) {
        continue;
      }
      bestDistance = diagonalDistance;
      bestIndex = i;
    }

    return bestIndex;
  }

  function isPointToolActive(): boolean {
    const shapeMode = getShapeMode();
    return !!pointTool?.isActive() &&
      shapeMode !== 'free' &&
      shapeMode !== 'ab-union' &&
      shapeMode !== 'ab-hull-debug' &&
      shapeMode !== 'core-case';
  }

  function getPointSeedUnderPoint(mouse: Point, pointerType: string): string | null {
    if (!isPointToolActive() || !pointTool) {
      return null;
    }
    const maxDistance = scaleToMath(POINT_SEED_HIT_PX * getHitScale(pointerType));
    let best: { id: string; distance: number } | null = null;
    for (const seed of pointTool.seeds()) {
      const seedDistance = distance(mouse, seed.point);
      if (seedDistance > maxDistance || seedDistance >= (best?.distance ?? Infinity)) {
        continue;
      }
      best = { id: seed.id, distance: seedDistance };
    }
    return best?.id ?? null;
  }

  function hitTest(mouse: Point, pointerType: string): HitTarget {
    const hitScale = getHitScale(pointerType);
    const localCHandleIndex =
      getLocalCHandleIndex(mouse, pointerType) ?? getLocalCRayIndex(mouse, pointerType);
    if (localCHandleIndex !== null) {
      return { kind: 'local-c-handle', index: localCHandleIndex };
    }

    const shapeMode = getShapeMode();

    if (
      shapeMode === 'local-c' ||
      shapeMode === 'free' ||
      shapeMode === 'ab-union' ||
      shapeMode === 'ab-hull-debug' ||
      shapeMode === 'core-case'
    ) {
      return { kind: 'none' };
    }

    if (shapeMode === 'circle') {
      const borderDist = distanceToCircleBorder(mouse, state.position, CIRCUMRADIUS);
      if (borderDist <= scaleToMath(BORDER_HIT_PX * hitScale)) return { kind: 'border' };
      if (pointInCircle(mouse, state.position, CIRCUMRADIUS)) return { kind: 'interior' };
      return { kind: 'none' };
    }

    const cpDist = distance(mouse, state.controlPoint);
    if (cpDist <= scaleToMath(CONTROL_POINT_HIT_PX * hitScale)) return { kind: 'control-point' };

    const verts = getVertices(state);
    const borderDist = distanceToTriangleBorder(mouse, verts);
    if (borderDist <= scaleToMath(BORDER_HIT_PX * hitScale)) return { kind: 'border' };

    if (pointInTriangle(mouse, verts[0], verts[1], verts[2])) return { kind: 'interior' };

    return { kind: 'none' };
  }

  function getActiveStartValueSegment(): StartValueSegment {
    return getStartValueSegment?.() ?? {
      start: HEXAGON_VERTICES[0],
      end: HEXAGON_VERTICES[5],
    };
  }

  function projectStartValue(mouse: Point): number {
    const { start, end } = getActiveStartValueSegment();
    const closest = closestPointOnSegment(mouse, start, end);
    const edge = {
      x: end.x - start.x,
      y: end.y - start.y,
    };
    const edgeLen2 = edge.x * edge.x + edge.y * edge.y;
    if (edgeLen2 === 0) return 0;

    const dx = closest.x - start.x;
    const dy = closest.y - start.y;
    return Math.max(0, Math.min(1, (dx * edge.x + dy * edge.y) / edgeLen2));
  }

  function getStartValueFromMouse(mouse: Point, pointerType: string): number | null {
    if (!onStartValueSelect) return null;

    const { start, end } = getActiveStartValueSegment();
    const hitDistance = distanceToSegment(mouse, start, end);
    if (hitDistance > scaleToMath(START_EDGE_HIT_PX * getHitScale(pointerType))) return null;

    return projectStartValue(mouse);
  }

  function updateCursor(mouse: Point, pointerType: string): void {
    if (pointerType !== 'mouse') {
      return;
    }

    if (isPointToolActive()) {
      if (getPointSeedUnderPoint(mouse, pointerType)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = pointInHexagon(mouse) ? 'crosshair' : 'default';
      }
      return;
    }

    const hit = hitTest(mouse, pointerType);
    switch (hit.kind) {
      case 'local-c-handle':
      case 'control-point':
        canvas.style.cursor = 'pointer';
        break;
      case 'border':
        canvas.style.cursor = getShapeMode() === 'circle' ? 'move' : 'alias';
        break;
      case 'interior':
        canvas.style.cursor = 'move';
        break;
      default:
        canvas.style.cursor = getStartValueFromMouse(mouse, pointerType) === null
          ? 'default'
          : 'pointer';
    }
  }

  function stopInteraction(): void {
    interaction = { kind: 'idle' };
    if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
      canvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    activePointerType = 'mouse';
  }

  function onPointerDown(e: PointerEvent): void {
    if (!e.isPrimary) {
      return;
    }

    const pointerType = e.pointerType || 'mouse';
    const mouse = getPointerMath(e);
    if (isPointToolActive() && pointTool) {
      const seedId = getPointSeedUnderPoint(mouse, pointerType);
      if (seedId) {
        pointTool.select(seedId);
        interaction = { kind: 'dragging-point-seed', seedId };
        activePointerId = e.pointerId;
        activePointerType = pointerType;
        canvas.setPointerCapture(e.pointerId);
        render();
        e.preventDefault();
        return;
      }
      if (pointInHexagon(mouse)) {
        pointTool.create(mouse);
        render();
        e.preventDefault();
      } else {
        updateCursor(mouse, pointerType);
      }
      return;
    }
    const halfDiagonalIndex = getHalfDiagonalHoverIndex(mouse, pointerType);
    const hit = hitTest(mouse, pointerType);
    const shapeMode = getShapeMode();
    if (
      shapeMode === 'free' ||
      shapeMode === 'ab-union' ||
      shapeMode === 'ab-hull-debug' ||
      shapeMode === 'core-case'
    ) {
      updateCursor(mouse, pointerType);
      return;
    }
    let startedInteraction = true;

    switch (hit.kind) {
      case 'local-c-handle':
        interaction = {
          kind: 'dragging-local-c-handle',
          index: hit.index,
        };
        onLocalCChange(hit.index, projectLocalC(mouse, hit.index));
        render();
        break;
      case 'control-point':
        interaction = {
          kind: 'dragging-control-point',
          startMouse: mouse,
          startControl: { ...state.controlPoint },
        };
        break;
      case 'border':
        if (shapeMode === 'circle') {
          interaction = {
            kind: 'dragging-triangle',
            startMouse: mouse,
            startPos: { ...state.position },
            startControl: { ...state.controlPoint },
          };
        } else {
          interaction = {
            kind: 'rotating-triangle',
            startMouse: mouse,
            startAngle: state.angle,
            startPos: { ...state.position },
          };
        }
        break;
      case 'interior':
        interaction = {
          kind: 'dragging-triangle',
          startMouse: mouse,
          startPos: { ...state.position },
          startControl: { ...state.controlPoint },
        };
        break;
      default:
        {
          if (halfDiagonalIndex !== null) {
            interaction = {
              kind: 'pending-half-diagonal-toggle',
              index: halfDiagonalIndex,
              startMouse: mouse,
            };
            break;
          }
          const startValue = getStartValueFromMouse(mouse, pointerType);
          if (startValue !== null) {
            interaction = { kind: 'dragging-start-value' };
            onStartValueSelect?.(startValue);
            render();
            break;
          }
        }
        startedInteraction = false;
    }

    if (!startedInteraction) {
      updateCursor(mouse, pointerType);
      return;
    }

    activePointerId = e.pointerId;
    activePointerType = pointerType;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    const pointerType =
      activePointerId === e.pointerId ? activePointerType : (e.pointerType || 'mouse');
    const mouse = getPointerMath(e);
    if (
      getShapeMode() === 'ab-union' ||
      getShapeMode() === 'ab-hull-debug' ||
      getShapeMode() === 'core-case'
    ) {
      return;
    }
    if (isPointToolActive() && pointTool) {
      onHalfDiagonalHover?.(null);
      if (interaction.kind === 'dragging-point-seed' && activePointerId === e.pointerId) {
        if (pointInHexagon(mouse)) {
          pointTool.move(interaction.seedId, mouse);
          render();
        }
        e.preventDefault();
        return;
      }
      if (interaction.kind === 'idle') {
        updateCursor(mouse, pointerType);
      }
      return;
    }
    onHalfDiagonalHover?.(getHalfDiagonalHoverIndex(mouse, pointerType));

    if (interaction.kind === 'idle') {
      updateCursor(mouse, pointerType);
      return;
    }

    if (activePointerId !== e.pointerId) {
      return;
    }

    if (interaction.kind === 'pending-half-diagonal-toggle') {
      const moved = distance(mouse, interaction.startMouse);
      if (moved > scaleToMath(CLICK_CANCEL_DISTANCE_PX * getHitScale(pointerType))) {
        stopInteraction();
        updateCursor(mouse, pointerType);
      }
      return;
    }

    if (interaction.kind === 'dragging-local-c-handle') {
      onLocalCChange(interaction.index, projectLocalC(mouse, interaction.index));
    }

    if (interaction.kind === 'dragging-triangle') {
      const dx = mouse.x - interaction.startMouse.x;
      const dy = mouse.y - interaction.startMouse.y;
      const desiredPos = {
        x: interaction.startPos.x + dx,
        y: interaction.startPos.y + dy,
      };
      const clamped = getShapeMode() === 'circle'
        ? clampPointToCircle(desiredPos, { x: 0, y: 0 }, CIRCUMRADIUS)
        : clampPointToTriangle(
            desiredPos,
            ...getValidRegion(state.angle),
          );
      const clampDx = clamped.x - interaction.startPos.x;
      const clampDy = clamped.y - interaction.startPos.y;
      state.position = clamped;
      state.controlPoint = {
        x: interaction.startControl.x + clampDx,
        y: interaction.startControl.y + clampDy,
      };
    }

    if (interaction.kind === 'rotating-triangle') {
      const cp = state.controlPoint;
      const startAngleToCP = Math.atan2(
        interaction.startMouse.y - cp.y,
        interaction.startMouse.x - cp.x,
      );
      const currAngleToCP = Math.atan2(
        mouse.y - cp.y,
        mouse.x - cp.x,
      );
      const dTheta = currAngleToCP - startAngleToCP;
      const newAngle = interaction.startAngle + dTheta;
      const newPos = rotatePoint(interaction.startPos, cp, dTheta);
      if (getShapeMode() !== 'circle' && pointInTriangle(newPos, ...getValidRegion(newAngle))) {
        state.angle = newAngle;
        state.position = newPos;
      }
    }

    if (interaction.kind === 'dragging-control-point') {
      const dx = mouse.x - interaction.startMouse.x;
      const dy = mouse.y - interaction.startMouse.y;
      state.controlPoint = {
        x: interaction.startControl.x + dx,
        y: interaction.startControl.y + dy,
      };
    }

    if (interaction.kind === 'dragging-start-value') {
      onStartValueSelect?.(projectStartValue(mouse));
    }

    render();
    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent): void {
    if (activePointerId !== e.pointerId) {
      return;
    }

    const mouse = getPointerMath(e);
    const pointerType = activePointerType;
    if (interaction.kind === 'pending-half-diagonal-toggle') {
      onHalfDiagonalToggle?.(interaction.index);
      stopInteraction();
      updateCursor(mouse, pointerType);
      render();
      return;
    }
    stopInteraction();
    updateCursor(mouse, pointerType);
  }

  function onPointerCancel(e: PointerEvent): void {
    if (activePointerId !== e.pointerId) {
      return;
    }

    stopInteraction();
    canvas.style.cursor = 'default';
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', (e) => {
    onHalfDiagonalHover?.(null);
    if (interaction.kind === 'idle' && (e.pointerType || 'mouse') === 'mouse') {
      canvas.style.cursor = 'default';
    }
  });
  canvas.addEventListener('lostpointercapture', () => {
    interaction = { kind: 'idle' };
    activePointerId = null;
    activePointerType = 'mouse';
    onHalfDiagonalHover?.(null);
    canvas.style.cursor = 'default';
  });
}
