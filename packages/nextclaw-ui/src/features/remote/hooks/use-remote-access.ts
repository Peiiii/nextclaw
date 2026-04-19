import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  controlRemoteService,
  fetchRemoteStatus,
  fetchRemoteDoctor,
  loginRemote,
  logoutRemote,
  pollRemoteBrowserAuth,
  startRemoteBrowserAuth,
  updateRemoteSettings
} from '@/api/remote';
import { REMOTE_STATUS_QUERY_KEY } from '@/features/remote';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

export function useRemoteStatus() {
  return useQuery({
    queryKey: REMOTE_STATUS_QUERY_KEY,
    queryFn: fetchRemoteStatus,
    staleTime: 5000,
    refetchOnWindowFocus: true
  });
}

export function useRemoteLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginRemote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMOTE_STATUS_QUERY_KEY });
      toast.success(t('remoteLoginSuccess'));
    },
    onError: (error: Error) => {
      toast.error(`${t('remoteLoginFailed')}: ${error.message}`);
    }
  });
}

export function useRemoteBrowserAuthStart() {
  return useMutation({
    mutationFn: startRemoteBrowserAuth,
    onError: (error: Error) => {
      toast.error(`${t('remoteBrowserAuthStartFailed')}: ${error.message}`);
    }
  });
}

export function useRemoteBrowserAuthPoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pollRemoteBrowserAuth,
    onSuccess: (result) => {
      if (result.status === 'authorized') {
        queryClient.invalidateQueries({ queryKey: REMOTE_STATUS_QUERY_KEY });
        toast.success(t('remoteLoginSuccess'));
      }
    },
    onError: (error: Error) => {
      toast.error(`${t('remoteBrowserAuthPollFailed')}: ${error.message}`);
    }
  });
}

export function useRemoteLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutRemote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMOTE_STATUS_QUERY_KEY });
      toast.success(t('remoteLogoutSuccess'));
    },
    onError: (error: Error) => {
      toast.error(`${t('remoteLogoutFailed')}: ${error.message}`);
    }
  });
}

export function useRemoteSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRemoteSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMOTE_STATUS_QUERY_KEY });
      toast.success(t('remoteSettingsSaved'));
    },
    onError: (error: Error) => {
      toast.error(`${t('remoteSettingsSaveFailed')}: ${error.message}`);
    }
  });
}

export function useRemoteDoctor() {
  return useMutation({
    mutationFn: fetchRemoteDoctor,
    onSuccess: () => {
      toast.success(t('remoteDoctorCompleted'));
    },
    onError: (error: Error) => {
      toast.error(`${t('remoteDoctorFailed')}: ${error.message}`);
    }
  });
}

export function useRemoteServiceControl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlRemoteService,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: REMOTE_STATUS_QUERY_KEY });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(`${t('remoteServiceActionFailed')}: ${error.message}`);
    }
  });
}
