import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const Mic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);
export const Wave = (p: P) => (
  <Svg {...p}>
    <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
  </Svg>
);
export const ArrowUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p} size={p.size ?? 16}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const SidebarIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9.5 4v16" />
  </Svg>
);
export const NewChat = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20z" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);
export const Lock = (p: P) => (
  <Svg {...p} size={p.size ?? 14}>
    <rect x="5" y="10" width="14" height="10" rx="2.5" />
    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
  </Svg>
);
export const Copy = (p: P) => (
  <Svg {...p} size={p.size ?? 16}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Svg>
);
export const ThumbUp = (p: P) => (
  <Svg {...p} size={p.size ?? 16}>
    <path d="M7 21V10l4.5-7a2 2 0 0 1 2.9 2.4L13 10h4.7a2.4 2.4 0 0 1 2.3 3l-1.6 6a2.4 2.4 0 0 1-2.3 2H7z" />
  </Svg>
);
export const ThumbDown = (p: P) => (
  <Svg {...p} size={p.size ?? 16} style={{ transform: 'rotate(180deg)' }}>
    <path d="M7 21V10l4.5-7a2 2 0 0 1 2.9 2.4L13 10h4.7a2.4 2.4 0 0 1 2.3 3l-1.6 6a2.4 2.4 0 0 1-2.3 2H7z" />
  </Svg>
);
export const Share = (p: P) => (
  <Svg {...p} size={p.size ?? 16}>
    <path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </Svg>
);
export const Gear = (p: P) => (
  <Svg {...p} size={p.size ?? 17}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2L5.6 5.6" />
  </Svg>
);
export const Close = (p: P) => (
  <Svg {...p} size={p.size ?? 17}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const Help = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.7 9.4a2.4 2.4 0 1 1 3.1 2.5c-.5.2-.8.7-.8 1.3v.4M12 16.6v.4" />
  </Svg>
);

/** Tiny glyphs for control chips and contextual prompt categories. */
export const KindIcon = ({ kind, size = 13 }: { kind: string; size?: number }) => {
  switch (kind) {
    case 'local':
      return (
        <Svg size={size}>
          <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </Svg>
      );
    case 'make':
      return (
        <Svg size={size}>
          <path d="M5 4v7a3 3 0 0 0 6 0V4M8 11v9M19 4l-2 6h4l-2 10" />
        </Svg>
      );
    case 'plan':
      return (
        <Svg size={size}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </Svg>
      );
    case 'learn':
      return (
        <Svg size={size}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v14H6.5A2.5 2.5 0 0 0 4 20.5z" />
          <path d="M19 18v2H6.5" />
        </Svg>
      );
    case 'write':
      return (
        <Svg size={size}>
          <path d="M4 20h4L19 9a2.6 2.6 0 0 0-3.7-3.7L4 16.4V20z" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 15.9 6.8 19l1.4-5.9-4.6-4 6-.5z" />
        </Svg>
      );
  }
};
