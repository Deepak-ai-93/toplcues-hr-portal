import React, { useState } from 'react';

interface DecimalInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

// Text-based numeric input so arbitrary amounts (including decimals) can be
// typed; type="number" with step/min restrictions drops partial entries and
// rejects values that are not multiples of the step.
export const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onChange,
  disabled,
  required,
  placeholder,
  className,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? String(Number.isFinite(value) ? value : 0);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      value={display}
      onFocus={(e) => {
        setDraft(display);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setDraft(raw);
        const parsed = Number.parseFloat(raw);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
      onBlur={() => setDraft(null)}
      className={
        className ??
        'w-14 text-center py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums'
      }
    />
  );
};
