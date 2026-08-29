import {
  AppPackageError,
  type AppPackageReadiness,
  type AppPackageReadinessRequirement,
  type AppPackageView,
} from "@kernel/types/app-package.types.js";
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";

type ReadinessComponent = {
  kind: "panel" | "service";
  id: string;
  componentDirectory: string;
};

export class AppPackageReadinessService {
  resolve = async (components: ReadinessComponent[]): Promise<AppPackageReadiness> => {
    const requirements = (await Promise.all(components
      .filter((component) => component.kind === "service")
      .map(async (component) => {
        const requires = (await readServiceAppManifest(component.componentDirectory)).requires;
        return [
          ...(requires?.capabilities ?? []).map((requirement): AppPackageReadinessRequirement => ({
            componentId: component.id,
            kind: "capability",
            id: requirement.version ? `${requirement.id}@${requirement.version}` : requirement.id,
            title: requirement.title ?? requirement.id,
            description: requirement.description,
            remediation: requirement.remediation,
          })),
          ...(requires?.resources ?? [])
            .filter((requirement) => requirement.required !== false)
            .map((requirement): AppPackageReadinessRequirement => ({
              componentId: component.id,
              kind: "configuration",
              id: requirement.binding,
              title: requirement.title ?? requirement.type,
              description: requirement.description,
              remediation: requirement.remediation,
            })),
        ];
      }))).flat();
    return {
      status: requirements.some((requirement) => requirement.kind === "capability")
        ? "needs-capability"
        : requirements.some((requirement) => requirement.kind === "configuration")
          ? "needs-configuration"
          : "ready",
      requirements,
    };
  };

  assertReadyToEnable = (app: AppPackageView): void => {
    if (app.readiness.status === "ready") return;
    const required = app.readiness.requirements.map((requirement) => requirement.title).join(", ");
    const reason = app.readiness.status === "needs-capability"
      ? "an additional capability is required"
      : "external service setup is required";
    throw new AppPackageError(
      "APP_PACKAGE_NOT_READY",
      `App ${app.id} is not ready to enable: ${reason}${required ? ` (${required})` : ""}.`,
    );
  };
}
