/**
 * Icons, matching Alfred's vocabulary.
 *
 * Every shape is the Heroicons **outline 24×24** path, unmodified, so the two
 * apps draw from the same family rather than drifting into look-alikes. The
 * Heroicons name each one came from is noted beside it.
 *
 * House rules, applied uniformly here rather than per call site:
 *   viewBox 24×24, fill none, stroke currentColor
 *   strokeWidth 1.75 everywhere — one weight across the whole app
 *   round caps and joins
 *   w-5 h-5 by default; colour inherited from the surrounding text
 */
type IconProps = {
  className?: string;
};

function Svg({
  className = "h-5 w-5",
  d,
}: IconProps & { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** Heroicons outline: home */
export function IconHome(props: IconProps) {
  return (
    <Svg
      {...props}
      d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  );
}

/** Heroicons outline: presentation-chart-line */
export function IconForecast(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
    />
  );
}

/** Heroicons outline: users */
export function IconHousehold(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
    />
  );
}

/** Heroicons outline: user */
export function IconAccount(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  );
}

/** Heroicons outline: wrench-screwdriver */
export function IconWrench(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
    />
  );
}

/** Heroicons outline: document-text */
export function IconDocument(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
    />
  );
}

/**
 * Heroicons outline: check — the plain tick, not check-circle. These sit inside
 * the circular status lamp, and a ringed glyph there reads as a circle drawn
 * inside a circle.
 */
export function IconCheck(props: IconProps) {
  return (
    <Svg
      {...props}
      d="m4.5 12.75 6 6 9-13.5"
    />
  );
}

/** Heroicons outline: exclamation-triangle */
export function IconAlert(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
    />
  );
}

/** Heroicons outline: clock */
export function IconClock(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  );
}

/** Heroicons outline: pause */
export function IconPause(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M15.75 5.25v13.5m-7.5-13.5v13.5"
    />
  );
}

/** Heroicons outline: chevron-left */
export function IconChevronLeft(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M15.75 19.5 8.25 12l7.5-7.5"
    />
  );
}

/** Heroicons outline: arrow-right-on-rectangle */
export function IconSignOut(props: IconProps) {
  return (
    <Svg
      {...props}
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
    />
  );
}
