import { useHomePersona } from "../../hooks/useHomePersona";

interface GreetingHeroProps {
  /** Total entries captured this week. */
  thisWeekCount: number;
  /** Total entries in the brain. */
  totalCount: number;
  /** Brain name for the fallback greeting line. */
  brainName?: string;
}

function timeOfDayWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function GreetingHero({ thisWeekCount, totalCount, brainName }: GreetingHeroProps) {
  const persona = useHomePersona();
  const greeting = persona.name
    ? `${timeOfDayWord()}, ${persona.name}.`
    : brainName
      ? `welcome to ${brainName}.`
      : "welcome.";

  // Render the digest line only once persona resolves to keep the layout
  // from popping. While loading we still show the greeting fallback.
  const digest =
    totalCount === 0
      ? "your brain is empty — type something below to start."
      : thisWeekCount === 0
        ? `${totalCount} thoughts in your brain. nothing new this week.`
        : `${thisWeekCount} new this week · ${totalCount} total in your brain.`;

  return (
    <header style={{ marginBottom: 24 }}>
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
        {digest}
      </p>
    </header>
  );
}
