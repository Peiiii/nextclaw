import { readFile } from "node:fs/promises";
import path from "node:path";

type LocalizedPresentationField = "nameI18n" | "titleI18n" | "descriptionI18n";

export type AppPackageManifestPresentation = {
  title?: string;
  description?: string;
  icon?: string;
  nameI18n?: Record<string, string>;
  titleI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
};

export class AppPackagePresentationService {
  readManifest = async (manifestPath: string): Promise<AppPackageManifestPresentation> => {
    const candidate = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const rawIcon = typeof candidate.icon === "string" ? candidate.icon : undefined;
    return {
      ...(typeof candidate.title === "string" ? { title: candidate.title } : {}),
      ...(typeof candidate.description === "string"
        ? { description: candidate.description }
        : {}),
      ...(rawIcon ? { icon: await this.resolveIcon(manifestPath, rawIcon) } : {}),
      ...this.readLocalizedField(candidate, "nameI18n"),
      ...this.readLocalizedField(candidate, "titleI18n"),
      ...this.readLocalizedField(candidate, "descriptionI18n"),
    };
  };

  private readLocalizedField = (
    candidate: Record<string, unknown>,
    field: LocalizedPresentationField,
  ): Partial<Record<LocalizedPresentationField, Record<string, string>>> => {
    const value = candidate[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const entries = Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    return entries.length > 0 ? { [field]: Object.fromEntries(entries) } : {};
  };

  private resolveIcon = async (manifestPath: string, icon: string): Promise<string> => {
    if (this.isDirectIconReference(icon)) {
      return icon;
    }
    const manifestDirectory = path.dirname(manifestPath);
    const iconPath = path.resolve(manifestDirectory, icon);
    const relative = path.relative(manifestDirectory, iconPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return icon;
    }
    const mimeType = this.iconMimeType(path.extname(iconPath));
    if (!mimeType) {
      return icon;
    }
    const bytes = await readFile(iconPath);
    if (bytes.byteLength > 256 * 1024) {
      return icon;
    }
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  };

  private isDirectIconReference = (icon: string): boolean =>
    icon.startsWith("data:") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("/") ||
    (!icon.includes("/") && !icon.includes(".") && [...icon].length <= 8);

  private iconMimeType = (extension: string): string | undefined => {
    switch (extension.toLowerCase()) {
      case ".svg": return "image/svg+xml";
      case ".png": return "image/png";
      case ".jpg":
      case ".jpeg": return "image/jpeg";
      case ".webp": return "image/webp";
      case ".gif": return "image/gif";
      default: return undefined;
    }
  };
}
