#!/usr/bin/env python3
"""Numerical probes for the hexagon union-obstruction question.

The implementation mirrors prompts/20260511abUnion.txt and the browser app's
membership predicate. It intentionally stays NumPy-only so it is easy to run and
inspect.
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass

import numpy as np

SQRT3 = math.sqrt(3.0)
N = 6
EPS = 1e-9

V = np.array(
    [[math.cos(i * math.pi / 3), math.sin(i * math.pi / 3)] for i in range(N)],
    dtype=float,
)


@dataclass
class Result:
    b: np.ndarray
    a_plus_b: np.ndarray
    min_separation: float
    remaining_sample_count: int
    L_star: float
    theta: float
    classification: str


def cross_const_arr(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return a[0] * b[:, 1] - a[1] * b[:, 0]


def cross_arr_const(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return a[:, 0] * b[1] - a[:, 1] * b[0]


def make_grid(res: int) -> np.ndarray:
    xs = np.linspace(-1 + 1 / res, 1 - 1 / res, res)
    ys = np.linspace(-SQRT3 / 2 + SQRT3 / (2 * res), SQRT3 / 2 - SQRT3 / (2 * res), res)
    x_grid, y_grid = np.meshgrid(xs, ys)
    points = np.column_stack([x_grid.ravel(), y_grid.ravel()])
    inside = np.ones(points.shape[0], dtype=bool)

    for i in range(N):
        edge = V[(i + 1) % N] - V[i]
        inside &= cross_const_arr(edge, points - V[i]) >= -1e-12

    return points[inside]


def precompute_local_coords(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    local_u = []
    local_v = []

    for i in range(N):
        origin = V[i]
        outgoing = V[(i + 1) % N] - origin
        incoming = V[(i - 1) % N] - origin
        r = points - origin
        det = outgoing[0] * incoming[1] - outgoing[1] * incoming[0]
        u = cross_arr_const(r, incoming) / det
        v = cross_const_arr(outgoing, r) / det
        local_u.append(u)
        local_v.append(v)

    return np.array(local_u), np.array(local_v)


def region_contains_local(out_len: float, in_len: float, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    valid = (u >= -EPS) & (v >= -EPS)
    a = out_len
    b = in_len

    if a * a + a * b + b * b > 1 + 1e-8:
        return np.zeros_like(u, dtype=bool)

    if a > EPS and b > EPS:
        in_hull = b * u + a * v <= a * b + 1e-9
    elif a <= EPS and b <= EPS:
        in_hull = u * u + v * v - u * v <= 1e-10
    elif a <= EPS:
        in_hull = (np.abs(u) <= 1e-8) & (v >= -EPS) & (v <= b + 1e-8)
    else:
        in_hull = (np.abs(v) <= 1e-8) & (u >= -EPS) & (u <= a + 1e-8)

    out = valid & in_hull

    fixed_1 = np.maximum.reduce([
        np.full_like(u, a + b),
        a - u + v,
        u + b,
        v,
    ]) <= 1 + 1e-9
    fixed_2 = np.maximum.reduce([
        np.full_like(u, a + b),
        b - v + u,
        v + a,
        u,
    ]) <= 1 + 1e-9
    out |= valid & (fixed_1 | fixed_2)

    da2 = (u - a) ** 2 + v ** 2 - (u - a) * v
    ok_a = da2 > EPS * EPS
    da = np.ones_like(u)
    da[ok_a] = np.sqrt(da2[ok_a])
    pa = a * (a - u + v) + b * v
    qa = a * (a - u)
    sa = a * (a + b - u) + b * (v - u)
    ell_a = np.maximum(da, pa / da) - np.minimum.reduce([np.zeros_like(u), qa / da, sa / da])
    out |= valid & ok_a & (ell_a <= 1 + 1e-9)

    db2 = u ** 2 + (v - b) ** 2 - u * (v - b)
    ok_b = db2 > EPS * EPS
    db = np.ones_like(u)
    db[ok_b] = np.sqrt(db2[ok_b])
    pb = b * (b - v + u) + a * u
    qb = b * (b - v)
    sb = b * (a + b - v) + a * (u - v)
    ell_b = np.maximum(db, pb / db) - np.minimum.reduce([np.zeros_like(u), qb / db, sb / db])
    out |= valid & ok_b & (ell_b <= 1 + 1e-9)

    return out


def remaining_points(b: np.ndarray, points: np.ndarray, local_u: np.ndarray, local_v: np.ndarray) -> np.ndarray:
    covered = np.zeros(points.shape[0], dtype=bool)

    for i in range(N):
        out_len = b[i]
        in_len = 1 - b[(i - 1) % N]
        covered |= region_contains_local(out_len, in_len, local_u[i], local_v[i])

    return points[~covered]


def side_length_for_theta(points: np.ndarray, theta: float) -> float:
    if len(points) == 0:
        return 0.0

    total = 0.0
    for k in range(3):
        normal = np.array([
            math.cos(theta + 2 * math.pi * k / 3),
            math.sin(theta + 2 * math.pi * k / 3),
        ])
        total += np.max(points @ normal)

    return 2 * total / SQRT3


def optimize_theta(points: np.ndarray, samples: int) -> tuple[float, float]:
    if len(points) == 0:
        return 0.0, 0.0

    best_l = float("inf")
    best_theta = 0.0

    for theta in np.linspace(0, 2 * math.pi / 3, samples, endpoint=False):
        length = side_length_for_theta(points, theta)
        if length < best_l:
            best_l = length
            best_theta = theta

    return best_l, best_theta


def classify(length: float, min_separation: float) -> str:
    if length < 0.98 and min_separation > 1e-3:
        return "interesting"
    if length < 1:
        return "needs refinement"
    return "not a counterexample"


def test_configuration(
    b_input: list[float] | np.ndarray,
    points: np.ndarray,
    local_u: np.ndarray,
    local_v: np.ndarray,
    theta_samples: int,
) -> Result:
    b = np.array(b_input, dtype=float)
    rem = remaining_points(b, points, local_u, local_v)
    length, theta = optimize_theta(rem, theta_samples)
    sums = np.array([1 - b[(i - 1) % N] + b[i] for i in range(N)])
    min_sep = float(np.min(np.abs(b - np.roll(b, 1))))

    return Result(
        b=b,
        a_plus_b=sums,
        min_separation=min_sep,
        remaining_sample_count=len(rem),
        L_star=float(length),
        theta=float(theta),
        classification=classify(float(length), min_sep),
    )


def print_result(label: str, result: Result) -> None:
    print(f"\n{label}")
    print(f"  b                    = {np.array2string(result.b, precision=6, separator=', ')}")
    print(f"  a_i+b_i              = {np.array2string(result.a_plus_b, precision=6, separator=', ')}")
    print(f"  min |b_i-b_(i-1)|    = {result.min_separation:.8g}")
    print(f"  remaining samples    = {result.remaining_sample_count}")
    print(f"  L_star               = {result.L_star:.8f}")
    print(f"  theta                = {result.theta:.8f} rad ({result.theta * 180 / math.pi:.4f} deg)")
    print(f"  classification       = {result.classification}")


def random_strict(rng: np.random.Generator, min_gap: float) -> np.ndarray:
    for _ in range(10000):
        b = rng.uniform(0, 1, N)
        if np.min(np.abs(b - np.roll(b, 1))) > min_gap:
            return b
    raise RuntimeError("failed to generate a strict random sample")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--res", type=int, default=180, help="grid resolution per axis")
    parser.add_argument("--theta-samples", type=int, default=240, help="theta samples in [0, 2pi/3)")
    parser.add_argument("--trials", type=int, default=100, help="random strict trials")
    parser.add_argument("--seed", type=int, default=0, help="random seed")
    parser.add_argument("--min-gap", type=float, default=1e-3, help="strict separation threshold")
    args = parser.parse_args()

    points = make_grid(args.res)
    local_u, local_v = precompute_local_coords(points)
    rng = np.random.default_rng(args.seed)

    print(f"grid points in H: {len(points)}")
    print_result(
        "equality success preset",
        test_configuration([0.25] * N, points, local_u, local_v, args.theta_samples),
    )
    print_result(
        "near-miss strict preset",
        test_configuration([0.01, 0.008, 0.006, 0.004, 0.002, 0], points, local_u, local_v, args.theta_samples),
    )

    best: Result | None = None
    for _ in range(args.trials):
        result = test_configuration(random_strict(rng, args.min_gap), points, local_u, local_v, args.theta_samples)
        if best is None or result.L_star < best.L_star:
            best = result

    if best is not None:
        print_result("best random strict result", best)


if __name__ == "__main__":
    main()
