# Axis-Aligned Polygon Hull for AB Union

This note describes the current mathematical model used by `ab union` mode and
the hex-axis-aligned polygon hull used for strict rows with `a_i + b_i < 1`.

## Local Coordinates

Fix a hexagon vertex `V_i`.  Let `e_i` be the unit edge direction from `V_i` to
`V_{i+1}`, and let `e_{i-1}` be the unit edge direction from `V_i` to
`V_{i-1}`.  A point near `V_i` is written as

```text
p = V_i + u e_i + v e_{i-1}.
```

The three hex-axis line families are

```text
u = constant,
v = constant,
u - v = constant.
```

An axis-aligned polygon means every edge is parallel to one of these families.

For region `R_i`, the code uses

```text
alpha = b_i     outgoing edge length,
beta  = a_i     incoming edge length.
```

In hull-debug controls, if the user enters `a,b`, then internally

```text
alpha = b,
beta  = a.
```

## Exact Local AB Region

The exact local AB set is

```text
R(a,b) = { (u,v) : Contains(u,v; b,a) }.
```

Equivalently, put `alpha = b` and `beta = a`.  First require

```text
u >= 0,
v >= 0,
alpha^2 + alpha beta + beta^2 <= 1.
```

Then `(u,v)` is in the exact region if at least one of the following tests
passes.

The base triangle:

```text
beta u + alpha v <= alpha beta.
```

The two linear strip pieces:

```text
max(alpha + beta, alpha - u + v, u + beta, v) <= 1,
```

or

```text
max(alpha + beta, beta - v + u, v + alpha, u) <= 1.
```

The first curved support test uses

```text
d_alpha = sqrt((u - alpha)^2 + v^2 - (u - alpha)v).
```

If `d_alpha > 0`, define

```text
ell_alpha =
  max(
    d_alpha,
    (alpha(alpha - u + v) + beta v) / d_alpha
  )
  -
  min(
    0,
    alpha(alpha - u) / d_alpha,
    (alpha(alpha + beta - u) + beta(v - u)) / d_alpha
  ).
```

If

```text
ell_alpha <= 1,
```

then `(u,v)` is in the exact region.

The second curved support test uses

```text
d_beta = sqrt(u^2 + (v - beta)^2 - u(v - beta)).
```

If `d_beta > 0`, define

```text
ell_beta =
  max(
    d_beta,
    (beta(beta - v + u) + alpha u) / d_beta
  )
  -
  min(
    0,
    beta(beta - v) / d_beta,
    (beta(alpha + beta - v) + alpha(u - v)) / d_beta
  ).
```

If

```text
ell_beta <= 1,
```

then `(u,v)` is in the exact region.

The global AB union is the union over all six vertices:

```text
U = R_0 union R_1 union ... union R_5.
```

Each `R_i` uses the same local formula in coordinates based at `V_i`, with its
own values `a_i,b_i`.

## Diagonal Clipping

The local parallelogram bounded by the two adjacent diagonals is

```text
0 <= u <= 1,
0 <= v <= 1.
```

Hull debug uses this square only as a faint reference.  Its exact samples and
validation use the full local hexagon footprint

```text
0 <= u <= 2,
0 <= v <= 2,
|u-v| <= 1.
```

The suggested hull is available only in the strict case `a+b<1`; for
`a+b>=1`, hull debug shows the exact set without a recommended hull.

In normal AB union mode, the exact region is clipped to this sector only when
`clip to corner sectors` is enabled.  If that option is off, the AB union mask is
formed from the full sampled hexagon.

## Boundary Hit Anchors

For a strict row `a + b < 1`, the code adds two adjacent-edge boundary-hit
anchors.  Define

```text
h(t) = (-t + sqrt(4 - 3t^2)) / 2.
```

Then

```text
bottomHit = h(a),
leftHit   = h(b).
```

The sampled hull always includes the anchor points

```text
(bottomHit, 0),
(0, leftHit).
```

These are the two places where the AB boundary meets the adjacent hexagon
edges in the local picture.

## Sampled Slab Hull

The code builds the hull from samples of the exact local set.  Let

```text
S = { (u_k, v_k) : (u_k, v_k) is a sampled point in R(a,b) }.
```

For each sample define

```text
delta_k = u_k - v_k.
```

The hull is built as a union of vertical `u`-slabs.  First choose breakpoints

```text
0 = U_0 < U_1 < ... < U_n = maxU.
```

For non-near-equality rows, currently `a + b < 0.9`, the code uses three coarse
slabs and merges cuts closer than `0.15` in `u`.

For near-equality rows, currently `a + b >= 0.9`, the code uses breakpoints
derived from the geometry:

```text
0,
1 - leftHit,
1 - a,
topStart + margin,
topEnd + margin,
rightShelfStart + margin,
bottomHit,
maxU.
```

Here

```text
topStart = min { u_k : v_k >= 1 - 2 margin },
topEnd   = max { u_k : v_k >= 1 - 2 margin },
```

and

```text
rightShelfStart = max { u_k : v_k > 1 - b + margin }.
```

Duplicate or out-of-range breakpoints are removed after clamping.

For each slab

```text
I_j = [U_j, U_{j+1}],
```

collect all samples with `u_k` in that slab.  The code records

```text
M_j     = max v_k + margin,
D^-_j  = min (u_k - v_k) - margin,
D^+_j  = max (u_k - v_k) + margin.
```

The slab hull is

```text
H_j = {
  (u,v) :
    U_j <= u <= U_{j+1},
    0 <= v <= M_j,
    D^-_j <= u - v <= D^+_j
}.
```

The local axis-aligned hull is the union

```text
H(a,b) = H_0 union H_1 union ... union H_{n-1}.
```

This is hex-axis aligned because every boundary is one of

```text
u = constant,
v = constant,
u - v = constant.
```

## Polygon Boundary Form

Hull debug converts the slab union into an editable polygon.  For each slab,
candidate `u` values are

```text
U_j,
U_{j+1},
D^-_j,
D^+_j,
M_j + D^-_j,
M_j + D^+_j.
```

Each candidate is clamped into `[U_j, U_{j+1}]`.  At a candidate `u`, the lower
and upper boundary values are

```text
v_min(u) = max(0, u - D^+_j),
v_max(u) = min(M_j, u - D^-_j).
```

The polygon is formed by walking the lower points

```text
(u, v_min(u))
```

from left to right, then the upper points

```text
(u, v_max(u))
```

from right to left.  Collinear vertices are removed.

Thus the editable polygon is not an independent definition.  It is the boundary
representation of the sampled slab hull `H(a,b)`.
