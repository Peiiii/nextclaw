import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import type { RemoteInstance } from "@/features/dashboard/types/remote-instance.types";

type RemoteInstanceTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function RemoteInstanceDomainEditor(props: {
  instance: RemoteInstance;
  t: RemoteInstanceTranslate;
  isSaving: boolean;
  isRemoving: boolean;
  onSave: (instanceId: string, prefix: string) => Promise<unknown>;
  onRemove: (instanceId: string) => Promise<unknown>;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [prefix, setPrefix] = useState(props.instance.customDomainPrefix ?? "");
  const suffix =
    props.instance.systemDomain && props.instance.systemDomainPrefix
      ? props.instance.systemDomain.slice(
          props.instance.systemDomainPrefix.length,
        )
      : "";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await props.onSave(props.instance.id, prefix);
    setIsEditing(false);
  }

  async function handleRemove(): Promise<void> {
    if (!window.confirm(props.t("remote.messages.domainReleaseConfirm"))) {
      return;
    }
    await props.onRemove(props.instance.id);
    setPrefix("");
  }

  if (isEditing) {
    return (
      <form
        className="space-y-2"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label className="block text-xs font-medium text-[var(--color-foreground-muted)]">
          {props.t("remote.domain.prefixLabel")}
          <div className="mt-1 flex min-w-0 items-center gap-1">
            <Input
              autoFocus
              className="h-8 min-w-0 font-mono text-xs"
              maxLength={63}
              value={prefix}
              aria-label={props.t("remote.domain.prefixLabel")}
              onChange={(event) => setPrefix(event.target.value)}
            />
            {suffix ? (
              <span className="shrink-0 font-mono text-xs text-[var(--color-foreground-subtle)]">
                {suffix}
              </span>
            ) : null}
          </div>
        </label>
        <div className="flex gap-1">
          <Button
            type="submit"
            className="h-7 px-2 text-xs"
            disabled={props.isSaving || !prefix.trim()}
          >
            {props.t("remote.actions.saveDomain")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={props.isSaving}
            onClick={() => {
              setPrefix(props.instance.customDomainPrefix ?? "");
              setIsEditing(false);
            }}
          >
            {props.t("remote.actions.cancelDomain")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2">
        <span className="text-[11px] text-[var(--color-foreground-subtle)]">
          {props.t("remote.domain.systemLabel")}
        </span>
        <span
          className="truncate font-mono text-xs text-[var(--color-foreground-muted)]"
          title={props.instance.systemDomain ?? undefined}
        >
          {props.instance.systemDomain ?? props.t("remote.domain.unavailable")}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-[11px] text-[var(--color-foreground-subtle)]">
          {props.t("remote.domain.customLabel")}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-[var(--color-foreground)]"
          title={props.instance.customDomain ?? undefined}
        >
          {props.instance.customDomain ?? props.t("remote.domain.customEmpty")}
        </span>
        <Button
          type="button"
          variant="secondary"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={props.isRemoving}
          onClick={() => setIsEditing(true)}
        >
          {props.t(
            props.instance.customDomainPrefix
              ? "remote.actions.editDomainShort"
              : "remote.actions.setDomainShort",
          )}
        </Button>
        {props.instance.customDomainPrefix ? (
          <Button
            type="button"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={props.isRemoving || props.isSaving}
            onClick={() => void handleRemove()}
          >
            {props.t("remote.actions.removeDomainShort")}
          </Button>
        ) : null}
      </div>
      <div
        className="truncate font-mono text-[11px] text-[var(--color-foreground-subtle)]"
        title={props.instance.localOrigin}
      >
        {props.instance.localOrigin}
      </div>
    </div>
  );
}
