# v0.6.1 — Table fit and historical P/E/V paths

The comparison table now fits within the notebook pane. All eight columns remain visible on desktop; narrow screens use labelled episode cards without horizontal scrolling.

Each selected past episode now shows its actual then-current Pressure, Expansion and Volatility scores above the Nifty percentage-change path, with a shared date cursor/slider and series switches. A daily-values disclosure includes session, date, P/E/V, Nifty close and percentage from the anchor. The session path includes the anchor and the next5/10/20 available closes; it uses scores for those exact historical dates. Weekends and missing closes are not invented.

Matching rules, score weights, transits, archive coverage (through2026-10-21) and options workspace are unchanged. Data do not auto-append. Current/past research contexts use37.9.14-consistency-3; the75-day notebook retains its existing connected source.

Validation: production build,28 tests including date/score/path alignment and outcome-blind selection, production HTTP smoke including historical score parity and existing research/options flows. Actual component markup and CSS checked in desktop and phone browser layout fixtures: table and pane widths710/710px and310/310px respectively. Fixture checks establish layout, not live React interaction.

Extract and upload the contents of astro-greeks to the repository root as before. No deployment has been performed by the assistant. Check for v0.6.1 once deployed.
