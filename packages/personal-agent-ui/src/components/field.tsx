import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`ui-field ${className}`.trim()}><span>{label}</span>{children}</label>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => <input ref={ref} className={`ui-control ${className}`.trim()} {...props} />,
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => <select ref={ref} className={`ui-control ${className}`.trim()} {...props}>{children}</select>,
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => <textarea ref={ref} className={`ui-control ${className}`.trim()} {...props} />,
);
Textarea.displayName = "Textarea";
