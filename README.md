# v0.3.1 — Readability update

A presentation-only update, keeping the existing readings, shortlists, rules and saved data.

- System UI font (Segoe UI on Windows), with 16px desktop body/table text and 15px mobile tables; no external font download.
- A centred 920px reading column, with a compact four-column shortlist; supporting wide tables remain expandable.
- Near-black text, neutral white/grey surfaces and clear table rules, closer to a readable conversation transcript.
- Sentence-case, bold table headings; more row padding and line spacing; tabular numerals.
- Restrained highlighting: pale green for the preferred comparison, blue for the selected row, and distinct action/risk states. Ordinary numbers and explanatory text stay dark and neutral.
- Larger controls and supporting notes, including the separate research screens. No charts or additional data fields.

Replace the repository source files and let the same Vercel project redeploy. Export a backup first as usual; storage and calculations are unchanged. Production build and HTTP checks validate the release. Visual browser automation remains unavailable here.

---

# v0.3 — The worked reading comes first

Update the existing GitHub repository with this release’s source files and let Vercel redeploy. Keep the same domain and export a backup first. Existing records use the same browser storage; no migration or API key is needed.

The default view now follows our discussion tables:

1. **Market reference** at the cutoff.
2. **Our working macro read:** a short interpretation, then a table of selected dates/windows, Pressure, Expansion, Macro V and what each window may mean. The full 75-day table is collapsed underneath. The displayed difference column is removed.
3. **Options worth investigating:** a preferred directional comparison, balanced benchmark, smaller-premium alternative and additional-time comparison, when qualifying quotes exist. Each row gives a premium, actual dated lot cost and plain-language trade-off. The complete available quote table and filters are collapsed underneath.
4. **The worked plan:** a proposed buy date, cash to allow, exit date/rules and skip condition. Three price examples show the numbers under explicit Nifty assumptions. Date/size/cost editing is collapsed underneath. Recording an actual purchase remains separate from saving a hypothetical plan.

There are no charts. Bought-option monitoring and the original research tools remain separate. Macro V is the only displayed volatility measure.

The briefing uses explicit rules, **not a trained AI interpretation or calibrated forecast**. Date selection keeps the cutoff, an early relief window, the first later pressure pulse, the strongest pressure and volatility dates, a sustained expansion transition and/or an expansion crest where present. It never looks at later market prices. Consecutive equal P/E days can be grouped into a window; V shows its endpoints. The short narrative refers to these dates rather than averaging the series into three 25-day blocks.

The shortlist uses the nearest expiry after the tentative exit: an absolute delta near 0.70 for directional exposure, near 0.50 for a balanced benchmark, an OTM comparison with absolute delta 0.15–0.40 and a smaller premium, and a second-expiry half-delta comparison. Where a snapshot spot is supplied, the OTM comparison is closest to a 2% OTM target. These are exploratory role choices; they are not proven probabilities or an unconditional instruction to buy. Both calls and puts can appear when separate macro windows qualify. The prior full-quote comparison highlights remain available in the expandable evidence table.

Existing ten-day lead / two-day exit date presets remain experimental and editable. No market-level target or profit probability has been calibrated. Worked premium examples assume a reference entry at the cutoff close, not an unknown future fill. Live data is not connected; monitoring continues to use manually observed or archived dated prices. Original losing tests and frozen records are unchanged.

Validation for this release: 19 unit tests plus production build/type checks and HTTP smoke checks. Visual browser automation was unavailable.

The remaining deployment, storage, archive and execution documentation follows below. Release notes above supersede earlier descriptions of the first screen and shortlisting.

---

# Fin-Lumen Options Desk — v0.2

## Update your existing GitHub / Vercel app

Export a workspace backup before updating. Replace the repository’s source files with the contents of this release, commit, and let your existing Vercel project redeploy. Keep the same Vercel domain to retain browser data. Node 24, `npm ci`, `npm run build`; no new environment variables.

The original storage name is unchanged. Existing frozen plans, studies, data packs and notes are retained. The new bought-option register is added alongside them. Old backups still restore; new backups include purchases and premium observations.

## Simpler working view

- **Decision tables:** market reference; 75 daily P / E / V scores; a one-line path read; highlighted option candidates; the selected option’s buy / exit dates and price-scenario table directly below.
- **Bought options:** actual paid premium, dated lot size, latest observed premium, net marked P&L, days remaining and an action cue with its rule.
- **Tests & data:** the original frozen-plan, replay, quarterly-test, import and notebook tools at `/research`. Their plots have been replaced with numerical tables.

**Only Fin-Lumen’s macro V is displayed as volatility.** There are no additional IV or India VIX displays or controls in the decision desk. Internal option-pricing calculations still use fitted market inputs; the macro V score is not substituted as a financial pricing parameter.

Candidate colours distinguish lowest cash outlay (amber), directional exposure (green) and more time (blue). They are explicit exploratory comparisons, not calibrated buy recommendations. The desk shows the available archived contracts, not the entire NSE chain. Candidate filters require volume / OI of at least 1,000 and an expiry buffer of more than seven days after the proposed exit; actual liquidity and fill quality still need checking.

The automatic one-line path compares average P and E in consecutive 25-day blocks, using a provisional 3-point separation. The proposed date preset uses the strongest same-side P−E / E−P day in the 75-day window, entering ten calendar days before and exiting two days after, with calendar adjustments and entry after the cutoff. This preset is **new and uncalibrated**; it is not a discovered historical optimum. Edit dates and conditions before freezing. A frozen plan retains the existing strict-quarter and execution checks.

Price scenarios show Nifty moves of −3%, −1%, 0%, +1% and +3% at the chosen exit, with other fitted pricing inputs held constant. They use the cutoff premium as a reference entry, not an invented future fill. **Outcome and recovery probabilities remain “Not calibrated”.** We still need to fit and validate a move/timing distribution against macro scores before percentages can be supplied responsibly.

Monitoring accepts a manually observed dated premium (with source / timestamp note) or an explicitly labelled archived close. **No automatic live feed is connected.** Action cues use the position’s actual paid premium, costs, written time exit and profit/loss thresholds; they are not probability-based advice. Tracking a position as closed does not calculate realised P&L without an exit fill. Historical prices must not be interpreted as current quotes.

Validation: 16 unit tests, TypeScript, production build and HTTP smoke checks. Browser visual automation remains unavailable in this environment.

---

## Deploy or run

For a new deployment: upload the extracted project contents into a private GitHub repository, then import it into Vercel as Next.js. Use Node 24, `npm ci` and `npm run build`. No database or API keys are needed. Configure Vercel Deployment Protection separately if the URL should be private.

For local use:

```sh
npm ci
npm run dev
```

For verification:

```sh
npm test
npm run typecheck
npm run build
npm run test:smoke
```

Records are saved in the same browser using IndexedDB; export before clearing site data or changing browsers/domains. Freeze research plans before revealing outcomes in Tests & data. A hash detects changes but is not a secure blind-test service. Previously exposed studies stay in development.

## Data that is actually bundled

- **3,287 daily macro rows:** 1 October 2017–30 September 2026, pinned to `C1-37.9.14-retrospective`.
- **139 market sessions / 55,642 option quotes:** 14 August–28 September 2023 and 15 March–22 August 2024. Contract coverage varies by session and original study. The archive is **not** the complete NSE option chain.
- **Six previously examined studies / 767 original policy rows:** September 2023, April, May, June, July and August 2024. Original results are preserved with source fingerprints; the current replay engine does not overwrite them.
- Quotes for 2018–2022 are **not bundled**. These quarters remain import-required rather than generating invented results.
- The model scores were generated retrospectively. We do not have evidence they were published or available on those historical cutoffs. A retrospective as-of replay is not an ex-ante forecasting track record.

Nifty index options launched on **4 June 2001** ([NSE release](https://nsearchives.nseindia.com/content/press/04062001.pdf)). Start research from 2018 if quote quality allows, report 2018–2020 separately from 2021 onward, and use each date's lot size, expiry calendar and liquidity. There is no need to assume options did not exist before 2021.

## Replay rules, precisely

- **Information cutoff:** all contract-selection inputs are from the previous actual session before entry. The macro view is cutoff through cutoff +74 calendar days. The trade's last exit and option expiry are independent dates.
- **Scheduled:** first actual market session inside the frozen entry window. For an exact planned day, set the window start and end to that day.
- **Contrarian:** at a candidate entry, compare the previous close with the close three loaded sessions before it. A call requires a negative cumulative Nifty change; a put requires a positive change. This is a cumulative comparison, not a demand for three consecutive same-direction sessions.
- **Confirmation:** prior close versus two sessions earlier must move in the option's direction; the selected same contract's premium close must also have increased over those two sessions. A single first qualifying signal is used.
- **Selection:** fixed strike; nearest absolute delta 0.70 inside 0.60–0.80; nearest absolute delta 0.50 inside 0.40–0.60; or closest strike to a 2%/4% OTM target. OTM targets are distances, not a claim of exact moneyness on a discrete strike grid. All require supplied minimum volume/OI and a valid IV fit. No fallback contract is substituted.
- **Opening cap:** the traded opening print cannot exceed the selected prior premium close by more than the configured percentage. It is tested once. A rejection is a no-fill, not a later intraday limit fill. These daily prints cannot establish actual bid/ask execution.
- **Costs:** entry debit = opening premium × dated lot × lots × (1 + slippage%) + total position reserve. Exit proceeds = exit print × units × (1 − slippage%). Net P&L is proceeds minus debit. The reserve is total per position, not per lot, and is a simplified user assumption rather than a statutory fee calculator.
- **Fixed exit:** close on the last expected session on/before the exit date.
- **Monitored exit:** net close-to-close marked return reaches +profit or −loss threshold; execute at the next actual session opening print. It may gap through the threshold. No intraday trigger or same-close execution is assumed.
- **Follow-through exit:** in addition to thresholds, if net marked P&L is ≤0 at the frozen deadline, execute next session open. A holiday deadline rolls to the preceding expected session. Missing deadline marks leave management unresolved.
- **Data gaps:** the engine requires a four-session pre-entry buffer and expected market sessions through observation/exit. Missing sessions or execution prints never become zero-price fills or a successful cash outcome. Completeness checks are conservative: even a late session gap can leave a test unresolved.
- **Monitoring:** only observations on/before the requested date contribute to signals or prices. Green/yellow/orange/red reflects configured time/loss boundaries and data quality; it is not a forecast of a cliff.
- **Greeks:** fitted to closing quotes, dated expiry futures and 6.5% fixed annual discounting using a European carry model. Delta is spot delta at fixed fitted carry; theta is a one-calendar-day model change. They are estimates, not exchange Greeks. Scenarios hold fitted carry fixed and expose spot, IV and remaining-time assumptions.

Bundled calendar exceptions are limited to these archive windows. Import the verified exchange calendar for other periods. Weekends are treated as closed by default; special-session rows that are supplied are used in the observed sequence. The current calendar schema does not assert completeness for every historical special session.

## Quarterly calibration discipline

A trading quarter's monthly reviews are the **preceding month's 15th**, then the **first** and **second** month’s 15th. Thus 2018 Q1 starts with the 15 December 2017 review, then 15 January and 15 February. Actual available as-of market prices can be earlier than a holiday/weekend cutoff.

Freeze a quarter profile before planning its monthly decisions. Apply it to each draft; a frozen plan under that profile must match the selection, entry, management and cost rules. Side, cash choice, dates and target levels remain per-plan decisions. The profile hash is linked into matching plans. Earlier local reveals are counted when the profile is frozen. Prior exposure outside this browser cannot be detected automatically.

Strict mode requires entry window and last planned exit in one quarter. The 75-day macro forecast can extend further. This avoids overlapping trading outcomes across quarters, but overlapping forecast windows are still dependent. Revisions/alternative contracts inside a quarter are also correlated. The quarter summary uses each plan's latest full replay and only a matching quarter-profile hash. It reports completed trades and median observed return, not a forecast win probability or a combined portfolio return.

Before treating new quarters as holdouts, record verified forecast generation/publication dates, lock rule versions, and establish that the evaluator has not already seen the outcomes. All supplied studies stay in the development cohort.

## Import format

The UI accepts documented JSON packs under 2 MB each. All packs sent in an API request must fit under 3 MB in total; this first version is for small research batches. Larger multi-year datasets belong in a future server database/data-provider adapter. Up to 20 packs, 300 market sessions and 1,200 macro dates per pack are supported.

```json
{
  "name": "2018-Q1 verified dataset",
  "source": "Provider, retrieval date, price definitions, volume/OI units and dated lot-size source",
  "macroVersion": "C1-37.9.14-retrospective",
  "macro": [],
  "days": [],
  "closed": []
}
```

Populate macro rows as `["YYYY-MM-DD", pressure, expansion, volatility]`. Each market day has this structure (field names only; replace with real observations):

```ts
type MarketDay = {
  date: string;
  spot: number;
  open?: number;
  high?: number;
  low?: number;
  vix?: number;
  futures: Record<string, number>; // expiry ISO date -> observed future close
  quotes: {
    expiry: string;
    strike: number;
    type: 'CE' | 'PE';
    open: number;
    close: number;
    volume: number;
    oi: number;
    lot: number; // actual contract lot for this date
  }[];
};
```

`closed` lists verified exchange holiday dates. Empty packs, duplicate rows, negative/nonfinite values, invalid dates, mismatched model versions and conflicting overlap are rejected. Zero or absent price prints cannot be executed. Source fields are documentation supplied by the researcher; import validation is structural, not independent verification of a provider.

A frozen plan hashes the loaded market inputs on/before its cutoff, the full 75-day macro view and the imported calendar through its exit +7 days. Adding or changing those as-of inputs invalidates that plan's replay; restore the original dataset or create a separately labelled revision. New future market observations can be added without rewriting the original plan. Keep old backups when importing older history.

## Source map

- `app/page.tsx`, `app/globals.css`: the numerical decision desk and bought-option monitor.
- `app/research/page.tsx`: preserved plans, tests and data workspace, with numerical tables.
- `lib/desk.ts`: explicitly labelled exploratory path, date and comparison rules, price scenarios and position action cues.
- `app/api/research/route.ts`: cutoff-filtered data, import validation, freeze verification, monitoring and replay API.
- `lib/research.ts`: deterministic pricing, entry selection, P&L and transition audit.
- `lib/catalog.ts`: server-only archive loader, input merging and provenance hashes.
- `lib/browser.ts`: IndexedDB storage, backups and exports.
- `data/archive.json`, `data/studies.json`: the existing project evidence in a normalized form.
- `tests/research.test.ts`: real archived outcome fixtures, lookahead checks, missing-data and fill edge cases.
- `scripts/smoke.mjs`: production HTTP checks.
- `scripts/prepare-archive.py`: reproducible normalization utility for the original research folders; not needed to build or deploy the bundled app.

## Validation for this handoff

Unit tests, TypeScript checks, a production Next.js build and production HTTP smoke checks passed. Browser visual / interaction automation could not be completed because the environment's browser download returned an invalid archive. Responsive styling is included, but final visual and in-browser storage checks should be made on the Vercel preview as we use the workbench. No live Vercel deployment or GitHub repository has been created by this source package.

## v0.4.0 — Macro & snapshots

The first view connects to `https://fin-lumen-new.vercel.app/api/macro?date=YYYY-MM-DD`, the existing 37.9.14-family service. It requires the requested date, numeric scores and Swiss Ephemeris/sidereal/Lahiri metadata; errors never fall back to the historical archive. Scores may be cached for one hour. Today's IST macro loads on opening; another date or a full 75-calendar-day table loads on demand in batches of five. The source deployment may evolve independently; this is a connected service, not a byte-pinned historical engine. Old tests retain their separate archived inputs.

Option prices use an **NSE CSV snapshot import, not automatic fetching**. Open the linked NSE option chain, choose NIFTY and one expiry, download CSV, enter its displayed IST date/time and expiry, optionally enter the displayed Nifty spot, then import. The CSV parser reads the calls/puts LTP, Bid and Ask fields around Strike, handles quoted thousands, rejects ambiguous duplicate contracts, and preserves missing quotes. It does not import IV/PCR as visible signals. Time, expiry and symbol are user-supplied labels, not independently verified by the CSV. Last-traded prices may precede the snapshot. A positive non-crossed bid can be explicitly copied as an observation to matching bought positions. No trade is sent and no quote is a guaranteed fill.

The snapshot stays in page memory until reload; copied monitoring marks persist in the existing workspace and its backup. Snapshot quotes and connected macro readings are never silently merged into historical replays. No Upstox account, token, scraper or streaming connection is required. This version does **not** implement automatic NSE snapshots or historical option-price retrieval.

## v0.5.0 — Baseline macro notebook

The landing page is now a narrow, table-first macro notebook: latest retrievable **published Nifty close**, today/start-date P/E/V, 75 daily macro readings, monthly start/end/max summaries, key score dates, full expandable data, browser-local notes and JSON export. There are no options-data subscriptions, broker connections or new trade recommendations. The earlier options workspace remains at `/options`, and research at `/research`.

`/api/nifty` reads the explicit public NSE daily index CSV reports for the last seven calendar dates and selects the latest successfully verified Nifty 50 report. This is a dated end-of-day reference, not a live quote. If a newer file is absent or inaccessible the page does not claim it was a holiday; the response reports unavailable newer reports. Failure is explicit. Nifty and macro start dates are separate; a historical macro request does not turn the current Nifty reference into a historical price. `/api/macro` continues to serve up to five dated readings per request, usable by a future connector; the notebook assembles 75 days. It shows progress and labels partial tables until complete. Monthly summaries are arithmetic score descriptions with no calibrated direction/target claim. Notes use a separate browser key and can be exported with the reading.

### Vercel deployment

Upload the contents of this source folder to the root of the existing `Megeco/Astro-Greeks` repository. Keep Vercel connected to that repository, framework Next.js, repository root, default output setting, and `npm run build`. No new environment variables, paid feeds or broker tokens are required. This package was prepared locally; GitHub's integration rejected the attempted repository write with403, so production deployment requires a repository upload by its owner or restored integration write access. It has not been deployed by this assistant.
