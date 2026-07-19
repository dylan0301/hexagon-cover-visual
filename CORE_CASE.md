# Core Case Six Points

This note defines the six named points used by the app's Core Case and
Core `f(a,b)` modes:
$$
P_3,\quad P_4,\quad P_5,\quad D_0,\quad D_1,\quad D_2.
$$

It uses the same hexagon and AB-region conventions as `MATH.md`.

## Coordinate setup

Let $H$ be the regular unit-radius hexagon with vertices
$$
V_0=(1,0),\quad
V_1=(1/2,\sqrt3/2),\quad
V_2=(-1/2,\sqrt3/2),
$$
$$
V_3=(-1,0),\quad
V_4=(-1/2,-\sqrt3/2),\quad
V_5=(1/2,-\sqrt3/2),
$$
indexed modulo 6.  Write
$$
e_i=[V_i,V_{i+1}],\qquad
E_i(t)=V_i+t(V_{i+1}-V_i),\qquad 0\le t\le 1.
$$

On edge $e_i$, the left dot has parameter $\ell_i$ and the right dot has
parameter $r_i$, with $\ell_i\le r_i$.  A one-dot edge means
$\ell_i=r_i$.  The AB parameters are
$$
b_i=\ell_i,\qquad a_{i+1}=1-r_i,
$$
or equivalently $a_i=1-r_{i-1}$.

Local coordinates at $V_i$ are
$$
x=V_i+u(V_{i+1}-V_i)+v(V_{i-1}-V_i).
$$
The local metric is
$$
\|(u,v)\|^2=u^2+v^2-uv.
$$

For AB data $(a_i,b_i)$, let $R_i=R_i(a_i,b_i)$ be the app's AB local
region at $V_i$.  This is the exact AB region unless the two-line AB
superset option is on.  See `MATH.md` for the full local predicate.  The Core
Case always constructs $P_3,P_4,P_5$ from the preserved region
$$
R_4=R_4(a_4,b_4).
$$

The Core Case constraint slice is
$$
a_4+b_4>1,\qquad a_0+b_0,a_1+b_1,a_2+b_2\le 1,
$$
with optional force constraints $a_3+b_3=1$ and $a_5+b_5=1$.  When the
relaxed-P option is on, both force constraints are turned off.

## Circle centers for P-points

In normal mode the two radius-1 circles are
$$
\mathcal C_2=\{x:\|x-E_2(t_2)\|=1\},\qquad
\mathcal C_5=\{x:\|x-E_5(t_5)\|=1\}.
$$

In relaxed-P mode, $R_4(a_4,b_4)$ is still preserved, but the circle centers
are virtual:
$$
\mathcal C_2^{rel}=\{x:\|x-E_2(b_4)\|=1\},\qquad
\mathcal C_5^{rel}=\{x:\|x-E_5(1-a_4)\|=1\}.
$$
These are the circles used both for drawing and for selecting $P_3,P_5$.

Below, $\mathcal C_2^*$ and $\mathcal C_5^*$ mean the normal circles when
relaxed-P is off and the virtual circles when relaxed-P is on.

## P3 and P5

Let $\partial_c R_4$ be the part of the boundary of $R_4$ away from the
two coordinate axes in the local $V_4$ cone:
$$
\partial_c R_4=\{x\in\partial R_4: u_4(x)>0,\ v_4(x)>0\}.
$$

The point $P_3$ is the point of
$$
\partial_c R_4\cap\mathcal C_2^*
$$
closest to $V_4$.  If this set is empty but $R_4$ is nonempty, the app uses
the fallback edge point
$$
P_3=E_3(1-a_4).
$$

The point $P_5$ is the point of
$$
\partial_c R_4\cap\mathcal C_5^*
$$
closest to $V_4$.  If this set is empty but $R_4$ is nonempty, the app uses
the fallback edge point
$$
P_5=E_4(b_4).
$$

The fallback condition used by the app is
$$
a_4\ge 0,\qquad b_4\ge 0,\qquad a_4^2+a_4b_4+b_4^2\le 1.
$$
If this condition fails and no circle-boundary point exists, the corresponding
point is missing.

## P4

The point $P_4$ is the line-line junction of the strict two-line model for
$R_4$.  Set
$$
x=b_4,\qquad y=a_4,\qquad s=x+y,\qquad \rho=x^2+xy+y^2.
$$
The formula is invalid if $s\le 1$, $\rho\ge 1$, or $4\rho-3<0$.
Otherwise let
$$
h=\frac{\sqrt3}{2},\qquad d=\sqrt{\max(0,4\rho-3)}.
$$
Define
$$
\alpha=\frac{h(x+2y-xd)}{2\rho},\qquad
\beta=\frac{h(x-y+sd)}{2\rho},
$$
$$
\gamma=\frac{h(-x+y+sd)}{2\rho},\qquad
\delta=\frac{h(2x+y-yd)}{2\rho},
$$
and
$$
\omega=\alpha\delta-\gamma\beta.
$$
If $\omega\le 0$, the point is missing.  Otherwise define local coordinates
$$
u=\frac{\delta(x\alpha-y\beta)}{\omega},\qquad
v=\frac{\alpha(y\delta-x\gamma)}{\omega}.
$$
If $u<0$, $v<0$, or the corresponding point is not in $R_4(a_4,b_4)$,
then $P_4$ is missing.  Otherwise
$$
P_4=V_4+u(V_5-V_4)+v(V_3-V_4).
$$

## D0, D1, D2

Let
$$
U=H\setminus\bigcup_{i=0}^5 R_i
$$
be the uncovered red region.

In red-witness mode, for $j=0,1,2$, $D_j$ is the first boundary point of
$U$ on the ray from the origin to $V_j$.  Equivalently, parameterize the
ray as
$$
\gamma_j(t)=tV_j,\qquad 0\le t\le 1.
$$
If the origin is not in $U$, then $D_j$ is missing.  If the ray starts in
$U$, $D_j$ is the first transition point where $\gamma_j(t)$ leaves
$U$.  If no transition is found, the app uses the endpoint $V_j$.

In algorithm-2 mode the three diagonal points are instead
$$
D_j=(1-c_*(p,q))V_j,\qquad j=0,1,2.
$$
In Core f(a,b), algorithm-2 mode is always used with
$$
p=1-b,\qquad q=1-a.
$$
In Core Case, the app uses the current edge-dot endpoints independently:
$$
p=
\begin{cases}
1-r_4,& e_4\text{ has two dots},\\
1-b_4,& e_4\text{ has one dot},
\end{cases}
\qquad
q=
\begin{cases}
\ell_3,& e_3\text{ has two dots},\\
1-a_4,& e_3\text{ has one dot}.
\end{cases}
$$

To define $c_*(p,q)$, set
$$
\sigma=p+q,\qquad m=\min(p,q),\qquad M=\max(p,q),
$$
and
$$
T=\sigma^4-\sigma^2+pq.
$$
If $T\ge 0$, then
$$
c_*(p,q)=\operatorname{clamp}_{[0,1]}
\left(\frac{2M}{1+\sqrt{\max(0,4\sigma^2-3)}}\right).
$$
If $T<0$, then $c_*(p,q)$ is the largest value $c\in[\sigma,1]$ satisfying
$$
c^4-c^2+mc-m^2\le 0.
$$

## Core f(a,b)

Core `f(a,b)` uses only the two free parameters
$$
a_4=a,\qquad b_4=b,
$$
with domain
$$
0\le a,b\le 1,\qquad a+b>1,\qquad a^2+ab+b^2\le 1.
$$
It builds the same six points above, always using algorithm-2 for
$D_0,D_1,D_2$.  The relaxed-P checkbox changes only the P-point circles; it
does not change the preserved $R_4(a,b)$.

The point `use` checkboxes do not change the definitions above.  They only
choose which existing points are included in the fitted enclosing equilateral
triangle.
