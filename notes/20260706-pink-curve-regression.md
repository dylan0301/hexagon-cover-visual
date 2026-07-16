# Pink Minimum Curve Regression

Date: 2026-07-06

## Setting

This records a numerical comparison in Core `f(a,b)` mode with:

- all 6 core points enabled;
- two-line AB superset enabled;
- relaxed P circle enabled.

The computed pink minimum curve is the per-`a` sampled local minimum of `f(a,b)`.
It was compared against the admissible-set transition curve

```text
p = 1 - b
q = 1 - a
T(p,q) = (p+q)^4 - (p+q)^2 + pq = 0
```

For each sampled `a`, the analytic comparison value `b_T(a)` is the branch of
`T(1-b, 1-a) = 0` inside the Core graph domain

```text
a + b > 1
a^2 + ab + b^2 <= 1
```

## High-grid Result

Sampling grid:

```text
a samples: 129
s samples: 225
grid nodes: 29025
minimum-curve nodes compared: 120
```

Linear regression of computed curve values against the transition-curve branch:

```text
b_min = 0.0008887 + 0.9993427 * b_T
R^2   = 0.9999931
```

Residuals for `b_min - b_T`:

```text
mean       0.0005358
RMSE       0.0010697
median |.| 0.0004743
p90 |.|    0.0013877
max |.|    0.0053964
```

Residuals for `T(1-b_min, 1-a)`:

```text
mean       -0.0008272
RMSE        0.0021219
median |.|  0.0008590
p90 |.|     0.0020373
max |.|     0.0111273
```

Worst vertical residuals were near the domain endpoints. The largest observed
case was

```text
a     = 0.9850156266
b_min = 0.0278431748
b_T   = 0.0224467737
db    = 0.0053964012
T     = -0.0103321755
```

## Conclusion

In this setting, the computed pink minimum curve is extremely close to the
transition curve `T(p,q)=0`. The largest discrepancies occur near domain
endpoints and are consistent with sampling-grid effects rather than clear
evidence for a different curve.
