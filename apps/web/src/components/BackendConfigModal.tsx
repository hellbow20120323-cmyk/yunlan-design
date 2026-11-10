/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Server, Check, ArrowRight, Code, Shield, HelpCircle } from 'lucide-react';
import { BackendApiConfig } from '../types';
import { SearchService } from '../services/searchService';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
  onShowToast: (msg: string) => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const [config, setConfig] = useState<BackendApiConfig>(SearchService.getConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    setConfig(SearchService.getConfig());
  }, [isOpen]);

  const handleSave = () => {
    SearchService.saveConfig(config);
    onConfigSaved();
    onShowToast('后端接口配置已保存！');
    onClose();
  };

  const handleTestConnection = async () => {
    if (!config.endpointUrl) {
      setTestResult({ success: false, msg: '请输入后端 API 请求地址' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const isGateway = /\/api\/search/i.test(config.endpointUrl);
      if (isGateway) {
        const healthResp = await fetch('/api/health');
        const health = healthResp.ok ? await healthResp.json() : null;
        const searchUrl = `${config.endpointUrl.replace(/\?.*$/, '')}?kw=${encodeURIComponent('测试')}`;
        const searchResp = await fetch(searchUrl, { method: 'GET' });
        const searchOk = searchResp.ok;
        if (healthResp.ok && searchOk) {
          const label = health?.modeLabel ? ` · ${health.modeLabel}` : '';
          setTestResult({
            success: true,
            msg: `云览网关就绪 (health + search)${label}`,
          });
        } else {
          setTestResult({
            success: false,
            msg: `云览网关检测失败：health=${healthResp.status} search=${searchResp.status}`,
          });
        }
        return;
      }

      const resp = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          query: 'test',
          providers: ['quark', 'aliyun'],
          category: 'all',
          sortBy: 'relevance',
          page: 1,
          pageSize: 2,
        }),
      });

      if (resp.ok) {
        setTestResult({ success: true, msg: `连接成功 (HTTP ${resp.status})！接口响应正常。` });
      } else {
        setTestResult({ success: false, msg: `后端响应异常: HTTP ${resp.status} - ${resp.statusText}` });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '网络连接失败';
      setTestResult({ success: false, msg: `连接失败: ${errorMsg}。请检查服务是否启动或允许跨域。` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                后端接口对接与配置
              </h2>
              <p className="text-xs text-slate-500">
                支持开箱即用的前端高仿模拟引擎或无缝切换至您的真实后端服务
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 dark:text-slate-300">
          
          {/* Mode switch */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                  启用自定义后端 API (对接您的接口)
                </span>
                <span className="text-slate-500">
                  开启后搜索请求将发送至您指定的后端 API 地址，关闭则使用内置的高性能模拟引擎
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useCustomBackend}
                  onChange={(e) => setConfig({ ...config, useCustomBackend: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-600"></div>
              </label>
            </div>
          </div>

          {/* Form fields if custom backend enabled */}
          {config.useCustomBackend && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block font-medium text-slate-900 dark:text-white mb-1.5">
                  后端 API 接口地址 (URL)
                </label>
                <input
                  type="text"
                  value={config.endpointUrl}
                  onChange={(e) => setConfig({ ...config, endpointUrl: e.target.value })}
                  placeholder="https://api.yourdomain.com/v1/search 或 /api/search"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  支持绝对地址或同源相对地址（如本地代理路径 /api/search）
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-900 dark:text-white mb-1.5">
                    授权密钥 API Key (选填)
                  </label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="Bearer token (如有)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-900 dark:text-white mb-1.5">
                    超时时间 (毫秒)
                  </label>
                  <input
                    type="number"
                    value={config.timeoutMs}
                    onChange={(e) => setConfig({ ...config, timeoutMs: Number(e.target.value) || 8000 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Mock fallback option */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mockFallbackOnError}
                  onChange={(e) => setConfig({ ...config, mockFallbackOnError: e.target.checked })}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-slate-600 dark:text-slate-300">
                  当后端接口发生 500 错误或网络超时时，自动回退到模拟数据以保障界面可用性
                </span>
              </label>

              {/* Test connection button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
                >
                  {testing ? '正在测试连接...' : '测试接口连通性'}
                </button>

                {testResult && (
                  <span className={`text-xs ${testResult.success ? 'text-emerald-500' : 'text-red-500'}`}>
                    {testResult.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Interface Spec Accordion / Guide */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Code className="w-4 h-4 text-cyan-500" />
              <span>推荐后端数据契约 (API Contract)</span>
            </div>
            
            <p className="text-slate-500">
              您后续在提供后端接口（如 Python/FastAPI、Node.js/Express、Go、Java 等）时，只需返回符合以下标准 JSON 结构的响应即可完全驱动本套前端界面：
            </p>

            <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed">
{`// POST 请求体 Request Body:
{
  "query": "流浪地球2",
  "providers": ["quark", "aliyun", "baidu"],
  "category": "video",
  "sortBy": "relevance",
  "page": 1,
  "pageSize": 10
}

// 响应体 Response JSON:
{
  "items": [
    {
      "id": "item-001",
      "title": "资源标题",
      "description": "简要说明",
      "diskProvider": "quark", // quark | aliyun | baidu | xunlei | pan123 | tianyi | pan115 | uc | mobile | lanzou
      "category": "video",    // video | doc | software | music | game | archive
      "sizeFormatted": "45.0 GB",
      "sizeBytes": 48318382080,
      "updatedAt": "2026-03-28",
      "shareUrl": "https://pan.quark.cn/s/...",
      "extractCode": "8f7k",   // 若无提取码可传空字符串
      "isValid": true,
      "healthScore": 99,
      "totalFiles": 3,
      "fileTree": [
        { "name": "4K_Remux.mkv", "sizeFormatted": "43.0 GB", "extension": "mkv" }
      ],
      "tags": ["4K原盘", "杜比视界"]
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 10,
  "hasMore": true,
  "tookMs": 95
}`}
            </pre>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            配置保存在浏览器本地，清除缓存后恢复默认
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存配置</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
