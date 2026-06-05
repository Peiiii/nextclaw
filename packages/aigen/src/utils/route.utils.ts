import { AigenError } from "@/types/cli-output.types.js";

export type AigenModelRoute = {
  providerId: string;
  providerLocalModel: string;
};

export const parseModelRoute = (route: string): AigenModelRoute => {
  const slashIndex = route.indexOf("/");

  if (slashIndex <= 0 || slashIndex === route.length - 1) {
    throw new AigenError(
      "INVALID_ARGUMENT",
      "Model route must use <provider-id>/<provider-local-model>.",
    );
  }

  return {
    providerId: route.slice(0, slashIndex),
    providerLocalModel: route.slice(slashIndex + 1)
  };
};

export const assertResourceId = (id: string, label: string): void => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
    throw new AigenError("INVALID_ARGUMENT", `${label} must be a stable resource id.`);
  }
};
