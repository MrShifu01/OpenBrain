import { memo } from "react";
import { NavIcon } from "./icons/NavIcons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

interface MobileMoreMenuProps {
  isOpen: boolean;
  onNavigate: (id: string) => void;
}

const SIDEBAR_ITEMS = [
  { id: "grid", label: "Memory Grid", icon: NavIcon.grid },
  { id: "todos", label: "Schedule", icon: NavIcon.todos },
  { id: "vault", label: "Vault", icon: NavIcon.vault },
  { id: "settings", label: "Settings", icon: NavIcon.settings },
];

function MobileMoreMenuInner({ isOpen, onNavigate }: MobileMoreMenuProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onNavigate("close")}>
      <SheetContent
        side="right"
        className="w-72 border-l p-0 lg:hidden"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <SheetHeader
          className="border-b px-5 py-5"
          style={{ borderColor: "var(--color-outline-variant)" }}
        >
          <SheetTitle
            className="text-base font-semibold"
            style={{ color: "var(--color-on-surface)" }}
          >
            Menu
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="More navigation">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="press-scale flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              {item.icon}
              <span className="text-sm font-medium" style={{ color: "var(--color-on-surface)" }}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export default memo(MobileMoreMenuInner);
