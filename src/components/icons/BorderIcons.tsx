// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
//
// Custom border icons — lucide-react (v1.30) does not ship border-specific
// icons, so we provide thin-stroke SVG components that match the lucide style.

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Grid/table icon — used as a generic "all borders" fallback. */
export function BorderAll(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

/** Outside-border only icon. */
export function BorderOutside(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

/** Top border icon. */
export function BorderTop(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="3" x2="21" y2="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="3" x2="3" y2="21" />
      <line x1="21" y1="3" x2="21" y2="21" />
    </svg>
  );
}

/** Bottom border icon. */
export function BorderBottom(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="3" x2="21" y2="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="3" y1="21" x2="21" y2="21" strokeWidth="3" />
      <line x1="3" y1="3" x2="3" y2="21" />
      <line x1="21" y1="3" x2="21" y2="21" />
    </svg>
  );
}

/** Left border icon. */
export function BorderLeft(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="3" x2="21" y2="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="3" x2="3" y2="21" strokeWidth="3" />
      <line x1="21" y1="3" x2="21" y2="21" />
    </svg>
  );
}

/** Right border icon. */
export function BorderRight(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="3" x2="21" y2="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="3" x2="3" y2="21" />
      <line x1="21" y1="3" x2="21" y2="21" strokeWidth="3" />
    </svg>
  );
}
