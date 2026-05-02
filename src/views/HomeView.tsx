import FirstRunChecklist from "../components/FirstRunChecklist";

interface HomeViewProps {
  entryCount: number;
  brainCount: number;
  brainName?: string;
  onNavigate: (view: string) => void;
  onOpenCapture: () => void;
  onCreateBrain: () => void;
}

export default function HomeView({
  entryCount,
  brainCount,
  brainName,
  onNavigate,
  onOpenCapture,
  onCreateBrain,
}: HomeViewProps) {
  const greeting = brainName ? `welcome to ${brainName}.` : "welcome.";

  return (
    <div
      className="mx-auto w-full"
      style={{
        maxWidth: 720,
        padding: "32px 20px 80px",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <h1
          className="f-serif"
          style={{
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {greeting}
        </h1>
        <p
          className="f-serif"
          style={{
            fontSize: 16,
            fontStyle: "italic",
            color: "var(--ink-soft)",
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}
        >
          the more your brain knows, the more it remembers for you.
        </p>
      </header>

      <FirstRunChecklist
        entryCount={entryCount}
        brainCount={brainCount}
        onNavigate={onNavigate}
        onOpenCapture={onOpenCapture}
        onCreateBrain={onCreateBrain}
      />
    </div>
  );
}
