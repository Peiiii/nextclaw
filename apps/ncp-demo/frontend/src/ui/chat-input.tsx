type ChatInputProps = {
  value: string;
  placeholder?: string;
  isSending: boolean;
  canSend: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
};

export function ChatInput({
  value,
  placeholder = "Ask anything.",
  isSending,
  canSend,
  onChange,
  onSend,
}: ChatInputProps) {
  return (
    <footer className="composer">
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void onSend();
          }
        }}
      />
      <button onClick={onSend} disabled={!canSend || value.trim().length === 0}>
        {isSending ? "running..." : "send"}
      </button>
    </footer>
  );
}
