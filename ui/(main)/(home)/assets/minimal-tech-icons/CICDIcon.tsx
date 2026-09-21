import type { SVGProps } from "react";

export function CICDIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >

      <path
        d="M3.7 6.8C7.6 2.9 14.1 2.9 18.4 6.7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <polyline
        points="17.6,3.8 19.2,7.7 15.1,7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="9.2"
        y1="12"
        x2="13.7"
        y2="12"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <circle
        cx="7.1"
        cy="12"
        r="2.45"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.15}
      />
      <circle
        cx="15.8"
        cy="12"
        r="2.45"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.15}
      />
      <path
        d="M19.3 17C15.3 21 8.9 21.2 4.5 17.3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <polyline
        points="8.3,17.2 4.2,16.6 4.5,20.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
