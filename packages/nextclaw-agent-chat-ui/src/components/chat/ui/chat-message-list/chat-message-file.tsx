type ChatMessageFileProps = {
  file: {
    label: string;
    mimeType: string;
    dataUrl?: string;
    isImage: boolean;
  };
};

export function ChatMessageFile({ file }: ChatMessageFileProps) {
  if (file.isImage && file.dataUrl) {
    return (
      <img
        src={file.dataUrl}
        alt={file.label}
        className="block max-h-80 max-w-full rounded-2xl object-contain"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-black/8 bg-black/6 px-3 py-2 text-sm">
      <div className="font-medium">{file.label}</div>
      <div className="text-xs opacity-75">{file.mimeType}</div>
    </div>
  );
}
