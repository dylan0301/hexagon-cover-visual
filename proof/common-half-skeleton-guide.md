# Common Guide: Maximal Unit Equilateral Triangles Over the Half-Skeleton

Use this as the common mathematical context for every target file in this
directory.  The target file specifies exactly one case to solve.

## 1. Geometry

Let \(H\) be the regular hexagon of side length \(1\), centered at
\[
C=(0,0).
\]
Its vertices are
\[
V_i=\left(\cos\frac{i\pi}{3},\sin\frac{i\pi}{3}\right),
\qquad i=0,\dots,5,
\]
with indices modulo \(6\).  In particular
\[
V_0=(1,0),\quad
V_1=\left(\frac12,\frac{\sqrt3}{2}\right),\quad
V_5=\left(\frac12,-\frac{\sqrt3}{2}\right).
\]
Let
\[
M_i=\frac12V_i
\]
be the midpoint of the radius \(CV_i\).  Thus
\[
M_0=\left(\frac12,0\right),\quad
M_1=\left(\frac14,\frac{\sqrt3}{4}\right),\quad
M_5=\left(\frac14,-\frac{\sqrt3}{4}\right).
\]

The half-skeleton is
\[
S_{1/2}=\partial H\cup\{C,M_0,\dots,M_5\}.
\]
It contains the entire boundary of the hexagon, but replaces the radial
segments by only the center and six radial midpoints.

The boundary edge from \(V_i\) to \(V_{i+1}\) is denoted \(e_{i,i+1}\).  In the
normalized \(V_0\)-local coordinates, use
\[
e_{0,1}(b)=V_0+b(V_1-V_0)
=\left(1-\frac b2,\frac{\sqrt3}{2}b\right),
\qquad 0\le b\le 1,
\]
and
\[
e_{5,0}(a)=V_0+a(V_5-V_0)
=\left(1-\frac a2,-\frac{\sqrt3}{2}a\right),
\qquad 0\le a\le 1.
\]
The adjacent rays are
\[
r_1(s)=sV_1,\qquad r_0(s)=sV_0,\qquad r_5(s)=sV_5,
\qquad 0\le s\le 1.
\]

## 2. Unit Equilateral Triangles

All triangles are closed unit equilateral triangles.  A convenient
parameterization is by center \(P=(u,v)\) and angle \(\theta\).  The vertices
are
\[
Q_k=P+\frac1{\sqrt3}
\left(\cos\left(\theta+\frac\pi2+\frac{2\pi k}{3}\right),
\sin\left(\theta+\frac\pi2+\frac{2\pi k}{3}\right)\right),
\qquad k=0,1,2.
\]
Assume the vertices are ordered counterclockwise.  A point \(X\) lies in the
closed triangle \(T\) iff
\[
\det(Q_{k+1}-Q_k,\;X-Q_k)\ge 0,\qquad k=0,1,2
\]
with indices modulo \(3\).

For a segment \(L(t)=A+t(B-A)\), \(0\le t\le 1\), the portion covered by \(T\)
is found by substituting \(L(t)\) into the three inequalities:
\[
\det(Q_{k+1}-Q_k,\;A-Q_k)
+t\det(Q_{k+1}-Q_k,\;B-A)\ge 0.
\]
Intersect the three resulting closed intervals in \(t\).  This is the interval
reported in maximal-frontier statements.

## 3. V-Triangles

A \(V_i\)-triangle is a closed unit equilateral triangle assigned to vertex
\(V_i\).  For target files, normalize to \(i=0\) by hexagon symmetry.  Thus the
triangle is \(T_0\), and it is constrained by the problem to contain \(V_0\).
Do not waste proof effort checking this base constraint; treat it as part of
the definition of a \(V_0\)-triangle.

The local boundary coverage coordinates are:
\[
a=\sup\{t\in[0,1]: e_{5,0}([0,t])\subset T_0\},
\]
\[
b=\sup\{t\in[0,1]: e_{0,1}([0,t])\subset T_0\}.
\]
Equivalently, \(a\) and \(b\) are the endpoint parameters of the intervals
\(T_0\cap e_{5,0}\) and \(T_0\cap e_{0,1}\) adjacent to \(V_0\).

For \(S_{1/2}\), ignore the radial coverage coordinate \(c\).  The target is a
maximal feasible set in the \((a,b)\)-plane for a fixed combinatorial type and
exact midpoint subset.

### V-Type Data

For a \(V_0\)-triangle, define:

- \(o\): the number of vertices of \(T_0\) outside the closed hexagon \(H\).
- \(n\): the number of adjacent rays among \(r_5,r_1\) that have positive
  length intersection with \(T_0\).

The relevant names are:

- Vd0: \((o,n)=(1,0)\) or \((2,0)\).
- Vd1: \((o,n)=(1,1)\).
- Vd2: \((o,n)=(1,2)\).
- T3-like: \((o,n)=(2,1)\).

The exact midpoint subset is taken from the local set
\[
\{M_5,M_0,M_1\}.
\]
Exact means: listed midpoints lie in the closed triangle \(T_0\), and unlisted
local midpoints do not lie in \(T_0\).

The realizable exact midpoint subsets to investigate are:

- Vd0 \((o=1,n=0)\): empty set.
- Vd0 \((o=2,n=0)\): \(\{M_0\}\).
- Vd1 \((o=1,n=1)\): empty set, \(\{M_0\}\), \(\{M_1\}\), \(\{M_5\}\),
  \(\{M_0,M_1\}\), \(\{M_0,M_5\}\).
- Vd2 \((o=1,n=2)\): \(\{M_0\}\), \(\{M_0,M_1\}\), \(\{M_0,M_5\}\),
  \(\{M_0,M_1,M_5\}\).
- T3-like \((o=2,n=1)\): \(\{M_1\}\), \(\{M_5\}\).

No other local midpoint subset is expected to be geometrically realizable.

## 4. C-Triangles

A \(C\)-triangle \(T_C\) is a closed unit equilateral triangle constrained to
contain \(C=(0,0)\).  Treat this as part of the definition; do not reject a
configuration merely by rechecking the base constraint.

For this project, the C-targets are normalized so that \(T_C\) covers exactly
the midpoint \(M_0\) among the six midpoints:
\[
M_0\in T_C,\qquad M_1,\dots,M_5\notin T_C
\]

CE1 means \(T_C\) has positive-length overlap with exactly one boundary edge.
The normalized CE1 target is overlap only with \(e_{0,1}\).  Write
\[
T_C\cap e_{0,1}
\]
as an interval \([s_{01},t_{01}]\) in the edge parameter.

CE2 means \(T_C\) has positive-length overlap with exactly two boundary edges.
The normalized CE2 target is overlap with \(e_{5,0}\) and \(e_{0,1}\).  Write
\[
T_C\cap e_{5,0}=[s_{50},t_{50}],
\qquad
T_C\cap e_{0,1}=[s_{01},t_{01}].
\]

## 5. Maximality

For V-targets, the object is the Pareto frontier of feasible \((a,b)\):
\[
(a,b)\preceq(a',b')
\quad\Longleftrightarrow\quad
a'\ge a,\ b'\ge b.
\]
A point is maximal if no other feasible point properly dominates it.

For CE1, maximality is interval inclusion:
\[
[s,t]\preceq [s',t']
\quad\Longleftrightarrow\quad
s'\le s,\ t'\ge t.
\]
The maximal set consists of intervals not properly contained in another
feasible interval.

For CE2, maximality is product inclusion:
\[
([s_{50},t_{50}],[s_{01},t_{01}])
\preceq
([s'_{50},t'_{50}],[s'_{01},t'_{01}])
\]
iff both edge intervals are contained:
\[
s'_{50}\le s_{50},\ t'_{50}\ge t_{50},
\qquad
s'_{01}\le s_{01},\ t'_{01}\ge t_{01}.
\]

## 6. Required Output From the LLM

For the target case, produce:

1. A precise restatement of the target.
2. A symbolic parameterization of the triangle and all constraints.
3. Exact semialgebraic inequalities for the target case.
4. A derivation of the closed maximal frontier.
5. A separate statement of boundary cases and degeneracies.
6. A numerical verification independent of the symbolic derivation:
   sampling variables, predicates to check, compute the Pareto/maximal
   frontier, and things that would count as evidence of an error.

Do not assume context outside the input guides and the target file.
