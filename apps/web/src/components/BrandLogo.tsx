/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/** 自行车与家酿图标：暖色圆角方标 + 自行车线稿 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-8 h-8',
  alt = '自行车与家酿',
}) => {
  return (
    <span
      role="img"
      aria-label={alt}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8DEC8] bg-gradient-to-br from-[#FAF0E4] to-[#F5EFE6] text-[#C86D28] shadow-yunlan-card ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-[62%] h-[62%]"
        aria-hidden="true"
      >
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L8.5 7H5" />
        <path d="M12 17.5V14l3.5-3 3.5 6.5" />
        <path d="m17 7-4.5 4" />
      </svg>
    </span>
  );
};
