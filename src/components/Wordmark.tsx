/**
 * Gradient-text wordmark — the same technique Lucy uses, so no logo art is
 * needed. The left padding compensates for the trailing letter-space that
 * tracking adds after the final character, keeping the word optically centred.
 */
export function Wordmark({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const scale =
    size === "lg"
      ? "text-3xl tracking-[0.3em] pl-[0.3em]"
      : "text-lg tracking-[0.3em] pl-[0.3em]";

  return (
    <span
      className={`font-sans font-medium uppercase text-transparent bg-clip-text bg-gradient-to-b from-[var(--grad-1)] via-[var(--grad-2)] to-[var(--grad-3)] ${scale} ${className}`}
    >
      Gunderhouse
    </span>
  );
}
