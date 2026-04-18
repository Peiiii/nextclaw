from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

LOGGER = logging.getLogger("nextclaw.hermes_acp_route_bridge")
API_MODE_HEADER = "x-nextclaw-narp-api-mode"
NARP_PROMPT_META_KEY = "nextclaw_narp"
_SESSION_ROUTE_OVERRIDES: Dict[str, Dict[str, Any]] = {}


def read_text_env(name: str) -> Optional[str]:
    value = os.environ.get(name)
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _read_headers_env() -> Dict[str, str]:
    raw = read_text_env("NEXTCLAW_HEADERS_JSON")
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


def _normalize_route_headers(raw_headers: Any) -> Dict[str, str]:
    if not isinstance(raw_headers, dict):
        return {}
    normalized: Dict[str, str] = {}
    for key, value in raw_headers.items():
        if isinstance(key, str) and isinstance(value, str):
            trimmed_key = key.strip()
            trimmed_value = value.strip()
            if trimmed_key and trimmed_value:
                normalized[trimmed_key] = trimmed_value
    return normalized


def _normalize_route_payload(raw_route: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw_route, dict):
        return None
    model = raw_route.get("model")
    api_base = raw_route.get("apiBase")
    if api_base is None:
        api_base = raw_route.get("api_base")
    api_key = raw_route.get("apiKey")
    if api_key is None:
        api_key = raw_route.get("api_key")
    api_mode = raw_route.get("apiMode")
    if api_mode is None:
        api_mode = raw_route.get("api_mode")
    provider = raw_route.get("provider")
    headers = (
        _normalize_route_headers(raw_route.get("headers"))
        or _normalize_route_headers(raw_route.get("extraHeaders"))
        or _normalize_route_headers(raw_route.get("extra_headers"))
    )
    api_mode_from_headers = headers.pop(API_MODE_HEADER, None)

    normalized_model = model.strip() if isinstance(model, str) else None
    normalized_api_base = api_base.strip() if isinstance(api_base, str) else None
    normalized_api_key = api_key.strip() if isinstance(api_key, str) else None
    normalized_api_mode = api_mode.strip() if isinstance(api_mode, str) else None
    normalized_provider = provider.strip() if isinstance(provider, str) else None

    if not any(
        [
            normalized_model,
            normalized_api_base,
            normalized_api_key,
            headers,
            normalized_api_mode,
            normalized_provider,
        ]
    ):
        return None

    return {
        "model": normalized_model,
        "api_base": normalized_api_base,
        "api_key": normalized_api_key or "",
        "headers": headers,
        "api_mode": normalized_api_mode or api_mode_from_headers or "chat_completions",
        "provider": normalized_provider,
    }


def _merge_route_payloads(
    base_route: Optional[Dict[str, Any]],
    override_route: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if base_route is None:
        return dict(override_route) if override_route is not None else None
    if override_route is None:
        return dict(base_route)

    return {
        "model": override_route.get("model") or base_route.get("model"),
        "api_base": override_route.get("api_base") or base_route.get("api_base"),
        "api_key": override_route.get("api_key")
        if override_route.get("api_key") is not None
        else base_route.get("api_key"),
        "headers": dict(override_route.get("headers") or {}),
        "api_mode": override_route.get("api_mode") or base_route.get("api_mode"),
        "provider": override_route.get("provider") or base_route.get("provider"),
    }


def read_nextclaw_route(
    session_id: Optional[str] = None,
    explicit_model: Optional[str] = None,
    explicit_base_url: Optional[str] = None,
    explicit_api_mode: Optional[str] = None,
    explicit_provider: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    model = explicit_model or read_text_env("NEXTCLAW_MODEL")
    api_base = read_text_env("NEXTCLAW_API_BASE")
    api_key = read_text_env("NEXTCLAW_API_KEY")
    headers = _read_headers_env()
    api_mode = headers.pop(API_MODE_HEADER, None) or "chat_completions"
    route = _normalize_route_payload(
        {
            "model": model,
            "api_base": api_base,
            "api_key": api_key,
            "headers": headers,
            "api_mode": explicit_api_mode or api_mode,
            "provider": explicit_provider,
        }
    )
    if session_id:
        route = _merge_route_payloads(route, _SESSION_ROUTE_OVERRIDES.get(session_id))
    if route is None:
        return None
    if explicit_model:
        route["model"] = explicit_model
    if explicit_base_url:
        route["api_base"] = explicit_base_url
    if explicit_api_mode:
        route["api_mode"] = explicit_api_mode
    if explicit_provider:
        route["provider"] = explicit_provider
    return route


def read_nextclaw_prompt_route(kwargs: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    nextclaw_meta = kwargs.get(NARP_PROMPT_META_KEY)
    if not isinstance(nextclaw_meta, dict):
        meta = kwargs.get("_meta")
        if not isinstance(meta, dict):
            return None
        nextclaw_meta = meta.get(NARP_PROMPT_META_KEY)
        if not isinstance(nextclaw_meta, dict):
            return None
    return _normalize_route_payload(nextclaw_meta.get("providerRoute"))


def remember_session_route(session_id: str, route: Dict[str, Any]) -> None:
    _SESSION_ROUTE_OVERRIDES[session_id] = dict(route)


def read_session_route(session_id: str) -> Optional[Dict[str, Any]]:
    route = _SESSION_ROUTE_OVERRIDES.get(session_id)
    return dict(route) if route is not None else None


def pop_session_route(session_id: str) -> None:
    _SESSION_ROUTE_OVERRIDES.pop(session_id, None)


def clear_session_routes() -> None:
    _SESSION_ROUTE_OVERRIDES.clear()
