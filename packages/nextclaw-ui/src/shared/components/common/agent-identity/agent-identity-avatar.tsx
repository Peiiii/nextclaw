import { AgentAvatar } from '@/shared/components/common/agent-avatar';
import { useAgentIdentity } from '@/shared/components/common/agent-identity/use-agent-identity';

type AgentIdentityAvatarProps = {
  agentId?: string | null;
  className?: string;
};

export function AgentIdentityAvatar({
  agentId,
  className,
}: AgentIdentityAvatarProps) {
  const identity = useAgentIdentity(agentId);

  if (!identity) {
    return null;
  }

  return (
    <AgentAvatar
      agentId={identity.agentId}
      displayName={identity.displayName}
      avatarUrl={identity.avatarUrl}
      className={className}
    />
  );
}
