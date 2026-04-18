"""NextClaw bridge for Hermes ACP RuntimeRoute passthrough.

This module is auto-imported by Python when PYTHONPATH points at this
directory. It patches Hermes ACP so `hermes acp` consumes the active
NextClaw RuntimeRoute instead of resolving its own provider config first.
"""

from __future__ import annotations

import importlib.util
import logging
from pathlib import Path
from typing import Any, Dict

LOGGER = logging.getLogger("nextclaw.hermes_acp_route_bridge")
ROUTE_ENABLE_ENV = "NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE"
CREATE_EXECUTION_AGENT = None

_ROUTE_HELPER_SPEC = importlib.util.spec_from_file_location(
    "nextclaw_hermes_acp_runtime_route",
    Path(__file__).with_name("nextclaw-hermes-acp-runtime-route.py"),
)
if _ROUTE_HELPER_SPEC is None or _ROUTE_HELPER_SPEC.loader is None:
    raise ImportError("Failed to load nextclaw Hermes ACP runtime route helper.")
_ROUTE_HELPER_MODULE = importlib.util.module_from_spec(_ROUTE_HELPER_SPEC)
_ROUTE_HELPER_SPEC.loader.exec_module(_ROUTE_HELPER_MODULE)
clear_session_routes = _ROUTE_HELPER_MODULE.clear_session_routes
pop_session_route = _ROUTE_HELPER_MODULE.pop_session_route
read_nextclaw_prompt_route = _ROUTE_HELPER_MODULE.read_nextclaw_prompt_route
read_nextclaw_route = _ROUTE_HELPER_MODULE.read_nextclaw_route
read_text_env = _ROUTE_HELPER_MODULE.read_text_env
remember_session_route = _ROUTE_HELPER_MODULE.remember_session_route


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
        route = read_nextclaw_route()
        if route is not None:
            return "nextclaw"
        return original_detect_provider()

    def has_provider():
        return detect_provider() is not None

    auth_module.detect_provider = detect_provider
    auth_module.has_provider = has_provider


def _patch_session_manager() -> None:
    global CREATE_EXECUTION_AGENT
    try:
        from acp_adapter import session as session_module
    except Exception:
        LOGGER.debug("Failed to import acp_adapter.session", exc_info=True)
        return

    original_make_agent = session_module.SessionManager._make_agent

    def create_execution_agent(
        *,
        session_id: str,
        cwd: str,
        model: str | None,
        requested_provider: str | None,
        base_url: str | None,
        api_mode: str | None,
    ):
        route = read_nextclaw_route(
            session_id=session_id,
            explicit_model=model,
            explicit_base_url=base_url,
            explicit_api_mode=api_mode,
            explicit_provider=requested_provider,
        )
        if route is None:
            raise RuntimeError(
                "Missing NextClaw providerRoute for Hermes ACP request-scoped execution."
            )

        from run_agent import AIAgent

        kwargs = {
            "platform": "acp",
            "enabled_toolsets": ["hermes-acp"],
            "quiet_mode": True,
            "session_id": session_id,
            "model": route["model"] or "",
            "provider": route.get("provider") or requested_provider or "custom",
            "api_mode": route["api_mode"],
            "base_url": route["api_base"] or "",
            "api_key": route["api_key"],
        }

        session_module._register_task_cwd(session_id, cwd)
        agent = AIAgent(**kwargs)
        agent._print_fn = session_module._acp_stderr_print
        _merge_openai_headers(agent, route["headers"])
        _merge_anthropic_headers(agent, route["headers"])
        LOGGER.info(
            "Hermes ACP execution agent route resolved: session_id=%s model=%s provider=%s api_mode=%s base_url=%s",
            session_id,
            getattr(agent, "model", ""),
            getattr(agent, "provider", ""),
            getattr(agent, "api_mode", ""),
            getattr(agent, "base_url", ""),
        )
        return agent

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
        route = read_nextclaw_route(
            session_id=session_id,
            explicit_model=model,
            explicit_base_url=base_url,
            explicit_api_mode=api_mode,
            explicit_provider=requested_provider,
        )
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

        return create_execution_agent(
            session_id=session_id,
            cwd=cwd,
            model=(route or {}).get("model") or model,
            requested_provider=(route or {}).get("provider") or requested_provider,
            base_url=(route or {}).get("api_base") or base_url,
            api_mode=(route or {}).get("api_mode") or api_mode,
        )

    session_module.SessionManager._make_agent = bridged_make_agent

    original_remove_session = session_module.SessionManager.remove_session

    def bridged_remove_session(self, session_id: str) -> bool:
        pop_session_route(session_id)
        return original_remove_session(self, session_id)

    session_module.SessionManager.remove_session = bridged_remove_session

    original_cleanup = session_module.SessionManager.cleanup

    def bridged_cleanup(self) -> None:
        clear_session_routes()
        return original_cleanup(self)

    session_module.SessionManager.cleanup = bridged_cleanup
    CREATE_EXECUTION_AGENT = create_execution_agent


def _patch_prompt_execution() -> None:
    try:
        from acp_adapter import server as server_module
        from acp_adapter import session as session_module
    except Exception:
        LOGGER.debug("Failed to import Hermes ACP server/session modules", exc_info=True)
        return

    original_prompt = getattr(server_module.HermesACPAgent, "prompt", None)
    if not callable(original_prompt):
        return
    if getattr(original_prompt, "__nextclaw_request_scoped_agent_bridge__", False):
        return

    async def bridged_prompt(self, prompt, session_id: str, **kwargs):
        if not callable(CREATE_EXECUTION_AGENT):
            raise RuntimeError("NextClaw Hermes ACP request-scoped agent bridge is not ready.")
        state = self.session_manager.get_session(session_id)
        if state is None:
            return await original_prompt(self, prompt, session_id, **kwargs)

        prompt_route = read_nextclaw_prompt_route(kwargs)
        if prompt_route is not None:
            remember_session_route(session_id, prompt_route)
            if prompt_route.get("model"):
                state.model = prompt_route["model"]

            previous_agent = getattr(state, "agent", None)
            provider_hint = None
            base_url_hint = None
            api_mode_hint = None
            try:
                state.agent = CREATE_EXECUTION_AGENT(
                    session_id=session_id,
                    cwd=state.cwd,
                    model=state.model or getattr(previous_agent, "model", None),
                    requested_provider=provider_hint,
                    base_url=base_url_hint,
                    api_mode=api_mode_hint,
                )
                session_module._register_task_cwd(session_id, state.cwd)
            except Exception as exc:
                LOGGER.exception(
                    "Failed to create prompt-routed Hermes execution agent for session %s",
                    session_id,
                )
                raise RuntimeError(
                    "NextClaw Hermes ACP failed to create the prompt-routed execution agent."
                ) from exc

        return await original_prompt(self, prompt, session_id, **kwargs)

    bridged_prompt.__nextclaw_request_scoped_agent_bridge__ = True
    server_module.HermesACPAgent.prompt = bridged_prompt


def _patch_acp_reasoning_mapping() -> None:
    try:
        from run_agent import AIAgent
    except Exception:
        LOGGER.debug("Failed to import run_agent.AIAgent", exc_info=True)
        return

    original_run_conversation = getattr(AIAgent, "run_conversation", None)
    if not callable(original_run_conversation):
        return
    if getattr(original_run_conversation, "__nextclaw_reasoning_bridge__", False):
        return

    def bridged_run_conversation(self, *args, **kwargs):
        original_thinking = getattr(self, "thinking_callback", None)
        original_reasoning = getattr(self, "reasoning_callback", None)
        remapped = (
            getattr(self, "platform", None) == "acp"
            and callable(original_thinking)
            and original_reasoning is None
        )

        if remapped:
            # Hermes ACP currently wires its transient spinner/status callback
            # into ACP thought events. For ACP sessions, remap that callback to
            # the real reasoning channel so downstream clients receive model
            # reasoning instead of strings like "(⌐■_■) computing...".
            self.reasoning_callback = original_thinking
            self.thinking_callback = None

        try:
            return original_run_conversation(self, *args, **kwargs)
        finally:
            if remapped:
                self.thinking_callback = original_thinking
                self.reasoning_callback = original_reasoning

    bridged_run_conversation.__nextclaw_reasoning_bridge__ = True
    AIAgent.run_conversation = bridged_run_conversation


def _activate() -> None:
    if read_text_env(ROUTE_ENABLE_ENV) != "1":
        return
    _patch_acp_auth()
    _patch_session_manager()
    _patch_prompt_execution()
    _patch_acp_reasoning_mapping()


_activate()
