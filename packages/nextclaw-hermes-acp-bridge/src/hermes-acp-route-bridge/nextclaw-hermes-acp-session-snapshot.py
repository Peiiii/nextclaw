from __future__ import annotations

import copy
from typing import Any


def clone_optional_collection(value: Any) -> Any:
    if isinstance(value, list):
        return list(value)
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, set):
        return set(value)
    return value


def copy_session_surface(source: Any, target: Any) -> None:
    if source is None:
        return
    target.enabled_toolsets = clone_optional_collection(
        getattr(source, "enabled_toolsets", None)
    ) or ["hermes-acp"]
    target.disabled_toolsets = clone_optional_collection(
        getattr(source, "disabled_toolsets", None)
    )
    target.tools = copy.deepcopy(getattr(source, "tools", None) or [])
    target.valid_tool_names = set(getattr(source, "valid_tool_names", set()) or set())
    # Request-scoped execution agents must rebuild Hermes's session prompt from
    # their own effective model/provider instead of inheriting the previous
    # agent's frozen prompt cache.
    target._cached_system_prompt = None


class HermesSessionAgentSnapshot:
    def __init__(
        self,
        *,
        session_id: str,
        cwd: str,
        model: str | None,
        provider: str | None,
        base_url: str | None,
        api_mode: str | None,
        source_agent: Any,
        execution_agent_factory: Any,
    ) -> None:
        self.session_id = session_id
        self.cwd = cwd
        self.model = model or ""
        self.provider = provider or ""
        self.base_url = base_url or ""
        self.api_mode = api_mode or ""
        self.compression_enabled = True
        self._session_db = None
        self._cached_system_prompt = None
        self._execution_agent_factory = execution_agent_factory
        copy_session_surface(source_agent, self)

    def _invalidate_system_prompt(self) -> None:
        return None

    def interrupt(self) -> None:
        return None

    def _compress_context(self, *args: Any, **kwargs: Any) -> Any:
        agent = self._execution_agent_factory()
        compress = getattr(agent, "_compress_context", None)
        if not callable(compress):
            raise RuntimeError("Context compression is not available for this Hermes session.")
        original_session_db = getattr(agent, "_session_db", None)
        try:
            if hasattr(agent, "_session_db"):
                agent._session_db = None
            return compress(*args, **kwargs)
        finally:
            if hasattr(agent, "_session_db"):
                agent._session_db = original_session_db
