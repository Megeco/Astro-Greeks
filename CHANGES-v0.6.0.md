# v0.6.0 — Macro + Nifty and historical analogues

The supplied v0.5.0 Macro Notebook is the baseline. Existing homepage, options and research workspaces and notes remain in place. New expandable panel is below the macro tables and above observations.

## Included
- Aligned daily Pressure / Expansion / Volatility (0–100) and Nifty close (own scale), shared date cursor, date range and series toggles.
- Bundled 1996-01-01–2026-10-21 daily scores and 7,662 official reconciled Nifty closing observations. No repeated upload is required. No interpolated or today's price data.
- Similar-score search for today or a chosen date. Search dates, RMS tolerance, outcome horizon5/10/20 sessions, all eligible separate episodes, CSV export, rise count, mean, median and outcome range.
- Reference and selected past planetary positions plus active macro transits underneath; direct Swiss Ephemeris / Lahiri / mean node at12UTC. Scoring engine copied from the user's37.9.14-consistency-3 snapshot with a read-only context adapter; no score weights changed.
- Each past outcome must finish strictly before the reference date. Candidate episodes are ranked by equal-weight three-score distance. Episodes are chosen greedily closest first and spaced more than the selected horizon apart. No ranking by outcome or planetary configuration. This is a score analogue, not a claim of a repeated transit configuration.

## Sources and limits
Historical research archive and reference/past contexts consistently use37.9.14-consistency-3, the same snapshot used in our recent tests. The pre-existing75-day notebook retains its connected `fin-lumen-new.vercel.app` source; its version is explicitly separate. Do not interpret values from different source versions as a change in the market.

The historical archive ends2026-10-21 and does not automatically append daily prices or scores. Its coverage date is visible. Present/future reference transits are computed on demand. Latest Nifty reference at the top keeps its existing refresh behavior. Updating that reference does not extend the bundled chart archive.

Historical close outcomes are not executable forecasts: scores are at17:30IST, after NSE close. Rise frequencies are observed historical proportions, not calibrated future probabilities. No historical options chain, option payoff calibration, implied-volatility forecast or recommendation weighting is added. Nearby scores can come from very different planets; both configurations are shown.

## Deployment
Extract and upload the contents of `astro-greeks` at the root of your existing GitHub repository (not an extra enclosing directory). Vercel: Next.js, Node22 or24, `npm run build`, default output. No broker/API key/database needed. Check for v0.6.0 and the expandable chart panel. This ZIP is tested locally and is not automatically deployed.

## Verification
29 tests, Next.js production build, production HTTP smoke tests including archive counts, four historical/current direct-Swiss contexts, historical score parity, invalid-date rejection, and unchanged existing options/research flows. Browser preview status is documented in the delivery message.
