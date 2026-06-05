"""Pydantic models shared across the API. Frontend types mirror these."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel


class BranchLoading(BaseModel):
    branch_name: str
    from_bus: str
    to_bus: str
    loading_percent: float
    kind: Literal["line", "trafo"]


class BusVoltage(BaseModel):
    bus_name: str
    region: str
    vm_pu: float
    in_band: bool


class RegionBalance(BaseModel):
    region: str
    load_mw: float
    gen_mw: float
    balance_mw: float


class BindingConstraint(BaseModel):
    element: str
    kind: Literal["line", "trafo"]
    loading_percent: float


class GridState(BaseModel):
    datetime: str
    total_load_mw: float
    total_gen_mw: float
    n_buses: int
    n_branches: int
    binding_constraint: Optional[BindingConstraint]
    worst_voltage: Optional[BusVoltage]
    regions: list[RegionBalance]
    overloaded: list[BranchLoading]
    voltage_violations: list[BusVoltage]


class ContingencyResult(BaseModel):
    datetime: str
    tripped_element: str
    converged: bool
    n1_secure: bool
    new_overloads: list[BranchLoading]
    worst_loading_percent: float


class Alert(BaseModel):
    id: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    element: str
    category: str
    title: str
    what: str
    action: str
    impact_risk: str
    financial: Optional[dict[str, Any]] = None
    predictive_basis: Optional[dict[str, Any]] = None


class ChatRequest(BaseModel):
    message: str
    datetime: Optional[str] = None
    history: list[dict[str, Any]] = []


class ProposedAction(BaseModel):
    kind: str
    element: Optional[str] = None
    datetime: Optional[str] = None
    description: str


class ChatResponse(BaseModel):
    status: Literal["answered", "awaiting_approval"]
    reply: str
    proposed_action: Optional[ProposedAction] = None
    tool_trace: list[dict[str, Any]] = []


class RiskVerdict(BaseModel):
    datetime: str
    element: str
    verdict: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    n1_secure: bool
    rationale: str
    estimated_cost_czk: Optional[float] = None
    evidence: dict[str, Any] = {}


class ShiftSummary(BaseModel):
    window_start: str
    window_end: str
    alert_count: int
    summary: str
    events: list[dict[str, Any]] = []
