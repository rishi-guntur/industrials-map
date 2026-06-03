# Industrials Sector Map

Interactive equity-universe map of the global industrials sector, built for an
investment-banking workflow. Verticals are rendered as bubbles sized by
aggregate market capitalization; click any bubble to drill into:

- **Comparables** — sortable company table with market cap, P/E (color-coded vs.
  the sector weighted average), and % of sector
- **Valuation** — market-cap-weighted and median P/E per vertical
- **Sub-Segments** — capitalization breakdown by classification
- **Geography** — HQ footprint by country

Data source: `Industrials.xlsx` (104 companies across 9 verticals).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
```

## Deploy (GitHub Pages)

This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that
builds and publishes automatically. See the deploy steps below.
