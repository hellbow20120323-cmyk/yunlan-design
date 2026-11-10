/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, ShieldAlert, FileCheck, Keyboard } from 'lucide-react';
import { PageShell, yunlanCardClass } from './PageShell';

const codeBlock = 'p-2.5 rounded-lg bg-[#f3f0ea] border border-yunlan-hairline';

export const UsageGuide: React.FC = () => {
  return (
    <PageShell
      maxWidth="4xl"
      title="使用指南与高级检索技巧"
      subtitle="掌握高效搜索指令，更快找到高质量原盘、工具与完整教程"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Card 1: Advanced Search Syntax */}
        <div className={`${yunlanCardClass()} p-6 space-y-3`}>
          <div className="flex items-center gap-2 text-[#9a7b4f] font-semibold text-sm">
            <Search className="w-4 h-4" />
            <span>智能搜索语法技巧</span>
          </div>
          <p className="text-xs text-yunlan-muted font-light leading-relaxed">
            支持高级指令组合，直接在搜索框内输入以下语法进行精准定位：
          </p>
          <div className="space-y-2 text-xs font-mono">
            <div className={codeBlock}>
              <span className="text-[#9a7b4f] font-semibold">流浪地球 4K HDR</span>
              <span className="text-slate-500 font-sans block text-xs mt-0.5">多关键词空格隔开，自动取交集</span>
            </div>
            <div className={codeBlock}>
              <span className="text-[#9a7b4f] font-semibold">Python 教程 -广告</span>
              <span className="text-slate-500 font-sans block text-xs mt-0.5">减号代表排除包含特定干扰词的资源</span>
            </div>
            <div className={codeBlock}>
              <span className="text-[#9a7b4f] font-semibold">考研数学 ext:pdf</span>
              <span className="text-slate-500 font-sans block text-xs mt-0.5">限制目标格式只看 PDF 文档或 MKV 视频</span>
            </div>
          </div>
        </div>

        {/* Card 2: Keyboard shortcuts */}
        <div className={`${yunlanCardClass()} p-6 space-y-3`}>
          <div className="flex items-center gap-2 text-[#9a7b4f] font-semibold text-sm">
            <Keyboard className="w-4 h-4" />
            <span>高效快捷键操作</span>
          </div>
          <p className="text-xs text-yunlan-muted font-light leading-relaxed">
            桌面端可用键盘导航；手机端请用底部「发现 / 网盘 / 榜单 / 指南」切换页面。
          </p>
          <div className="space-y-2 text-xs">
            <div className={`flex items-center justify-between p-2 ${codeBlock}`}>
              <span className="text-[#5c564e]">聚焦搜索框</span>
              <kbd className="px-2 py-0.5 font-mono text-xs bg-[#fffcf8] border border-yunlan-hairline rounded shadow-xs">
                / 或 Ctrl+K
              </kbd>
            </div>
            <div className={`flex items-center justify-between p-2 ${codeBlock}`}>
              <span className="text-[#5c564e]">提交搜索 / 执行检索</span>
              <kbd className="px-2 py-0.5 font-mono text-xs bg-[#fffcf8] border border-yunlan-hairline rounded shadow-xs">
                Enter
              </kbd>
            </div>
            <div className={`flex items-center justify-between p-2 ${codeBlock}`}>
              <span className="text-[#5c564e]">关闭详情弹窗 / 清空搜索历史</span>
              <kbd className="px-2 py-0.5 font-mono text-xs bg-[#fffcf8] border border-yunlan-hairline rounded shadow-xs">
                Esc
              </kbd>
            </div>
          </div>
        </div>

        {/* Card 3: Link Health Checking */}
        <div className={`${yunlanCardClass()} p-6 space-y-3`}>
          <div className="flex items-center gap-2 text-[#8a9a6e] font-semibold text-sm">
            <FileCheck className="w-4 h-4" />
            <span>链接有效性自动校验</span>
          </div>
          <p className="text-xs text-yunlan-muted font-light leading-relaxed">
            系统会定期对收录的公开分享链接执行轻量级心跳探针，过滤掉已被原作者取消或官方清理的失效资源。若在浏览过程中遇到失效链接，可随时点击卡片详情中的「报错失效链接」，系统将优先复核并自动剔除。
          </p>
        </div>

        {/* Card 4: Disclaimer & Compliance */}
        <div className={`${yunlanCardClass()} p-6 space-y-3`}>
          <div className="flex items-center gap-2 text-[#b8956b] font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>合规声明与免责须知</span>
          </div>
          <p className="text-xs text-yunlan-muted font-light leading-relaxed">
            本站仅为面向网络公开分享链接的非盈利性索引引擎，本身不存储、不上传、不断点续传任何实际文件内容。所有展示结果均直接跳转至各第三方云盘官网。如发现任何侵犯您合法权益的链接，欢迎联系处理。
          </p>
        </div>

      </div>
    </PageShell>
  );
};
