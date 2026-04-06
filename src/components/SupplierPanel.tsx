import { useMemo, type JSX } from "react";
import { TC } from "../data/constants";
import { extractPhone, toWaUrl } from "../lib/phone";
import type { Entry } from "../types";

interface SupplierPanelProps {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
  onReorder: (entry: Entry) => void;
}

export default function SupplierPanel({
  entries,
  onSelect,
  onReorder,
}: SupplierPanelProps): JSX.Element | null {
  const suppliers = useMemo(
    () =>
      entries.filter((e) => e.tags?.includes("supplier") || e.metadata?.category === "supplier"),
    [entries],
  );
  const withPrice = suppliers.filter((s) => s.metadata?.price);

  const abtnClass =
    "py-[5px] px-3 rounded-[20px] text-[11px] font-semibold cursor-pointer no-underline inline-flex items-center gap-1";

  if (suppliers.length === 0)
    return (
      <p className="text-ob-text-dim mt-10 text-center text-sm">
        No suppliers yet — add entries tagged "supplier".
      </p>
    );

  return (
    <div>
      <p className="text-ob-text-muted m-0 mb-4 text-xs">
        {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-3">
        {suppliers.map((s) => {
          const phone = extractPhone(s);
          const cfg = TC[s.type] || TC.note;
          const price = s.metadata?.price
            ? `${s.metadata.price}${s.metadata.unit ? " " + s.metadata.unit : ""}`
            : null;
          return (
            <div key={s.id} className="bg-ob-surface border-ob-border rounded-xl border px-5 py-4">
              <div onClick={() => onSelect(s)} className="mb-3 cursor-pointer">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-lg">{cfg.i}</span>
                  <span className="text-ob-text text-[15px] font-semibold">{s.title}</span>
                  {price && (
                    <span className="text-ob-accent bg-ob-accent/[0.08] rounded-[20px] px-2 py-0.5 text-[11px]">
                      {price}
                    </span>
                  )}
                </div>
                <p className="text-ob-text-muted m-0 text-xs leading-snug">{s.content}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className={`${abtnClass} text-ob-accent border-ob-accent/25 bg-ob-accent/[0.08] border`}
                  >
                    📞 Call
                  </a>
                )}
                {phone && (
                  <a
                    href={toWaUrl(phone)}
                    target="_blank"
                    rel="noreferrer"
                    className={`${abtnClass} text-whisper border-whisper/25 bg-whisper/[0.08] border`}
                  >
                    💬 WhatsApp
                  </a>
                )}
                <button
                  onClick={() => onReorder(s)}
                  className={`${abtnClass} text-orange border-orange/25 bg-orange/[0.08] border`}
                >
                  🔁 Reorder
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {withPrice.length > 0 && (
        <div className="bg-ob-surface border-ob-border mt-7 rounded-xl border px-5 py-4">
          <p className="text-ob-text-muted m-0 mb-3 text-xs font-bold tracking-[1px] uppercase">
            Cost Summary
          </p>
          {withPrice.map((s) => (
            <div
              key={s.id}
              className="border-ob-border/20 flex justify-between border-b py-1.5 text-[13px]"
            >
              <span className="text-ob-text-soft">{s.title}</span>
              <span className="text-ob-accent font-semibold">
                {s.metadata!.price}
                {s.metadata!.unit ? " " + s.metadata!.unit : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
