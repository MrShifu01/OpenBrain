/**
 * Everion logomark — three-node graph in warm bronze.
 *
 * Renders the canonical brand mark from /logoNew.webp. The image already
 * carries its own colour, so it stays brand-correct regardless of theme.
 */

interface EverionLogoProps {
  size?: number;
  className?: string;
}

export function EverionLogo({ size = 32, className }: EverionLogoProps) {
  return (
    <img
      src="/logoNew.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, objectFit: "contain", display: "block" }}
      decoding="async"
      loading="eager"
    />
  );
}
