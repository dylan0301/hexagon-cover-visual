import type { Point } from './types';
import type { SymmetricPointSeed } from './symmetricPoints';
import type { CUnionCeFilter } from './cUnion';

export type FreeTriangleId = 'C' | 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
export type FreeCForm = 'triangle' | 'c-union';
export type FreeTarget = 'S_HALF' | 'S_T' | 'S' | 'BENZENE' | 'LOTUS';
export type FreeTool = 'move' | 'd-mark' | 's-mark' | 'sample' | 'point';
export type FreeVd0Mode = 'max-c' | 'max-a' | 'max-b';
export type FreeVd0Coordinate = 'a' | 'b' | 'c';
export type NamedPointKind = 'O' | 'M' | 'P' | 'B' | 'V' | 'label' | 'manual';
export type FreeSegmentKind = 'hex-edge' | 'half-diagonal' | 'triangle-edge' | 'lotus-arc' | 'c-union-boundary';

export interface FreeNamedPointRef {
  kind: NamedPointKind;
  index?: number;
  targetTId?: string;
  labelId?: string;
  manualPoint?: Point;
}

export interface FreeSegmentRef {
  kind: FreeSegmentKind;
  index: number;
  triangleId?: FreeTriangleId;
  anchorPoint?: Point;
}

export interface FreeLabel {
  id: string;
  name: string;
  mode: 'dynamic' | 'static';
  first: FreeSegmentRef | null;
  second: FreeSegmentRef | null;
  point: Point | null;
}

export interface FreeEdgePointConstraint {
  edgeIndex: number;
  point: FreeNamedPointRef;
}

export interface FreeVd0Constraint {
  enabled: boolean;
  mode: FreeVd0Mode;
  rawSources: Partial<Record<FreeVd0Coordinate, FreeNamedPointRef>>;
}

export interface FreeTriangleState {
  id: FreeTriangleId;
  center: Point;
  angle: number;
  fixed: boolean;
  hidden: boolean;
  midpointConstraints: boolean[];
  edgePointConstraint: FreeEdgePointConstraint | null;
  vd0: FreeVd0Constraint;
}

export interface FreeState {
  cForm: FreeCForm;
  cUnionCeFilter: CUnionCeFilter;
  target: FreeTarget;
  targetTPoints: FreeTargetTPoint[];
  tool: FreeTool;
  strictEps: number;
  selectedTriangleId: FreeTriangleId;
  triangles: FreeTriangleState[];
  labels: FreeLabel[];
  selectedSegments: FreeSegmentRef[];
  pointSeeds: SymmetricPointSeed[];
  selectedPointSeedId: string | null;
  status: string;
  sampling?: import('./halfSkeletonFrontier').SamplingStore;
}

export interface FreeTargetTPoint {
  id: string;
  t: number;
  fixed: boolean;
}

export interface FreeSegment {
  ref: FreeSegmentRef;
  start: Point;
  end: Point;
  label: string;
  polyline?: Point[];
  arc?: {
    center: Point;
    radius: number;
    startAngle: number;
    sweep: number;
  };
}

export interface FreeValidationSegment {
  kind: 'edge' | 'diag' | 'lotus-line' | 'lotus-arc';
  index: number;
  leafIndex?: number;
  label?: string;
  arc?: {
    center: Point;
    radius: number;
    startAngle: number;
    sweep: number;
  };
  gaps: Array<[number, number]>;
  intervals: Array<[number, number]>;
}

export interface FreeConstraintStatus {
  triangleId: FreeTriangleId;
  ok: boolean;
  messages: string[];
}

export interface FreeValidationResult {
  coverageOk: boolean;
  constraintsOk: boolean;
  segments: FreeValidationSegment[];
  pointFailures: string[];
  constraintStatuses: FreeConstraintStatus[];
}
