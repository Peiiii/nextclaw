import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPreference,
  PREFERENCE_KEYS,
  updatePreference,
  type PreferenceEntryView,
  type PreferenceJsonValue,
} from '@/shared/lib/api';

const CHAT_MODEL_FAVORITES_PREFERENCE_KEY = PREFERENCE_KEYS.chat.modelFavorites;
const chatModelFavoritesQueryKey = ['preference', CHAT_MODEL_FAVORITES_PREFERENCE_KEY] as const;

function normalizeFavoriteModelValues(value: PreferenceJsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const values: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const normalized = item.trim();
    if (normalized && !values.includes(normalized)) {
      values.push(normalized);
    }
  }
  return values;
}

export function useChatModelFavorites(availableModelValues: string[]) {
  const queryClient = useQueryClient();
  const availableModelValueSet = useMemo(
    () => new Set(availableModelValues),
    [availableModelValues],
  );
  const favoritesQuery = useQuery({
    queryKey: chatModelFavoritesQueryKey,
    queryFn: () => fetchPreference(CHAT_MODEL_FAVORITES_PREFERENCE_KEY),
    staleTime: 30_000,
  });
  const favoriteModelValues = useMemo(
    () => normalizeFavoriteModelValues(favoritesQuery.data?.value),
    [favoritesQuery.data?.value],
  );
  const visibleFavoriteModelValues = useMemo(
    () => favoriteModelValues.filter((value) => availableModelValueSet.has(value)),
    [availableModelValueSet, favoriteModelValues],
  );
  const updateFavorites = useMutation({
    mutationFn: async (values: string[]) =>
      await updatePreference(CHAT_MODEL_FAVORITES_PREFERENCE_KEY, values),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: chatModelFavoritesQueryKey });
      const previous = queryClient.getQueryData<PreferenceEntryView>(chatModelFavoritesQueryKey);
      queryClient.setQueryData<PreferenceEntryView>(chatModelFavoritesQueryKey, {
        key: CHAT_MODEL_FAVORITES_PREFERENCE_KEY,
        value: values,
        updatedAt: new Date().toISOString(),
      });
      return { previous };
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatModelFavoritesQueryKey, context.previous);
      }
    },
    onSuccess: (entry) => {
      queryClient.setQueryData(chatModelFavoritesQueryKey, entry);
    },
  });
  const setModelFavorite = useCallback((value: string, favorite: boolean) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    const next = favorite
      ? [normalized, ...favoriteModelValues.filter((item) => item !== normalized)]
      : favoriteModelValues.filter((item) => item !== normalized);
    updateFavorites.mutate(next);
  }, [favoriteModelValues, updateFavorites]);

  return {
    favoriteModelValues: visibleFavoriteModelValues,
    isLoading: favoritesQuery.isLoading,
    setModelFavorite,
  };
}
