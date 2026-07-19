# Target: CE2 C-triangle, exact midpoint subset {M0}, edges e50 and e01

Use `common-half-skeleton-guide.md` as the complete context.  Solve the
normalized C-triangle target:
\[
T_C\text{ contains exactly }M_0\text{ among }M_0,\dots,M_5,
\]
and \(T_C\) has positive-length overlap with exactly two hexagon boundary edges,
namely \(e_{5,0}\) and \(e_{0,1}\).

Write
\[
T_C\cap e_{5,0}=[s_{50},t_{50}],
\qquad
T_C\cap e_{0,1}=[s_{01},t_{01}].
\]
Find all maximal feasible interval pairs under product inclusion: both edge
intervals must be enlarged or contained simultaneously.  Do not optimize the
two intervals independently unless you prove that independent optimization is
valid.

Give symbolic inequalities, the maximal-pair derivation, boundary cases and degeneracies, and an independent numerical verification plan.
