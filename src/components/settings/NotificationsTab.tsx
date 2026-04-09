import NotificationSettings from "../NotificationSettings";

export default function NotificationsTab() {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--color-surface-container-high)",
        borderColor: "var(--color-outline-variant)",
      }}
    >
      <NotificationSettings />
    </div>
  );
}
