/**
 * The Gunderhouse mark, cut from the supplied logo sheet.
 *
 * Both files are transparent PNGs — the artwork's glow is preserved as alpha
 * rather than baked onto a plate, so they sit on the app's ground with no
 * visible box behind them.
 *
 *   "lockup"  mark plus the wordmark, for sign-in and other full-page moments
 *   "mark"    the mark alone, for the top bar where the wordmark would be
 *             too small to read
 */
export function Wordmark({
  variant = "mark",
  className = "",
}: {
  variant?: "lockup" | "mark";
  className?: string;
}) {
  if (variant === "lockup") {
    return (
      <img
        src="/brand/lockup.webp"
        alt="Gunderhouse"
        width={700}
        height={631}
        className={`h-auto w-full max-w-[19rem] ${className}`}
      />
    );
  }

  return (
    <img
      src="/brand/mark.webp"
      alt="Gunderhouse"
      width={220}
      height={205}
      className={`h-9 w-auto ${className}`}
    />
  );
}
