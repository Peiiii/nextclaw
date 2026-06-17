import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPreference,
  PREFERENCE_KEYS,
  updatePreference,
  type PreferenceEntryView,
} from "@/shared/lib/api";
import {
  normalizeSessionType,
  type ChatSessionTypeOption,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";

const CHAT_NEW_SESSION_TYPE_PREFERENCE_KEY =
  PREFERENCE_KEYS.chat.newSessionType;
const chatNewSessionTypePreferenceQueryKey = [
  "preference",
  CHAT_NEW_SESSION_TYPE_PREFERENCE_KEY,
] as const;

type UseChatNewSessionTypePreferenceParams = {
  defaultSessionType: string;
  sessionTypeOptions: readonly ChatSessionTypeOption[];
};

function findSelectableSessionTypeOption(
  sessionType: string,
  sessionTypeOptions: readonly ChatSessionTypeOption[],
): ChatSessionTypeOption | null {
  const normalizedSessionType = normalizeSessionType(sessionType);
  return (
    sessionTypeOptions.find(
      (option) =>
        option.value === normalizedSessionType && option.ready !== false,
    ) ?? null
  );
}

function resolveNewSessionTypeOption(params: {
  preferredSessionType: string | null;
  defaultSessionType: string;
  sessionTypeOptions: readonly ChatSessionTypeOption[];
}): ChatSessionTypeOption {
  const { defaultSessionType, preferredSessionType, sessionTypeOptions } =
    params;
  const preferredOption = preferredSessionType
    ? findSelectableSessionTypeOption(preferredSessionType, sessionTypeOptions)
    : null;
  const defaultOption = findSelectableSessionTypeOption(
    defaultSessionType,
    sessionTypeOptions,
  );
  return (
    preferredOption ??
    defaultOption ??
    sessionTypeOptions.find((option) => option.ready !== false) ??
    sessionTypeOptions[0] ?? {
      value: normalizeSessionType(defaultSessionType),
      label: normalizeSessionType(defaultSessionType),
      icon: null,
      ready: true,
      reason: null,
      reasonMessage: null,
      supportedModels: undefined,
      recommendedModel: null,
      modelSelectionMode: "nextclaw",
      runtimeDefaultThinking: null,
      cta: null,
    }
  );
}

function readPreferredSessionType(entry: PreferenceEntryView | undefined) {
  return typeof entry?.value === "string"
    ? normalizeSessionType(entry.value)
    : null;
}

export function useChatNewSessionTypePreference({
  defaultSessionType,
  sessionTypeOptions,
}: UseChatNewSessionTypePreferenceParams) {
  const queryClient = useQueryClient();
  const preferenceQuery = useQuery({
    queryKey: chatNewSessionTypePreferenceQueryKey,
    queryFn: () => fetchPreference(CHAT_NEW_SESSION_TYPE_PREFERENCE_KEY),
    staleTime: 30_000,
    retry: false,
  });
  const preferredSessionType = useMemo(
    () => readPreferredSessionType(preferenceQuery.data),
    [preferenceQuery.data],
  );
  const selectedSessionTypeOption = useMemo(
    () =>
      resolveNewSessionTypeOption({
        preferredSessionType,
        defaultSessionType,
        sessionTypeOptions,
      }),
    [defaultSessionType, preferredSessionType, sessionTypeOptions],
  );
  const updateNewSessionType = useMutation({
    mutationFn: async (sessionType: string) =>
      await updatePreference(
        CHAT_NEW_SESSION_TYPE_PREFERENCE_KEY,
        normalizeSessionType(sessionType),
      ),
    onMutate: async (sessionType) => {
      const normalizedSessionType = normalizeSessionType(sessionType);
      await queryClient.cancelQueries({
        queryKey: chatNewSessionTypePreferenceQueryKey,
      });
      const previous = queryClient.getQueryData<PreferenceEntryView>(
        chatNewSessionTypePreferenceQueryKey,
      );
      queryClient.setQueryData<PreferenceEntryView>(
        chatNewSessionTypePreferenceQueryKey,
        {
          key: CHAT_NEW_SESSION_TYPE_PREFERENCE_KEY,
          value: normalizedSessionType,
          updatedAt: new Date().toISOString(),
        },
      );
      return { previous };
    },
    onError: (_error, _sessionType, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          chatNewSessionTypePreferenceQueryKey,
          context.previous,
        );
      }
    },
    onSuccess: (entry) => {
      queryClient.setQueryData(chatNewSessionTypePreferenceQueryKey, entry);
    },
  });
  const setSelectedSessionType = useCallback(
    (sessionType: string) => {
      const nextOption = findSelectableSessionTypeOption(
        sessionType,
        sessionTypeOptions,
      );
      if (!nextOption) {
        return;
      }
      updateNewSessionType.mutate(nextOption.value);
    },
    [sessionTypeOptions, updateNewSessionType],
  );

  return {
    selectedSessionType: selectedSessionTypeOption.value,
    selectedSessionTypeOption,
    isLoading: preferenceQuery.isLoading,
    setSelectedSessionType,
  };
}
