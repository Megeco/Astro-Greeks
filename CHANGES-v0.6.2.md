# v0.6.2 — Automatic daily table and closest 75-day score path

The daily75-day P/E/V table now sits directly in the Macro window, inside an expandable section that is visible immediately, including loading/error state and count. The readings load on page open and date changes; manual reload remains available. It is initially collapsed for easy access when needed. Monthly and key-date summaries remain.

The75-day endpoint now calculates directly with the bundled37.9.14-consistency-3 Swiss/Lahiri/mean-node engine, the same engine as the research archive and transit contexts. It removes the previous dependence on15 successive batches from the remote app, without changing the bundled scoring rules. All75 readings arrive as one complete response; partial responses cannot appear complete.

The historical table keeps its anchor-score matches and ordering. Among them, the closest complete75-calendar-day P/E/V path is highlighted in gold and selected automatically. Ranking uses RMS error across225 score values (75 days ×3 scores), all equally weighted; lower is closer. Historical path endpoints must precede the reference date and all75 dates must be available. Missing/ineligible path gaps are shown as a dash. Returns do not influence the highlight. This is the closest path among the displayed anchor-match population, not an unrestricted search across all historical dates. Existing separate-episode spacing still depends on the5/10/20-session return horizon;75-day score paths can overlap.

The selected episode now includes a solid-vs-dashed comparison of its75-day P/E/V trajectory and the reference trajectory, on aligned calendar-day offsets. The previously added historical score/Nifty path remains below it. The reference date initially follows the Macro window, and its independent selector remains usable. All alternative matches and CSV export remain available.

Future astro scores are computable from the ephemeris. Using a future reference score path for similarity does not establish a predictable Nifty price path; this feature uses no future market prices. Historical matches are descriptive, and neither score proximity nor the highlight is a forecast probability or an options recommendation.

Historical Nifty archive remains through2026-10-21 and does not auto-append. No price history, scoring weights, options-selection logic or natal framework was changed.

Deploy by uploading contents of astro-greeks to the existing repository root. Expected version v0.6.2. Not deployed by the assistant. Validation:30 tests, production build and production HTTP smoke tests including the75-day endpoint, date boundaries, archived parity, and existing workspaces.
