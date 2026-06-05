"""LLM provider abstraction.

Real provider = the `openai` SDK pointed at Gemini's OpenAI-compatible endpoint
(or Groq/Ollama - only the env vars change). Mock provider = deterministic, so
the whole tool-calling loop is testable with no API key.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol

from .. import config


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    content: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw_assistant_message: dict[str, Any] | None = None


class Provider(Protocol):
    def chat(self, messages: list[dict[str, Any]], tools: list[dict] | None = None) -> LLMResponse: ...


class LLMProviderError(RuntimeError):
    """Raised when the configured LLM provider rejects or cannot complete a request."""


class RealProvider:
    """Wraps the OpenAI-compatible chat completions API."""

    def __init__(self) -> None:
        config.require_llm_ready()
        from openai import OpenAI

        self._client = OpenAI(base_url=config.LLM_BASE_URL, api_key=config.LLM_API_KEY)
        self._model = config.LLM_MODEL

    @staticmethod
    def _arguments(raw: str | None) -> dict[str, Any]:
        try:
            return json.loads(raw or "{}")
        except json.JSONDecodeError:
            return {}

    def chat(self, messages: list[dict[str, Any]], tools: list[dict] | None = None) -> LLMResponse:
        kwargs: dict[str, Any] = {"model": self._model, "messages": messages}
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        try:
            completion = self._client.chat.completions.create(**kwargs)
        except Exception as exc:
            raise LLMProviderError(f"LLM request failed for model '{self._model}': {exc}") from exc
        message = completion.choices[0].message
        tool_calls: list[ToolCall] = []
        raw_message: dict[str, Any] = {"role": "assistant"}
        if message.content is not None:
            raw_message["content"] = message.content
        if message.tool_calls:
            raw_message["tool_calls"] = []
            for index, tc in enumerate(message.tool_calls):
                call_id = tc.id or f"call_{index}"
                tool_calls.append(ToolCall(id=call_id, name=tc.function.name, arguments=self._arguments(tc.function.arguments)))
                raw_message["tool_calls"].append(
                    {
                        "id": call_id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "{}",
                        },
                    }
                )
        return LLMResponse(
            content=message.content,
            tool_calls=tool_calls,
            raw_assistant_message=raw_message,
        )


class MockProvider:
    """Deterministic provider for tests and key-less runs.

    Behaviour: if a tool result is already present in the conversation, return a
    final textual answer. Otherwise, if tools are offered, call the first useful
    one (preferring get_state) exactly once. This exercises the full loop.
    """

    FINAL_TEXT = "Mock summary: grid state retrieved via tool call; all numbers come from tools."

    def chat(self, messages: list[dict[str, Any]], tools: list[dict] | None = None) -> LLMResponse:
        has_tool_result = any(m.get("role") == "tool" for m in messages)
        if has_tool_result or not tools:
            return LLMResponse(content=self.FINAL_TEXT, raw_assistant_message={"role": "assistant", "content": self.FINAL_TEXT})

        names = [t["function"]["name"] for t in tools]
        chosen = "get_state" if "get_state" in names else names[0]
        call = ToolCall(id="mock-call-1", name=chosen, arguments={})
        raw = {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {"name": chosen, "arguments": "{}"},
                }
            ],
        }
        return LLMResponse(content=None, tool_calls=[call], raw_assistant_message=raw)


def get_provider() -> Provider:
    return MockProvider() if config.use_mock_llm() else RealProvider()
