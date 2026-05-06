import * as React from "react";
import { format, parse } from "date-fns";

import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DateFieldProps {
  /** ISO yyyy-MM-dd; "" or undefined = empty */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Inline style for the trigger button (override colors / radius). */
  triggerStyle?: React.CSSProperties;
  /** className for the trigger button. */
  triggerClassName?: string;
  /** ARIA label when no date selected. */
  ariaLabel?: string;
  /** Bound earliest day pickable. */
  fromDate?: Date;
  /** How the value renders inside the trigger. Defaults to "EEE d MMM" (e.g. "Mon 5 May"). */
  displayFormat?: string;
  /** Popover side (default: bottom). */
  side?: "top" | "right" | "bottom" | "left";
  /** Popover alignment (default: start). */
  align?: "start" | "center" | "end";
}

/**
 * Branded replacement for `<input type="date">`. Renders the project's
 * design-token styling on the trigger and pops a `Calendar` (react-day-picker)
 * panel anchored to it. Value contract matches the native input
 * (`yyyy-MM-dd` ISO date string) so callers can drop in without touching
 * their state shape.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  triggerStyle,
  triggerClassName,
  ariaLabel,
  fromDate,
  displayFormat = "EEE d MMM",
  side = "bottom",
  align = "start",
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const display = selected ? format(selected, displayFormat) : placeholder;
  const isEmpty = !selected;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={triggerClassName}
        aria-label={selected ? `Date: ${display}` : ariaLabel || placeholder}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          height: 30,
          padding: "0 10px",
          fontSize: 12,
          fontFamily: "var(--f-sans)",
          fontWeight: 500,
          border: "1px solid var(--line-soft)",
          borderRadius: 8,
          background: "var(--surface-low)",
          color: isEmpty ? "var(--ink-ghost)" : "var(--ember)",
          cursor: "pointer",
          ...triggerStyle,
        }}
      >
        <svg
          aria-hidden="true"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.7 }}
        >
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display}
        </span>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          autoFocus
          disabled={fromDate ? { before: fromDate } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
