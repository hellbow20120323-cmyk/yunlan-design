/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/** 云览图标：原图四周留白较多，略放大以填满圆角方标 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-8 h-8',
  alt = '云览',
}) => {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-[22%] bg-yunlan-surface shadow-yunlan-card ${className}`}
    >
      <img
        src="/logo.png"
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover scale-[1.52]"
        draggable={false}
      />
    </span>
  );
};
