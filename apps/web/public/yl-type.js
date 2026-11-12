/**
 * 字体异步加载：不阻塞首屏渲染。
 * Google Fonts 的样式表在部分网络环境下很慢甚至不可达，写成 <link rel="stylesheet">
 * 会让首屏一直等到超时；这里改为脚本注入，页面先用系统字体渲染，字体到了再平滑替换（display=swap）。
 * 放在外部文件而非内联，是为了满足 CSP 禁止内联脚本的策略。
 */
(function () {
  var href =
    'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300..800&family=JetBrains+Mono:wght@400;500;600&display=swap';
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
})();
