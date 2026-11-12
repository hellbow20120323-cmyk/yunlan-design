/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ALL_PROVIDER_IDS, DISK_PROVIDERS } from '../constants/providers';
import { BrandLogo } from './BrandLogo';

type FooterTab = 'search' | 'providers' | 'rankings' | 'guide' | 'tools';

interface FooterProps {
  onNavigateToTab: (tab: FooterTab) => void;
  /** 搜索入口开关：关闭时页脚只展示合规工具入口 */
  searchEnabled?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateToTab, searchEnabled = true }) => {
  return (
    <footer className="w-full border-t border-yunlan-hairline bg-yunlan-paper/80 text-xs text-yunlan-muted mt-12 sm:mt-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Main Footer Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-yunlan-hairline">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <BrandLogo className="w-8 h-8" />
              <span className="font-semibold text-[#3d3832] text-sm">云览 Yunlan</span>
              <span className="text-xs text-[#a88858]">
                {searchEnabled ? '· 专业多网盘聚合资源搜索' : '· 免费在线工具'}
              </span>
            </div>
            <p className="text-xs text-yunlan-muted max-w-lg leading-relaxed font-light">
              {searchEnabled
                ? '本站仅提供公开云盘分享链接的第三方索引与转存跳转服务，不直接存储、上传或修改任何文件。'
                : '本站提供免费的在线文本处理、格式转换与公开资料检索工具，所有工具均在浏览器本地运行，不上传文件、无需注册。'}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-6 flex-wrap text-xs">
            {searchEnabled && (
              <button
                onClick={() => onNavigateToTab('search')}
                className="hover:text-[#9a7b4f] transition-colors"
              >
                发现资源
              </button>
            )}
            <button
              onClick={() => onNavigateToTab('tools')}
              className="hover:text-[#9a7b4f] transition-colors"
            >
              在线工具
            </button>
            {searchEnabled && (
              <button
                onClick={() => onNavigateToTab('providers')}
                className="hover:text-[#9a7b4f] transition-colors"
              >
                网盘导航
              </button>
            )}
            {searchEnabled && (
              <button
                onClick={() => onNavigateToTab('rankings')}
                className="hover:text-[#9a7b4f] transition-colors"
              >
                全网风云榜
              </button>
            )}
            <button
              onClick={() => onNavigateToTab('guide')}
              className="hover:text-[#9a7b4f] transition-colors"
            >
              使用指南
            </button>
            <a
              href="/support"
              className="hover:text-[#9a7b4f] transition-colors"
            >
              支持与申请
            </a>
          </div>
        </div>

        {/* Supported providers quick links */}
        <div className="py-4 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-400">
          {searchEnabled ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span>支持网盘：</span>
              {ALL_PROVIDER_IDS.map((id) => (
                <a
                  key={id}
                  href={DISK_PROVIDERS[id].officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {DISK_PROVIDERS[id].name}
                </a>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span>合规说明：</span>
              <span>工具不收集输入内容，不提供文件存储与下载服务。</span>
            </div>
          )}

          <div>
            <span>
              © {new Date().getFullYear()} 云览 YUNLAN ·{' '}
              {searchEnabled ? '跨平台多网盘聚合引擎' : '免费在线工具站'}
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
