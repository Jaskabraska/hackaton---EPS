"""Rough Kč economics from the dataset's fuel prices.

The fuel price table is monthly per fuel type and region. We use it to price a
redispatch (extra thermal MWh). Conversion to Kč is an explicit, illustrative
constant - flagged as such so it is never mistaken for a settled market price.
"""
from __future__ import annotations

from functools import lru_cache

import pandas as pd

from .. import config

# Illustrative conversion from the dataset's fuel-price unit to Kč/MWh.
CZK_PER_PRICE_UNIT = 300.0
DEFAULT_FUEL = "Natural Gas R1"


@lru_cache(maxsize=1)
def _fuel_prices() -> dict[str, float]:
    """First-row (representative) price per fuel column; the table is flat over the year."""
    df = pd.read_csv(config.OTHER_DIR / "Fuel prices 2024.csv")
    first = df.iloc[0]
    return {col: float(first[col]) for col in df.columns if col != "Datetime"}


def fuel_price_czk_per_mwh(fuel: str = DEFAULT_FUEL) -> float:
    price_unit = _fuel_prices().get(fuel, 5.4)
    return round(price_unit * CZK_PER_PRICE_UNIT, 2)


def estimate_redispatch_cost(delta_mw: float, hours: float, fuel: str = DEFAULT_FUEL) -> dict:
    """Cost in Kč of dispatching `delta_mw` extra for `hours`, priced by fuel."""
    mwh = abs(delta_mw) * hours
    price = fuel_price_czk_per_mwh(fuel)
    cost = round(mwh * price, 2)
    return {
        "delta_mw": delta_mw,
        "hours": hours,
        "fuel": fuel,
        "price_czk_per_mwh": price,
        "intervention_cost_czk": cost,
        "note": "Illustrative: fuel-price unit x CZK_PER_PRICE_UNIT. Not a settled market price.",
    }
