# Free Mode

## Objects

Free mode always represents six open unit equilateral vertex triangles

\[
T_0,\ T_1,\dots,T_5,
\]

where \(T_i\) is assigned to the hexagon vertex \(V_i\).  Its seventh
coverer is selected by `C form`:

- `triangle` uses the movable open unit equilateral center triangle \(T_C\),
- `Cunion` uses the fixed set \(\mathcal C_\cup\) defined below.

Switching forms preserves the inactive form's state.  Switching back to
`triangle` therefore restores the previous pose and constraints of \(T_C\).

The regular hexagon has center

\[
O=(0,0)
\]

and vertices

\[
V_i=(\cos(i\pi/3),\sin(i\pi/3)).
\]

The midpoint of the half-diagonal \([O,V_i]\) is

\[
M_i=\frac12 V_i.
\]

## Cunion

Let \(r_4=[O,V_4]\), and let \(c(T)\) denote the center of a unit open
equilateral triangle \(T\).  For a hexagon boundary edge \(e\), say that
\(T\) overlaps \(e\) when their intersection has positive length.  Define
\(T\) to be CE1 or CE2 when it overlaps exactly one or exactly two hexagon
boundary edges, respectively.

For \(k\in\{1,2\}\), the Cunion family is

\[
\mathcal F_k=
\left\{
T:
O\in T,\quad
\{i:M_i\in T\}=\{4\},\quad
T\text{ is CE}k,\quad
\operatorname{cross}(V_4,c(T))\ge 0
\right\}.
\]

Thus every member contains \(O\), contains exactly the midpoint \(M_4\), and
has its center on the inclusive oriented-left side of the ray from \(O\) to
\(V_4\).  The last condition is the symmetry normalization for \(r_4\).

The `CE1`, `CE2`, and `both` filters display and use, respectively,

\[
\mathcal C_\cup^{(1)}=\overline{\bigcup_{T\in\mathcal F_1}T},
\qquad
\mathcal C_\cup^{(2)}=\overline{\bigcup_{T\in\mathcal F_2}T},
\qquad
\mathcal C_\cup^{(1,2)}=
\overline{\bigcup_{T\in\mathcal F_1\cup\mathcal F_2}T}.
\]

The app approximates these closures with 2048 uniformly sampled triangle
orientations over one \(2\pi/3\) period.  At each orientation it includes all
feasible center placements, then traces the outer contour with 4096 radial
samples.  No maximality or Pareto reduction is applied.  The complete planar
set is drawn: its part inside \(H\) is cyan, its part outside \(H\) is
translucent neutral gray, and its outer boundary is cyan.  The drawing is not
clipped to the hexagon.

The contour is a display and mark-selection approximation.  Covering tests do
not use the filled display path: they apply `strictEps` to the underlying
sampled triangle half-plane vectors and union the resulting point, segment, or
arc coverage intervals.  Changing the CE filter changes both the displayed
set and the active coverer used by validity checks and Vd0.

The sampled model is generated lazily and cached for the page lifetime;
epsilon-specific filtered coverage is cached after that.  While the model is
still being built, the \(T_i\) remain movable, but coverage is reported as
pending and Cunion marks and Vd0 auto-placement are unavailable.

## Targets

Free mode has five covering targets.

The full skeleton is

\[
S=\partial H\cup [O,V_0]\cup\cdots\cup[O,V_5].
\]

The half-skeleton target is

\[
S_{1/2}=\partial H\cup\{O,M_0,\dots,M_5\}.
\]

Thus \(S_{1/2}\) still includes the whole boundary \(\partial H\), but replaces
the six half-diagonal segments with seven marked points.

The variable point target is

\[
S_t=S_{1/2}\cup\{P_i(t_j):i=0,\dots,5,\ j=1,\dots,k\},
\qquad 0\le t_j\le 1,
\]

where

\[
P_i(t_j)=(1-t_j)V_i.
\]

Thus \(P_i(t_j)\) lies on the half-diagonal \([O,V_i]\) at distance \(1-t_j\)
from \(O\).  The Free-mode default is one row, \(t_1=0.3\).  Users can add more
rows.  Dragging any \(P_i(t_j)\) along its half-diagonal changes the shared
value of \(t_j\), so all six points for that row move together.  Locking a row
only disables that row's drag interaction; it does not remove the points from
the covering target and does not add a triangle constraint.

The Benzene target adds one fixed point in each center subtriangle
\(\triangle O V_i V_{i+1}\).  Define

\[
B_i=\frac{O+V_i+V_{i+1}}{3}=\frac{V_i+V_{i+1}}{3}.
\]

Then

\[
\operatorname{Benzene}=S\cup\{B_0,\dots,B_5\}.
\]

The six points \(B_i\) are fixed centroids; they are drawn when Benzene is
selected and have no separate drag interaction.

The lotus target is a one-dimensional curve target.  Let

\[
D_i=\{p:\|p-V_i\|\le 1\}
\]

be the closed unit disk centered at \(V_i\).  Lotus is motivated by the
parity/XOR pattern

\[
(D_0\oplus D_1\oplus\cdots\oplus D_5)\cap H,
\]

but Free mode uses the following explicit curve target rather than a filled
two-dimensional region.

For each \(i\), define two unit-circle arcs from \(O\) to \(V_i\):

\[
A_i^-\subset \partial D_{i-1},
\qquad
A_i^+\subset \partial D_{i+1},
\]

with indices modulo \(6\).  The lotus leaf at \(V_i\) is

\[
L_i=A_i^-\cup A_i^+.
\]

The full lotus target is

\[
\operatorname{Lotus}
=
\partial H\cup\bigcup_{i=0}^5 L_i.
\]

Thus Lotus consists of twelve unit-circle arcs plus the six hexagon perimeter
edges.  The perimeter is part of Lotus, but it is recorded separately from the
leaves \(L_i\).

## D6 Point Seeds

Free mode also has a `point` tool.  A point-tool click inside the hexagon
creates a seed point \(Q\).  The seed contributes its full D6 orbit to the
covering target:

\[
\mathcal O_{D_6}(Q)
=
\{r^k Q:k=0,\dots,5\}\cup\{r^k \sigma Q:k=0,\dots,5\},
\]

where \(r\) is rotation by \(\pi/3\) about \(O\), and \(\sigma(x,y)=(x,-y)\)
is reflection across the horizontal axis.  Duplicate orbit points are merged,
so a generic seed gives twelve points, while a seed on a symmetry axis or at
the center gives fewer distinct points.

Multiple seeds may be active at once.  Seed handles can be dragged, deleted one
at a time, or cleared all at once.  Clicks and drags outside the hexagon are
ignored.  Point seeds are saved in the Free JSON state.  The D6 orbit points
are covering targets only; they are not named point sources for
edge-through-point constraints.

## Base Constraints

In `triangle` form, the center constraint is

\[
O\in T_C,
\]

and in either C form the vertex-triangle constraints are

\[
V_i\in T_i,\qquad i=0,\dots,5.
\]

In `Cunion` form, membership in the fixed Cunion family replaces the movable
\(T_C\) and its constraints.

Additional midpoint constraints may be enabled in the control panel.

For \(T_C\) in `triangle` form, any subset of

\[
\{M_0,\dots,M_5\}
\]

may be required.

For \(T_i\), only the local midpoint candidates

\[
\{M_{i-1},M_i,M_{i+1}\}
\]

are exposed as constraints, with indices taken modulo \(6\).

## Edge-Through-Point Constraints

Each movable triangle may have at most one active edge-through-point constraint
in the current implementation.  Cunion is a fixed coverer and has no such
constraint.

An edge-through-point constraint has the form:

\[
\text{edge}_k(T)\ni P,
\]

where \(k\in\{0,1,2\}\), and \(P\) is a named point.

The canvas labels every visible movable-triangle edge with the same index used
by this constraint:

\[
T:e0,\quad T:e1,\quad T:e2.
\]

For example, `V3:e1` is edge `1` of the triangle assigned to \(V_3\).  These
labels are part of the mathematical interface: choosing edge `1` in the control
panel means the edge labeled `V3:e1` in the figure.

Named points include:

- \(O\),
- the six \(M_i\),
- the six \(P_i(t)\),
- the six \(B_i\),
- the six \(V_i\),
- dynamic labeled intersection points,
- static labeled intersection points,
- manual coordinate points in saved state.

Labeled points are created with either `d-mark` or `s-mark` by selecting two
source curves.  The usual allowed source segments are:

- hexagon boundary edges,
- half-diagonals \([O,V_i]\),
- visible triangle edges.

When the Free target is Lotus, the twelve lotus arcs are also selectable source
curves.  The current implementation supports labels from one lotus arc and one
visible triangle edge.  It does not create arc-arc labels or labels between a
lotus arc and a fixed hexagon/half-diagonal segment.

In `Cunion` form, only the merged outer boundary for the active CE filter is a
Cunion mark source.  It can be paired with a hexagon edge, a half-diagonal, or
a visible \(T_i\)-edge.  Internal CE1/CE2 seams, the Cunion boundary paired
with itself, and Cunion/lotus-arc pairs are not mark sources.  When the chosen
pair has several intersections, the app selects the one nearest the click on
the Cunion boundary.  A dynamic mark follows the nearest continuation to its
previous coordinate as the other source moves; a static Cunion mark freezes at
its creation coordinate.

If the two selected sources intersect, `d-mark` creates a dynamic label
(`D1`, `D2`, ...) that stores both source segments and recomputes its coordinate
whenever the triangles move.  `s-mark` creates a static label (`S1`, `S2`, ...)
whose coordinate is usually fixed at creation time.  Static labels keep the
same `first` and `second` fields as dynamic labels only for fixed source
segments (hexagon edges and half-diagonals).  Static labels involving a lotus
arc keep the arc and triangle-edge references so the intersection can be
recomputed as triangles move.  If the selected sources do not intersect, no
label is created.

While a label is being created in either mark mode, selected source segments
are highlighted in the figure.  This highlight is temporary bookkeeping only;
it does not add a geometric constraint unless a labeled point is later used in
an edge-through-point constraint.

## Vd0 Raw Sources

For a \(V_i\)-triangle, Vd0 computes raw \(a,b,c\) from the farthest uncovered
point on the three incident skeleton branches by default.  Each raw coordinate
can instead use the current vertex \(V_i\), a marked label, a target point
\(P_j(t)\), a Benzene point \(B_j\), or the relevant midpoint \(M_i\), when
that point lies on the coordinate branch.  The value is measured as distance
from \(V_i\) along the branch:

- \(a\) uses \([V_i,V_{i-1}]\),
- \(b\) uses \([V_i,V_{i+1}]\),
- \(c\) uses \([V_i,O]\).

If a selected raw source later becomes invalid or leaves the branch, Vd0 falls
back to the automatic farthest-uncovered value for that coordinate.

In `Cunion` form, the active CE-filtered Cunion set participates in the
uncovered-branch calculation in place of \(T_C\).

Vd0 is not available for the Lotus target.  When Lotus is selected, Vd0
controls are hidden and Vd0 auto-placement is ignored.  Existing Vd0 settings
are preserved and become visible again when the target is switched back to
\(S\) or \(S_{1/2}\).

## Interface Conventions

Free mode is separate from the \(g_c\)-chain interface.  When Free mode is
active, the graph panel is hidden entirely:

- no map graph is displayed,
- the compose-chain buttons are hidden,
- the admissible-set editor is hidden,
- the ordinary controller-state panel is hidden.

The right panel instead shows only Free mode controls and the Free JSON state.

In `Cunion` form the \(T_C\) row and the sampling panel are hidden, and the
`sample` tool is unavailable.  Entering Cunion while sampling changes the tool
to `move`; if \(T_C\) was selected, \(T_4\) becomes selected.  All non-C
facilities remain available, including moving and rotating the \(T_i\), their
fixed/hidden and midpoint settings, edge-through-point constraints, targets,
point seeds, marks, Vd0, and Free JSON.

A dynamic mark whose source belongs to the inactive C form is retained but
suspended.  Any edge-through-point constraint that uses it is likewise
suspended, and a dependent Vd0 placement is paused instead of falling back to
an automatic raw value.  Reactivating the source form restores these
dependencies.  Static labels remain usable fixed points while their source
form is inactive.

Moving a triangle is direct manipulation of its pose.  The app then projects the
candidate pose back toward the active constraints:

- \(T_C\), when active, must continue to contain \(O\),
- \(T_i\) must continue to contain \(V_i\),
- checked midpoint constraints must remain satisfied,
- any active edge-through-point constraint must remain satisfied.

This projection is a numerical interaction rule.  It is not a separate theorem
about the covering problem.

## Open Triangle Semantics

The mathematical problem uses open triangles.  Free mode therefore uses a
strict epsilon model for validity.

A point \(p\) counts as covered by a triangle \(T\) only when it lies inside
all three triangle half-planes by at least \(\varepsilon\), where
\(\varepsilon\) is the free-mode strict epsilon.

Similarly, a skeleton segment is covered by a triangle only on the subinterval
that remains after applying the same epsilon margin.  The app computes interval
coverage on each skeleton segment, merges those intervals over all seven
active coverers, and reports the remaining gaps.

For Lotus, the same strict epsilon margin is applied to each lotus perimeter
edge and each circular arc.  Arc coverage is computed as exact parameter
intervals on the arc, then merged over all seven active coverers.

This means a point lying exactly on a triangle edge is not treated as covered
for the strict validity test, even though it is visually on the boundary.

## Validity

In every Free target below, if point seeds exist, every distinct point in every
seed's D6 orbit must also be covered by at least one active coverer.

For target \(S\), a free-mode configuration is valid when:

1. all active constraints are satisfied with the strict epsilon margin, and
2. every boundary edge and every half-diagonal has no uncovered interval.

For target \(S_{1/2}\), a free-mode configuration is valid when:

1. all active constraints are satisfied with the strict epsilon margin,
2. every boundary edge has no uncovered interval, and
3. \(O,M_0,\dots,M_5\) are each covered by at least one active coverer.

For target \(S_t\), a free-mode configuration is valid when:

1. all active constraints are satisfied with the strict epsilon margin,
2. every boundary edge has no uncovered interval, and
3. \(O,M_0,\dots,M_5\) and every \(P_i(t_j)\) are each covered by at least one
   active coverer.

For target Benzene, a free-mode configuration is valid when:

1. all active constraints are satisfied with the strict epsilon margin,
2. every boundary edge and every half-diagonal has no uncovered interval, and
3. \(B_0,\dots,B_5\) are each covered by at least one active coverer.

For target Lotus, a free-mode configuration is valid when:

1. all active non-Vd0 constraints are satisfied with the strict epsilon margin,
2. every lotus arc has no uncovered interval, and
3. every lotus perimeter edge has no uncovered interval.

Lotus coverage is checked geometrically against the six vertex triangles and
the active C coverer.  The app does not currently enforce the separate
observation that a unit equilateral triangle can intersect positive-length
portions of at most four lotus arcs; that fact is recorded in `MATH.md`.

Fixed triangles remain part of the covering test.  Hidden triangles also remain
part of the covering test; hiding only removes them from the canvas hit target
and visual clutter.  Hiding an unfixed triangle automatically fixes it.  If a
hidden triangle is unfixed, it is shown again.

## Free JSON Compatibility

C forms use Free JSON version 8.  The state stores the selected C form, the
CE1/CE2/both filter, and the click anchor used to disambiguate a compound
Cunion-boundary mark.  Free JSON versions 1 through 7 remain loadable and
default to `triangle` form with the `both` filter.  Loading also sanitizes
boundary anchors and normalizes a saved `sample` tool or \(T_C\) selection when
it is incompatible with the active form.  The ordinary, non-Free controller
snapshot version is unchanged.
