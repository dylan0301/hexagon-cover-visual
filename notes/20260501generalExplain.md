# Setup + Goal

- Define the _hexagon_ $H$ as the unit regular hexagon with center $C = (0, 0)$ and vertices $V_i = \omega^i$ where $\omega$ is the sixth primitive root of unity $\omega = (1 + \sqrt{3} i) / 2$.

  - Let $r_i$ be the half-diagonal $CV_i$. Let edges be $e_{i, i+1} = V_i V_{i+1}$.
  - Let $M_i$ be the midpoint of radius $r_i$

  - Define the _boundary_ $\partial H$. It consists of 6 edges of $H$.

  - Define the _skeleton_ $S$ as the union of $\partial H$ and three main diagonals

  - Define the _half-skeleton_ $S_{1/2}$ as the union of $\partial H$ and the center $C$ and the $M_i$'s.

Define the _$V$-triangle_ $T_i$ as an arbitrary open unit equilateral triangle containing the vertex $V_i$.

Define the $C$-triangle $T_C$ as the open unit equilateral triangle of side length 1 containing the origin $(0, 0)$.

Assume _general position_: No three lines on a single point, etc. ('Probability zero' sets)

__Goal.__ Show that the union of the interior of $V$-triangles $T_0, \ldots, T_5$ and $C$-triangle $T_C$ cannot contain the hexagon $H$.

 a Triangle $T$ is maximal over a set $X$ if there does not exist other triangle that covers $T \cap X$ and some more of $X$.

# Types of $V$-triangle

The $V$-triangle $T_i$ can have two properties:

- The number of vertices of $T_i$ outside $H$: 1 or 2 : $o$
- Whether $T_i$ intersects $r_{i-1}$ or $r_{i+1}$: $n$

-> Total of six possibilities of $(o, n)$, but $(2, 2)$ not attainable!

- Vd0 -> $(o, n) = (1, 0), (2, 0)$

- Vd1 -> $(o, n) = (1, 1)$
- Vd2 -> $(o, n) = (1, 2)$
- T3-like -> $(o, n) = (2, 1)$


The $C$-triangle $T_C$ can have two properties:

- The combinatorial type of the vertices of $T_C$
  - The set of six 60-degree angled convex cone $C_{01}, C_{12}, ..., C_{50}$, with vertex $O$
  - Whether $C_-$ contains the vertex of $T_C$ or not
    - 013 (Type 1) or 024 (Type 2) up to rotation and reflection (D6 dihedral group)

- Whether $T_C$ intersects some of the edges: $n$



- Type 1 -> Vertex-containing cones are $C_0, C_1, C_3$ modulo D6
- Type 2 -> Vertex-containing cones are $C_0, C_2, C_4$ modulo D6

- Ce0 -> $C$-triangle $T_C$ has no overlap with edges
- Ce1 -> has overlap with exactly one edge
- Ce2 -> has overlap with exactly two edges

# Admissible Set

Define the length of $T_i \cap e_{i, i+1}$ as $a_i$, $T_i \cap e_{i-1, i}$ as $b_i$, and $T_i \cap r_i$ as $c_i$.

The set of possible $(a, b, c)$'s form a very specific semialgebraic set $\mathcal{S}$. Call it _admissible set_.

- Define $g_c$, informally, as the map from 'previous' $a_{i-1}$ to 'next' $a_i$ for $c = c_i$.
  - Formally, $g_c(a)=$ maximum value of $a_{next}$ such that $(a_{next}, 1 - a, c) \in \mathcal{S}$

The strategy is to fix the $T_C$, and have induced $c_0, c_1, \ldots, c_5$.

Then, given $a_i$, we should have $b_{i+1} \geq 1 - a_i$ and so the maximum possible $a_{i+1}$ is $g_{c_i}(a_i)$

# Half-skeleton argument Lemmas

Case analysis on whether $V_i$ covers $M_i$ or $M_{i-1}$ or $M_{i+1}$

**Lemma 1:** If $V_i$ covers $M_i$ then $a_i + b_i < 1$ (assuming general position)

Proof: Admissible set

**Lemma 2**: If $V_i$ is Vd1 and covers $M_{i-1}$ or $M_{i+1}$, then the set of admissible $a_i, b_i$'s is small (???)
Proof: Geometrical calculations

**Lemma 3**: If $T_C$ is is Ce1 or Ce2, then it covers exactly one of $M_0, M_1, M_2, M_3, M_4, M_5$.
Proof: Geometrical calculations

# Subgoals: some $V_i$ overlaps with $r_{i \pm 1}$

## Ce0 + At least one Vd1/Vd2

Assumptions:

- $T_C$ is of type Ce0
- At least one of $T_i$'s ($V$-triangles) is of type Vd1 or Vd2 ($o = 1$, $n = 1, 2$)

Result:

- This cannot cover $S_{1/2}$.

Proof Ideas:

- Cover $S_{1/2}$ only

- Assume $T_0$ is Vd1 or Vd2
  - $(a_0, b_0)$ is forced to be very small
- $T_C$ covers only a subset of $M_0, \ldots, M_5$.
  - Look at combinatorial types of $M_i$'s _not_ covered by $T_C$.
- _If_ $M_i$ is covered by $V_i$, then invoke Lemma 1 and consider it 'gone' in $g$-chain
- _If_ $M_i$ is covered by $V_{i \pm 1}$, then it also induces small
- Only use $g_0$ (c = 0) or $g_{1/2}$ (c = 1/2)

Proof Sketch:

- Do case analysis on $x$, where $x$ is the largest distance from $O$ to $T_0 \cap r_1$
  - $x \geq 1/2$ -> $(a_0, b_0)$ more smaller
    - Four of $T_1, \ldots, T_5$ ($c_i = 0$) sufficient for proof
    - One of $T_1, \ldots, T_5$ has $c_i = 1/2$
  - $x \leq 1/2$ -> $M_1$ needs to be contained -> one extra triangle 'gone' in $g$-chain
    - Need combinatorial analysis on $M_i$'s
    - Two 'holes' $M_i$'s not covered by $T_C$ or $T_0$ are not adjacent
    - Another case analysis:
      - Case: one triangle $T_i$ covers two holes
        - Restricts $(a_i, b_i)$ greatly
      - Case: Two different $T_i, T_j$ covers each hole
        - Three of $T_1, \ldots, T_5$ ($c_i = 0$) sufficient for proof
        - Two of $T_1, \ldots, T_5$ has $c_i = 1/2$

## Ce1 + At least one Vd1/Vd2/T3-like

Proof Ideas:

- Cover $S_{1/2}$ only

- Assume $T_0$ is Vd1 or Vd2
  - $(a_0, b_0)$ is forced to be very small
- By Lemma 3, we can assume $T_C$ covers only one $M_i$.
- _If_ $V_i$ only covers $M_i$, then invoke Lemma 1, then the maximal triangle that covers $M_i$ is a triangle with $a_i + b_i = 1$  and consider it 'gone' in $g$-chain
- _If_ $M_i$ is covered by $V_{i\pm1}$, then it also induces small $a_{i\pm1}$ and $b_{i\pm1}$
- Only use $g_0$ (c = 0) or $g_{1/2}$ (c = 1/2) in the $g$-chain



+ Which $T_C$'s are maximal relative to $S_{1/2}$?
  + These are likely to be one-dimensional
    + LET'S EXPERIMENT!!!
    + Computer search / AI search
  + It contains exactly one of $M_i$'s
+ If T3-like triangle $T_i$ contains $M_i$, then it cannot contain $M_{i+1}$
  + And if $T_i$ contains $M_i$, then use Lemma 1 to dispose $g_i$
+ So if $T_i$ is T3-like, we can assume $T_i$ contains one of $M_{i \pm 1}$

+ FIx types of the 7 triangles and which $M_i
 each triangle covers. Then apply chain with figured out equations of the fixed type.
 We do this for all possible combinatorial types.
 + So first, Figure out all maximal triangles over $S_{1/2}$.

## Ce0 + No Vd1/Vd2 + T3-like

Assumptions:

- $T_C$ is of type Ce0
- No $V$-triangles are of type Vd1 or Vd2
- Some $V$-triangles are of type T3-like

Proof Steps:

- Look at adjacent $V$-triangles $V_i$ and $V_{i+1}$
  - Make a directed graph
  - Use maximality argument on skeleton to reduce the number of T3-like triangles

Result:

- This covering is not skeleton-maximal -> slightly incomplete???

##