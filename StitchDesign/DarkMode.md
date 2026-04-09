Based on the Warm & Luxurious Dark Mode design from the Onboarding Ivory screen, here is the curated color palette and the code snippet for your implementation.

The "Warm Luxury" Dark Palette
This palette focuses on depth and sophistication, using rich dark tones paired with illuminated warm accents to maintain a sense of trust and intelligence.

1. Core Brand Colors
Primary Accent (Muted Bronze): #967E5B
Usage: "Get Started" button, primary icons, and key interactive highlights.
Secondary Accent (Warm Taupe): #7D6E5D
Usage: Secondary icons and subtle decorative elements.
Luxury Highlight (Ivory Mist): #E5E0D8
Usage: Logos, headlines, and high-priority text.
2. Dark Mode Surface & Text Colors
Background (Deep Charcoal): #1A1816
Usage: Main screen background.
Surface/Cards (Dark Umber): #2A2724
Usage: Feature cards (Intelligent Search, Secure Organization) with soft outer glows.
Primary Text: #F2F1EE
Usage: Main headings and high-contrast body text.
Secondary Text: #A8A39D
Usage: Supporting descriptions and "Sign In" footer links.
Soft Glow/Shadow: rgba(150, 126, 91, 0.15)
Usage: Sub-glow around the feature cards to create tactile depth.
Claude Code Implementation Snippet
You can provide this block to Claude Code to set up your theme variables or styled-components:

/* Everion Warm Luxury Dark Mode Variables */
:root {
  /* Brand Accents */
  --brand-bronze: #967E5B;
  --brand-taupe: #7D6E5D;
  --brand-ivory: #E5E0D8;

  /* Surfaces & Backgrounds */
  --bg-dark-charcoal: #1A1816;
  --surface-dark-umber: #2A2724;
  
  /* Text & Typography */
  --text-primary-ivory: #F2F1EE;
  --text-secondary-muted: #A8A39D;
  
  /* Tactical Depth Effects */
  --shadow-warm-glow: 0 8px 32px rgba(150, 126, 91, 0.15);
  --border-subtle: 1px solid rgba(229, 224, 216, 0.05);
}

/* Example usage for the CTA Button */
.button-primary {
  background-color: var(--brand-bronze);
  color: var(--text-primary-ivory);
  border-radius: 100px;
  padding: 16px 32px;
  font-weight: 600;
  text-align: center;
}

/* Example usage for the Feature Cards */
.feature-card {
  background-color: var(--surface-dark-umber);
  border: var(--border-subtle);
  box-shadow: var(--shadow-warm-glow);
  border-radius: 24px;
  padding: 24px;
}