# Ce2 One-Interval Lemma and Maximality Formulation

## Setup

Let \(H\) be the regular hexagon, with boundary \(\partial H\) and skeleton \(S\).

Let \(T_C\) be a Ce2 \(C\)-triangle. Thus

\[
T_C \cap \partial H
\]

has exactly two connected components. Write them as

\[
T_C \cap \partial H = I_L \sqcup I_R.
\]

Assume, up to the dihedral symmetry of the hexagon, that

\[
M_4 \in T_C.
\]

Then the two Ce2 boundary intervals lie locally near the three \(V\)-triangles

\[
T_3,\quad T_4,\quad T_5.
\]

The relevant local picture is:

\[
I_L \subset e_{3,4},
\qquad
I_R \subset e_{4,5}.
\]

Here \(I_L\) is the Ce2 interval on the left side of \(V_4\), and \(I_R\) is the Ce2 interval on the right side of \(V_4\).

---

# Interaction Types

Let \(I\subset \partial H\) be one Ce2 interval, and let \(T_i\) be a \(V\)-triangle.

Define

\[
K_i := T_i \cap \partial H.
\]

We say that \(T_i\) interacts with \(I\) in one of the following four ways.

## 1. Include

\[
I \subset K_i.
\]

That is, \(T_i\) covers the entire Ce2 interval \(I\).

## 2. Intersect

\[
I \cap K_i \neq \varnothing,
\qquad
I \not\subset K_i.
\]

That is, \(T_i\) covers a nonempty proper subinterval of \(I\).

## 3. Attach

\[
I \cap K_i = \varnothing,
\qquad
\overline I \cap \overline{K_i} \neq \varnothing.
\]

That is, \(T_i\) does not cover any interior point of \(I\), but there is no empty boundary space between \(I\) and \(K_i\).

## 4. Far

\[
\overline I \cap \overline{K_i} = \varnothing.
\]

That is, there is a positive gap along \(\partial H\) between the interval \(I\) and the boundary part covered by \(T_i\).

Thus the four interaction types are ordered as

\[
\mathrm{include}
>
\mathrm{intersect}
>
\mathrm{attach}
>
\mathrm{far}.
\]

---

# Local Ce2 One-Interval Lemma

## Informal Statement

Assume \(T_C\) is Ce2 and contains \(M_4\). Then, when we look only at the three nearby perimeter triangles

\[
T_3,\quad T_4,\quad T_5,
\]

one of these three triangles must include one of the two Ce2 intervals.

In other words, among the two intervals

\[
I_L,\ I_R,
\]

at least one is completely covered by a single triangle among

\[
T_3,\ T_4,\ T_5.
\]

---

## Formal Statement

**Lemma.**  
Let \(T_C\) be a Ce2 \(C\)-triangle such that

\[
M_4 \in T_C.
\]

Let

\[
T_C\cap \partial H = I_L \sqcup I_R,
\]

where

\[
I_L \subset e_{3,4},
\qquad
I_R \subset e_{4,5}.
\]

Assume that the local perimeter region near

\[
I_L \cup I_R
\]

is covered by the three \(V\)-triangles

\[
T_3,\quad T_4,\quad T_5.
\]

Then at least one of the following inclusions holds:

\[
I_L \subset T_3,
\]

\[
I_L \subset T_4,
\]

\[
I_R \subset T_4,
\]

\[
I_R \subset T_5.
\]

Equivalently,

\[
\boxed{
\text{one of }T_3,T_4,T_5\text{ includes one of }I_L,I_R.
}
\]

---

# Reduced Form

The easy cases are when \(T_3\) or \(T_5\) already includes one interval.

So the nontrivial part of the lemma is the following.

**Reduced Lemma.**  
Suppose

\[
I_L \not\subset T_3
\]

and

\[
I_R \not\subset T_5.
\]

Then

\[
I_L \subset T_4
\qquad\text{or}\qquad
I_R \subset T_4.
\]

Equivalently,

\[
\boxed{
T_3\text{ does not include }I_L
\text{ and }
T_5\text{ does not include }I_R
\implies
T_4\text{ includes }I_L\text{ or }I_R.
}
\]

---

# Case Table Before Maximality

For each of \(T_3\) and \(T_5\), there are four possible interaction types:

\[
\mathrm{include},\quad
\mathrm{intersect},\quad
\mathrm{attach},\quad
\mathrm{far}.
\]

So before using maximality, there are

\[
4\times 4 = 16
\]

possible pairs:

\[
\bigl(\sigma(T_3,I_L),\sigma(T_5,I_R)\bigr).
\]

The cases where one entry is include are immediate.

Thus the nontrivial cases are the \(3\times 3\) cases

\[
\sigma(T_3,I_L),\sigma(T_5,I_R)
\in
\{\mathrm{intersect},\mathrm{attach},\mathrm{far}\}.
\]

For all of these cases, the desired conclusion is

\[
I_L \subset T_4
\qquad\text{or}\qquad
I_R \subset T_4.
\]

---

# Maximality Principle

Let \(X\subseteq H\) be a chosen set, for example

\[
X=S,
\qquad
X=S_{1/2},
\qquad
X=\partial H,
\]

or some local skeleton near \(I_L\cup I_R\).

A triangle \(T\) is called **maximal over \(X\)** if there does not exist another unit equilateral triangle \(T'\) of the same allowed type such that

\[
T\cap X \subseteq T'\cap X
\]

and

\[
T'\cap X \neq T\cap X.
\]

That is, \(T'\) covers everything that \(T\) covers on \(X\), and covers strictly more of \(X\).

---

# Maximality Reduction for Intersect Cases

## Informal Idea

The interaction type `intersect` is not extremal.

If a \(V\)-triangle covers a nonempty proper part of a Ce2 interval, then its boundary endpoint lies strictly inside that interval. Usually, one should be able to move or replace the triangle so that it covers more of the interval, without losing what it already covered on the skeleton.

Therefore, in a maximal configuration, an `intersect` interaction should be replaceable by either:

- `include`, if the triangle can be enlarged until it covers the whole interval, or
- an equality/boundary case, which behaves like `attach` or another constraint.

Thus, after passing to maximal triangles, one expects that `intersect` cases are unnecessary.

---

## Maximality Lemma

**Lemma.**  
Let \(I\subset \partial H\) be one Ce2 interval, and let \(T_i\) be a \(V\)-triangle interacting with \(I\).

Suppose \(T_i\) interacts with \(I\) by `intersect`, meaning

\[
I\cap (T_i\cap\partial H)\neq\varnothing
\]

but

\[
I\not\subset T_i\cap\partial H.
\]

If \(T_i\) is not constrained by another equality condition, then \(T_i\) is not maximal over the relevant skeleton \(X\).

Equivalently, in a maximal configuration over \(X\), we may assume that no \(V\)-triangle interacts with a Ce2 interval by `intersect`.

Therefore, in maximal configurations, the only required local interaction types are

\[
\mathrm{include},\quad
\mathrm{attach},\quad
\mathrm{far}.
\]

---

# Case Table After Maximality

After eliminating `intersect`, each of \(T_3\) and \(T_5\) has only three possible interaction types:

\[
\mathrm{include},\quad
\mathrm{attach},\quad
\mathrm{far}.
\]

So there are initially

\[
3\times 3 = 9
\]

cases.

The cases where one entry is `include` are immediate.

Thus the only genuinely nontrivial cases are

\[
(\mathrm{attach},\mathrm{attach}),
\]

\[
(\mathrm{attach},\mathrm{far}),
\]

\[
(\mathrm{far},\mathrm{attach}),
\]

\[
(\mathrm{far},\mathrm{far}).
\]

In each of these four cases, the desired conclusion is

\[
I_L \subset T_4
\qquad\text{or}\qquad
I_R \subset T_4.
\]

---

# Final Local Lemma After Maximality

**Lemma.**  
Let \(T_C\) be a Ce2 \(C\)-triangle such that

\[
M_4\in T_C.
\]

Let

\[
T_C\cap\partial H=I_L\sqcup I_R,
\]

with

\[
I_L\subset e_{3,4},
\qquad
I_R\subset e_{4,5}.
\]

Assume that \(T_3,T_4,T_5\) are maximal over the chosen skeleton \(X\).

Assume also that `intersect` cases have been eliminated by maximality.

Then one of the following holds:

\[
I_L\subset T_3,
\]

\[
I_L\subset T_4,
\]

\[
I_R\subset T_4,
\]

\[
I_R\subset T_5.
\]

Equivalently,

\[
\boxed{
\text{one of }T_3,T_4,T_5\text{ includes one Ce2 interval.}
}
\]

---

# Proof Strategy

1. Since \(T_C\) is Ce2 and contains \(M_4\), its boundary intersection has two intervals

   \[
   I_L\subset e_{3,4},
   \qquad
   I_R\subset e_{4,5}.
   \]

2. Classify the interaction of \(T_3\) with \(I_L\), and the interaction of \(T_5\) with \(I_R\), using

   \[
   \mathrm{include},\quad
   \mathrm{intersect},\quad
   \mathrm{attach},\quad
   \mathrm{far}.
   \]

3. By maximality, eliminate the `intersect` cases.

4. If \(T_3\) includes \(I_L\), we are done.

5. If \(T_5\) includes \(I_R\), we are done.

6. Otherwise,

   \[
   \sigma(T_3,I_L),\sigma(T_5,I_R)
   \in
   \{\mathrm{attach},\mathrm{far}\}.
   \]

7. Check the four remaining cases:

   \[
   (\mathrm{attach},\mathrm{attach}),
   \]

   \[
   (\mathrm{attach},\mathrm{far}),
   \]

   \[
   (\mathrm{far},\mathrm{attach}),
   \]

   \[
   (\mathrm{far},\mathrm{far}).
   \]

8. In each case, local perimeter coverage forces \(T_4\) to include at least one interval:

   \[
   I_L\subset T_4
   \qquad\text{or}\qquad
   I_R\subset T_4.
   \]

Therefore one of \(T_3,T_4,T_5\) includes one of the two Ce2 intervals.

---

# Coordinate Formulation

Let

\[
I_L=[\alpha_L,\beta_L]\subset e_{3,4},
\]

\[
I_R=[\alpha_R,\beta_R]\subset e_{4,5}.
\]

Let \(x_3\) be the endpoint of the interval

\[
T_3\cap e_{3,4}
\]

measured toward \(I_L\). Then:

\[
\begin{array}{c|c}
\text{interaction of }T_3\text{ with }I_L & \text{condition}\\
\hline
\mathrm{include} & x_3\ge \beta_L\\
\mathrm{intersect} & \alpha_L<x_3<\beta_L\\
\mathrm{attach} & x_3=\alpha_L\\
\mathrm{far} & x_3<\alpha_L
\end{array}
\]

Similarly, let \(x_5\) be the endpoint of

\[
T_5\cap e_{4,5}
\]

measured toward \(I_R\). Then:

\[
\begin{array}{c|c}
\text{interaction of }T_5\text{ with }I_R & \text{condition}\\
\hline
\mathrm{include} & x_5\ge \beta_R\\
\mathrm{intersect} & \alpha_R<x_5<\beta_R\\
\mathrm{attach} & x_5=\alpha_R\\
\mathrm{far} & x_5<\alpha_R
\end{array}
\]

The middle triangle \(T_4\) has two relevant boundary-covering lengths:

\[
b_4 := \text{coverage of }T_4\text{ along }e_{3,4},
\]

\[
a_4 := \text{coverage of }T_4\text{ along }e_{4,5}.
\]

Then

\[
I_L\subset T_4
\]

is equivalent to

\[
b_4\ge \beta_L,
\]

and

\[
I_R\subset T_4
\]

is equivalent to

\[
a_4\ge \beta_R.
\]

Thus the one-interval lemma can be written as the implication

\[
x_3<\beta_L
\quad\text{and}\quad
x_5<\beta_R
\implies
b_4\ge \beta_L
\quad\text{or}\quad
a_4\ge \beta_R.
\]

After eliminating intersect cases by maximality, this reduces to checking

\[
x_3\le \alpha_L,
\qquad
x_5\le \alpha_R,
\]

and proving

\[
b_4\ge \beta_L
\quad\text{or}\quad
a_4\ge \beta_R.
\]

---

# Summary

The Ce2 local analysis can be reduced to the following statement:

\[
\boxed{
\text{If }T_C\text{ is Ce2 and contains }M_4,
\text{ then among }T_3,T_4,T_5,
\text{ one triangle includes one Ce2 boundary interval.}
}
\]

With maximality over the chosen skeleton \(X\), the `intersect` cases should be unnecessary, so the proof only needs to handle:

\[
(\mathrm{attach},\mathrm{attach}),
\quad
(\mathrm{attach},\mathrm{far}),
\quad
(\mathrm{far},\mathrm{attach}),
\quad
(\mathrm{far},\mathrm{far}).
\]