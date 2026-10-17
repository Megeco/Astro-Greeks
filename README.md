# Fin-Lumen Research Workbench

A purchase-only Nifty options research app, built with **Next.js, React and TypeScript** for a **GitHub → Vercel** workflow. No database, broker connection, API key or Cloudflare service is required.

## Deploy from GitHub to Vercel

1. Create a new **private GitHub repository**, for example `fin-lumen-workbench`.
2. Extract the source ZIP and upload the **contents of the project folder** to the repository. `package.json`, `app/`, `lib/` and `data/` belong at the repository root. Include the small dotfiles and `.github/workflows/check.yml` if using a local Git push. Do not upload `node_modules` or `.next`.
3. In Vercel, choose **Add New → Project**, import this GitHub repository and select **Next.js**.
4. Use **Node.js 24.x**, install command `npm ci`, build command `npm run build`, and the default output directory. No environment variables are needed. Deploy.
5. Configure **Deployment Protection** if this is a private research workspace. Private source code does not make a deployment URL private. Protection availability and production coverage depend on your Vercel plan/settings.

If you uploaded the project inside a parent folder, set Vercel's Root Directory to that folder. Subsequent GitHub pushes can deploy through Vercel's Git integration.

Official setup references: [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github), [Vercel deployment protection](https://vercel.com/docs/deployment-protection), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation).

## Run locally

Use Node 24 (`.nvmrc` is included).

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`.

For a production check:

```sh
npm test
npm run typecheck
npm run build
npm run test:smoke
npm start
```

The smoke script starts and stops its own production server on port 3011. Set `SMOKE_PORT` to use another port. GitHub Actions runs the unit tests, type check, build and smoke check.

## What you can use now

| Workspace | Behaviour |
| --- | --- |
| Macro path | 75 consecutive calendar days of daily pressure, expansion and volatility scores; raw daily table; trailing Nifty chart limited to the cutoff; written path and transition dates |
| Options lab | Actual archived calls and puts available at the latest loaded session at/before the cutoff; expiry and liquidity filters; dated lots; fitted IV, delta and daily theta; cash-outlay and exposure comparisons; spot/IV/time scenario repricing |
| Plan vault | Purchase or explicit cash decision; dated entry window; contract-selection rule; opening price cap; costs; time exit, profit/loss signals and optional follow-through deadline; SHA-256 freeze; revisions preserve the original |
| Monitoring | Manual historical observation date; status strip, holding timer and premium ledger; no later prices used for decisions |
| Replay & studies | Frozen-plan replay, actual price-print P&L, missing-data and no-fill outcomes, exploratory ±3-session transition audit; six preserved original studies; CSV export |
| Quarterly tests | Chronological queue from 2018 Q1 to 2026 Q3; three monthly review dates per quarter; frozen quarter rule profiles; matching-profile results; trading outcomes confined to the quarter when strict mode is selected |
| Data & notebook | JSON dataset import, conflict checks, backup/restore, source fingerprints, research notes and UX issue log |

There is no automated macro-to-trade recommendation, target-price predictor or calibrated probability engine in this release. The researcher writes the path; the app compares contracts and tests explicit rules. This is the workflow envelope in which we can develop those rules without pretending they have already been established.

## A first verification run

The app opens at **15 July 2024**, a period already discussed in our development research.

1. Read the daily macro path and explore the available put/call snapshots.
2. In Plan vault, the prefilled development example is the **26 September 2024 25,500 PE**, scheduled entry **1 August**, fixed exit **20 August**, one lot, 5% opening cap, 1% adverse slippage per side and ₹100 total reserve.
3. Freeze it, then reveal the replay. Expected net P&L: **₹2,533.8875** on entry cash **₹16,261.2625**.
4. Create a revised draft with monitored exits (+50% / −40%). Freeze that separate variant and reveal. The 5 August close triggers a 6 August opening exit: net P&L **₹12,833.60**.
5. These are correlated, exposed development variants. Neither is a newly discovered blind success. Do not count them as two independent observations.

The July losing put case is also retained and tested. The framework must preserve failures, not reinterpret them into successes.

## Storage and access

Research records, imported packs, notes and reveal logs live in **this browser's IndexedDB**. They are not written to GitHub or a server database. A new browser/device/domain starts with an empty personal workspace. Clearing site data can erase it. Use **Export backup** and **Restore / merge** regularly.

A backup contains saved records and imported packs; an editable draft must be frozen before it becomes a saved plan. Restore merges records, rejecting conflicting identities. There is no account login, cross-device sync, background alert service or live order execution.

The bundled server archive stays out of the initial browser bundle, and responses are filtered by the requested cutoff. Freeze hashes make changes detectable; they do **not** provide a secure blind experiment or a cryptographically trusted audit trail. An owner with source access can inspect outcomes. Real untouched tests need controlled data access and verified forecast vintages.

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

- `app/page.tsx`, `app/globals.css`: responsive seven-screen workbench.
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
