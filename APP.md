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
- Each edge has one shared dot or two ordered dots.  On `e_i`, the left dot gives `b_i`; the right dot gives `a_{i+1}` by distance from the right endpoint.
- Click `V_i` to toggle the boundary of `R_i`.  In `Move`, a left split dot toggles `R_i`, a right split dot toggles `R_{i+1}`, and a shared dot toggles both.
- `show region` controls the shaded covered-region fill.
- `visible regions` checkboxes control which individual `R_i` fills contribute to the shaded union.
- `show purple triangle` toggles the sampled enclosing equilateral triangle for the current `theta`.
- `show red pair > 1` continuously searches the red uncovered region for a sampled pair farther than distance `1` and draws the witness when found.
- `clip to corner sectors` clips `R_i` to the sector bounded by the adjacent half-diagonals; locally this is `0 <= u <= 1` and `0 <= v <= 1`.
- The center dropdown can show no center shape, the draggable C-triangle, the draggable C-circle, or the manual `c_i` convex hull. `lock center` freezes the active center geometry but still allows changing the center mode.
- Mark sources are hexagon edges, half-diagonals, and the active C-triangle or C-circle boundary. Manual `c_i` hulls and `R_i` boundaries are not mark sources.
- Labels on perimeter edges show one-time snap buttons and persistent lock checkboxes for the eligible edge dot. Snaps and locks respect the existing `same a` and `same b` lock groups.
- The region table includes `same a` and `same b` checkboxes. Checked values move as locked groups while preserving the edge-dot order.
