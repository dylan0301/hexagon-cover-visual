import type { Point } from './types';
import { mathToCanvas } from './coords';

const S = Math.sqrt(3) / 2;

// Ordered as V_0, ..., V_5 with V_0 = (1, 0), counterclockwise.
export const HEXAGON_VERTICES: Point[] = [
  { x: 1, y: 0 },
  { x: 0.5, y: S },
  { x: -0.5, y: S },
  { x: -1, y: 0 },
  { x: -0.5, y: -S },
  { x: 0.5, y: -S },
];

const DIAGONALS: [Point, Point][] = [
  [HEXAGON_VERTICES[0], HEXAGON_VERTICES[3]],
  [HEXAGON_VERTICES[1], HEXAGON_VERTICES[4]],
  [HEXAGON_VERTICES[2], HEXAGON_VERTICES[5]],
];

export function drawHexagon(ctx: CanvasRenderingContext2D): void {
  const cverts = HEXAGON_VERTICES.map(mathToCanvas);

  // Fill hexagon
  ctx.beginPath();
  ctx.moveTo(cverts[0].x, cverts[0].y);
  for (let i = 1; i < cverts.length; i++) {
    ctx.lineTo(cverts[i].x, cverts[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();

  drawHexagonLines(ctx);
}

export function drawHexagonLines(ctx: CanvasRenderingContext2D): void {
  const cverts = HEXAGON_VERTICES.map(mathToCanvas);

  ctx.beginPath();
  ctx.moveTo(cverts[0].x, cverts[0].y);
  for (let i = 1; i < cverts.length; i++) {
    ctx.lineTo(cverts[i].x, cverts[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw three main diagonals
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (const [a, b] of DIAGONALS) {
    const ca = mathToCanvas(a);
    const cb = mathToCanvas(b);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.stroke();
  }
}
