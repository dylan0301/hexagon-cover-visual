# CE Classification Differences

This note compares the C-triangle perimeter classification in
`notes/20260501generalExplain.md` with the current repository docs and source.

## Classification In `20260501generalExplain.md`

The note classifies the C-triangle `T_C` using two independent pieces of data.

### Vertex-Cone Type

The vertices of `T_C` are classified by which of the six 60-degree cones at the
origin contain them, modulo the `D6` symmetries of the regular hexagon.

- Type 1: vertex-containing cones are `C_0, C_1, C_3`, up to rotation and
  reflection.
- Type 2: vertex-containing cones are `C_0, C_2, C_4`, up to rotation and
  reflection.

### Perimeter-Edge Type

The CE type records how many hexagon boundary edges have nontrivial overlap with
`T_C`.

- `CE0`: `T_C` has no overlap with hexagon perimeter edges.
- `CE1`: `T_C` overlaps exactly one hexagon perimeter edge.
- `CE2`: `T_C` overlaps exactly two hexagon perimeter edges.

Under the general-position assumption, point-only contacts, tangencies, and
vertex coincidences should be treated as degenerate cases outside this
classification.

## Differences From Current Docs

`MATH.md` does not use the names `CE0`, `CE1`, or `CE2`.

Instead, it records the C-triangle by its six radial exit distances:

```text
gamma_i = dist(O, boundary(T_C) intersect [O,V_i])
```

The current math note then translates these values into local bounds for the
six `V_i`-triangle parameters:

```text
c_i <= 1 - gamma_i
```

This is compatible with the CE classification, but it does not preserve the
explicit perimeter-edge case split.

`MATH.md` also does not include the Type 1 / Type 2 vertex-cone classification
from `20260501generalExplain.md`.

`MATH.md` does not state the half-skeleton lemma from the prompt note:

```text
If T_C is CE1 or CE2, then it covers exactly one midpoint M_i.
```

## Differences From Current Source

`src/triangle.ts` computes only the radial gamma data for the C-shape.

The relevant function is:

```text
getInnerGammas(state, shapeMode)
```

For triangle mode, it intersects the six rays from the origin to the hexagon
vertices with the boundary of `T_C`. It does not compute intersections between
`T_C` and the six hexagon perimeter edges.

The source currently has no implementation for:

- counting perimeter-edge overlaps of `T_C`;
- labeling a C-triangle as `CE0`, `CE1`, or `CE2`;
- computing the Type 1 / Type 2 vertex-cone class;
- checking which midpoint `M_i` is covered by `T_C`;
- treating CE cases separately in the UI or graph logic.

The app also has a `C-circle` mode. The CE classification from
`20260501generalExplain.md` applies to the C-triangle and should not be reused
unchanged for the circle mode.

## Naming Difference

The prompt note writes `Ce0`, `Ce1`, and `Ce2`.

The later task text writes `CE0`, `CE1`, and `CE2`.

These appear to refer to the same cases. For consistency in new notes and code,
use `CE0`, `CE1`, and `CE2`.

## Summary

The existing repository represents the C-triangle through `gamma` values and
local `c_i` bounds. The CE case split from `20260501generalExplain.md` is not
currently represented in either `MATH.md` or the TypeScript source.

To match the prompt note, the missing pieces are:

- a geometry helper that counts nondegenerate overlaps between `T_C` and the six
  perimeter edges of the hexagon;
- a `CE0 | CE1 | CE2` classification derived from that count;
- optional Type 1 / Type 2 cone classification for the C-triangle vertices;
- midpoint coverage checks for the half-skeleton lemmas.
