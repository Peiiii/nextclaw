import { useState } from "react";
import type {
  MarketplaceItemSummary,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallSpec,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NoticeCard } from "@/components/ui/notice-card";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

export function InstallDialog(props: {
  item: MarketplaceItemSummary | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    name: string;
    allAgents: boolean;
    inputs: Record<string, string>;
  }) => Promise<void>;
}) {
  const { item, open, pending, onOpenChange, onSubmit } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {item ? (
        <InstallDialogContent
          key={`${item.slug}:${open ? "open" : "closed"}`}
          item={item}
          pending={pending}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

function InstallDialogContent(props: {
  item: MarketplaceItemSummary;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    name: string;
    allAgents: boolean;
    inputs: Record<string, string>;
  }) => Promise<void>;
}) {
  const { item, pending, onOpenChange, onSubmit } = props;
  const template = item.install as MarketplaceMcpInstallSpec | undefined;
  const [name, setName] = useState(template?.defaultName ?? "");
  const [allAgents, setAllAgents] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>(
    Object.fromEntries(
      (template?.inputs ?? []).map((field) => [
        field.id,
        field.defaultValue ?? "",
      ]),
    ),
  );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("marketplaceMcpInstallDialogTitle")}</DialogTitle>
        <DialogDescription>{item.name}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-800">
            {t("marketplaceMcpServerName")}
          </div>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={template?.defaultName ?? "mcp-server"}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {t("marketplaceMcpAllAgents")}
            </div>
            <div className="text-xs text-gray-500">
              {t("marketplaceMcpAllAgentsDescription")}
            </div>
          </div>
          <Switch checked={allAgents} onCheckedChange={setAllAgents} />
        </div>

        {(template?.inputs ?? []).map((field) => (
          <div key={field.id} className="space-y-2">
            <div className="text-sm font-medium text-gray-800">
              {field.label}
            </div>
            {field.description ? (
              <div className="text-xs text-gray-500">{field.description}</div>
            ) : null}
            <Input
              type={field.secret ? "password" : "text"}
              value={inputs[field.id] ?? ""}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  [field.id]: event.target.value,
                }))
              }
              placeholder={field.defaultValue ?? ""}
            />
          </div>
        ))}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={() => void onSubmit({ name, allAgents, inputs })}
          disabled={pending || !name.trim()}
        >
          {pending ? t("marketplaceInstalling") : t("marketplaceInstall")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function DoctorDialog(props: {
  result: MarketplaceMcpDoctorResult | null;
  targetName: string | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { result, targetName, open, pending, onOpenChange } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("marketplaceMcpDoctorTitle")}</DialogTitle>
          <DialogDescription>{targetName ?? "-"}</DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="text-sm text-gray-500">{t("loading")}</div>
        ) : null}
        {!pending && result ? (
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              {t("marketplaceMcpDoctorAccessible")}:{" "}
              {result.accessible
                ? t("statusReady")
                : t("marketplaceOperationFailed")}
            </div>
            <div>
              {t("marketplaceMcpDoctorTransport")}:{" "}
              {result.transport.toUpperCase()}
            </div>
            <div>
              {t("marketplaceMcpDoctorTools")}: {result.toolCount}
            </div>
            {result.error ? (
              <NoticeCard
                tone="danger"
                description={result.error}
                className="rounded-lg"
              />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
