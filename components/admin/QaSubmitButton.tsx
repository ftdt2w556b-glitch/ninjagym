"use client";

import { useFormStatus } from "react-dom";

interface Props {
  label: string;
  pendingLabel?: string;
  className?: string;
}

export default function QaSubmitButton({ label, pendingLabel, className }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:opacity-50 disabled:cursor-not-allowed transition-opacity`}
    >
      {pending ? (pendingLabel ?? "...") : label}
    </button>
  );
}
