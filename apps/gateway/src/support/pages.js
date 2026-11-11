/**
 * 中转页 / 状态页 / 人工后台的 HTML 渲染。
 * 页面不内联脚本（CSP script-src 'self'），交互脚本由同源外链提供。
 */
import { escapeHtml } from "./mailer.js";
import { maskEmail } from "./codes.js";

/** 生产服务器为 UTC，页面时间统一按北京时间展示 */
const DISPLAY_TZ = "Asia/Shanghai";

function fmtTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { timeZone: DISPLAY_TZ, hour12: false });
}

const PAGE_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; background:#f7f7f6; color:#2a2826; font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif; line-height:1.65; }
  main { max-width:640px; margin:0 auto; padding:32px 18px 64px; }
  .card { background:#fff; border:1px solid #e4e1db; border-radius:14px; padding:24px; box-shadow:0 2px 10px rgba(42,40,38,.04); }
  h1 { font-size:20px; margin:0 0 6px; }
  h2 { font-size:16px; margin:22px 0 8px; }
  p { margin:0 0 12px; font-size:14px; color:#4b4844; }
  .meta { font-size:12px; color:#7a766f; }
  .notice { margin:16px 0; padding:12px 14px; background:#fafaf9; border:1px solid #e4e1db; border-radius:10px; font-size:13px; color:#4b4844; }
  .actions { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
  button, .btn { display:block; width:100%; min-height:46px; padding:11px 16px; border-radius:10px; border:1px solid #d1cdc6; background:#fff; color:#2a2826; font-size:14px; font-weight:600; cursor:pointer; text-align:center; text-decoration:none; }
  button.primary, .btn.primary { background:#1661ab; border-color:#1661ab; color:#fff; }
  button:disabled { opacity:.55; cursor:not-allowed; }
  .status { display:inline-block; padding:2px 9px; border-radius:999px; font-size:12px; font-weight:600; }
  .pending { background:#fdf3df; color:#7a561b; }
  .approved { background:#e6f3ec; color:#2f7d63; }
  .rejected { background:#fbe9ea; color:#a83d45; }
  .qr { display:block; width:min(260px,100%); margin:14px auto; border-radius:10px; border:1px solid #e4e1db; }
  .code { font-family:ui-monospace,Menlo,monospace; letter-spacing:5px; font-size:26px; font-weight:700; }
  form.inline { margin:0; }
  input[type=text], input[type=email], textarea, select { width:100%; min-height:42px; padding:9px 11px; border:1px solid #d1cdc6; border-radius:8px; font-size:14px; background:#fff; color:#2a2826; }
  textarea { min-height:110px; resize:vertical; }
  label { display:block; font-size:12px; color:#7a766f; margin:12px 0 5px; }
  .row { display:flex; gap:10px; }
  .row > * { flex:1; }
  .msg { margin-top:10px; font-size:12px; color:#1661ab; min-height:18px; }
  .msg.err { color:#a83d45; }
  .footer { margin-top:20px; font-size:12px; color:#7a766f; text-align:center; }
  .admin-shell { max-width:1180px; }
  .admin-grid { display:grid; grid-template-columns: 1fr; gap:16px; }
  @media (min-width: 900px) { .admin-grid { grid-template-columns: 1.1fr .9fr; } }
  .list { display:flex; flex-direction:column; gap:8px; }
  .item { border:1px solid #e4e1db; border-radius:10px; padding:10px 12px; background:#fff; cursor:pointer; }
  .item:hover { border-color:#1661ab; }
  .item .line { display:flex; justify-content:space-between; gap:10px; font-size:13px; }
  .item small { color:#7a766f; font-size:11px; }
  .toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px; }
  .toolbar button { width:auto; min-height:36px; padding:6px 12px; font-size:12px; }
  .hidden { display:none !important; }
  .detail { border:1px solid #e4e1db; border-radius:10px; padding:14px; background:#fafaf9; }
  .kv { font-size:12px; color:#4b4844; word-break:break-all; margin:3px 0; }
  .tag { display:inline-block; padding:1px 7px; border-radius:999px; background:#efede9; font-size:11px; color:#4b4844; margin-left:6px; }
  .thumb { max-width:100%; border-radius:8px; border:1px solid #e4e1db; margin-top:8px; }
`;

function layout({ title, body, script = "", admin = false }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${escapeHtml(title)}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
<main class="${admin ? "admin-shell" : ""}">
${body}
</main>
${script ? `<script src="${script}" defer></script>` : ""}
</body>
</html>`;
}

export function renderRelayPage({ token, app }) {
  return layout({
    title: "云览 · 申请中转页",
    body: `
<div class="card">
  <h1>云览 · 申请中转页</h1>
  <p class="meta">申请邮箱：${escapeHtml(maskEmail(app.email))} · 本链接仅可访问一次</p>
  <div class="notice">
    声明：自愿支持站点维护与审核结果、权限发放没有任何绑定，不强制支持。本站没有到账回调，也不会自动开通任何权限。
  </div>
  <p>请选择接下来的操作：</p>
  <div class="actions">
    <form class="inline" method="post" action="/relay/${escapeHtml(token)}/choice">
      <input type="hidden" name="choice" value="support">
      <button class="primary" type="submit">选项 A：自愿支持站点维护</button>
    </form>
    <form class="inline" method="post" action="/relay/${escapeHtml(token)}/choice">
      <input type="hidden" name="choice" value="skip">
      <button type="submit">选项 B：暂不支持，直接等待人工审核</button>
    </form>
  </div>
  <p style="margin-top:18px;font-size:12px;color:#7a766f;">只有选择 A 后的页面才会展示赞赏码；邮件、首页与表单页均不展示。审核结果完全由人工终审决定。</p>
</div>
<div class="footer">云览 Yunlan</div>`,
  });
}

export function renderResultPage({ app, choice, uploads = [], qrAvailable = false, qrRev = "" }) {
  const status = app.status;
  const statusText = status === "approved" ? "已通过" : status === "rejected" ? "未通过" : "待审核";
  const statusClass = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
  const uploadList = uploads.length
    ? `<p class="meta">已收到 ${uploads.length} 份凭证：${uploads
        .map((u) => `${fmtTime(u.createdAt)}${u.tradeNo ? ` · 单号 ${escapeHtml(u.tradeNo)}` : ""}`)
        .join("；")}</p>`
    : "";
  const qrBlock =
    choice === "support"
      ? `<h2>赞赏码</h2>
         ${
           qrAvailable
             ? `<img class="qr" src="/relay/qr${qrRev ? `?v=${encodeURIComponent(qrRev)}` : ""}" alt="赞赏码">`
             : `<p class="meta">赞赏码暂未配置，请联系站长。</p>`
         }
         <p class="meta">赞赏为完全自愿。本站不会自动识别到账，也不会因赞赏自动通过审核。</p>`
      : `<p class="notice">你已选择暂不支持，直接进入人工审核队列。无需进行任何转账操作。</p>`;

  const uploadBlock =
    choice === "support"
      ? `<h2>补充凭证（可选）</h2>
         <p class="meta">如你希望帮助核对，可上传账单截图或填写交易单号。凭证仅用于人工对账参考。</p>
         <form id="upload-form">
           <label for="tradeNo">交易单号</label>
           <input id="tradeNo" type="text" maxlength="64" placeholder="选填，例如微信转账单号">
           <label for="file">账单截图</label>
           <input id="file" type="file" accept="image/png,image/jpeg,image/webp">
           <div class="actions"><button class="primary" type="submit">提交凭证</button></div>
         </form>
         <div id="upload-msg" class="msg" role="status"></div>
         ${uploadList}`
      : "";

  return layout({
    title: "云览 · 申请状态",
    script: "/relay/app.js",
    body: `
<div class="card">
  <h1>云览 · 申请状态</h1>
  <p class="meta">申请邮箱：${escapeHtml(maskEmail(app.email))} · 提交时间：${escapeHtml(fmtTime(app.createdAt))}</p>
  <p>当前状态：<span class="status ${statusClass}">${statusText}</span></p>
  <div class="notice">自愿支持与审核结果、权限发放没有任何绑定。所有审核均由人工完成，系统不会自动放行。</div>
  ${qrBlock}
  ${uploadBlock}
  <p style="margin-top:18px;font-size:12px;color:#7a766f;">此页面可在 30 天内通过本机浏览器再次打开。若更换设备或清理了浏览器，请联系站长重新发送链接（链接仅可访问一次）。</p>
</div>
<div class="footer">云览 Yunlan</div>`,
  });
}

export function renderUsedPage() {
  return layout({
    title: "云览 · 链接已使用",
    body: `
<div class="card">
  <h1>该链接已被使用</h1>
  <p>一次性中转链接仅允许访问一次。若为本人操作，可打开申请状态页查看进度；如需重新获取链接，请联系站长。</p>
  <div class="actions"><a class="btn primary" href="/relay/status">查看申请状态</a></div>
</div>
<div class="footer">云览 Yunlan</div>`,
  });
}

export function renderExpiredPage() {
  return layout({
    title: "云览 · 链接已失效",
    body: `
<div class="card">
  <h1>链接已失效</h1>
  <p>该链接不存在、已过期或已被使用。一次性中转链接有效期为 24 小时，且仅可访问一次。</p>
  <div class="actions"><a class="btn" href="/support">重新提交申请</a></div>
</div>
<div class="footer">云览 Yunlan</div>`,
  });
}

export function renderMessagePage(title, message) {
  return layout({
    title: `云览 · ${title}`,
    body: `
<div class="card">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <div class="actions"><a class="btn" href="/support">返回申请页</a></div>
</div>
<div class="footer">云览 Yunlan</div>`,
  });
}

/* ------------------------------------------------------------------ */
/* 人工审核后台                                                        */
/* ------------------------------------------------------------------ */

export const ADMIN_JS = `
(function () {
  var token = sessionStorage.getItem('yl_admin_token') || '';
  var state = { status: 'pending_review', apps: [], candidates: [], selected: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + token });
    if (opts.body && !(opts.body instanceof Blob) && typeof opts.body === 'object') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.ok === false) throw new Error(d.error || ('请求失败 ' + r.status));
        return d;
      });
    });
  }
  function statusBadge(s) {
    var label = s === 'approved' ? '已通过' : s === 'rejected' ? '已驳回' : '待审核';
    var cls = s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending';
    return '<span class="status ' + cls + '">' + label + '</span>';
  }
  function showMsg(id, text, err) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'msg' + (err ? ' err' : '');
  }
  function mailReasonText(reason) {
    var map = {
      already_reviewed: '该申请此前已审核，未重复发送',
      opt_out: '该邮箱已退订，按合规要求不再发送',
      mail_not_configured: '服务端未配置发件邮箱',
      send_failed: '发信失败，请查看服务端日志',
      no_review: '缺少审核记录'
    };
    return map[reason] || reason || '未知原因';
  }

  function loadStats() {
    api('/api/support/admin/overview').then(function (d) {
      var s = d.stats;
      $('stats').textContent = '申请 ' + s.applications + ' · 待审核 ' + s.pending + ' · 已通过 ' + s.approved + ' · 候选 ' + s.candidates + ' · 账单 ' + s.donations;
    }).catch(function (e) { $('stats').textContent = e.message; });
  }

  function loadApps() {
    api('/api/support/admin/applications?status=' + encodeURIComponent(state.status) + '&limit=200').then(function (d) {
      state.apps = d.applications || [];
      var box = $('app-list');
      box.innerHTML = state.apps.length ? '' : '<p class="meta">暂无申请</p>';
      state.apps.forEach(function (a) {
        var div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = '<div class="line"><strong>' + esc(a.email) + '</strong>' + statusBadge(a.status) + '</div>' +
          '<div class="line"><small>口令 ' + esc(a.code) + ' · ' + esc(fmt(a.createdAt)) + '</small><small>' +
          (a.optInEmail ? '已同意邮件' : '未同意邮件') + ' · 凭证 ' + a.uploadCount + '</small></div>';
        div.onclick = function () { selectApp(a.id); };
        box.appendChild(div);
      });
    }).catch(function (e) { showMsg('admin-msg', e.message, true); });
  }

  function selectApp(id) {
    state.selected = id;
    $('detail').classList.remove('hidden');
    $('detail-body').innerHTML = '<p class="meta">加载中…</p>';
    return api('/api/support/admin/applications/' + encodeURIComponent(id)).then(function (d) {
      var a = d.application;
      var reviews = (d.reviews || []).map(function (r) {
        return '<div class="kv">' + esc(fmt(r.createdAt)) + ' · ' + (r.action === 'approve' ? '通过' : '驳回') + (r.note ? ' · ' + esc(r.note) : '') + '</div>';
      }).join('') || '<div class="kv">暂无审核记录</div>';
      var uploads = (d.uploads || []).map(function (u) {
        return '<div class="kv">' + esc(fmt(u.createdAt)) + (u.tradeNo ? ' · 单号 ' + esc(u.tradeNo) : '') +
          ' · <a href="#" data-img="' + esc(u.id) + '">查看截图</a></div>';
      }).join('') || '<div class="kv">暂无上传凭证</div>';
      $('detail-body').innerHTML =
        '<div class="kv"><strong>邮箱</strong>：' + esc(a.email) + '</div>' +
        '<div class="kv"><strong>口令</strong>：<span class="code">' + esc(a.code) + '</span></div>' +
        '<div class="kv"><strong>状态</strong>：' + statusBadge(a.status) + '</div>' +
        '<div class="kv"><strong>提交</strong>：' + esc(fmt(a.createdAt)) + ' · 邮件许可：' + (a.optInEmail ? '是' : '否') + (a.unsubscribedAt ? '（已于 ' + esc(fmt(a.unsubscribedAt)) + ' 退订）' : '') + '</div>' +
        '<div class="kv"><strong>发信</strong>：' + esc(a.mailStatus || '-') + (a.mailError ? ' · ' + esc(a.mailError) : '') + '</div>' +
        '<h2>审核记录</h2>' + reviews +
        '<h2>上传凭证</h2>' + uploads +
        '<div id="detail-img"></div>' +
        '<h2>人工终审</h2>' +
        '<label>审核备注（驳回时建议填写）</label><input id="review-note" type="text" maxlength="200">' +
        '<label>通过时同时开通权限（可选，仅对已注册的同邮箱账号生效）</label>' +
        '<select id="grant-plan"><option value="">不开通</option><option value="month">月付 30 天</option><option value="quarter">季付 90 天</option><option value="half">半年 183 天</option><option value="year">年付 365 天</option></select>' +
        '<div class="actions"><button class="primary" id="approve-btn">审核通过</button><button id="reject-btn">驳回</button><button id="resend-btn">重发通知邮件</button></div>' +
        '<div id="review-msg" class="msg"></div>';
      $('approve-btn').onclick = function () { review('approve'); };
      $('reject-btn').onclick = function () { review('reject'); };
      $('resend-btn').onclick = function () { resendMail(); };
      $('detail-body').querySelectorAll('[data-img]').forEach(function (link) {
        link.onclick = function (ev) { ev.preventDefault(); loadImage(link.getAttribute('data-img')); };
      });
    }).catch(function (e) { $('detail-body').innerHTML = '<p class="msg err">' + esc(e.message) + '</p>'; });
  }

  function loadImage(id) {
    fetch('/api/support/admin/uploads/' + encodeURIComponent(id) + '/image', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { if (!r.ok) throw new Error('读取失败'); return r.blob(); })
      .then(function (blob) {
        var img = document.createElement('img');
        img.className = 'thumb';
        img.src = URL.createObjectURL(blob);
        var box = $('detail-img');
        box.innerHTML = '';
        box.appendChild(img);
      })
      .catch(function (e) { showMsg('review-msg', e.message, true); });
  }

  function review(action) {
    if (!state.selected) return;
    var note = $('review-note').value;
    var grantPlanId = $('grant-plan').value || null;
    if (action === 'reject' && !note.trim()) {
      if (!confirm('驳回时未填写备注，仍要提交吗？')) return;
    }
    if (action === 'approve' && !confirm('确认人工审核通过？')) return;
    var approveBtn = $('approve-btn');
    var rejectBtn = $('reject-btn');
    function unlock() {
      if (approveBtn) approveBtn.disabled = false;
      if (rejectBtn) rejectBtn.disabled = false;
    }
    if (approveBtn) approveBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;
    api('/api/support/admin/applications/' + encodeURIComponent(state.selected) + '/review', {
      method: 'POST',
      body: { action: action, note: note, grantPlanId: grantPlanId }
    }).then(function (d) {
      var msg = d.message || '已保存';
      var err = false;
      if (d.mail && d.mail.sent === false) {
        err = true;
        msg = '审核已保存；结果邮件未发送（' + mailReasonText(d.mail.reason) + '）';
      }
      loadApps(); loadStats(); loadCandidates();
      var refresh = state.selected ? selectApp(state.selected) : null;
      if (refresh && refresh.then) {
        refresh.then(function () { showMsg('review-msg', msg, err); }).catch(unlock);
      } else {
        showMsg('review-msg', msg, err);
      }
    }).catch(function (e) {
      unlock();
      showMsg('review-msg', e.message, true);
    });
  }

  function resendMail() {
    if (!state.selected) return;
    api('/api/support/admin/applications/' + encodeURIComponent(state.selected) + '/resend', { method: 'POST' })
      .then(function (d) {
        showMsg('review-msg', d.mail && d.mail.sent ? '通知邮件已发送' : '未发送：' + mailReasonText(d.mail && d.mail.reason), !(d.mail && d.mail.sent));
        loadStats();
      })
      .catch(function (e) { showMsg('review-msg', e.message, true); });
  }

  function loadCandidates() {
    api('/api/support/admin/candidates?reviewed=0&limit=200').then(function (d) {
      state.candidates = d.candidates || [];
      var box = $('candidate-list');
      box.innerHTML = state.candidates.length ? '' : '<p class="meta">暂无候选，请先导入账单</p>';
      state.candidates.forEach(function (c) {
        var div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = '<div class="line"><strong>¥' + esc(c.amount) + '</strong><span class="tag">匹配分 ' + esc(c.matchScore) + '</span></div>' +
          '<div class="line"><small>' + esc(fmt(c.payTime)) + ' · 备注：' + esc(c.note || '（空）') + '</small></div>' +
          '<div class="line"><small>候选申请：' + esc(c.app ? c.app.email : '无') + (c.app ? ' · 口令 ' + esc(c.app.code) : '') + '</small></div>' +
          '<div class="line"><small>' + esc((c.matchReasons || []).join(' / ')) + '</small></div>';
        if (c.app) {
          div.onclick = function () { selectApp(c.app.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        }
        box.appendChild(div);
      });
    }).catch(function (e) { showMsg('admin-msg', e.message, true); });
  }

  function importBills() {
    var text = $('csv').value.trim();
    if (!text) return showMsg('import-msg', '请先粘贴账单 CSV', true);
    api('/api/support/admin/donations/import', { method: 'POST', body: { csv: text } })
      .then(function (d) {
        showMsg('import-msg', '导入 ' + d.imported + ' 条，跳过 ' + d.skipped + ' 条，生成候选 ' + d.candidates + ' 条');
        loadCandidates(); loadStats();
      })
      .catch(function (e) { showMsg('import-msg', e.message, true); });
  }

  function uploadQr() {
    var input = $('qr-file');
    var file = input.files && input.files[0];
    if (!file) return showMsg('qr-msg', '请选择赞赏码图片', true);
    fetch('/api/support/admin/qr', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': file.type },
      body: file
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || '上传失败'); return d; }); })
      .then(function () { showMsg('qr-msg', '赞赏码已更新'); loadStats(); })
      .catch(function (e) { showMsg('qr-msg', e.message, true); });
  }

  function loadAll() {
    loadStats(); loadApps(); loadCandidates();
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (token) { $('token').value = token; $('login').classList.add('hidden'); $('panel').classList.remove('hidden'); loadAll(); }
    $('save-token').onclick = function () {
      token = $('token').value.trim();
      sessionStorage.setItem('yl_admin_token', token);
      $('login').classList.add('hidden');
      $('panel').classList.remove('hidden');
      loadAll();
    };
    $('logout').onclick = function () {
      sessionStorage.removeItem('yl_admin_token');
      token = '';
      $('panel').classList.add('hidden');
      $('login').classList.remove('hidden');
    };
    document.querySelectorAll('[data-status]').forEach(function (b) {
      b.onclick = function () { state.status = b.getAttribute('data-status'); loadApps(); };
    });
    $('reload').onclick = loadAll;
    $('import-btn').onclick = importBills;
    $('qr-btn').onclick = uploadQr;
  });
})();
`;

export const RELAY_JS = `
(function () {
  var form = document.getElementById('upload-form');
  if (!form) return;
  var msg = document.getElementById('upload-msg');
  function setMsg(text, err) {
    msg.textContent = text || '';
    msg.className = 'msg' + (err ? ' err' : '');
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var fileInput = document.getElementById('file');
    var tradeNo = (document.getElementById('tradeNo').value || '').trim();
    var file = fileInput.files && fileInput.files[0];
    if (!file && !tradeNo) {
      setMsg('请至少填写交易单号或选择一张截图', true);
      return;
    }
    if (file && file.size > 2 * 1024 * 1024) {
      setMsg('图片不能超过 2MB', true);
      return;
    }
    var opts = { method: 'POST', credentials: 'include', headers: {} };
    var url = '/api/support/uploads';
    if (tradeNo) url += '?tradeNo=' + encodeURIComponent(tradeNo);
    if (file) {
      opts.headers['Content-Type'] = file.type || 'application/octet-stream';
      opts.body = file;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify({ tradeNo: tradeNo });
    }
    setMsg('提交中…');
    fetch(url, opts)
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || '提交失败'); return d; }); })
      .then(function () { setMsg('凭证已提交，感谢你的补充'); form.reset(); })
      .catch(function (e) { setMsg(e.message, true); });
  });
})();
`;

export function renderAdminPage() {
  return layout({
    admin: true,
    title: "云览 · 申请审核后台",
    script: "/support/admin.js",
    body: `
<div class="card">
  <h1>云览 · 申请审核后台</h1>
  <p class="meta">所有结论必须人工点击提交；系统只提供候选推荐，不存在自动放行。</p>
  <div id="login">
    <label for="token">管理员凭证（ADMIN_TOKEN）</label>
    <input id="token" type="password" autocomplete="off" placeholder="Bearer Token">
    <div class="actions"><button class="primary" id="save-token">进入后台</button></div>
    <div id="admin-msg" class="msg"></div>
  </div>
  <div id="panel" class="hidden">
    <div class="toolbar">
      <span id="stats" class="meta"></span>
      <button id="reload" type="button">刷新</button>
      <button id="logout" type="button">退出</button>
    </div>
    <div class="admin-grid">
      <div>
        <h2>申请列表</h2>
        <div class="toolbar">
          <button type="button" data-status="pending_review">待审核</button>
          <button type="button" data-status="approved">已通过</button>
          <button type="button" data-status="rejected">已驳回</button>
          <button type="button" data-status="">全部</button>
        </div>
        <div id="app-list" class="list"></div>
        <h2>对账候选（仅推荐）</h2>
        <div id="candidate-list" class="list"></div>
        <h2>导入账单</h2>
        <p class="meta">CSV 列顺序：到账时间, 备注, 金额, 交易单号（可选）。备注含 4 位口令权重最高；到账时间与申请时间相差 ±60 秒为次要权重。</p>
        <textarea id="csv" placeholder="2026-11-11 10:00:00,云览 1234,5,4200001234"></textarea>
        <div class="toolbar"><button id="import-btn" type="button">导入并生成候选</button></div>
        <div id="import-msg" class="msg"></div>
        <h2>赞赏码设置</h2>
        <p class="meta">仅用于一次性中转页之后的「自愿支持」页面展示，不会出现在首页、表单页或邮件中。</p>
        <input id="qr-file" type="file" accept="image/png,image/jpeg,image/webp">
        <div class="toolbar"><button id="qr-btn" type="button">上传赞赏码</button></div>
        <div id="qr-msg" class="msg"></div>
      </div>
      <div>
        <h2>申请详情</h2>
        <div id="detail" class="detail hidden"><div id="detail-body"></div></div>
      </div>
    </div>
  </div>
</div>`,
  });
}
