/* 富国杯答疑工具 — 公开页脚本：FAQ 搜索 / 分类筛选 / 手风琴
 * 数据优先级：云端（配置了 CloudBase 时实时拉取上架 FAQ）→ 内置种子（快速首屏与兜底）。
 */
(function () {
  'use strict';

  var listEl = document.getElementById('faq-list');
  var searchEl = document.getElementById('faq-search');
  var chipBar = document.getElementById('faq-cats');
  var countEl = document.getElementById('faq-count');
  var emptyEl = document.getElementById('faq-empty');

  var PHONE = window.FGCUP.PHONE, HOURS = window.FGCUP.PHONE_HOURS;
  var CATS = window.FGCUP.CATS;
  var SEED = (window.FGCUP.FAQ_SEED || []).filter(function (f) { return f.public; });
  var DATA = SEED.slice();

  var state = { q: '', cat: '全部' };

  // 分类 chips
  ['全部'].concat(CATS).forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (c === '全部' ? ' is-on' : '');
    b.textContent = c;
    b.addEventListener('click', function () {
      state.cat = c;
      chipBar.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      render();
    });
    chipBar.appendChild(b);
  });

  var debounceTimer = null;
  searchEl.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { state.q = searchEl.value.trim(); render(); }, 120);
  });

  function norm(s) { return (s || '').toLowerCase(); }

  function filtered() {
    var q = norm(state.q);
    return DATA.filter(function (f) {
      if (state.cat !== '全部' && f.cat !== state.cat) return false;
      if (!q) return true;
      var hay = norm(f.q) + ' ' + norm(f.a) + ' ' + norm((f.kw || []).join(' '));
      return q.split(/\s+/).every(function (t) { return hay.indexOf(t) !== -1; });
    });
  }

  function render() {
    var items = filtered();
    countEl.textContent = items.length ? '共 ' + items.length + ' 条' : '';
    listEl.innerHTML = '';
    emptyEl.hidden = items.length > 0;

    items.forEach(function (f, i) {
      var d = document.createElement('details');
      d.className = 'faq-item';
      if (i === 0 && state.q) d.open = true;
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="faq-q"></span><span class="faq-caret" aria-hidden="true"></span>';
      sum.querySelector('.faq-q').textContent = f.q;
      var body = document.createElement('div');
      body.className = 'faq-a';
      body.textContent = f.a;
      d.appendChild(sum);
      d.appendChild(body);
      listEl.appendChild(d);
    });
  }

  emptyEl.querySelector('.faq-empty-phone').textContent = PHONE;
  emptyEl.querySelector('.faq-empty-hours').textContent = HOURS;
  document.querySelector('.ask-phone').textContent = PHONE;
  document.querySelector('.ask-hours').textContent = HOURS;
  render();

  // ---------- 网页提问（匿名；先依据 FAQ 库自动回复，未解决才转人工） ----------
  var askMask = document.getElementById('ask-mask');
  var askText = document.getElementById('ask-text');
  var askSubmit = document.getElementById('ask-submit');
  var askResult = document.getElementById('ask-result');

  function el(tag, cls, txt) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  }

  function matchTop(text) {
    var q = norm(text).trim();
    if (!q) return null;
    var best = null, bs = 0;
    DATA.forEach(function (f) {
      var s = 0;
      (f.kw || []).forEach(function (kw) { if (q.indexOf(norm(kw)) !== -1) s += Math.max(kw.length, 2); });
      if (norm(f.q).indexOf(q) !== -1) s += 8;
      if (s > bs) { bs = s; best = f; }
    });
    return bs >= 2 ? best : null;
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function saveLocalAsk(t) {
    try {
      var arr = JSON.parse(localStorage.getItem('fgcup_pubq_v1') || '[]');
      arr.unshift(t);
      localStorage.setItem('fgcup_pubq_v1', JSON.stringify(arr.slice(0, 50)));
    } catch (e) { /* 忽略 */ }
  }

  function commitAsk(text, faqRef, solved, done) {
    var now = stamp();
    var ticket = {
      id: 'W' + Date.now().toString(36),
      status: solved ? '已直接回答' : '待回答',
      channel: '网页',
      problem: text,
      faqRef: faqRef || '',
      answer: '',
      records: [{ time: now, text: solved ? '网页自助提问：系统依据 FAQ 自动回复，学生确认解决。' : (faqRef ? '网页提问：自动回复未解决，转人工处理。' : '网页提问：FAQ 未命中，转人工处理。') }],
      createdAt: now, updatedAt: now, origin: 'public'
    };
    var C = window.APP_CONFIG || {};
    var canReach = location.protocol !== 'file:' && !!C.envId;
    if (canReach) {
      // 主通道：云接入 HTTP 网关（免 SDK 鉴权，镜像站同样可用）
      try {
        pubPost({ action: 'submitTicket', ticket: { problem: text, faqRef: faqRef || '', solved: !!solved } }, function (r) {
          if (r && r.ok) { done(); return; }
          if (window.console) console.warn('[fgcup] submitTicket 回退本地: ' + JSON.stringify(r));
          saveLocalAsk(ticket);
          done();
        });
      } catch (e) {
        if (window.console) console.warn('[fgcup] submitTicket 异常: ' + (e && e.message || e));
        saveLocalAsk(ticket);
        done();
      }
      return;
    }
    saveLocalAsk(ticket);
    done();
  }

  function showDone(msg) {
    askResult.hidden = false;
    askResult.innerHTML = '';
    askResult.appendChild(el('div', 'ask-done', '✓ ' + msg));
    setTimeout(function () { askMask.hidden = true; }, 2800);
  }

  document.getElementById('ask-open').addEventListener('click', function () {
    askMask.hidden = false;
    askResult.hidden = true;
    askResult.innerHTML = '';
    askText.value = '';
    askText.focus();
  });
  document.getElementById('ask-close').addEventListener('click', function () { askMask.hidden = true; });
  askMask.addEventListener('click', function (e) { if (e.target === askMask) askMask.hidden = true; });

  askSubmit.addEventListener('click', function () {
    var text = askText.value.trim();
    if (text.length < 5) {
      askResult.hidden = false;
      askResult.innerHTML = '';
      askResult.appendChild(el('p', 'ask-err', '请至少输入 5 个字，描述清楚问题才好匹配答案。'));
      return;
    }
    var hit = matchTop(text);
    askResult.hidden = false;
    askResult.innerHTML = '';
    if (hit) {
      var box = el('div', 'ask-sug');
      box.appendChild(el('b', null, '猜你想问：' + hit.q));
      box.appendChild(el('p', null, hit.a));
      var btns = el('div', 'ask-sug-btns');
      var ok = el('button', 'btn btn-main', '问题解决了');
      var no = el('button', 'btn ask-btn-ghost', '没有解决，转人工');
      ok.type = 'button';
      no.type = 'button';
      ok.addEventListener('click', function () {
        commitAsk(text, hit.id, true, function () { showDone('已记录，很高兴帮到你！'); });
      });
      no.addEventListener('click', function () {
        commitAsk(text, hit.id, false, function () {
          showDone('已转交工作人员，将在 1 个工作日内处理；急事可致电 ' + PHONE + '（' + HOURS + '）。');
        });
      });
      btns.appendChild(ok);
      btns.appendChild(no);
      box.appendChild(btns);
      askResult.appendChild(box);
      askResult.appendChild(el('p', 'ask-note', '以上答案依据赛事常见问题库（已公布材料口径）自动匹配。'));
    } else {
      commitAsk(text, null, false, function () {
        showDone('已提交！工作人员将在 1 个工作日内处理；急事可致电 ' + PHONE + '（' + HOURS + '）。');
      });
    }
  });

  // ---------- 云端增强（可选） ----------
  var C = window.APP_CONFIG || {};
  var useCloud = location.protocol !== 'file:' && ((C.mode === 'cloudbase') || (C.mode !== 'local' && !!C.envId));
  if (!useCloud) return;

  /* 云接入 HTTP 网关：免 SDK/安全域名白名单，主站与镜像站共用 */
  function pubHttpUrl() {
    return 'https://' + C.envId + '.service.tcloudbase.com/fgpublic';
  }
  function pubPost(payload, cb) {
    try {
      var x = new XMLHttpRequest();
      x.open('POST', pubHttpUrl(), true);
      x.setRequestHeader('Content-Type', 'application/json');
      x.timeout = 12000;
      x.onload = function () { try { cb(JSON.parse(x.responseText)); } catch (e) { cb(null); } };
      x.onerror = function () { cb(null); };
      x.ontimeout = function () { cb(null); };
      x.send(JSON.stringify(payload));
      if (window.console) console.info('[fgcup] pubPost → ' + payload.action);
    } catch (e) {
      if (window.console) console.warn('[fgcup] pubPost 异常: ' + (e && e.message || e));
      cb(null);
    }
  }

  function applyFaqs(r) {
    if (r && r.ok && r.faqs && r.faqs.length) {
      DATA = r.faqs;
      render();
      return true;
    }
    return false;
  }

  // 主通道：HTTP 直连（失败保持种子数据；SDK 兜底已移除——旧 CDN 地址已 404，网关即主链路）
  pubPost({ action: 'readFaq' }, function (r) { applyFaqs(r); });

  // 浏览计数：每次打开页面计 1 次 PV（只累加数字，不记录任何个人信息）；本地 file:// 不计
  pubPost({ action: 'visit' }, function () { /* 静默，失败不影响页面 */ });
})();
