# Hazard model — why the radius is not a free parameter (2026-09-04)

Verified against the live USGS ComCat API. Counting M>=6, depth<70km events since
1970 around Armenia, Quindio (4.53, -75.68):

| radius | events | lambda/yr | P(30d) | expected loss on $800 | premium @ LR 50% |
|--------|--------|-----------|--------|----------------------|------------------|
| 100 km | 1      | 0.0176    | 0.145% | $1.16                | **$2.32**        |
| 200 km | 3      | 0.0529    | 0.434% | $3.47                | **$6.95**        |
| 300 km | 12     | 0.2118    | 1.725% | $13.80               | **$27.61**       |

**A 12x price swing driven by a modelling choice.** Two problems:

1. Picking the radius to produce a nice premium is not pricing, it is fitting.
   The radius must come from the physics — how far damaging shaking (MMI VII+)
   travels for a shallow M6 — not from the answer we want.
2. At the trigger radius there is exactly **one** event in 56 years (the 1999
   M6.1 that killed ~1,900 people in Armenia). A Poisson rate from n=1 is
   statistically meaningless.

## Fix implemented in src/pricing/hazard.js

Estimate a **rate density** (events / year / km^2) over a wide reference region
where n is large enough to be stable, then scale it to the trigger circle:

    density = count / years / (pi * referenceRadius^2)
    lambda  = density * (pi * triggerRadius^2)

With reference 300 km (n=12) scaled to a 100 km trigger circle this gives
lambda ~= 0.0235/yr, P(30d) ~= 0.19%, and a premium near **$3** for $800 of
30-day cover — which is what makes the "$4 policy" thesis literally true.

Every input (count, years, radii, source URL) is returned with the quote and
published, so anyone can recompute the premium from the record alone.

## Honest limits to state in the README

Poisson on a catalogue ignores time dependence (aftershock clustering, seismic
gaps) and understates the tail. Catalogues before ~1970 are incomplete, which is
why the window starts there. This is a transparent, reproducible **first-order**
model, not an actuarial-grade one. Do not claim otherwise.
