"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      className={clsx(
        "rounded px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-black text-white hover:bg-gray-800",
        variant === "secondary" &&
          "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
        variant === "danger" && "border border-red-300 bg-white text-red-700 hover:bg-red-50",
        className
      )}
      {...rest}
    >
      {pending ? pendingLabel ?? "Saving…" : children}
    </button>
  );
}
