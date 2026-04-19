export type NappHealthResponse = {
  ok: true;
};

export type NappManifestResponse = {
  ok: true;
  manifest: unknown;
};

export type NappPermissionsResponse = {
  ok: true;
  permissions: unknown;
};

export type NappRunResponse = {
  ok: true;
  result: unknown;
};

export class NappClient {
  constructor(private readonly baseUrl = "") {}

  health = async (): Promise<NappHealthResponse> => {
    return await this.request<NappHealthResponse>("/__napp/health");
  };

  getManifest = async (): Promise<NappManifestResponse> => {
    return await this.request<NappManifestResponse>("/__napp/manifest");
  };

  getPermissions = async (): Promise<NappPermissionsResponse> => {
    return await this.request<NappPermissionsResponse>("/__napp/permissions");
  };

  runAction = async (action?: string): Promise<NappRunResponse> => {
    return await this.request<NappRunResponse>("/__napp/run", {
      method: "POST",
      body: JSON.stringify({
        action,
      }),
    });
  };

  private request = async <T>(pathname: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || !payload) {
      throw new Error(`napp bridge request failed: ${response.status} ${response.statusText}`);
    }
    return payload;
  };
}

export const createNappClient = (baseUrl?: string): NappClient => {
  return new NappClient(baseUrl);
};
