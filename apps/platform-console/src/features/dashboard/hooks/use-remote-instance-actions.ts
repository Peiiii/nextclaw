import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveRemoteInstance,
  createRemoteShareGrant,
  deleteRemoteInstance,
  fetchRemoteShareGrants,
  openRemoteInstance,
  revokeRemoteShareGrant,
  unarchiveRemoteInstance
} from '@/api/client';
import { RemoteInstanceActionsManager } from '@/features/dashboard/managers/remote-instance-actions.manager';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function useRemoteInstanceActions(props: {
  token: string;
  t: Translate;
  onInstanceListChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const remoteShareGrantsQuery = useQuery({
    queryKey: ['remote-share-grants', selectedInstanceId],
    enabled: Boolean(selectedInstanceId),
    queryFn: async () => await fetchRemoteShareGrants(props.token, selectedInstanceId ?? '')
  });

  async function refreshInstanceList(): Promise<void> {
    props.onInstanceListChanged();
    await queryClient.invalidateQueries({ queryKey: ['remote-instances'] });
  }

  const openMutation = useMutation({
    mutationFn: async (params: { instanceId: string; entry: 'subdomain' | 'fixed_domain' }) =>
      await openRemoteInstance(props.token, params.instanceId),
    onSuccess: (session, variables) => {
      const targetUrl = variables.entry === 'fixed_domain'
        ? session.fixedDomainOpenUrl ?? session.openUrl
        : session.openUrl;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  });
  const createShareMutation = useMutation({
    mutationFn: async (instanceId: string) => await createRemoteShareGrant(props.token, instanceId),
    onSuccess: async (grant) => {
      setSelectedInstanceId(grant.instanceId);
      await queryClient.invalidateQueries({ queryKey: ['remote-share-grants', grant.instanceId] });
      try {
        await navigator.clipboard.writeText(grant.shareUrl);
        setFeedback(props.t('remote.messages.newShareCopied'));
      } catch {
        setFeedback(props.t('remote.messages.newShareCreated'));
      }
    }
  });
  const revokeShareMutation = useMutation({
    mutationFn: async (params: { grantId: string; instanceId: string }) =>
      await revokeRemoteShareGrant(props.token, params.grantId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['remote-share-grants', variables.instanceId] });
      setFeedback(props.t('remote.messages.shareRevoked'));
    }
  });
  const archiveMutation = useMutation({
    mutationFn: async (instanceId: string) => await archiveRemoteInstance(props.token, instanceId),
    onSuccess: async (instance) => {
      if (selectedInstanceId === instance.id) setSelectedInstanceId(null);
      await refreshInstanceList();
      setFeedback(props.t('remote.messages.archiveSuccess'));
    }
  });
  const restoreMutation = useMutation({
    mutationFn: async (instanceId: string) => await unarchiveRemoteInstance(props.token, instanceId),
    onSuccess: async () => {
      await refreshInstanceList();
      setFeedback(props.t('remote.messages.restoreSuccess'));
    }
  });
  const deleteMutation = useMutation({
    mutationFn: async (instanceId: string) => await deleteRemoteInstance(props.token, instanceId),
    onSuccess: async ({ instanceId }) => {
      if (selectedInstanceId === instanceId) setSelectedInstanceId(null);
      await refreshInstanceList();
      setFeedback(props.t('remote.messages.deleteSuccess'));
    }
  });
  const commands = new RemoteInstanceActionsManager({
    t: props.t,
    setFeedback,
    setSelectedInstanceId,
    archiveInstance: archiveMutation.mutate,
    deleteInstance: deleteMutation.mutate,
    restoreInstance: restoreMutation.mutate
  });

  return {
    commands,
    mutations: {
      archive: archiveMutation,
      createShare: createShareMutation,
      delete: deleteMutation,
      open: openMutation,
      restore: restoreMutation,
      revokeShare: revokeShareMutation
    },
    queries: {
      remoteShareGrants: remoteShareGrantsQuery
    },
    state: {
      feedback,
      selectedInstanceId
    }
  };
}
