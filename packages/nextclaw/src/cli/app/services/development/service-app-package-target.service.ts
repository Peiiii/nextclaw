import { access } from "node:fs/promises";
import path from "node:path";
import {
  AppManifestService,
  type AppPermissions,
  type AppResolvedComponent,
  isAppComponentManifestBundle,
} from "@nextclaw/app-runtime";
import { getServiceAppManifestPath } from "@nextclaw/kernel";
import type { ServiceAppDevIssue } from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

export type ResolvedServiceTarget = {
  appPath: string;
  packageContext?: { permissions: AppPermissions };
};

export class ServiceAppPackageTargetService {
  resolve = async (
    target: string,
    componentId: string | undefined,
    issues: ServiceAppDevIssue[],
  ): Promise<ResolvedServiceTarget | null> => {
    const targetPath = path.resolve(target);
    if (await this.pathExists(getServiceAppManifestPath(targetPath))) {
      return { appPath: targetPath };
    }
    if (!(await this.pathExists(path.join(targetPath, "manifest.json")))) {
      return { appPath: targetPath };
    }

    try {
      const manifestService = new AppManifestService();
      const bundle = await manifestService.load(targetPath);
      if (!isAppComponentManifestBundle(bundle)) {
        issues.push({
          severity: "error",
          code: "service.package.schemaUnsupported",
          message:
            "app dev/call requires a schema v2 package when the target is a package directory.",
          fixHint:
            "Use a Service App directory or a schema v2 package with a Service component.",
        });
        return null;
      }
      const services = bundle.components.filter(
        (component) => component.kind === "service",
      );
      const selected = this.selectService(services, componentId, issues);
      if (!selected) return null;
      return {
        appPath: selected.componentDirectory,
        packageContext: {
          permissions: manifestService.resolvePlatformSecurity(bundle.manifest)
            .permissions,
        },
      };
    } catch (error) {
      issues.push({
        severity: "error",
        code: "service.package.invalid",
        message: `Cannot load schema v2 package: ${error instanceof Error ? error.message : String(error)}`,
      });
      return null;
    }
  };

  findOwningPackage = async (
    appPath: string,
    issues: ServiceAppDevIssue[],
  ): Promise<{ permissions: AppPermissions } | undefined> => {
    let candidate = path.dirname(appPath);
    while (true) {
      const permissions = await this.readOwningPermissions(
        candidate,
        appPath,
        issues,
      );
      if (permissions) return { permissions };
      const parent = path.dirname(candidate);
      if (parent === candidate) return undefined;
      candidate = parent;
    }
  };

  private selectService = (
    services: AppResolvedComponent[],
    componentId: string | undefined,
    issues: ServiceAppDevIssue[],
  ): AppResolvedComponent | undefined => {
    const requested = componentId?.trim();
    const selected = requested
      ? services.find((component) => component.id === requested)
      : services.length === 1
        ? services[0]
        : undefined;
    if (selected) return selected;
    const available = services.map((component) => component.id);
    issues.push({
      severity: "error",
      code: requested
        ? "service.package.componentNotFound"
        : "service.package.componentRequired",
      message: requested
        ? `Service component does not exist in package: ${requested}.`
        : services.length === 0
          ? "The package does not contain a Service component."
          : "The package contains multiple Service components; choose one with --component.",
      fixHint:
        available.length > 0
          ? `Available Service components: ${available.join(", ")}.`
          : undefined,
    });
    return undefined;
  };

  private readOwningPermissions = async (
    candidate: string,
    appPath: string,
    issues: ServiceAppDevIssue[],
  ): Promise<AppPermissions | undefined> => {
    if (!(await this.pathExists(path.join(candidate, "manifest.json")))) {
      return undefined;
    }
    const manifestService = new AppManifestService();
    try {
      const bundle = await manifestService.load(candidate);
      if (!isAppComponentManifestBundle(bundle)) return undefined;
      const ownsComponent = bundle.components.some(
        (component) =>
          path.resolve(component.componentDirectory) === path.resolve(appPath),
      );
      return ownsComponent
        ? manifestService.resolvePlatformSecurity(bundle.manifest).permissions
        : undefined;
    } catch (error) {
      issues.push({
        severity: "error",
        code: "service.package.invalid",
        message: `Cannot load owning schema v2 package at ${candidate}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return undefined;
    }
  };

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };
}
