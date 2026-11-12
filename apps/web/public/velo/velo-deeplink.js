/**
 * /velo 深链支持：让 /velo#view-color-studio 这类链接可以直接打开对应工具。
 * 原站是单文件内联脚本，navigateTo/switchTab 均为全局函数，这里只做包装，不改动原有逻辑。
 */
(function () {
  var PREFIX = '#view-';

  function readHash() {
    var raw = window.location.hash || '';
    if (raw.indexOf(PREFIX) !== 0) return '';
    return raw.slice(PREFIX.length);
  }

  function applyHash() {
    var id = readHash();
    if (!id) return;
    if (!document.getElementById('view-' + id)) return;
    if (typeof window.navigateTo === 'function') window.navigateTo(id);
  }

  function wrapNavigate() {
    if (typeof window.navigateTo !== 'function' || window.navigateTo.__veloWrapped) return;
    var original = window.navigateTo;
    window.navigateTo = function (id) {
      var result = original.apply(this, arguments);
      try {
        var clean = String(id || '').replace(/^view-/, '');
        if (clean) window.history.replaceState(null, '', PREFIX + clean);
      } catch (err) {
        /* replaceState 失败不影响工具切换 */
      }
      return result;
    };
    window.navigateTo.__veloWrapped = true;
  }

  function boot() {
    wrapNavigate();
    applyHash();
  }

  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('hashchange', applyHash);
})();
