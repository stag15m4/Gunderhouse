/**
 * Outline icons only — no filled sets. 24×24 viewBox, round caps and joins,
 * stroke weight 1.75, coloured by the surrounding text colour.
 */
type IconProps = {
  className?: string;
  strokeWidth?: number;
};

function Svg({
  className = "h-5 w-5",
  strokeWidth = 1.75,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </Svg>
  );
}

export function IconForecast(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 15l4-4 3 3 5-6" />
      <path d="M19 8v3.5M19 8h-3.5" />
    </Svg>
  );
}

export function IconHousehold(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 11.5a3 3 0 0 0 0-6" />
      <path d="M18 20a6 6 0 0 0-2.5-4.9" />
    </Svg>
  );
}

export function IconAccount(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function IconWrench(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 3.5a5 5 0 0 0-6.1 6.9L3.7 16.1a2 2 0 1 0 2.8 2.8l5.7-5.7a5 5 0 0 0 6.9-6.1l-3 3-2.6-.7-.7-2.6z" />
    </Svg>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
      <path d="M14 3v4.5h4.5" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 8.5v4.5" />
      <path d="M12 16.5h.01" />
      <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.75" />
    </Svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 6v12M14.5 6v12" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 5 8 12l6.5 7" />
    </Svg>
  );
}

export function IconSignOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 7.5V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5v-2" />
      <path d="M10 12h10m0 0-3-3m3 3-3 3" />
    </Svg>
  );
}
