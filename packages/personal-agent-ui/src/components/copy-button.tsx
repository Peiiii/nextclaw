import { useEffect, useRef, useState } from "react";
import { Check, Copy, LoaderCircle } from "lucide-react";
import { IconButton } from "./icon-button";

export function CopyButton({ text, label, copiedLabel, failedLabel }: {
  text: string; label: string; copiedLabel: string; failedLabel: string;
}) {
  const [result, setResult] = useState<{ text: string; state: "pending" | "copied" | "failed" } | null>(null);
  const request = useRef(0);
  const state = result?.text === text ? result.state : null;
  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setResult(null), 2000);
    return () => window.clearTimeout(timer);
  }, [state, result]);
  const copy = async () => {
    const id = ++request.current;
    setResult({ text, state: "pending" });
    try {
      await navigator.clipboard.writeText(text);
      if (request.current === id) setResult({ text, state: "copied" });
    } catch {
      if (request.current === id) setResult({ text, state: "failed" });
    }
  };
  return <span className="ui-copy-action">
    <IconButton label={state === "copied" ? copiedLabel : label} disabled={state === "pending"}
      icon={state === "copied" ? <Check /> : state === "pending" ? <LoaderCircle className="motion-safe:animate-spin" /> : <Copy />}
      onClick={() => void copy()} />
    <span role="status" className={state === "failed" ? "ui-copy-error" : "sr-only"}>
      {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : ""}
    </span>
  </span>;
}
