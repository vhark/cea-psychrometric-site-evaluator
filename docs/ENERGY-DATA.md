# Energy catalog: evidence and limits

Purpose: state exactly what the ZIP, utility, price and grid catalogs contain, when each was retrieved, what it cannot be used for, and how to rebuild it.

Status: catalogs retrieved 2026-09-11; documentation reconciled 2026-09-15. Utility mapping is vintage 2021 and eGRID is vintage 2023; neither refreshes automatically. Audit item 6's tracking mechanism shipped, but that did not refresh the underlying data. Run `node scripts/check-vintages.mjs` for the committed vintages against their budgets; see [Vintage and refresh](#vintage-and-refresh).

Read this if: you are quoting a price, an emissions factor or a service territory from this tool, or rebuilding the catalogs.

## Retained snapshot

The checked-in derived acquisition is dated **2026-09-11**. Retrieval date is distinct from mapping year, price period and grid generation year. `data/energy/manifest.json` retains publishers, URLs, licenses, source hashes, available Last-Modified headers and acquisition timestamps. The original GeoNames archives, OpenEI CSVs and EIA/EPA workbooks are not in the public repository: the rebuild downloads them into gitignored `data/energy/raw/`, with a local `acquisition.json` recording their bytes and hashes.

The static application downloads only the compact JSON artifacts, not the raw workbooks. The five data artifacts total **4,300,825 bytes**; the separate small provenance manifest is additional. Original downloads total **37,031,620 bytes**. No account, credential, shared secret or API key is required to build or use this catalog.

## Actual coverage

| Measure | Count |
| --- | ---: |
| Searchable source ZIP strings, union | 42,185 |
| Distinct GeoNames inventory ZIPs, including US/PR/VI/GU/AS/MP | 41,706 |
| Mapping-only ZIP strings, not evidence of active postal validity | 479 |
| ZIPs with approximate coordinates | 41,706 |
| ZIPs with one or more 2021 utility candidates | 39,146 |
| ZIPs with multiple utility candidates | 27,037 |
| ZIPs with unknown utility mapping | 3,039 |
| Distinct ZIP/candidate associations after exact deduplication | 79,873 |
| Utility/state/service/name candidate records | 1,399 |
| Distinct EIA utility identifiers in candidates | 1,197 |
| ZIPs with state-sector price history | 41,272 |
| Monthly price observations across three sectors | 30,729 |
| Price geographies | 52 |
| ZIPs with one or more EPA subregion candidates | 41,588 |
| ZIPs with multiple EPA subregions | 2,955 |
| State grid generation records, including DC and PR | 52 |
| eGRID subregion records | 27 |
| Full utility tariff schedules | Not ingested; coverage unknown |

These are catalog counts, not a claim of exhaustive current US service coverage. The 50 states and DC have January 2010 through June 2026 prices for commercial, industrial and residential sectors, 198 monthly periods each. Puerto Rico has June 2014 through June 2026, 145 periods each. The exact periods and coverage are generated from source rows, not invented ranges. Later prices retain EIA's `Preliminary` status; older rows retain their source status. `coverage.json` exposes each state/sector's first period, last period and actual observation count.

## Postal inventory and utility identity

### GeoNames

Source: [GeoNames postal-code downloads](https://download.geonames.org/export/zip/), including `US.zip`, `PR.zip`, `VI.zip`, `GU.zip`, `AS.zip` and `MP.zip`. Attribution: GeoNames, CC BY 4.0 as declared in the retained archive README. The README's embedded Creative Commons link points to an older license version; retain that source notice rather than silently rewriting it.

This is **not a USPS-authoritative all-active-ZIP list**. GeoNames disclaims accuracy, timeliness and completeness. Coordinates can be estimated. The source coordinate-accuracy field is retained, including null when absent, rather than represented as street or rooftop accuracy. Each ZIP is a five-character string and leading zeros are preserved. Distinct place names for the same ZIP are retained together; the first source coordinate is used as a coarse representative, not averaged into a fictional location. Territory administration codes are not US state abbreviations, so PR/VI/GU/AS/MP are explicitly carried as jurisdiction codes.

Military, PO-box, unique or institutional ZIP completeness is not established. FM/MH/PW, freely associated states rather than US territories, are not separately acquired. Source mapping rows can still refer to ZIPs outside the acquired GeoNames inventory, and those strings are preserved as `mapping-only`, with no invented coordinates or city. The EPA workbook contains low-numbered ZIP-like values such as `00001`; retaining source evidence does not make these active postal codes. A stronger authoritative inventory requires [USPS City State Product](https://postalpro.usps.com/address-quality/city-state-product) access and redistribution rights.

### Utility candidates

Source: [OpenEI submission 5806](https://data.openei.org/submissions/5806), **U.S. Electric Utility Companies and Rates: Look-up by Zipcode (2021)**, published by NREL, CC BY 4.0. Both `iou_zipcodes_2021.csv` and `non_iou_zipcodes_2021.csv` are unioned. The source combines EIA-861 and ABB Velocity Suite material; the public CSV's license is not a separate grant to underlying ABB territorial products.

A candidate preserves EIA ID, source utility name, association state, service type, ownership, mapping year and provenance. Deduplication is exact across those fields. All many-to-many associations remain. Utility ID alone does not erase service-type or state distinctions. The source files contain 80,234 rows; exact duplicate associations reduce the catalog to 79,873. No nearest-utility, fuzzy-name, single-first-provider or assumed exclusive-territory assignment is made. Unknown mapping never means no service.

The source's utility rate columns are deliberately **not used** for pricing: their 2021 averages are not current tariffs and zero sector values are not evidence of free electricity. Neither the frozen-2012 utility-rates-v3 API nor any other stale endpoint is treated as current.

EIA-861 final 2024 utility and county service files were researched but are not joined into this ZIP table. A county distribution-equipment record does not verify every ZIP or premise in that county. The implemented 2021 public ZIP mapping remains explicitly dated rather than presented as a current county-to-ZIP territorial reconstruction.

## Historical electricity prices

Source: [EIA-861M monthly sales and revenue workbook](https://www.eia.gov/electricity/data/eia861m/xls/sales_revenue.xlsx), `Monthly-States` and `Monthly-Ter` sheets. EIA data are [public domain](https://www.eia.gov/about/copyrights_reuse.php). The retained file includes June 2026 data and was last modified August 26, 2026 according to the acquisition response.

The ingestor detects sector headers and checks `Price` / `Cents/kWh` units. It takes EIA's published state-sector prices and divides by 100 to obtain USD/kWh. It does not unweightedly average utility rates or sum confidential/sample utility records. Rows with missing/nonpositive sector price or sales are not converted into free energy. Original revenue, sales and statuses remain inspectable in the retained workbook. EIA's monthly data include sampling, imputation and adjustments; `Final` does not mean a facility-specific billed price.

**Basis: state-sector realized average retail price proxy**, not a selected candidate utility tariff, marginal price, current quote, or exact electric bill. Sector is an explicit assumption. Do not add arbitrary demand charges to this aggregate and call it an actual tariff simulation.

`getEnergyContext` returns matching-sector period rows with period, USD/kWh, source, state geography, sector and preliminary/final status. Requested dates bound the retrieved history with one adjacent month on each side, because UTC weather interval boundaries may fall in a different local billing month. `applyEnergyContext` selects the actual local calendar month using `scenario.timezone`. An annual row is accepted only if explicitly present under that exact year. No latest-price, nearest-period, or future-rate fallback exists.

Manual price mode is a deliberate scenario override and survives energy application. Otherwise each hour's cost is recalculated as:

`electricKWh × periodPrice + fuelKWh × scenario.fuelPrice + waterL × scenario.waterPrice`

The original simulation's already-computed electric cost is not added again. Fuel and water prices remain the original scenario inputs. Maintenance and capex remain separate from the observed-period cost. All valid hours, including warmup energy, contribute to run totals consistently with the simulation; comparative common-eligible-hour economics are handled by the metrics module.

Missing price makes hourly `cost` null, not zero. `knownCost` includes only available electricity cost plus known fuel and water costs. Summary `priceMissingHours`, `pricedElectricKWh`, `unpricedElectricKWh`, and `costCoverage` expose missingness. Total `cost` is null if any valid hour lacks a price; a covered subset is not silently presented as the full cost. Summary and daily/monthly rows carry these fields. `effectiveElectricityPrice` is consumption-weighted over priced electricity only and is null when no priced electricity was consumed, not an unweighted historic average. No partial period is annualized.

### Tariffs remain separate

[OpenEI URDB](https://openei.org/wiki/Utility_Rate_Database) and its [no-key bulk JSON download](https://openei.org/apps/USURDB/download/usurdb.json.gz) are separately described in source metadata. Full schedules are **not ingested or evaluated**. ZIP/provider/date tariff availability is unknown, not zero schedules and not a claim of no service. External URDB records require rate eligibility, effective dates, energy tiers, demand windows, riders and fixed/minimum charges to model a real bill. An absent end date would not establish current validity. No candidate provider is assigned a verified tariff here.

## Annual grid mix and CO2

Sources: [EPA eGRID2023 rev2 workbook](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx) and [Power Profiler ZIP tool v14.2](https://www.epa.gov/system/files/documents/2025-06/power_profiler_zipcode_tool_v14.2.xlsx), US public-domain data. [EPA methodology and reuse FAQ](https://www.epa.gov/egrid/frequent-questions-about-egrid).

The dataset year is **2023**, not the 2025 publication or 2026 retrieval year. `ST23` and `SRL23` provide state and subregion records. Resource-mix fields are numeric fractions in the workbook despite their percent labels; the ingestor multiplies by 100, returning `mix: [{fuel, percent}]` in percent units. Source rounding is retained; shares are not artificially normalized to force exactly 100%. Eleven primary fuel categories are used. Aggregate renewable/nonrenewable subtotal columns are excluded to avoid double counting.

`STCO2RTA` / `SRCO2RTA` are **annual CO2 total-output emission rates, lb/MWh**. The exact conversion is:

`kg CO2/kWh = lb CO2/MWh × 0.45359237 / 1000`

The catalog retains both original rate and converted `co2KgPerKWh`, generation MWh, year, geography, units, source and evidence kind. This is CO2, **not CO2e**, lifecycle carbon, hourly marginal emissions, utility procurement or a claim about contractual renewable supply. No grid-loss adjustment is applied. Source plant coverage does not mean all distributed rooftop generation is included.

All possible subregions from `Zip-subregion` are retained. The ZIP tool identifies embedded eGRID2023_rev1 rates; those embedded rates are not used, only its ZIP associations. The separate rev2 workbook supplies generation and emissions. A sole subregion association is a screening candidate, not verified service. If multiple subregions exist, no first-match region is chosen: the context shows the candidates and, where available, a distinctly labeled **state-generation proxy**. State production mix is not imported electricity consumption mix or utility procurement.

Hourly CO2 is calculated only when the hour's local calendar year equals the grid record's year. Other years keep the grid snapshot visible as context but hourly emissions remain null. `gridMissingHours`, `knownCo2Kg` and null total `co2Kg` make partial coverage explicit. No 2023 factor is silently reused for 2024, 2025 or 2026. Earlier eGRID histories and hourly EIA generation are not ingested.

## Reproducing and updating

Requires Python 3 and `openpyxl` 3.1 or later. A minimal isolated setup:

```sh
python3 -m venv /tmp/cea-psychrometric-site-evaluator-energy
/tmp/cea-psychrometric-site-evaluator-energy/bin/pip install openpyxl==3.1.5
/tmp/cea-psychrometric-site-evaluator-energy/bin/python scripts/build-energy.py
```

Run from the repository root. Cached source files are checked against their local acquisition SHA-256 before parsing, with no network requests when all are present. A fresh checkout downloads missing sources and records new provenance; it does not guarantee that mutable upstream bytes still equal the 2026-09-11 snapshot. Source column/unit drift and duplicate price periods fail ingestion instead of silently changing meanings.

To intentionally acquire new mutable upstream snapshots:

```sh
/tmp/cea-psychrometric-site-evaluator-energy/bin/python scripts/build-energy.py --refresh
```

This replaces acquisition timestamps and source checksums, then regenerates data and provenance. Mapping and grid filenames are pinned to their dated datasets; a newly published mapping/grid year needs an explicit URL/schema update rather than relabeling old observations. The manifest has parser/schema version `1.0` / `1` and checksums for generated artifacts. Update the written coverage figures above when adopting a different snapshot.

## Vintage and refresh

Every dataset here is a committed snapshot. **Nothing refreshes automatically**: no build step, no page load and no scheduled job re-downloads anything, so age accumulates silently until someone looks. `scripts/check-vintages.mjs` is what looks.

```sh
node scripts/check-vintages.mjs                 # aligned table; exit 1 if anything is stale
node scripts/check-vintages.mjs --json          # same assessment, machine readable
node scripts/check-vintages.mjs --check-remote  # also probe each recorded source URL (HEAD, 10 s each)
```

It reads only the committed manifests, writes nothing, and makes no network request unless `--check-remote` is given. Exit code is 0 when nothing is stale and 1 when at least one dataset is past its budget, so it can gate a workflow. `--check-remote` findings are informational and never change the exit code: an upstream file that moved is not evidence that the local snapshot went bad, and an unreachable host is reported as unknown rather than as a pass. `--now YYYY-MM-DD` assesses against a fixed UTC clock.

Age is whole months since the covered period ended, and a partial month never rounds up: a price series through 2026-06 is 2 months old on 2026-09-14 and 3 on 2026-09-30. Budgets are per dataset because the publishers differ; a monthly price series goes stale long before an annual grid vintage does. `aging` is a prompt, `stale` is a gate, and `unknown` is its own status: a dataset whose manifest carries no machine-readable date is never reported as current, and no date is ever inferred from a file timestamp, a clock, or a publication month written in prose.

| Dataset | Vintage read from | Aging / stale | Why that budget | Refresh |
| --- | --- | ---: | --- | --- |
| EIA-861M monthly prices | `data/energy/coverage.json` newest `lastPeriod` | 5 / 9 mo | EIA publishes each month about two months in arrears (the retained workbook, last modified 2026-08-26, ends at 2026-06), so three months of lag is normal, not a defect. At five months two releases are missing; at nine the newest priced month predates a full cooling season. | `build-energy.py --refresh` |
| OpenEI ZIP utility mapping | `manifest.json` `sources.oedi2021.vintage` | 30 / 48 mo | Association snapshot for calendar 2021, published 2022-11. Ownership changes and territory transfers accumulate slowly, so two to three years is still defensible under the "possible provider" caveat; past four years the candidate list cannot support naming a provider. | new mapping year URL in `build-energy.py`, then `--refresh` |
| eGRID generation mix and CO2 | `manifest.json` `sources.egrid2023.vintage` | 24 / 36 mo | eGRID is annual and lands about 18 months after its data year (eGRID2023 published 2025-06), so one missing data year is always expected. At 24 months a newer eGRID should exist; at 36 two do. | new eGRID year URL in `build-energy.py`, then `--refresh` |
| EPA Power Profiler ZIP subregions | `manifest.json` `sources.epaZip2023.published` | 24 / 36 mo | Subregion boundaries move only when EPA redraws them, so this follows the eGRID cadence. | new ZIP tool version in `build-energy.py`, then `--refresh` |
| GeoNames ZIP inventory | `manifest.json` newest `acquisition[].retrievedAt` for `geonames-*` | 12 / 18 mo | GeoNames rewrites its country files continuously, so this is a retrieval date, not a data year. A missing ZIP fails closed (lookup returns null), so a year is tolerable; beyond 18 months recently activated ZIPs are absent often enough to look like a bug. | `build-energy.py --refresh` |
| Bundled NASA POWER weather years | `data/weather/index.json` newest `sites[].years` | 15 / 24 mo | POWER hourly data lag real time by two to three months, so a completed year becomes fetchable around March. Fifteen months after a bundled year ends, a newer complete year exists and is not bundled. | `python3 scripts/fetch-weather.py <year>`, then add the year to `index.json` |
| NOAA Tulsa daily cross-check | `data/reference/noaa-provenance.json` `lastDate` | 6 / 12 mo | A year-to-date observation series checking the station snapshot beside it. Past twelve months it no longer overlaps the year anyone is running. | `node scripts/fetch-observed.mjs` |

The dated 2026-09-14 assessment found prices `2026-06` current, utility mapping `2021` stale, eGRID `2023` aging, Power Profiler ZIP vintage unknown, and GeoNames/weather/NOAA current under their declared budgets. Exit 1 reflected stale mapping, not a broken checker. The unknown ZIP-tool date is retained because prose is not machine-readable provenance. The same day's optional remote probe found the recorded URLs present and Last-Modified unchanged except the daily-rewritten GeoNames archives. These are historical observations, not current uptime or freshness guarantees. Adding a supported publication date or newer dataset requires an explicit manifest/source update, not relabeling old bytes.

Historical recosting through `applyEnergyContext` changes dollars and effective electricity price without rerunning dispatch or altering the already-computed states and loads. This is narrower than saying prices never affect physics: the simulator's dispatch objective uses the scenario's manual price inputs, so changing those and rerunning can change selected actions. The historical series does not retroactively optimize them. Grid emissions are emitted only for matching local calendar years, not by reusing the eGRID vintage everywhere. Stale utility mapping weakens a candidate list that was never a service guarantee; missing GeoNames ZIPs return null rather than invented coordinates.

`assessVintages(manifests, now)` in `src/vintages.js` is the shared, DOM-free assessment behind the script, so a surface that already holds `catalog.manifest` and `catalog.coverage` can report the same status without re-reading anything. Regression coverage is `test/vintages.test.mjs`.

## Static adapter contract

- `loadEnergyCatalog()` fetches compact inventory, candidates, price, grid, coverage and manifest JSON once; a failed load can be retried. `catalog.coverage` contains the exact coverage measures above, and `catalog.sources` contains provenance.
- `lookupZip(zip, catalog)` requires five digits, returns null when not found, and returns `utilities`, `mappingStatus`, `priceAvailability` and `gridAvailability` for every matched record. Mapping-only rows can have null city/state/coordinates. No numeric coercion discards leading zeros.
- `getEnergyContext(zipInfo, {sector, startDate, endDate}, catalog)` returns candidate providers, historical prices, optional grid, all grid candidates, coverage, warnings and sources. Choosing a possible utility does not convert the state-sector price proxy into that utility's tariff.
- `applyEnergyContext(result, context)` returns new result/hour/summary objects without mutating the reusable simulation or context. Price source, applied mode, timezone, fuel/water assumptions, complete source metadata and coverage survive in `result.energyContext` for export.

Acquisition manifests establish data provenance, not model validity. The dated runtime and integration checks, including current schema/cost behavior, are recorded in [VERIFICATION.md](VERIFICATION.md).
