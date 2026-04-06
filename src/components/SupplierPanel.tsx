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
      <p>
        No suppliers yet — add entries tagged "supplier".
      </p>
    );

  return (
    <div>
      <p>
        {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
      </p>
      <div>
        {suppliers.map((s) => {
          const phone = extractPhone(s);
          const cfg = TC[s.type] || TC.note;
          const price = s.metadata?.price
            ? `${s.metadata.price}${s.metadata.unit ? " " + s.metadata.unit : ""}`
            : null;
          return (
            <div key={s.id}>
              <div onClick={() => onSelect(s)}>
                <div>
                  <span>{cfg.i}</span>
                  <span>{s.title}</span>
                  {price && (
                    <span>{price}</span>
                  )}
                </div>
                <p>{s.content}</p>
              </div>
              <div>
                {phone && (
                  <a href={`tel:${phone}`}>
                    📞 Call
                  </a>
                )}
                {phone && (
                  <a href={toWaUrl(phone)} target="_blank" rel="noreferrer">
                    💬 WhatsApp
                  </a>
                )}
                <button onClick={() => onReorder(s)}>
                  🔁 Reorder
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {withPrice.length > 0 && (
        <div>
          <p>Cost Summary</p>
          {withPrice.map((s) => (
            <div key={s.id}>
              <span>{s.title}</span>
              <span>
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
