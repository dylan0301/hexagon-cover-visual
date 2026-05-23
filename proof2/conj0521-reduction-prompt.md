# May 21/22 Hexagon Covering Reduction Prompt

This prompt is self-contained. It is meant for a mathematical LLM that should
try to prove one focused reduction step in the hexagon covering project.

## Instructions For The Solver

Work in English. Use TeX for mathematical notation.

Your goal is rigor, not plausibility. If you cannot complete the proof, state
exactly which lemmas or cases you can prove, and exactly where the remaining
gap is. Do not fill gaps with informal geometric intuition.

The accepted quadrilateral theorem below may be used without proof. Everything
else needed for the target statement should be proved or explicitly marked as
an assumption.

## 1. Geometry And Main Covering Context

Let \(H\) be the regular hexagon of side length \(1\), centered at
\[
O=(0,0).
\]
Its vertices are
\[
V_i=\left(\cos\frac{i\pi}{3},\sin\frac{i\pi}{3}\right),
\qquad i=0,\dots,5,
\]
with indices taken modulo \(6\). Let
\[
e_i=[V_i,V_{i+1}]
\]
be the boundary edge from \(V_i\) to \(V_{i+1}\).

The full skeleton is
\[
S=\partial H\cup [V_0,V_3]\cup [V_1,V_4]\cup [V_2,V_5].
\]
The global conjectural obstruction is that seven open equilateral triangles of
side length \(1\) cannot cover \(S\). The present task is not to prove the whole
conjecture from scratch. The present task is to prove the May 21/22 reduction
described below.

## 2. Boundary Points And Local Coordinates

Choose one point on each boundary edge:
\[
X_i=V_i+t_i(V_{i+1}-V_i),\qquad 0\le t_i\le 1.
\]
In the one-point-per-edge setting, write
\[
b_i=t_i
\]
for the distance from \(V_i\) to \(X_i\) along \(e_i\), and
\[
a_i=1-t_{i-1}
\]
for the distance from \(V_i\) to \(X_{i-1}\) along \(e_{i-1}\).

Thus
\[
a_i+b_i=1-t_{i-1}+t_i.
\]
In particular,
\[
a_i+b_i=1 \quad\Longleftrightarrow\quad t_i=t_{i-1}.
\]

At vertex \(V_i\), use local coordinates \((u,v)\) in the \(120^\circ\) cone
spanned by the two boundary directions from \(V_i\). The coordinate \(u\)
points from \(V_i\) toward \(V_{i+1}\), and \(v\) points from \(V_i\) toward
\(V_{i-1}\). The local metric is
\[
\|(u,v)\|^2=u^2+v^2-uv.
\]
In these coordinates the two adjacent boundary marked points are
\[
X_i=(b_i,0),\qquad X_{i-1}=(0,a_i).
\]

## 3. The AB-Union Region

For each \(i\), define \(R_i\) to be the set of all points \(P\in H\) such that
there exists a closed unit equilateral triangle containing
\[
V_i,\quad X_{i-1},\quad X_i,\quad P.
\]
Equivalently, in local coordinates at \(V_i\), \(R_i\) is the local set
\(R(a_i,b_i)\) of all \((u,v)\), \(u,v\ge 0\), that can be added to
\[
(0,0),\quad (0,a_i),\quad (b_i,0)
\]
inside one closed unit equilateral triangle.

Let the uncovered AB-union region be
\[
U=H\setminus \bigcup_{i=0}^5 R_i.
\]

Strategic caveat for this prompt: although \(R(a,b)\) is formally defined for
all local values, the AB-union construction has intended proof-strategy meaning
only for a triangle with \(a+b>1\). In the May 21/22 case below, this is the
unique strict triangle at \(V_4\). The other vertices enter through equality or
\(\le 1\) constraints and through the radial max-\(c\) points; do not treat
their AB-union regions as independent proof objects unless that extra use is
separately justified.

For an angle \(\theta\), define the three unit normal directions
\[
n_k(\theta)=
\left(
\cos\left(\theta+\frac{2\pi k}{3}\right),
\sin\left(\theta+\frac{2\pi k}{3}\right)
\right),
\qquad k=0,1,2.
\]
The side length of the smallest equilateral triangle with those outward normal
directions that contains \(U\) is
\[
L(\theta)=\frac{2}{\sqrt3}\sum_{k=0}^2 h_U(n_k(\theta)),
\]
where
\[
h_U(n)=\sup_{x\in U} n\cdot x.
\]
The optimized enclosing side length is
\[
L_*=\inf_{\theta\in[0,2\pi/3)} L(\theta).
\]

## 4. Exact Local Membership Predicate

This section gives a concrete semialgebraic description of \(R(a,b)\), using
the same axis convention as above: the outgoing boundary length \(b\) lies on
the \(u\)-axis and the incoming boundary length \(a\) lies on the \(v\)-axis.
Use it if a proof needs explicit inequalities.

To keep the formulas readable, set
\[
\alpha=b,\qquad \beta=a.
\]
Let \(A=(\alpha,0)\), \(B=(0,\beta)\), and \(X=(u,v)\) in local coordinates with
metric
\[
\|(x,y)\|^2=x^2+y^2-xy.
\]
If
\[
\alpha^2+\alpha\beta+\beta^2>1,
\]
then \(R(a,b)\) is empty. Otherwise \(X\in R(a,b)\) if at least one of the
following conditions holds.

Convex hull part:
\[
\beta u+\alpha v\le \alpha\beta.
\]

Fixed-side parts:
\[
\max(\alpha+\beta,\ \alpha-u+v,\ u+\beta,\ v)\le 1,
\]
or
\[
\max(\alpha+\beta,\ \beta-v+u,\ v+\alpha,\ u)\le 1.
\]

Moving side through \(A\): define
\[
D_A^2=(u-\alpha)^2+v^2-(u-\alpha)v,
\]
\[
P_A=\alpha(\alpha-u+v)+\beta v,\qquad Q_A=\alpha(\alpha-u),
\]
\[
S_A=\alpha(\alpha+\beta-u)+\beta(v-u).
\]
When \(D_A>0\), set
\[
\ell_A=
\max\left(D_A,\frac{P_A}{D_A}\right)
-
\min\left(0,\frac{Q_A}{D_A},\frac{S_A}{D_A}\right).
\]
Then the moving-side-through-\(A\) condition is
\[
\ell_A\le 1.
\]

Moving side through \(B\): define
\[
D_B^2=u^2+(v-\beta)^2-u(v-\beta),
\]
\[
P_B=\beta(\beta-v+u)+\alpha u,\qquad Q_B=\beta(\beta-v),
\]
\[
S_B=\beta(\alpha+\beta-v)+\alpha(u-v).
\]
When \(D_B>0\), set
\[
\ell_B=
\max\left(D_B,\frac{P_B}{D_B}\right)
-
\min\left(0,\frac{Q_B}{D_B},\frac{S_B}{D_B}\right).
\]
Then the moving-side-through-\(B\) condition is
\[
\ell_B\le 1.
\]

## 5. Local V-Triangle Admissible Set

The radial max-\(c\) points below use the local admissible set
\[
\mathcal A\subset[0,1]^3.
\]
A triple \((a,b,c)\in\mathcal A\) means that a closed unit equilateral triangle
containing \(V_i\) can cover boundary lengths \(a,b\) along the two adjacent
edges and radial length \(c\) along \([V_i,O]\).

The set is symmetric under \(a\leftrightarrow b\). For the ordered half
\(a\le b\), \(\mathcal A\) is the union of the following three cells.

Cell 1:
\[
a\le b,\qquad a+b\le 1,\qquad a^2+ab+b^2\le 1,
\]
\[
(a+b)^4-(a+b)^2+ab\le 0,
\]
\[
c^4-c^2+ac-a^2\le 0.
\]

Cell 2:
\[
a\le b,\qquad a+b\le 1,\qquad a^2+ab+b^2\le 1,
\]
\[
(a+b)^4-(a+b)^2+ab\ge 0,
\]
\[
((a+b)^2-1)c^2+bc-b^2\le 0.
\]

Cell 3:
\[
a\le b,\qquad a+b\ge 1,\qquad a^2+ab+b^2\le 1,
\]
\[
(a^2-1)c^2+(2ab^2+b)c+(b^4-b^2)\le 0,
\]
\[
c\le \frac12.
\]

For \(a>b\), define membership by symmetry:
\[
(a,b,c)\in\mathcal A\quad\Longleftrightarrow\quad (b,a,c)\in\mathcal A.
\]

## 6. The May 21/22 Constrained Case

Assume the difficult case has already been reduced to the situation where
exactly one \(V\)-triangle has
\[
a_i+b_i>1.
\]
By rotation, take this index to be \(i=4\). The `0521` constrained slice is
\[
a_4+b_4>1,
\]
\[
a_1+b_1=a_3+b_3=a_5+b_5=1,
\]
\[
a_0+b_0\le 1,\qquad a_2+b_2\le 1.
\]

In terms of the edge parameters \(t_i\), this is
\[
t_1=t_0,\qquad t_3=t_2,\qquad t_5=t_4,
\]
\[
t_4>t_3,\qquad t_0\le t_5,\qquad t_2\le t_1.
\]
Equivalently, after writing
\[
p=t_0=t_1,\qquad q=t_2=t_3,\qquad r=t_4=t_5,
\]
the constraints are
\[
q<r,\qquad q\le p\le r.
\]

The project intuition is that this constrained family should be enough to
resolve the May 21/22 case. The intended monotonicity claim is:

> To minimize the four-point enclosing triangle described in Section 8, the
> variable points should move to the equality boundary
> \(a_1+b_1=a_3+b_3=a_5+b_5=1\), leaving only the effective parameters
> \(p,q,r\) with \(q\le p\le r\).

This monotonicity should not be assumed unless it is proved. If it is false,
the solver should give a counterexample or identify the exact missing
hypothesis.

## 7. Accepted Quadrilateral Lemma

The following theorem is accepted for this prompt and may be used without
proof.

Let \(Q\) be a convex quadrilateral. Let \(f(Q)\) be a smallest-area, equivalently
smallest-side-length, equilateral triangle containing \(Q\). Then at least one
of the following contact patterns occurs:

1. one vertex of \(Q\) is a vertex of \(f(Q)\), and two of the other vertices of
   \(Q\) lie on edges of \(f(Q)\);
2. all four vertices of \(Q\) lie on edges of \(f(Q)\);
3. two vertices of \(Q\) are two vertices of \(f(Q)\).

Support-function formulation: if the outward normals of an enclosing
equilateral triangle are \(n_0,n_1,n_2\), with directions separated by
\(120^\circ\), then its side length is
\[
\frac{2}{\sqrt3}\bigl(h_Q(n_0)+h_Q(n_1)+h_Q(n_2)\bigr).
\]
The usual proof idea is that if each support value is realized by a unique
quadrilateral vertex and the fourth vertex is strictly interior to the three
supporting lines, then a small rotation of the normals decreases the side
length. Therefore such a configuration cannot be minimal.

Use this theorem as an allowed classification of the smallest enclosing
equilateral triangle for the four points in Section 8.

## 8. The Four-Point Construction

The four points are intended to witness the obstruction in the constrained
case.

Let
\[
R_4=R(a_4,b_4)
\]
be the AB-union region at \(V_4\).

Let \(C_2\) be the radius-\(1\) circle centered at \(X_2\), and let \(C_5\) be
the radius-\(1\) circle centered at \(X_5\). These are full circles; do not clip
them by a hexagon diagonal.

Define \(P_3\) to be the relevant intersection point between the boundary curve
of \(R_4\) and \(C_2\). Define \(P_5\) analogously as the relevant intersection
point between the boundary curve of \(R_4\) and \(C_5\). The phrase "boundary
curve of \(R_4\)" means the non-axis curved boundary of the local AB-union set,
not an edge of the hexagon and not a coordinate axis. If there are multiple
such intersections, the app selects the one closest to \(V_4\); a proof should
justify the correct branch or state a branch condition.

Next define two radial max-\(c\) points. For \(i=0,2\), let
\[
c_i^{\max}=\max\{c\in[0,1]:(a_i,b_i,c)\in \mathcal A\},
\]
where \(\mathcal A\) is the local admissible set for a unit equilateral
\(V_i\)-triangle with boundary coordinates \(a_i,b_i\) and radial coordinate
\(c\). Then
\[
G_i=(1-c_i^{\max})V_i.
\]
Thus \(G_0\in[O,V_0]\) and \(G_2\in[O,V_2]\).

Let
\[
Q=\operatorname{conv}\{P_3,P_5,G_0,G_2\}.
\]
Let
\[
\Lambda(P_3,P_5,G_0,G_2)
\]
be the side length of the smallest equilateral triangle containing these four
points.

The app computes this value numerically by fitting a smallest enclosing
equilateral triangle to the four points.

## 9. Target Statement To Prove

Prove the strongest rigorous form you can of the following target.

> Under the May 21/22 constrained case
> \[
> q<r,\qquad q\le p\le r,
> \]
> with four points \(P_3,P_5,G_0,G_2\) defined as above, the smallest
> equilateral triangle containing those four points has side length at least
> \(1\):
> \[
> \Lambda(P_3,P_5,G_0,G_2)\ge 1.
> \]

A proof of this target would show that the intended four-point obstruction
rules out the `0521` candidate case.

If the exact target is too strong as stated, prove a corrected version. For
example, a useful partial result would be one of:

1. a proof after identifying the correct branches for \(P_3\) and \(P_5\);
2. a proof under an additional explicit nondegeneracy assumption;
3. a proof that the minimum occurs on the boundary \(p=q\) or \(p=r\);
4. a proof that the accepted quadrilateral contact classification reduces the
   problem to finitely many algebraic cases;
5. a counterexample showing that the target statement needs a missing
   hypothesis.

## 10. Expected Proof Strategy

The preferred strategy is:

1. Convert all four points into explicit functions of \(p,q,r\).
2. Use the accepted quadrilateral lemma to reduce the smallest-enclosing
   triangle to finitely many contact patterns.
3. For each contact pattern, write the corresponding side-length candidate in
   terms of support functions or exact point constraints.
4. Prove that every candidate has side length at least \(1\), or isolate the
   exact parameter branch where the proof fails.
5. Separately justify the monotonicity/reduction claim that led to
   \(a_1+b_1=a_3+b_3=a_5+b_5=1\), if the proof uses it.

Do not rely on rasterized numerical evidence. Numerical checks are acceptable
only as sanity checks after an exact argument has been stated.

## 11. Required Output

Return your answer in this structure:

1. Summary and verdict: complete proof, partial proof, or counterexample.
2. Precise restatement of the proved theorem.
3. Definitions of all auxiliary quantities and branches used for \(P_3\) and
   \(P_5\).
4. Detailed proof.
5. List of unresolved gaps, if any.
6. Optional numerical verification, clearly separated from the proof.
