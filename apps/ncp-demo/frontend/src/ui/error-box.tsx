import type { NcpError } from "@nextclaw/ncp";

export function ErrorBox({ error }: { error: NcpError | null }) {
  if (!error) return null;
  return (
    <div className="error-box">
      {error.code}: {error.message}
    </div>
  );
}
