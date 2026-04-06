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

  if (suppliers.length === 0)
    return (
      <p className="text-sm text-center py-8" style={{ color: "#777" }}>
        No suppliers yet — add entries tagged "supplier".
      </p>
    );

  return (
    <div className="px-4 py-4 space-y-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <p className="text-sm font-semibold text-white">
        {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-3">
        {suppliers.map((s) => {
          const phone = extractPhone(s);
          const cfg = TC[s.type] || TC.note;
          const price = s.metadata?.price
            ? `${s.metadata.price}${s.metadata.unit ? " " + s.metadata.unit : ""}`
            : null;
          return (
            <div
              key={s.id}
              className="rounded-2xl border overflow-hidden"
              style={{ background: "rgba(38,38,38,0.6)", borderColor: "rgba(72,72,71,0.2)" }}
            >
              <div
                onClick={() => onSelect(s)}
                className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{cfg.i}</span>
                  <span className="text-sm font-medium text-white truncate">{s.title}</span>
                  {price && (
                    <span
                      className="ml-auto text-xs font-semibold rounded-full px-2 py-0.5"
                      style={{ color: "#72eff5", background: "rgba(114,239,245,0.1)" }}
                    >
                      {price}
                    </span>
                  )}
                </div>
                <p className="text-xs line-clamp-2" style={{ color: "#aaa" }}>{s.content}</p>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 border-t"
                style={{ borderColor: "rgba(72,72,71,0.2)" }}
              >
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="text-xs rounded-xl px-3 py-1 border transition-colors hover:bg-white/5"
                    style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
                  >
                    📞 Call
                  </a>
                )}
                {phone && (
                  <a
                    href={toWaUrl(phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs rounded-xl px-3 py-1 border transition-colors hover:bg-white/5"
                    style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
                  >
                    💬 WhatsApp
                  </a>
                )}
                <button
                  onClick={() => onReorder(s)}
                  className="text-xs rounded-xl px-3 py-1 border transition-colors hover:bg-white/5"
                  style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
                >
                  🔁 Reorder
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {withPrice.length > 0 && (
        <div
          className="rounded-2xl border p-3 space-y-2"
          style={{ background: "rgba(38,38,38,0.6)", borderColor: "rgba(72,72,71,0.2)" }}
        >
          <p className="text-xs font-semibold text-white">Cost Summary</p>
          {withPrice.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span style={{ color: "#aaa" }}>{s.title}</span>
              <span style={{ color: "#72eff5" }}>
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
