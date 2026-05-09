export { createUiNcpAgent } from "./features/runtime/create-ui-ncp-agent.service.js";
export type {
  CreateUiNcpAgentParams,
  UiNcpAgentHandle,
} from "./features/runtime/create-ui-ncp-agent.service.js";
export {
  dispatchPromptOverNcp,
  runGatewayInboundLoop,
} from "./features/runtime/nextclaw-ncp-dispatch.js";
