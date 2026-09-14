# KTUL reference study

Open ktul_2026_operating_hours_report.html for charts or the Markdown report for methods. All CSVs use explicit units in headings/manifest and retain missing weather. Source payload is in ktul_2026_hourly_raw.csv.

From the application folder: `node scripts/reference-study.mjs [snapshot.json] [output-directory]`. Refresh observed weather and the NOAA cross-check with `node scripts/fetch-observed.mjs [start-date] [end-date]`. NOAA secondary evidence is under data/reference with its own URL/checksum.
