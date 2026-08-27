import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { appQueryClient } from "@/app-query-client";
import { nextclawClient } from "@/shared/lib/api/managers/client.manager";
import { t } from "@/shared/lib/i18n";
import { desktopCapabilityManager } from "../managers/desktop-capability.manager";
import {
  type DesktopAuthorizationRequest,
  useDesktopAuthorizationStore,
} from "../stores/desktop-authorization.store";

const AUTHORIZATION_EVENT_TYPE = "desktop.authorization.required";

export function DesktopAuthorizationDialog() {
  const pending = useDesktopAuthorizationStore((state) => state.pending);
  const present = useDesktopAuthorizationStore((state) => state.present);
  const clear = useDesktopAuthorizationStore((state) => state.clear);
  const [isGranting, setIsGranting] = useState(false);

  useEffect(() => nextclawClient.eventBus.subscribeAll((event) => {
    if (event.type !== AUTHORIZATION_EVENT_TYPE) return;
    const request = readAuthorizationRequest(event.payload);
    if (request) present(request);
  }), [present]);

  const allow = async () => {
    if (!pending || isGranting) return;
    setIsGranting(true);
    try {
      await desktopCapabilityManager.grantAccess(pending.request);
      await appQueryClient.invalidateQueries({
        queryKey: ["desktop-capability", "grants"],
      });
      clear();
      toast.success(t("desktopAuthorizationAllowed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("desktopAuthorizationFailed"),
      );
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open && !isGranting) clear();
      }}
    >
      <DialogContent className="[&>:last-child]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            {t("desktopAuthorizationTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("desktopAuthorizationDescription")}
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="space-y-3 rounded-xl bg-muted/55 p-4 text-sm">
            <AuthorizationField
              label={t("desktopAuthorizationCaller")}
              value={formatSubject(pending)}
            />
            <AuthorizationField
              label={t("desktopAuthorizationApplication")}
              value={pending.applicationId}
            />
            <AuthorizationField
              label={t("desktopAuthorizationAccess")}
              value={pending.request.access.map(formatAccess).join(", ")}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              {formatRisk(pending.request.access)}
            </p>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isGranting}
            onClick={clear}
          >
            {t("desktopAuthorizationReject")}
          </Button>
          <Button type="button" disabled={isGranting} onClick={() => void allow()}>
            {isGranting ? t("desktopAuthorizationAllowing") : t("desktopAuthorizationAllow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuthorizationField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-xs text-foreground">{value}</div>
    </div>
  );
}

function readAuthorizationRequest(value: unknown): DesktopAuthorizationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const { request } = payload;
  if (!request || typeof request !== "object" || Array.isArray(request)) return null;
  const candidate = request as Record<string, unknown>;
  if (
    typeof payload.applicationId !== "string" ||
    !candidate.subject ||
    !candidate.resource ||
    !Array.isArray(candidate.access) ||
    typeof candidate.declarationFingerprint !== "string"
  ) return null;
  return {
    applicationId: payload.applicationId,
    request: candidate as DesktopAuthorizationRequest["request"],
  };
}

function formatSubject(pending: DesktopAuthorizationRequest): string {
  const { subject } = pending.request;
  const label = subject.type === "agent"
    ? t("desktopCapabilitiesAgent")
    : t("desktopCapabilitiesExtension");
  return `${label} · ${subject.id}`;
}

function formatAccess(access: string): string {
  if (access === "ui.read") return t("desktopAuthorizationRead");
  if (access === "ui.observe") return t("desktopAuthorizationObserve");
  if (access === "ui.write") return t("desktopAuthorizationWrite");
  if (access === "screen.capture-window") return t("desktopAuthorizationScreenCapture");
  if (access === "input.pointer") return t("desktopAuthorizationPointerInput");
  return access;
}

function formatRisk(access: string[]): string {
  if (access.includes("ui.write")) return t("desktopAuthorizationWriteRisk");
  if (access.includes("screen.capture-window")) return t("desktopAuthorizationScreenCaptureRisk");
  if (access.includes("input.pointer")) return t("desktopAuthorizationPointerInputRisk");
  return t("desktopAuthorizationReadRisk");
}
