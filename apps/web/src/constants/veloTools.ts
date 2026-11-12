/**
 * 完整静态工坊（/velo）中的进阶工具入口。
 * 这些工具仍由复制的静态页面承载，不加入 React 的 ToolSlug，避免类型与路由连锁改动。
 */
export interface VeloToolLink {
  name: string;
  desc: string;
  href: string;
  icon: string;
}

export const VELO_ONLY_TOOLS: VeloToolLink[] = [
  {
    name: '职业大环赛赛段推演',
    desc: '图尔马莱峰赛段物理推演与功率对比',
    href: '/velo#view-stage-sim',
    icon: '🏁',
  },
  {
    name: '自由车架涂装工坊',
    desc: '钢架管身、套管拼色与个性车标定制',
    href: '/velo#view-color-studio',
    icon: '🎨',
  },
  {
    name: '骑行体能与精酿补给',
    desc: '骑行消耗与精酿补给热量换算',
    href: '/velo#view-velo-recovery',
    icon: '🚴',
  },
  {
    name: 'BJCP 六维风味雷达',
    desc: '啤酒风味特征六维雷达罗盘',
    href: '/velo#view-brew-radar',
    icon: '🧭',
  },
  {
    name: '复古酒标与水牌工坊',
    desc: '自定义酒标、水牌与导出图样',
    href: '/velo#view-label-studio',
    icon: '🏷️',
  },
  {
    name: '正则表达式测试器',
    desc: '实时高亮、捕获分组与文本替换',
    href: '/velo#view-tool-regex',
    icon: '.*',
  },
  {
    name: '文本差异比对',
    desc: '逐行 / 逐字高亮文本差异',
    href: '/velo#view-tool-diff',
    icon: '↔',
  },
];

export const VELO_HOME = '/velo';
