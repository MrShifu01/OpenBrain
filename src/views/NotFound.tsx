import { useDocumentMeta } from "../hooks/useDocumentMeta";

export default function NotFound() {
  useDocumentMeta({
    title: "Not found — Everion",
    description: "The page you were looking for couldn't be found.",
  });
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--f-sans)",
        textAlign: "center",
      }}
    >
      <div className="micro" style={{ marginBottom: 18, color: "var(--ink-faint)" }}>
        404 · page not found
      </div>
      <h1
        className="f-serif"
        style={{
          fontSize: "clamp(40px, 7vw, 56px)",
          margin: 0,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
        }}
      >
        we couldn't find that.
      </h1>
      <p
        className="f-serif"
        style={{
          fontSize: 18,
          fontStyle: "italic",
          color: "var(--ink-soft)",
          marginTop: 18,
          marginBottom: 32,
          maxWidth: 460,
          lineHeight: 1.5,
        }}
      >
        the page may have moved, or the link is older than the room.
      </p>
      <a
        href="/"
        className="design-btn-primary press"
        style={{
          height: 44,
          minHeight: 44,
          padding: "0 24px",
          fontSize: 14,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        Go home
      </a>
    </div>
  );
}
