#!/usr/bin/env python3
"""Build ideal-gas fixtures from published tables, without application imports.

Saturation inputs are manually transcribed reference data. Decimal arithmetic is
used only to derive W from those inputs; printed precision is not source accuracy.
"""

import json
from decimal import Decimal, localcontext
from pathlib import Path


SOURCES = {
    "ashrae-table-3": {
        "title": "ASHRAE Fundamentals 2025, SI chapter 1, Table 3",
        "url": "https://handbook.ashrae.org/Handbooks/F25/SI/F25_Ch01/F25_Ch01_si.aspx",
        "note": "Published LibHuAirProp/IAPWS saturation pressures; kPa converted to Pa. The 0 C row is liquid water.",
    },
    "murphy-koop-table-c1": {
        "title": "Murphy and Koop (2005), Appendix C, Table C1, p.1561",
        "url": "https://doi.org/10.1256/qj.04.94",
        "pdfUrl": "https://www.patarnott.com/atms360/pdf_atms360/class2017/VaporPressureIce_SupercooledH20_Murphy.pdf",
        "note": "Published check values for computer codes; Kelvin converted to Celsius.",
    },
    "iapws-triple-point": {
        "title": "IAPWS R14-08(2011), section 4",
        "url": "https://www.iapws.org/relguide/MeltSub.html",
        "note": "Normal triple point: 273.16 K and 611.657 Pa.",
    },
}

# id, degrees Celsius, phase, saturation pressure Pa, primary source
TABLE_ROWS = [
    ("ashrae-ice-minus20", "-20", "ice", "103.24", "ashrae-table-3"),
    ("ashrae-ice-minus10", "-10", "ice", "259.87", "ashrae-table-3"),
    ("mk-ice-zero", "0", "ice", "611.154", "murphy-koop-table-c1"),
    ("mk-water-zero", "0", "water", "611.213", "murphy-koop-table-c1"),
    ("iapws-ice-triple", "0.01", "ice", "611.657", "iapws-triple-point"),
    ("iapws-water-triple", "0.01", "water", "611.657", "iapws-triple-point"),
    ("ashrae-water20", "20", "water", "2339.2", "ashrae-table-3"),
    ("ashrae-water40", "40", "water", "7384.4", "ashrae-table-3"),
    ("mk-water-minus33_15", "-33.15", "water", "37.667", "murphy-koop-table-c1"),
    ("mk-ice-minus33_15", "-33.15", "ice", "27.272", "murphy-koop-table-c1"),
]


def build():
    saturation = [
        {
            "id": key,
            "temperatureC": float(temperature),
            "phase": phase,
            "expectedPa": float(pressure),
            "relativeTolerance": 0.001,
            "absoluteTolerancePa": 0.002,
            "sourceId": source,
        }
        for key, temperature, phase, pressure, source in TABLE_ROWS
    ]
    humidity_ratio = []
    with localcontext() as ctx:
        ctx.prec = 50
        for key, temperature, phase, saturation_pressure, source in TABLE_ROWS[:8]:
            for total_pressure in (70000, 84000, 101325):
                for rh in ("0.5", "1"):
                    vapor_pressure = Decimal(saturation_pressure) * Decimal(rh)
                    ratio = Decimal("0.621945") * vapor_pressure / (
                        Decimal(total_pressure) - vapor_pressure
                    )
                    humidity_ratio.append({
                        "id": f"{key}-rh{rh}-p{total_pressure}",
                        "temperatureC": float(temperature),
                        "phase": phase,
                        "relativeHumidity": float(rh),
                        "pressurePa": total_pressure,
                        "referenceSaturationPressurePa": float(saturation_pressure),
                        "referenceVaporPressurePa": float(vapor_pressure),
                        "expectedHumidityRatio": float(ratio),
                        "relativeTolerance": 0.001,
                        "absoluteTolerance": 1e-9,
                        "sourceId": source,
                        "saturationReferenceId": key,
                    })
    return {
        "schemaVersion": 1,
        "checkedOn": "2026-09-22",
        "sources": SOURCES,
        "derivation": {
            "humidityRatio": "W = 0.621945 * e / (P - e); e = RH * published saturation pressure",
            "method": "Python Decimal, precision 50, using transcribed published pressure constants; no application or PsychroLib import",
            "units": {"temperature": "C", "pressure": "Pa", "relativeHumidity": "fraction", "humidityRatio": "kg_water/kg_dry_air"},
            "tolerance": "0.1% relative allows rounded tables and distinct physical correlations. Use max(absoluteTolerance, relativeTolerance*abs(expected)). Additional printed digits in derived W are not measurement accuracy.",
            "limitations": "Pure-phase saturation plus ideal-gas moisture conversion; no humid-air enhancement factor. Each phase is explicit. Values derived from a publication are distinguished from values directly published.",
        },
        "saturation": saturation,
        "humidityRatio": humidity_ratio,
    }


if __name__ == "__main__":
    output = Path(__file__).resolve().parents[1] / "test/fixtures/psychrometric-reference.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build(), indent=2) + "\n")
    print(f"Wrote {output}")
