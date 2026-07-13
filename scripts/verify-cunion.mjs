import assert from 'node:assert/strict';
import { createServer } from 'vite';

const TOLERANCE = 1e-8;

function mergeIntervals(intervals) {
  const sorted = intervals.map((interval) => [...interval]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1] + TOLERANCE) {
      merged.push(interval);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }
  return merged;
}

function assertIntervalsEqual(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: interval count`);
  for (let index = 0; index < actual.length; index++) {
    assert.ok(Math.abs(actual[index][0] - expected[index][0]) <= TOLERANCE, `${label}: start ${index}`);
    assert.ok(Math.abs(actual[index][1] - expected[index][1]) <= TOLERANCE, `${label}: end ${index}`);
  }
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function pointStrictlyInPlacedTriangle(point, center, triangle) {
  for (let index = 0; index < triangle.length; index++) {
    const start = {
      x: center.x + triangle[index].x,
      y: center.y + triangle[index].y,
    };
    const end = {
      x: center.x + triangle[(index + 1) % triangle.length].x,
      y: center.y + triangle[(index + 1) % triangle.length].y,
    };
    if (cross(
      { x: end.x - start.x, y: end.y - start.y },
      { x: point.x - start.x, y: point.y - start.y },
    ) <= TOLERANCE) return false;
  }
  return true;
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { hmr: false, middlewareMode: true, ws: false },
});

try {
  const cUnion = await server.ssrLoadModule('/src/cUnion.ts');
  const buildProgress = [];
  const model = await cUnion.buildCUnionModel((progress) => buildProgress.push(progress));
  assert.ok(buildProgress.length > 10, 'build reports chunked progress');
  assert.equal(buildProgress.at(-1), 1);
  assert.ok(buildProgress.every((progress, index) => index === 0 || progress >= buildProgress[index - 1]));
  assert.equal(await cUnion.buildCUnionModel(), model, 'model is cached');
  const ce1 = cUnion.getCUnionCoverage(model, 'ce1', 0);
  const ce2 = cUnion.getCUnionCoverage(model, 'ce2', 0);
  const both = cUnion.getCUnionCoverage(model, 'both', 0);
  const strictBoth = cUnion.getCUnionCoverage(model, 'both', 1e-5);

  assert.equal(model.orientationCount, cUnion.C_UNION_ORIENTATION_COUNT);
  assert.equal(model.boundaryRayCount, cUnion.C_UNION_BOUNDARY_RAY_COUNT);
  assert.ok(model.counts.ce1CellCount > 0, 'CE1 family is nonempty');
  assert.ok(model.counts.ce2CellCount > 0, 'CE2 family is nonempty');
  assert.equal(both.polygonCount, ce1.polygonCount + ce2.polygonCount);

  const origin = { x: 0, y: 0 };
  const m4 = { x: -0.25, y: -Math.sqrt(3) / 4 };
  const vertices = Array.from({ length: 6 }, (_, index) => ({
    x: Math.cos(index * Math.PI / 3),
    y: Math.sin(index * Math.PI / 3),
  }));
  const midpoints = vertices.map((vertex) => ({ x: vertex.x / 2, y: vertex.y / 2 }));
  const triangleGeometry = await server.ssrLoadModule('/src/triangle.ts');
  for (const layer of ['ce1', 'ce2']) {
    for (const cell of model.cells[layer]) {
      const center = cell.centers.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      center.x /= cell.centers.length;
      center.y /= cell.centers.length;
      assert.ok(pointStrictlyInPlacedTriangle(origin, center, cell.triangle), `${layer} contains O`);
      const containedMidpoints = midpoints.flatMap((point, index) =>
        pointStrictlyInPlacedTriangle(point, center, cell.triangle) ? [index] : [],
      );
      assert.deepEqual(containedMidpoints, [4], `${layer} has exact {M4}`);
      assert.ok(cross(vertices[4], center) >= -TOLERANCE, `${layer} center is left of r4`);
      const angle = Math.atan2(cell.triangle[0].y, cell.triangle[0].x) - Math.PI / 2;
      const ce = triangleGeometry.getCPerimeterIntersections({ position: center, angle, controlPoint: center });
      assert.equal(ce.kind.toLowerCase(), layer, `${layer} classification`);
    }
  }

  for (const [name, coverage] of [['CE1', ce1], ['CE2', ce2]]) {
    assert.ok(cUnion.cUnionContainsPoint(coverage, origin), `${name} contains O`);
    assert.ok(cUnion.cUnionContainsPoint(coverage, m4), `${name} contains M4`);
  }

  for (let ix = -12; ix <= 12; ix++) {
    for (let iy = -12; iy <= 12; iy++) {
      const point = { x: ix / 10, y: iy / 10 };
      const inCe1 = cUnion.cUnionContainsPoint(ce1, point);
      const inCe2 = cUnion.cUnionContainsPoint(ce2, point);
      assert.equal(cUnion.cUnionContainsPoint(both, point), inCe1 || inCe2, 'both filter is CE1 union CE2');
      if (cUnion.cUnionContainsPoint(strictBoth, point)) {
        assert.ok(cUnion.cUnionContainsPoint(both, point), 'strict erosion is contained in closure coverage');
      }
    }
  }

  const segments = vertices.map((start, index) => [start, vertices[(index + 1) % 6]]);
  segments.push([origin, vertices[4]]);
  for (const [index, [start, end]] of segments.entries()) {
    const expected = mergeIntervals([
      ...cUnion.cUnionIntervalsOnSegment(ce1, start, end),
      ...cUnion.cUnionIntervalsOnSegment(ce2, start, end),
    ]);
    assertIntervalsEqual(
      cUnion.cUnionIntervalsOnSegment(both, start, end),
      expected,
      `segment ${index}`,
    );
  }

  const arc = { center: vertices[3], radius: 1, startAngle: 0, sweep: Math.PI / 3 };
  const expectedArc = mergeIntervals([
    ...cUnion.cUnionIntervalsOnArc(ce1, arc),
    ...cUnion.cUnionIntervalsOnArc(ce2, arc),
  ]);
  assertIntervalsEqual(cUnion.cUnionIntervalsOnArc(both, arc), expectedArc, 'arc');

  const boundaries = ['ce1', 'ce2', 'both'].map((filter) => cUnion.cUnionBoundaryPoints(model, filter));
  for (const boundary of boundaries) {
    assert.equal(boundary.length, cUnion.C_UNION_BOUNDARY_RAY_COUNT);
    assert.ok(boundary.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  }
  for (let index = 0; index < boundaries[2].length; index++) {
    const radii = boundaries.map((boundary) => Math.hypot(boundary[index].x, boundary[index].y));
    assert.ok(Math.abs(radii[2] - Math.max(radii[0], radii[1])) <= TOLERANCE, `combined ray ${index}`);
  }

  const freeGeometry = await server.ssrLoadModule('/src/freeGeometry.ts');
  const state = freeGeometry.createDefaultFreeState();
  const dynamicBoundaryLabel = {
    id: 'D1',
    name: 'D1',
    mode: 'dynamic',
    first: { kind: 'c-union-boundary', index: 0, anchorPoint: m4 },
    second: { kind: 'half-diagonal', index: 4 },
    point: m4,
  };
  state.cForm = 'c-union';
  state.labels = [dynamicBoundaryLabel];
  assert.ok(freeGeometry.isFreeLabelSuspended(state, dynamicBoundaryLabel, null));
  assert.ok(!freeGeometry.isFreeLabelSuspended(state, dynamicBoundaryLabel, model));

  const frozenPoint = { x: 0.125, y: -0.25 };
  state.labels = [{
    id: 'S1',
    name: 'S1',
    mode: 'static',
    first: { kind: 'lotus-arc', index: 0 },
    second: { kind: 'triangle-edge', triangleId: 'C', index: 0 },
    point: frozenPoint,
  }];
  freeGeometry.refreshLabels(state, model);
  assert.deepEqual(state.labels[0].point, frozenPoint, 'inactive static C label stays frozen');

  for (let index = 1; index <= 12; index++) {
    cUnion.getCUnionCoverage(model, 'both', index * 1e-7);
  }
  assert.ok(model.layerCoverageCache.size <= 4, 'strict-epsilon layer cache is bounded');
  assert.ok(model.coverageCache.size <= 12, 'filtered strict-epsilon cache is bounded');

  console.log(JSON.stringify({ status: 'PASS', counts: model.counts }));
} finally {
  await server.close();
}
