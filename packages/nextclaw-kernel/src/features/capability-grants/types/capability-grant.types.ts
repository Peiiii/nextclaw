export type CapabilityGrantSubject = {
  type: string;
  id: string;
};

export type CapabilityGrantResource = {
  type: string;
  target: unknown;
};

export type CapabilityGrantRequest = {
  subject: CapabilityGrantSubject;
  resource: CapabilityGrantResource;
  access: string[];
  declarationFingerprint: string;
};

export type CapabilityGrant = CapabilityGrantRequest & {
  grantedAt: string;
  lastUsedAt?: string;
};

export type CapabilityGrantFilter = {
  subject?: Partial<CapabilityGrantSubject>;
  resourceType?: string;
  target?: unknown;
  access?: string[];
};

export type CapabilityGrantDecision =
  | { granted: true; grant: CapabilityGrant }
  | { granted: false; reason: "authorization_required" };
