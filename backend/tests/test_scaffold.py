"""Smoke tests for the scaffold."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["llm_mode"] in {"mock", "live"}


def test_glossary_is_single_source():
    from app import config

    assert config.GLOSSARY_PATH.exists()
    assert config.GLOSSARY_PATH.name == "glossary.json"
