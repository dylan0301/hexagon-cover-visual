# App

## Purpose
This repository contains a Vite + TypeScript web app for exploring unit equilateral triangles against the regular hexagon skeleton.

## Run
- `npm install`
- `npm run dev`
- `npm run build`

## Main files
- `index.html`: app shell and canvases
- `src/main.ts`: app wiring, controls, state snapshots, rendering
- `src/interaction.ts`: pointer interaction state machine
- `src/maps.ts`: admissible-set predicate and one-variable map logic
- `src/region.ts`: graph canvas and composition plots
- `src/triangle.ts`: triangle and circle geometry on the left canvas
- `src/abUnion.ts`: `ab union` region explorer, masks, equality locks, and red-region witness search
- `src/hexagon.ts`: hexagon boundary and main diagonals
- `src/coords.ts`: math-to-canvas coordinate transforms
- `src/geometry.ts`: pure geometric helpers
- `src/symmetricPoints.ts`: D6 point-seed orbit helpers
- `src/types.ts`: shared types
- `src/style.css`: layout and control styling
- `experiments/`: NumPy scripts for professor-facing numerical checks

## Behavior
- All geometry is tracked in math coordinates.
- The left canvas shows the C-triangle or manual `c_i` controls.
- The right canvas shows `g_c`, pair compositions, or the six-step composition.
- Strict mode exposes `strictEps` and updates the admissible-set checks and local `c` bounds.
- The point tool is available in Triangle, `c_i`, Circle, and Free modes.  A click inside the hexagon creates a seed point; each seed contributes its de-duplicated D6 orbit to the coverability check.  Seed handles can be dragged, deleted, or cleared.  Clicks and drags outside the hexagon are ignored.
- D6 points are covered by the active mode's coverers: C-triangle plus generated V-triangles in Triangle mode, generated V-triangles in `c_i` mode, C-circle plus generated V-triangles in Circle mode, and all seven placed triangles in Free mode.
- Point seeds are included in the Controller State JSON and in the Free State JSON.

## `ab union` mode

The `ab union` shape mode ports the standalone `hex_region_app.html` region explorer into the normal app interface.

- Use `Move`, `Add`, and `Delete` to edit boundary dots on each edge `e_i=[V_i,V_{i+1}]`.
- Use `d-mark` and `s-mark` to label intersections between the active C-triangle or C-circle boundary and the fixed skeleton. `D` labels recompute when the geometry changes; `S` labels keep the point created at click time.
- Use `f mark` to place free dots inside the hexagon; two dots show their blue distance, and three or more show the optimized yellow enclosing equilateral triangle.
- Each edge has one shared dot or two ordered dots.  On `e_i`, the left dot gives `b_i`; the right dot gives `a_{i+1}` by distance from the right endpoint.
- Click `V_i` to toggle the boundary of `R_i`.  In `Move`, a left split dot toggles `R_i`, a right split dot toggles `R_{i+1}`, and a shared dot toggles both.
- `original AB union` controls the shaded exact covered-region fill.
- `visible regions` checkboxes control which individual `R_i` fills contribute to the shaded overlays.
- `hex-axis hull` shows the hull overlay and uses it for the sampled mask. It replaces each row with `a_i+b_i < 1` by a hex-axis hull using adjacent-edge boundary hits. Near `a_i+b_i=1`, it adds local top-start/top-end cuts to reduce the upper/right excess while preserving sampled containment.
- `show purple triangle` toggles the sampled enclosing equilateral triangle. `auto optimize theta` updates it to the sampled best angle after completed AB changes; disabling auto restores the manual theta slider and optimize button.
- `show red pair > 1` continuously searches the red uncovered region for a sampled pair farther than distance `1` and draws the witness when found.
- `clip to corner sectors` clips `R_i` to the sector bounded by the adjacent half-diagonals; locally this is `0 <= u <= 1` and `0 <= v <= 1`.
- The center dropdown can show no center shape, the draggable C-triangle, the draggable C-circle, or the manual `c_i` convex hull. `lock center` freezes the active center geometry but still allows changing the center mode.
- Mark sources are hexagon edges, half-diagonals, and the active C-triangle or C-circle boundary. Manual `c_i` hulls and `R_i` boundaries are not mark sources.
- Labels on perimeter edges show one-time snap buttons and persistent lock checkboxes for the eligible edge dot. Snaps and locks respect the existing `same a` and `same b` lock groups.
- The region table includes `same a` and `same b` checkboxes. Checked values move as locked groups while preserving the edge-dot order.

## `Hull debug` mode

`Hull debug` is a diagnostic local view for inspecting one `R(a,b)` set and sketching a desired hex-axis hull when `a+b<1`. The default example is `a=0.20`, `b=0.50`.

- The canvas shows the full local hexagon footprint in coordinates where `u` points from `V_i` to `V_{i+1}`, and `v` points from `V_i` to `V_{i-1}`.
- The exact sampled AB-union set, required points, and adjacent-edge boundary hits are drawn as references.
- `load suggested hull` replaces the current polygon with the code-generated hex-axis hull for strict rows with `a+b<1`; for `a+b>=1`, no suggested hull is shown.
- Click to add polygon vertices. On a closed polygon, click an edge to insert a new dot on that edge.
- Drag vertices to adjust them while preserving snapped edge directions where possible.
- Select a dot and use `delete selected dot`, Backspace, or Delete to remove it while preserving local axis alignment.
- Close the polygon to check whether it contains all sampled exact-region points. Missed samples are highlighted in red, and the vertex list is shown for copying.
- `export current` appends the current `a`, `b`, polygon vertices, and sampled coverage data to the experiment JSON. Repeated exports stay in the same JSON block until `clear exports`.
- This mode is exploratory only; it does not change the normal `ab union` mask or hull algorithm.

## `0521 conj` mode

`0521 conj` is a diagnostic AB-union slice for the May 21 conjecture reduction.

- The mode uses one draggable point `X_i` per edge and enforces `a1+b1=a3+b3=a5+b5=1`, `a4+b4>1`, `a0+b0<=1`, and `a2+b2<=1`.
- The control panel has `move`, `add`, and `delete` tools plus a `hard limit` checkbox; when checked, dot drags clamp at the active constraints instead of letting unrelated dots move to repair them.
- The canvas reuses the AB-union overlay, then draws the two full radius-1 circles centered at `X2` and `X5`.
- It marks two numerical intersections between the `R4` boundary and those circle boundaries, plus the `V0` and `V2` max-c points on `OV0` and `OV2`.
- It fits and draws the smallest enclosing equilateral triangle for the four marked points and reports its side length in the right panel.

## `0525 conj` mode

`0525 conj` is the five-point variant of the diagnostic AB-union slice.

- The mode enforces `a4+b4>1` and `a0+b0,a1+b1,a2+b2<=1`.
- The control panel has independent checkboxes for forcing `a3+b3=1` and `a5+b5=1`; when unchecked, those rows use `<=1` instead.
- The `hard limit` checkbox clamps dot drags at the active constraints instead of letting unrelated dots move to repair them.
- It marks the two `R4`/circle intersections and three diagonal red-witness points, then fits the smallest enclosing equilateral triangle for the five marked points.
