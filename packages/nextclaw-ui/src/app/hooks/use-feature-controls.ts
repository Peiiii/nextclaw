import { useQuery } from "@tanstack/react-query";
import { nextclawClient } from "@/shared/lib/api";

const FEATURE_CONTROLS_QUERY_KEY = ["feature-controls"] as const;

export function useFeatureControls() {
  return useQuery({
    queryKey: FEATURE_CONTROLS_QUERY_KEY,
    queryFn: nextclawClient.featureControls.get,
  });
}
