"""NextClaw bridge for Hermes ACP RuntimeRoute passthrough.

This module is auto-imported by Python when PYTHONPATH points at this
directory. It patches Hermes ACP so `hermes acp` consumes the active
NextClaw RuntimeRoute instead of resolving its own provider config first.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

LOGGER = logging.getLogger("nextclaw.hermes_acp_route_bridge")
ROUTE_ENABLE_ENV = "NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE"
API_MODE_HEADER = "x-nextclaw-narp-api-mode"


def _read_text_env(name: str) -> Optional[str]:
    value = os.environ.get(name)
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _read_headers_env() -> Dict[str, str]:
    raw = _read_text_env("NEXTCLAW_HEADERS_JSON")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        LOGGER.debug("Failed to parse NEXTCLAW_HEADERS_JSON", exc_info=True)
        return {}
    if not isinstance(parsed, dict):
        return {}
    normalized: Dict[str, str] = {}
    for key, value in parsed.items():
        if isinstance(key, str) and isinstance(value, str) and key.strip() and value.strip():
            normalized[key] = value
    return normalized


def _read_nextclaw_route(explicit_model: Optional[str] = None) -> Optional[Dict[str, Any]]:
    model = explicit_model or _read_text_env("NEXTCLAW_MODEL")
    api_base = _read_text_env("NEXTCLAW_API_BASE")
    api_key = _read_text_env("NEXTCLAW_API_KEY")
    headers = _read_headers_env()
    api_mode = headers.pop(API_MODE_HEADER, None) or "chat_completions"
    if not any([model, api_base, api_key, headers]):
        return None
    return {
      "model": model,
      "api_base": api_base,
      "api_key": api_key or "",
      "headers": headers,
      "api_mode": api_mode,
    }


def _merge_openai_headers(agent: Any, headers: Dict[str, str]) -> None:
    if not headers:
        return
    client_kwargs = getattr(agent, "_client_kwargs", None)
    if not isinstance(client_kwargs, dict):
        return
    merged = dict(client_kwargs.get("default_headers") or {})
    merged.update(headers)
    client_kwargs["default_headers"] = merged
    replace_client = getattr(agent, "_replace_primary_openai_client", None)
    if callable(replace_client):
        replace_client(reason="nextclaw_runtime_route_bridge")


def _merge_anthropic_headers(agent: Any, headers: Dict[str, str]) -> None:
    if not headers:
        return
    client = getattr(agent, "_anthropic_client", None)
    if client is None:
        return
    merged = dict(getattr(client, "_default_headers", {}) or {})
    merged.update(headers)
    if hasattr(client, "_default_headers"):
        client._default_headers = merged
    inner_client = getattr(client, "_client", None)
    if inner_client is not None:
        if hasattr(inner_client, "_default_headers"):
            inner_client._default_headers = merged
        transport_headers = getattr(inner_client, "headers", None)
        if hasattr(transport_headers, "update"):
            transport_headers.update(merged)


def _patch_acp_auth() -> None:
    try:
        from acp_adapter import auth as auth_module
    except Exception:
        LOGGER.debug("Failed to import acp_adapter.auth", exc_info=True)
        return

    original_detect_provider = auth_module.detect_provider

    def detect_provider():
        route = _read_nextclaw_route()
        if route is not None:
            return "nextclaw"
        return original_detect_provider()

    def has_provider():
        return detect_provider() is not None

    auth_module.detect_provider = detect_provider
    auth_module.has_provider = has_provider


def _patch_session_manager() -> None:
    try:
        from acp_adapter import session as session_module
    except Exception:
        LOGGER.debug("Failed to import acp_adapter.session", exc_info=True)
        return

    original_make_agent = session_module.SessionManager._make_agent

    def bridged_make_agent(
        self,
        *,
        session_id: str,
        cwd: str,
        model: str | None = None,
        requested_provider: str | None = None,
        base_url: str | None = None,
        api_mode: str | None = None,
    ):
        route = _read_nextclaw_route(explicit_model=model)
        if route is None:
            return original_make_agent(
                self,
                session_id=session_id,
                cwd=cwd,
                model=model,
                requested_provider=requested_provider,
                base_url=base_url,
                api_mode=api_mode,
            )

        if self._agent_factory is not None:
            return self._agent_factory()

        from run_agent import AIAgent

        kwargs = {
            "platform": "acp",
            "enabled_toolsets": ["hermes-acp"],
            "quiet_mode": True,
            "session_id": session_id,
            "model": route["model"] or "",
            "provider": requested_provider or "custom",
            "api_mode": api_mode or route["api_mode"],
            "base_url": base_url or route["api_base"] or "",
            "api_key": route["api_key"],
        }

        session_module._register_task_cwd(session_id, cwd)
        agent = AIAgent(**kwargs)
        agent._print_fn = session_module._acp_stderr_print
        _merge_openai_headers(agent, route["headers"])
        _merge_anthropic_headers(agent, route["headers"])
        return agent

    session_module.SessionManager._make_agent = bridged_make_agent


def _activate() -> None:
    if _read_text_env(ROUTE_ENABLE_ENV) != "1":
        return
    _patch_acp_auth()
    _patch_session_manager()


_activate()

