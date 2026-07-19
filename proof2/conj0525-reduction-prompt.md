# May 25 Five-Point Hexagon Covering Reduction Prompt

This prompt is self-contained. It is meant for a mathematical LLM that should
try to prove one focused five-point obstruction in the hexagon covering
project.

## Instructions For The Solver

Work in English. Use TeX for mathematical notation.

Your goal is rigor, not plausibility. If you cannot complete the proof, state
exactly which lemmas or cases you can prove, and exactly where the remaining
gap is. Do not fill gaps with informal geometric intuition or numerical
evidence.

The reductions
$$
a_3+b_3=1,\qquad a_5+b_5=1
$$
may be used as assumptions for this prompt. Everything else needed for the
target statement should be proved or explicitly marked as an assumption.

## 1. Geometry And Covering Context

Let \(H\) be the regular hexagon of side length \(1\), centered at
$$
O=(0,0).
$$
Its vertices are
$$
V_i=\left(\cos\frac{i\pi}{3},\sin\frac{i\pi}{3}\right),
\qquad i=0,\dots,5,
$$
with indices taken modulo \(6\). Let
$$
e_i=[V_i,V_{i+1}]
$$
be the boundary edge from \(V_i\) to \(V_{i+1}\).

The full skeleton is
$$
S=\partial H\cup [V_0,V_3]\cup [V_1,V_4]\cup [V_2,V_5].
$$
The global conjectural obstruction is that seven open equilateral triangles of
side length \(1\) cannot cover \(S\). The present task is not to prove the whole
conjecture from scratch. The present task is to prove the May 25 five-point
obstruction described below.

## 2. Boundary Points And Local Coordinates

Choose one point on each boundary edge:
$$
X_i=V_i+t_i(V_{i+1}-V_i),\qquad 0\le t_i\le 1.
$$
Write
$$
b_i=t_i
$$
for the distance from \(V_i\) to \(X_i\) along \(e_i\), and
$$
a_i=1-t_{i-1}
$$
for the distance from \(V_i\) to \(X_{i-1}\) along \(e_{i-1}\). Hence
$$
a_i+b_i=1-t_{i-1}+t_i.
$$
In particular,
$$
a_i+b_i=1 \quad\Longleftrightarrow\quad t_i=t_{i-1}.
$$

At vertex \(V_i\), use local coordinates \((u,v)\) in the \(120^\circ\) cone
spanned by the two boundary directions from \(V_i\). The coordinate \(u\)
points from \(V_i\) toward \(V_{i+1}\), and \(v\) points from \(V_i\) toward
\(V_{i-1}\). The local metric is
$$
\|(u,v)\|^2=u^2+v^2-uv.
$$
In these coordinates the two adjacent boundary marked points are
$$
X_i=(b_i,0),\qquad X_{i-1}=(0,a_i).
$$

## 3. The May 25 Reduced Slice

Assume the unique strict AB-union vertex is \(V_4\):
$$
a_4+b_4>1.
$$
Use the same reduction as in the May 21/22 four-point strategy:
$$
a_3+b_3=1,\qquad a_5+b_5=1.
$$
For the first three vertices, assume only
$$
a_0+b_0\le 1,\qquad a_1+b_1\le 1,\qquad a_2+b_2\le 1.
$$
There is no assumption that \(a_1+b_1=1\).

In edge parameters, these conditions are
$$
t_3=t_2,\qquad t_5=t_4,
$$
$$
t_4>t_2,\qquad t_0\le t_5,\qquad t_1\le t_0,\qquad t_2\le t_1.
$$

## 4. AB-Union Regions

For each \(i\), define \(R_i\) to be the set of all points \(P\in H\) such that
there exists a closed unit equilateral triangle containing
$$
V_i,\quad X_{i-1},\quad X_i,\quad P.
$$
Equivalently, in local coordinates at \(V_i\), \(R_i\) is the local set
\(R(a_i,b_i)\) of all \((u,v)\), \(u,v\ge 0\), that can be added to
$$
(0,0),\quad (0,a_i),\quad (b_i,0)
$$
inside one closed unit equilateral triangle.

Let the red uncovered region be
$$
U=H\setminus \bigcup_{i=0}^5 R_i.
$$
The five-point construction below uses all six sets \(R_i\) when choosing the
three diagonal points.

## 5. Exact Local Membership Predicate

This section gives a concrete semialgebraic description of \(R(a,b)\), using
the same axis convention as above: the outgoing boundary length \(b\) lies on
the \(u\)-axis and the incoming boundary length \(a\) lies on the \(v\)-axis.
Use it if a proof needs explicit inequalities.

Set
$$
\alpha=b,\qquad \beta=a.
$$
Let \(A=(\alpha,0)\), \(B=(0,\beta)\), and \(X=(u,v)\) in local coordinates with
metric
$$
\|(x,y)\|^2=x^2+y^2-xy.
$$
If
$$
\alpha^2+\alpha\beta+\beta^2>1,
$$
then \(R(a,b)\) is empty. Otherwise \(X\in R(a,b)\) if at least one of the
following conditions holds.

Convex hull part:
$$
\beta u+\alpha v\le \alpha\beta.
$$

Fixed-side parts:
$$
\max(\alpha+\beta,\ \alpha-u+v,\ u+\beta,\ v)\le 1,
$$
or
$$
\max(\alpha+\beta,\ \beta-v+u,\ v+\alpha,\ u)\le 1.
$$

Moving side through \(A\): define
$$
D_A^2=(u-\alpha)^2+v^2-(u-\alpha)v,
$$
$$
P_A=\alpha(\alpha-u+v)+\beta v,\qquad Q_A=\alpha(\alpha-u),
$$
$$
S_A=\alpha(\alpha+\beta-u)+\beta(v-u).
$$
When \(D_A>0\), set
$$
\ell_A=
\max\left(D_A,\frac{P_A}{D_A}\right)
-
\min\left(0,\frac{Q_A}{D_A},\frac{S_A}{D_A}\right).
$$
Then the moving-side-through-\(A\) condition is
$$
\ell_A\le 1.
$$

Moving side through \(B\): define
$$
D_B^2=u^2+(v-\beta)^2-u(v-\beta),
$$
$$
P_B=\beta(\beta-v+u)+\alpha u,\qquad Q_B=\beta(\beta-v),
$$
$$
S_B=\beta(\alpha+\beta-v)+\alpha(u-v).
$$
When \(D_B>0\), set
$$
\ell_B=
\max\left(D_B,\frac{P_B}{D_B}\right)
-
\min\left(0,\frac{Q_B}{D_B},\frac{S_B}{D_B}\right).
$$
Then the moving-side-through-\(B\) condition is
$$
\ell_B\le 1.
$$

## 6. The Five Points

The first two points are the same type of points used in the May 21/22
four-point obstruction.

Let \(C_2\) be the radius-\(1\) circle centered at \(X_2\), and let \(C_5\) be
the radius-\(1\) circle centered at \(X_5\). Define \(P_3\) to be the selected
intersection point between the non-axis boundary curve of \(R_4\) and \(C_2\).
Define \(P_5\) analogously using \(C_5\).

If there are multiple non-axis intersections, use the branch closest to
\(V_4\). If one of these intersections does not exist, then the five-point
configuration is undefined for that parameter choice.

The other three points lie on the half-diagonals
$$
[O,V_0],\qquad [O,V_1],\qquad [O,V_2].
$$
If \(O\notin U\), then the corresponding five-point configuration is undefined.
Otherwise, for \(j=0,1,2\), define
$$
\rho_j=\sup\{\rho\in[0,1]: \lambda V_j\in U
\text{ for every }0\le \lambda<\rho\}.
$$
Then define
$$
D_j=\rho_j V_j.
$$
Thus \(D_j\) is the point farthest from \(O\) in the initial red interval along
\([O,V_j]\). It may lie on \(\partial U\); this boundary case is intentional.
If the whole half-diagonal segment remains red, then \(D_j=V_j\).

The five obstruction points are
$$
P_3,\quad P_5,\quad D_0,\quad D_1,\quad D_2.
$$

This definition includes both common cases:

1. If no \(R_i\) cuts \([O,V_j]\), then \(D_j=V_j\).
2. If, for example, \(R_2\) crosses \([O,V_1]\), then \(D_1\) is the
   intersection point between \([O,V_1]\) and the relevant AB-union boundary.

## 7. Minimal Enclosing Equilateral Triangle

For any finite set \(K\subset\mathbb R^2\), define
$$
h_K(n)=\max_{x\in K} n\cdot x.
$$
For an angle \(\theta\), define the three unit normal directions
$$
n_k(\theta)=
\left(
\cos\left(\theta+\frac{2\pi k}{3}\right),
\sin\left(\theta+\frac{2\pi k}{3}\right)
\right),
\qquad k=0,1,2.
$$
The side length of the smallest equilateral triangle with these outward normal
directions that contains \(K\) is
$$
L_K(\theta)=\frac{2}{\sqrt3}\sum_{k=0}^2 h_K(n_k(\theta)).
$$
The optimized enclosing side length is
$$
\Lambda(K)=\inf_{\theta\in[0,2\pi/3)}L_K(\theta).
$$

For the May 25 five-point set, write
$$
K_5=\{P_3,P_5,D_0,D_1,D_2\}
$$
and
$$
\Lambda_5=\Lambda(K_5).
$$

## 8. May 25 Conjecture

Prove or disprove the following conjecture.

> For every parameter choice in the reduced slice of Section 3 for which all
> five points are defined,
> $$
> \Lambda_5>1.
> $$

Equivalently, no closed equilateral triangle of side length \(1\) contains all
five points
$$
P_3,\quad P_5,\quad D_0,\quad D_1,\quad D_2.
$$

A proof of this conjecture would give the desired five-point obstruction
without assuming \(a_1+b_1=1\), while still using the reductions
$$
a_3+b_3=1,\qquad a_5+b_5=1.
$$

## 9. Required Output

Return your answer in this structure:

1. State whether the conjecture is proved, disproved, or still open.
2. Give a rigorous proof, counterexample, or strongest partial proof.
3. Identify the exact branch choices for \(P_3\) and \(P_5\), or state what
   remains unresolved about them.
4. Analyze the three diagonal points \(D_0,D_1,D_2\), especially cases where
   an AB-union boundary cuts a half-diagonal before the usual radial point.
5. List exact unresolved gaps, if any.
6. Optional numerical checks, clearly separated from the proof.
