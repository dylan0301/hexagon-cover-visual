# Area Conjecture

This note records the working area conjecture used by the `Max Area` and
`Area Conj` modes.

The purpose of the conjecture is to estimate how much area must lie outside
the regular hexagon when unit equilateral triangles are forced to contain
prescribed boundary data near the six vertices.

## 1. Hexagon And Boundary Coordinates

Let $H$ be the regular hexagon of side length $1$, centered at
$$
O=(0,0).
$$
Index its vertices by
$$
V_i=\left(\cos \frac{i\pi}{3},\sin \frac{i\pi}{3}\right),
\qquad i=0,\dots,5,
$$
with indices taken modulo $6$. Let
$$
e_i=[V_i,V_{i+1}]
$$
be the boundary edge from $V_i$ to $V_{i+1}$.

Choose one marked point $X_i$ on each boundary edge:
$$
X_i=V_i+t_i(V_{i+1}-V_i), \qquad 0\le t_i\le 1.
$$

At the vertex $V_i$, define the adjacent boundary lengths
$$
a_i=1-t_{i-1}, \qquad b_i=t_i.
$$
Thus $a_i$ is the distance from $V_i$ to $X_{i-1}$ along the incoming
edge $e_{i-1}$, and $b_i$ is the distance from $V_i$ to $X_i$ along the
outgoing edge $e_i$.

Equivalently, in local coordinates at $V_i$, the two adjacent boundary
points are
$$
(0,a_i),\qquad (b_i,0),
$$
inside the $120^\circ$ cone spanned by the two boundary directions.

## 2. The Local Function $f(a,b)$

Fix $a,b\in[0,1]$. Let $P_a$ and $P_b$ be the two adjacent boundary
points at one vertex $V$, at distances $a$ and $b$ from $V$ along the
two boundary edges.

Define $f(a,b)$ by
$$
f(a,b)
=
\max_T \frac{\operatorname{area}(T\cap H)}{\operatorname{area}(T)},
$$
where the maximum is over all closed unit equilateral triangles $T$ such
that
$$
V,\quad P_a,\quad P_b \in T.
$$
Since $T$ has side length $1$, the denominator is the fixed area
$$
\operatorname{area}(T)=\frac{\sqrt 3}{4}.
$$
Thus $f(a,b)\in[0,1]$, and $1-f(a,b)$ is the normalized area of the part
of a realizing triangle that lies outside the hexagon.

When a triangle attaining the maximum is chosen, denote it by
$$
T(a,b).
$$
The maximizing triangle need not be unique.

## 3. Six-Vertex Area Conjecture

For a boundary configuration $X_0,\dots,X_5$, define
$$
f_i=f(a_i,b_i).
$$

The working conjecture is that in the relevant nontrivial configurations,
especially when at least two rows satisfy
$$
a_i+b_i>1,
$$
one should have
$$
\sum_{i=0}^5 f_i < 6.
$$
Equivalently,
$$
\sum_{i=0}^5 (1-f_i) > 0.
$$

The intended geometric meaning is that the six locally forced unit triangles
cannot all be realized entirely inside $H$; the total outside area should be
strictly positive. A stronger proof strategy would try to show that the
outside-area contribution is quantitatively large when several rows have
$a_i+b_i>1$.

The exact final hypotheses for the strongest useful form of this conjecture
are still part of the proof problem.

## 4. Structural Conjecture For $T(a,b)$

The numerical search is guided by the following structural conjecture.

### Case 1: $a+b\le 1$

If
$$
a+b\le 1,
$$
then $T(a,b)$ can be chosen to be axis-aligned with the hexagon.

More precisely, by symmetry assume
$$
a\le b.
$$
Then one side of $T(a,b)$ lies on the same line as the hexagon edge
containing the $b$-point. The case $b<a$ is obtained by reflecting the
statement and using the edge containing the $a$-point.

In the app, this is implemented as a deterministic candidate triangle. It is
not assumed to replace the full numerical search; it is added to the candidate
set so the maximum can still be chosen by area comparison.

### Case 2: $a+b>1$

If
$$
a+b>1,
$$
then $T(a,b)$ is conjectured to admit a Type 2 realization:
one vertex of the unit equilateral triangle lies exactly at one of the two
boundary points $P_a$ or $P_b$.

In the app, this is implemented as a family of anchored candidate triangles,
again competing with the generic numerical search rather than replacing it.

## 5. Numerical Modes

The `Max Area` mode studies one pair $(a,b)$. It computes a numerical
candidate for $f(a,b)$, displays a realizing triangle, and reports
$$
f(a,b),\qquad 1-f(a,b).
$$

The `Area Conj` mode studies six rows at once. It lets the user move six
boundary points on $\partial H$, producing six pairs
$$
(a_i,b_i),\qquad i=0,\dots,5.
$$
For each row it computes $f_i=f(a_i,b_i)$, draws the corresponding realizing
triangle candidate, and reports
$$
\sum_i f_i,\qquad \sum_i(1-f_i).
$$

The UI also supports row constraints such as
$$
a_i+b_i=1
$$
and
$$
a_i+b_i=1+\delta.
$$
For numerical stability, the internal target for the first constraint is
implemented as $1-\varepsilon$, where $\varepsilon$ is a hard-coded
tolerance in the application code.

## 6. Open Proof Tasks

The current proof problem has three main parts.

1. Prove the structural conjecture for $T(a,b)$ in the two regimes
   $a+b\le 1$ and $a+b>1$.
2. Derive explicit formulas or sharp bounds for $f(a,b)$ from that
   structure.
3. Use those bounds around the six vertices to prove the desired strict
   inequality for $\sum_i f_i$ under the correct global hypotheses.

