# Hexagon Skeleton And The Seven-Triangle Obstruction

## 1. Geometric setup

Let
\[
O := (0,0)
\]
be the center of the regular hexagon of side length `1`. We index the vertices by
\[
V_i = \bigl(\cos(i\pi/3),\, \sin(i\pi/3)\bigr), \qquad i=0,1,\dots,5,
\]
so in particular
\[
V_0=(1,0)
\]
and the indexing proceeds counterclockwise.

The **skeleton** is
\[
\operatorname{Sk} := \partial H \cup [V_0,V_3] \cup [V_1,V_4] \cup [V_2,V_5],
\]
that is, the boundary of the hexagon together with its three main diagonals.

The goal is to prove:

> Seven open equilateral triangles of side length $1$ cannot cover $\operatorname{Sk}$.

Everything in this note is organized around a contradiction argument: assume such a cover exists, encode the local geometric constraints, and derive an impossible six-step recurrence around the hexagon.

## 2. Standard reduction of a hypothetical 7-cover

Assume that `\operatorname{Sk}` is covered by seven open equilateral triangles of side length `1`.

Two pieces of the reduction are immediate.

1. Since the three diagonals meet at `O`, at least one covering triangle must contain `O`.
   Call this distinguished triangle the **C-triangle** and denote it by `T_C`.
2. Each vertex $V_i$ belongs to the skeleton, so for each `i` there is at least one covering triangle containing $V_i$.
   Fix one such triangle and call it the **$V_i$-triangle**, denoted `T_i`.

Thus the hypothetical cover can be organized as
\[
T_C,\ T_0,\ T_1,\ \dots,\ T_5.
\]

This labeling is only a bookkeeping device. The contradiction will come from comparing what `T_C` does along the six rays from the center with what each `T_i` can do near the corresponding vertex.

## 3. Inner gamma data of the C-triangle

For each `i`, consider the radial segment
\[
[O,V_i].
\]
Because `T_C` is convex and contains `O`, the ray from `O` through $V_i$ exits `T_C` in a unique point of `\partial T_C`. This gives a number
\[
\gamma_i := \operatorname{dist}\bigl(O,\, \partial T_C \cap [O,V_i]\bigr), \qquad i=0,\dots,5.
\]
The 6-tuple
\[
\gamma(T_C) := (\gamma_0,\dots,\gamma_5)
\]
is the **inner gamma** of the C-triangle.

### Notation cleanup

There is one typo-level inconsistency in the informal description that should be fixed explicitly:

- the phrase "the intersection of the boundary of the V-triangle and the line segment from `(0,0)` to $V_i$" cannot be right if the blue triangle in the app is meant to determine the inner gamma;
- the quantity `\gamma_i` must be read from the **C-triangle** `T_C`, not from the $V_i$-triangle.

That is the convention used in this note and in the UI. No further reparameterization of `g` is needed in the writeup: the one-variable maps will be denoted only by $g_c$, where the subscript is always the local admissible coordinate $c$.

## 4. Local coordinates for a $V_i$-triangle

Fix `i`, and look at the three skeleton segments incident to $V_i$:

- the boundary edge toward $V_{i-1}$,
- the boundary edge toward $V_{i+1}$,
- the diagonal toward `O`.

For a $V_i$-triangle we record three lengths:
\[
(a,b,c) \in [0,1]^3,
\]
where

- `a` is the length covered from $V_i$ toward $V_{i-1}$,
- `b` is the length covered from $V_i$ toward $V_{i+1}$,
- `c` is the length covered from $V_i$ toward `O`.

So `(a,b,c)` is a purely local description of how a unit equilateral triangle sitting at $V_i$ can meet the three incident skeleton branches.

## 5. The admissible set

The **admissible set** `\mathcal A \subset [0,1]^3` is the set of all triples `(a,b,c)` that can occur in the local picture above.

It is symmetric under interchange of the two boundary-edge coordinates:
\[
(a,b,c) \in \mathcal A \iff (b,a,c) \in \mathcal A.
\]
So it is enough to describe the ordered half
\[
a \le b.
\]
The full admissible set is then recovered by symmetry, i.e. by swapping `a` and `b` when `a>b`.

In the ordered half `a \le b`, the admissible set is the union of the following three closed semialgebraic cells.

### Ordered Cell 1
\[
a \le b
\]
\[
a+b \le 1
\]
\[
a^2+ab+b^2 \le 1
\]
\[
(a+b)^4-(a+b)^2+ab \le 0
\]
\[
c^4-c^2+ac-a^2 \le 0
\]

### Ordered Cell 2
\[
a \le b
\]
\[
a+b \le 1
\]
\[
a^2+ab+b^2 \le 1
\]
\[
(a+b)^4-(a+b)^2+ab \ge 0
\]
\[
((a+b)^2-1)c^2 + bc - b^2 \le 0
\]

### Ordered Cell 3
\[
a \le b
\]
\[
a+b \ge 1
\]
\[
a^2+ab+b^2 \le 1
\]
\[
(a^2-1)c^2 + (2ab^2+b)c + (b^4-b^2) \le 0
\]
\[
c \le \tfrac12
\]

Equivalently, the other three cells are obtained from these three by applying the symmetry
\[
(a,b,c) \longmapsto (b,a,c).
\]

So the decomposition is governed by one symmetry and two regime changes:

- the symmetry `a \leftrightarrow b`, corresponding to swapping clockwise and counterclockwise edges;
- the transition across `a+b=1`;
- the transition across
  \[
  (a+b)^4-(a+b)^2+ab = 0.
  \]

## 6. How the inner gamma talks to a $V_i$-triangle

This is the main notational point.

The inner gamma $\gamma_i$ is measured from $O$ outward along $[O,V_i]$. By contrast, the admissible-set coordinate $c$ is measured from $V_i$ inward along $[V_i,O]$.

Geometrically, the portion of the diagonal not already covered by the C-triangle has length
\[
1 - \gamma_i.
\]

For the contradiction argument, one does not need to identify the local parameter with this full complementary length. It is enough to choose a local parameter $c_i$ for the $V_i$-triangle such that
\[
c_i \le 1-\gamma_i.
\]

In other words, the quantity $1-\gamma_i$ is an upper bound on the local admissible slice parameter needed in the propagation argument.

This is the convention the app displays explicitly:

- the left panel shows the six values $\gamma_0,\dots,\gamma_5$ read from the blue C-triangle;
- the left panel also shows the six complementary quantities $1-\gamma_0,\dots,1-\gamma_5$;
- the right panel studies the one-variable maps $g_c$ and the full composition obtained from local parameters satisfying $c_i \le 1-\gamma_i$.

## 7. From the admissible set to a one-variable map

Fix `c \in [0,1]`. For each `a \in [0,1]`, define
\[
B_c(a) := \max\{b \in [0,1] : (a,b,c) \in \mathcal A\},
\]
whenever the slice is nonempty.

Then define the induced map
\[
g_c(a) := 1 - B_c(a).
\]

Interpretation:

- `a` is the uncovered amount arriving at $V_i$ from the previous edge,
- `B_c(a)` is the largest amount the $V_i$-triangle can cover on the next edge while still respecting the diagonal parameter `c`,
- `g_c(a)=1-B_c(a)` is the uncovered amount passed on to the next vertex.

This is the same one-variable object that was previously denoted $f_c$ in the informal description. In the current note and UI, the preferred notation is $g_c$.

## 8. The six-step composition around the hexagon

Let `x_0 \in [0,1]` be the uncovered amount on the edge `[V_5,V_0]` adjacent to $V_0$. After the $V_0$-triangle acts, the uncovered amount handed to the next edge is
\[
x_1 = g_{c_0}(x_0).
\]
Continuing cyclically gives
\[
x_{i+1} = g_{c_i}(x_i), \qquad i=0,1,\dots,5,
\]
with indices taken mod `6`.

Hence after one full turn,
\[
x_6 = (g_{c_5} \circ g_{c_4} \circ \cdots \circ g_{c_0})(x_0).
\]
For the covering argument, the parameters are constrained only by
\[
c_i \le 1-\gamma_i, \qquad i=0,\dots,5.
\]
So one keeps the composition in the local-coordinate notation
\[
x_6 = (g_{c_5} \circ g_{c_4} \circ \cdots \circ g_{c_0})(x_0),
\]
with the understanding that each $c_i$ is bounded above by $1-\gamma_i$.

## 9. The contradiction template

A seven-triangle covering would force the propagated defect after one full cycle not to exceed the defect we started with on the same edge. In symbols, one needs
\[
x_0 \ge x_6.
\]
With the notation above, that means
\[
x \ge (g_{c_5} \circ g_{c_4} \circ \cdots \circ g_{c_0})(x)
\]
for every relevant $x \in [0,1]$, every inner-gamma tuple produced by a valid C-triangle, and every choice of local parameters satisfying
\[
c_i \le 1-\gamma_i.
\]

So the global covering problem is reduced to a family of explicit one-dimensional inequalities built from admissible-set slices.

## 10. Dictionary between the math and the current app

- **Blue triangle on the left**: the C-triangle `T_C`.
- **Displayed tuple `γ`**: the six exit distances of `T_C` along the rays $[O,V_i]$.
- **Displayed tuple `1-γ`**: six upper bounds for the local diagonal parameters $c_i$ relevant for the six $V_i$-triangles.
- **Slider on the right**: a single-parameter graph of $g_c$, where $c$ is the local admissible slice parameter.
- **Composition mode on the right**: the graph of
  \[
  x \longmapsto (g_{c_5} \circ \cdots \circ g_{c_0})(x),
  \]
  where in the proof one only uses the bounds $c_i \le 1-\gamma_i$.

## 11. `ab union` region explorer

The `ab union` mode studies a related corner-region problem. For each edge
\[
e_i=[V_i,V_{i+1}]
\]
choose one or two ordered boundary dots
\[
X_i=V_i+\ell_i(V_{i+1}-V_i),\qquad
Y_i=V_i+r_i(V_{i+1}-V_i),
\qquad 0\le \ell_i\le r_i\le 1.
\]
A one-dot edge is the special case \(\ell_i=r_i\).  The outgoing value at
`V_i` is
\[
b_i=\ell_i,
\]
and the incoming value at `V_{i+1}` is
\[
a_{i+1}=1-r_i.
\]
Thus at vertex `V_i`,
\[
a_i=1-r_{i-1}.
\]
The equality case is
\[
a_i+b_i=1 \iff \ell_i=r_{i-1}.
\]

The local coordinates at `V_i` use the two boundary directions toward `V_{i+1}` and `V_{i-1}`. In those coordinates a sampled point has coordinates `(u,v)` with `u,v >= 0`, and the metric is
\[
\|(u,v)\|^2=u^2+v^2-uv.
\]
The displayed region `R_i` is computed from the local membership predicate for all unit equilateral triangles containing
\[
V_i,\quad Y_{i-1},\quad X_i
\]
inside the local `120^\circ` cone. The table value
\[
d_i=\sqrt{a_i^2+a_i b_i+b_i^2}
\]
is the distance between the adjacent edge dots `Y_{i-1}` and `X_i`; if `d_i>1`, the local required set cannot fit inside a unit equilateral triangle.

The uncovered red region is
\[
U=H\setminus \bigcup_i R_i.
\]
For a normal angle `theta`, the purple triangle uses the sampled support values of `U` in the three equilateral normal directions and displays the sampled side length
\[
L(\theta)=\frac{2}{\sqrt3}\sum_{k=0}^2 h_k(\theta).
\]
The optimize button samples `theta` in `[0,2\pi/3)` to estimate `L_*`.

Optional UI modifiers:

- Individual region visibility affects only the displayed covered fill.
- `clip to corner sectors` clips each `R_i` by the adjacent half-diagonal sector; locally this is `0 <= u <= 1` and `0 <= v <= 1`.
- The red-pair search checks sampled points of `U` for a witness pair with Euclidean distance greater than `1`.
- `Move`, `Add`, and `Delete` tools edit the edge dots.  An edge has at least one dot and at most two dots.
- `same a` and `same b` locks are UI constraints on selected `a_i` and `b_i` values; they are not additional geometry.

## 12. What remains to prove mathematically

To finish the contradiction argument, one still needs a rigorous statement of the form:

1. every hypothetical 7-cover produces an inner-gamma tuple $\gamma(T_C)$ and hence six local parameters $c_i$ with $c_i \le 1-\gamma_i$;
2. each $V_i$-triangle yields an admissible triple `(a_i,b_i,c_i)`;
3. the resulting composition map cannot satisfy the required cyclic inequality.

The admissible-set description is the local input. The composition inequality is the global output. The non-coverability statement follows once those two pieces are connected without exception.

## 13. The variable point target \(S_t\)

Free mode also has a point target interpolating along the half-diagonals.
For each \(0\le t\le 1\), define
\[
P_i(t):=(1-t)V_i,\qquad i=0,\dots,5.
\]
Thus \(P_i(t)\in[O,V_i]\) and
\[
\operatorname{dist}(O,P_i(t))=1-t.
\]

The app allows a finite list of shared parameters \(t_1,\dots,t_k\).  The
target is
\[
S_t:=S_{1/2}\cup\{P_i(t_j): i=0,\dots,5,\ j=1,\dots,k\}.
\]
It keeps the whole hexagon boundary and the seven points
\[
O,M_0,\dots,M_5
\]
from \(S_{1/2}\), and adds the same finite set of extra positions on each
half-diagonal.

Special values are:

- \(t=0\): \(P_i(t)=V_i\),
- \(t=\tfrac12\): \(P_i(t)=M_i\),
- \(t=1\): \(P_i(t)=O\).

Each \(t_j\) is shared by all six half-diagonals.  In Free mode, dragging any
\(P_i(t_j)\) changes only that shared \(t_j\), unless that row is locked.  The
lock only disables the UI handle; it does not change the mathematical target.

## 14. D6 point-orbit targets

The app also has an interactive point tool in Triangle, \(c_i\), Circle, and
Free modes.  A seed point \(Q\in H\) generates the D6 orbit
\[
\mathcal O_{D_6}(Q)
=
\{r^k Q:k=0,\dots,5\}\cup\{r^k\sigma Q:k=0,\dots,5\},
\]
where \(r\) is rotation by \(\pi/3\) about \(O\), and
\(\sigma(x,y)=(x,-y)\).  The app uses the set of distinct orbit points, so a
generic seed gives twelve points, while seeds on symmetry axes or at \(O\) may
give fewer.

For a finite list of seeds \(Q_1,\dots,Q_m\), the additional point target is
\[
\mathcal Q
=
\bigcup_{\ell=1}^m \mathcal O_{D_6}(Q_\ell).
\]
These points are added to the active coverability check.  In Triangle mode
they are tested against the C-triangle together with the generated
\(V_i\)-triangles.  In \(c_i\) mode they are tested against the generated
\(V_i\)-triangles.  In Circle mode they are tested against the C-circle
together with the generated \(V_i\)-triangles.  In Free mode they are tested
against all seven placed unit equilateral triangles.

## 15. The Benzene target

Free mode also has a target called **Benzene**.  It adds one fixed point in
each center subtriangle
\[
\triangle O V_i V_{i+1},\qquad i=0,\dots,5,
\]
with indices taken mod `6`.

Define
\[
B_i:=\frac{O+V_i+V_{i+1}}{3}=\frac{V_i+V_{i+1}}{3}.
\]
Thus \(B_i\) is the centroid of the subtriangle \(\triangle O V_i V_{i+1}\).

The Benzene target is
\[
\operatorname{Benzene}:=S\cup\{B_0,\dots,B_5\}.
\]
Equivalently, it is the full skeleton together with these six interior
centroid points.  The \(B_i\) are fixed points; there is no additional
parameter or drag interaction.

## 16. The lotus target

There is another 1-dimensional target set used by the app, called **lotus**.
Let
\[
D_i := \{p : \|p-V_i\|\le 1\}
\]
be the closed unit disk centered at the hexagon vertex `V_i`. The informal construction starts from the parity/XOR pattern
\[
(D_0\oplus D_1\oplus\cdots\oplus D_5)\cap H.
\]
The app's lotus target is not this filled 2-dimensional parity region. The target is the following explicit 1-dimensional curve set.

For each `i`, define two unit-circle arcs from `O` to `V_i`:
\[
A_i^- \subset \partial D_{i-1},
\qquad
A_i^+ \subset \partial D_{i+1},
\]
where indices are taken mod `6`. Thus `A_i^-` is centered at `V_{i-1}` and `A_i^+` is centered at `V_{i+1}`. Define
\[
L_i := A_i^- \cup A_i^+.
\]

The lotus target is
\[
\operatorname{Lotus}
:=
\partial H \cup \bigcup_{i=0}^5 L_i.
\]
Equivalently, it is the twelve arcs `A_i^\pm` together with the six perimeter edges
\[
\partial H = \bigcup_i [V_i,V_{i+1}]
\]
The perimeter is part of lotus, but it is recorded separately from the leaves `L_i`.

The useful geometric observation is that a unit equilateral triangle can intersect positive-length portions of at most four of the twelve lotus arcs. The app's Free-mode `Lotus` target currently checks coverage geometrically: each arc and perimeter edge is tested against the seven placed triangles by exact interval coverage.

The question represented by this mode is:

> Can the lotus target be covered by seven unit equilateral triangles?

This note records the definition and locality model only; it does not assert the answer to the seven-triangle lotus question.
