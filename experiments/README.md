# Union-Obstruction Numerical Experiments

This directory contains a small NumPy experiment for the strict-inequality question in
`prompts/20260511abUnion.txt`.

The browser app has a matching `ab union` mode for visual inspection. Use that mode to drag
the `p_i` points, toggle individual `R_i` regions, test the equality locks, clip regions to
corner sectors, and inspect sampled red-region witnesses.

Run a fast smoke test:

```bash
python3 experiments/union_obstruction_experiment.py --res 180 --theta-samples 120 --trials 20
```

Run a slower search:

```bash
python3 experiments/union_obstruction_experiment.py --res 300 --theta-samples 720 --trials 1000
```

The script reports:

- `b = (b_0,...,b_5)`
- `a_i+b_i = 1-b_{i-1}+b_i`
- `min |b_i-b_{i-1}|`
- sampled uncovered count
- best sampled `theta`
- sampled `L_*`
- classification:
  - `interesting`: `L_* < 0.98` and strict separation is above `1e-3`
  - `needs refinement`: `0.98 <= L_* < 1`
  - `not a counterexample`: `L_* >= 1`

This is a numerical probe, not a proof certificate. Near `L_* = 1`, increase `--res` and
`--theta-samples` and inspect the uncovered slits in the browser app.
