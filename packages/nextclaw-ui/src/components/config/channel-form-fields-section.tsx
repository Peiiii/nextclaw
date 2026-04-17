import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/common/tag-input";
import { hintForPath } from "@/lib/config-hints";
import { t } from "@/lib/i18n";
import {
  Globe,
  Hash,
  KeyRound,
  Mail,
  Settings,
  ToggleLeft,
} from "lucide-react";
import type { ConfigUiHints } from "@/api/types";
import type { ChannelField } from "./channel-form-fields";

function getFieldIcon(fieldName: string) {
  if (
    fieldName.includes("token") ||
    fieldName.includes("secret") ||
    fieldName.includes("password")
  ) {
    return <KeyRound className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName.includes("url") || fieldName.includes("host")) {
    return <Globe className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName.includes("email") || fieldName.includes("mail")) {
    return <Mail className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName.includes("id") || fieldName.includes("from")) {
    return <Hash className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName === "enabled" || fieldName === "consentGranted") {
    return <ToggleLeft className="h-3.5 w-3.5 text-gray-500" />;
  }
  return <Settings className="h-3.5 w-3.5 text-gray-500" />;
}

type ChannelFormFieldsSectionProps = {
  channelName: string;
  fields: ChannelField[];
  formData: Record<string, unknown>;
  jsonDrafts: Record<string, string>;
  setJsonDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  updateField: (name: string, value: unknown) => void;
  uiHints?: ConfigUiHints;
};

export function ChannelFormFieldsSection({
  channelName,
  fields,
  formData,
  jsonDrafts,
  setJsonDrafts,
  updateField,
  uiHints,
}: ChannelFormFieldsSectionProps) {
  return (
    <>
      {fields.map((field) => {
        const hint = hintForPath(
          `channels.${channelName}.${field.name}`,
          uiHints,
        );
        const label = hint?.label ?? field.label;
        const placeholder = hint?.placeholder;

        return (
          <div key={field.name} className="space-y-2.5">
            <Label
              htmlFor={field.name}
              className="flex items-center gap-2 text-sm font-medium text-gray-900"
            >
              {getFieldIcon(field.name)}
              {label}
            </Label>

            {field.type === "boolean" && (
              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                <span className="text-sm text-gray-500">
                  {(formData[field.name] as boolean)
                    ? t("enabled")
                    : t("disabled")}
                </span>
                <Switch
                  id={field.name}
                  checked={(formData[field.name] as boolean) || false}
                  onCheckedChange={(checked) =>
                    updateField(field.name, checked)
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            )}

            {(field.type === "text" || field.type === "email") && (
              <Input
                id={field.name}
                type={field.type}
                value={(formData[field.name] as string) || ""}
                onChange={(event) =>
                  updateField(field.name, event.target.value)
                }
                placeholder={placeholder}
                className="rounded-xl"
              />
            )}

            {field.type === "password" && (
              <Input
                id={field.name}
                type="password"
                value={(formData[field.name] as string) || ""}
                onChange={(event) =>
                  updateField(field.name, event.target.value)
                }
                placeholder={placeholder ?? t("leaveBlankToKeepUnchanged")}
                className="rounded-xl"
              />
            )}

            {field.type === "number" && (
              <Input
                id={field.name}
                type="number"
                value={(formData[field.name] as number) || 0}
                onChange={(event) =>
                  updateField(field.name, parseInt(event.target.value, 10) || 0)
                }
                placeholder={placeholder}
                className="rounded-xl"
              />
            )}

            {field.type === "tags" && (
              <TagInput
                value={(formData[field.name] as string[]) || []}
                onChange={(tags) => updateField(field.name, tags)}
              />
            )}

            {field.type === "select" && (
              <Select
                value={(formData[field.name] as string) || ""}
                onValueChange={(value) => updateField(field.name, value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === "json" && (
              <textarea
                id={field.name}
                value={jsonDrafts[field.name] ?? "{}"}
                onChange={(event) =>
                  setJsonDrafts((prev) => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
                className="min-h-[120px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono"
              />
            )}
          </div>
        );
      })}
    </>
  );
}
