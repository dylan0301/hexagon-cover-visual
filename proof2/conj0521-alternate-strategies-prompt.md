# Alternate May 21/22 Strategy Prompt

This prompt is self-contained. It is meant for a mathematical LLM that should
investigate two possible proof strategies for the May 21/22 hexagon covering
reduction.

## Instructions For The Solver

Work in English. Use TeX for mathematical notation.

Your goal is rigor, not plausibility. If a proposed strategy is false or
missing a hypothesis, state that clearly and give the counterexample or exact
gap. Do not treat numerical or visual evidence as proof.

There are two strategies below. Try both. A complete solution to either
strategy is useful. If neither can be completed, give the strongest rigorous
partial results and explain exactly what remains unresolved.

## 1. Hexagon And Skeleton Setup

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
The global goal is to prove that seven open equilateral triangles of side
length \(1\) cannot cover \(S\). This prompt only asks for partial reduction
arguments relevant to the May 21/22 strategy.

## 2. Boundary Points And Local Coordinates

Choose one point on each boundary edge:
\[
X_i=V_i+t_i(V_{i+1}-V_i),\qquad 0\le t_i\le 1.
\]
Write
\[
b_i=t_i
\]
for the distance from \(V_i\) to \(X_i\) along \(e_i\), and
\[
a_i=1-t_{i-1}
\]
for the distance from \(V_i\) to \(X_{i-1}\) along \(e_{i-1}\). Hence
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

## 3. Local V-Triangle Admissible Set

Let
\[
\mathcal A\subset[0,1]^3
\]
be the local admissible set. A triple \((a,b,c)\in\mathcal A\) means that a
closed unit equilateral triangle containing \(V_i\) can cover boundary lengths
\(a,b\) along the two adjacent edges and radial length \(c\) along \([V_i,O]\).

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

For each \(i\), define
\[
c_i^{\max}=\max\{c\in[0,1]:(a_i,b_i,c)\in\mathcal A\}
\]
when the slice is nonempty, and define the radial max-\(c\) point
\[
G_i=(1-c_i^{\max})V_i\in[O,V_i].
\]

## 4. AB-Union Region For The Unique Strict Triangle

For local values \(a,b\), define \(R(a,b)\) as the set of all local points
\((u,v)\), \(u,v\ge 0\), that can be added to
\[
(0,0),\quad (0,a),\quad (b,0)
\]
inside one closed unit equilateral triangle.

Strategic caveat: in this project, the AB-union construction has intended
proof-strategy meaning only for a triangle with \(a+b>1\). In the May 21/22
case, the unique strict triangle is taken to be \(V_4\). Do not use AB-union
regions for the other vertices as independent proof objects unless that extra
use is separately justified.

Let
\[
R_4=R(a_4,b_4).
\]
Let \(C_2\) be the radius-\(1\) circle centered at \(X_2\), and let \(C_5\) be
the radius-\(1\) circle centered at \(X_5\). Define \(P_3\) to be the relevant
intersection point between the non-axis boundary curve of \(R_4\) and \(C_2\).
Define \(P_5\) analogously using \(C_5\). If there are multiple such
intersections, identify and justify the correct branch; the numerical app uses
the branch closest to \(V_4\).

## 5. Strategy A: Midpoint-Window Admissible-Set Attack

Investigate the following claim.

> If every boundary point lies near the midpoint of its edge,
> \[
> t_i\in[0.4,0.6]\qquad\text{for all }i,
> \]
> then the local admissible-set constraints at the six \(V_i\)-triangles are
> already incompatible with covering the full hexagon skeleton.

Under this midpoint-window assumption,
\[
a_i=1-t_{i-1}\in[0.4,0.6],
\qquad
b_i=t_i\in[0.4,0.6].
\]
The proposed proof should use only the local constraints
\[
(a_i,b_i,c_i)\in\mathcal A,\qquad i=0,\dots,5,
\]
together with the requirement that the six \(V_i\)-triangles cover the skeleton
portions not handled by the central triangle.

The motivation is heuristic: existing examples or near-examples appear only
when the \(X_i\) lie near edge midpoints. Do not assume this heuristic is true.
The task is to prove a precise midpoint-window obstruction or show why this
strategy cannot work as stated.

Useful outputs for Strategy A include:

1. a proof that no choice of \(c_i\) compatible with
   \(t_i\in[0.4,0.6]\) can cover the needed radial skeleton portions;
2. a cyclic inequality or composition argument using the admissible slices of
   \(\mathcal A\);
3. an explicit counterexample to the midpoint-window claim;
4. a corrected smaller interval \([\lambda,1-\lambda]\) for which the claim is
   true.

## 6. Strategy B: Five-Point Obstruction Without \(a_1+b_1=1\)

Investigate a variant of the May 21/22 four-point obstruction where we do not
assume
\[
a_1+b_1=1.
\]

Keep the unique strict triangle at \(V_4\):
\[
a_4+b_4>1.
\]
Keep the two equality reductions
\[
a_3+b_3=1,\qquad a_5+b_5=1,
\]
and allow
\[
a_0+b_0\le 1,\qquad a_1+b_1\le 1,\qquad a_2+b_2\le 1.
\]

In edge parameters, the equalities give
\[
t_3=t_2,\qquad t_5=t_4,
\]
and the inequalities include
\[
t_4>t_3,\qquad t_0\le t_5,\qquad t_1\le t_0,\qquad t_2\le t_1.
\]

Use five obstruction points:
\[
P_3,\quad P_5,\quad G_0,\quad G_1,\quad G_2.
\]
Here \(P_3,P_5\) are the two \(R_4\)-boundary/circle points from Section 4, and
\[
G_j=(1-c_j^{\max})V_j,\qquad j=0,1,2,
\]
are the radial max-\(c\) points for \(V_0,V_1,V_2\). In particular, \(G_1\) is
the additional point on \([O,V_1]\).

Let
\[
\Lambda_5(P_3,P_5,G_0,G_1,G_2)
\]
be the side length of the smallest equilateral triangle containing these five
points.

The target is:
\[
\Lambda_5(P_3,P_5,G_0,G_1,G_2)\ge 1.
\]

A proof of this target would remove the need to assume
\[
a_1+b_1=1
\]
in the earlier four-point strategy.

Useful outputs for Strategy B include:

1. a complete proof of \(\Lambda_5\ge 1\) under the stated inequalities;
2. a proof after identifying the correct branches for \(P_3\) and \(P_5\);
3. a proof under a clearly stated nondegeneracy hypothesis;
4. a reduction to finitely many support-function or contact-pattern cases;
5. a counterexample showing that the five-point claim is false as stated.

## 7. Support-Function Tool

For any compact set \(K\subset\mathbb R^2\), define
\[
h_K(n)=\sup_{x\in K} n\cdot x.
\]
If an enclosing equilateral triangle has outward unit normals
\[
n_k(\theta)=
\left(
\cos\left(\theta+\frac{2\pi k}{3}\right),
\sin\left(\theta+\frac{2\pi k}{3}\right)
\right),
\qquad k=0,1,2,
\]
then its side length is
\[
L_K(\theta)=\frac{2}{\sqrt3}\sum_{k=0}^2 h_K(n_k(\theta)).
\]
The smallest enclosing side length is
\[
\inf_{\theta\in[0,2\pi/3)}L_K(\theta).
\]

Use this support-function formulation for the five-point problem if direct
contact-pattern analysis becomes too complicated.

## 8. Required Output

Return your answer in this structure:

1. Summary and verdict for Strategy A.
2. Detailed proof, partial proof, or counterexample for Strategy A.
3. Summary and verdict for Strategy B.
4. Detailed proof, partial proof, or counterexample for Strategy B.
5. A list of exact unresolved gaps, if any.
6. Optional numerical checks, clearly separated from the proof.
