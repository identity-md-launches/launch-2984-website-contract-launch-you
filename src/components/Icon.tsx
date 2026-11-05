export type IconName =
  | "arrow"
  | "close"
  | "volume"
  | "muted"
  | "check"
  | "run"
  | "rest"
  | "book"
  | "spark"
  | "external"
  | "refresh"
  | "download"
  | "help"
  | "wheel"
  | "trophy"
  | "chevron";
const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4Z" />
      <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4Z" />
      <path d="m16 9 6 6m0-6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  run: (
    <>
      <path d="m13 2-3 8H5l7 12 2-9h5L13 2Z" />
    </>
  ),
  rest: (
    <>
      <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
    </>
  ),
  book: (
    <>
      <path d="M3 4h7a3 3 0 0 1 2 1 3 3 0 0 1 2-1h7v15h-7a3 3 0 0 0-2 1 3 3 0 0 0-2-1H3V4Zm9 1v15" />
    </>
  ),
  spark: (
    <path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z" />
  ),
  external: (
    <>
      <path d="M14 3h7v7M21 3 10 14" />
      <path d="M10 4H4v16h16v-6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7A9 9 0 1 0 21 14M20 2v6h-6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v7m0 4v7M3 12h7m4 0h7M5.6 5.6l5 5m2.8 2.8 5 5m0-12.8-5 5m-2.8 2.8-5 5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v6m-4 0h8" />
    </>
  ),
  chevron: <path d="m8 4 8 8-8 8" />,
};
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
