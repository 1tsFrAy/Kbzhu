'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEY = 'moyden:v1';
const DEF = { p: { sex: 'm', age: 25, h: 175, w: 70, act: 1.375, goal: 'keep', rate: 0.5 }, days: {}, recent: [], theme: '' };
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
S = Object.assign(structuredClone(DEF), S || {});
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Не удалось сохранить: память браузера недоступна'); } };
const iso = d => d.toLocaleDateString('sv');
const fmtD = s => new Date(s + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
let cur = iso(new Date());
const get = (d = cur) => S.days[d] || { food: [], water: 0 };
const put = (d = cur) => (S.days[d] ||= { food: [], water: 0 });
const tot = d => get(d).food.reduce((a, f) => (a.k += f.k, a.p += f.p, a.f += f.f, a.c += f.c, a), { k: 0, p: 0, f: 0, c: 0 });
let tt;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- Расчёты ---------- */
function lastWeight() {
  const ks = Object.keys(S.days).filter(k => S.days[k].weight).sort();
  return ks.length ? S.days[ks.at(-1)].weight : S.p.w;
}
function calc() {
  const p = S.p, w = lastWeight(), h = p.h, m = h / 100;
  const bmr = 10 * w + 6.25 * h - 5 * p.age + (p.sex === 'm' ? 5 : -161); // Миффлин — Сан-Жеор
  const tdee = bmr * p.act;
  const delta = (p.goal === 'lose' ? -1 : p.goal === 'gain' ? 1 : 0) * p.rate * 1100; // 7700 ккал ≈ 1 кг
  const floor = p.sex === 'm' ? 1500 : 1200;
  const kcal = Math.max(floor, Math.round(tdee + delta));
  const prot = Math.round(w * (p.goal === 'lose' ? 2 : 1.6)), fat = Math.round(w * 0.9);
  const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { w, bmr, tdee, kcal, prot, fat, carb, bmi: w / (m * m), lo: 18.5 * m * m, hi: 24.9 * m * m,
    water: Math.round(w * 33 / 50) * 50, floored: tdee + delta < floor };
}
const bmiCat = b => b < 16 ? 'выраженный дефицит' : b < 18.5 ? 'недостаток массы' : b < 25 ? 'норма' : b < 30 ? 'избыток массы' : 'ожирение';

/* ---------- День ---------- */
function renderDay() {
  const c = calc(), d = get(), t = tot();
  $('#date').value = cur;
  const left = Math.round(c.kcal - t.k);
  $('#left').textContent = Math.abs(left);
  $('#leftLbl').textContent = left >= 0 ? 'осталось ккал' : 'сверх нормы';
  $('#eaten').textContent = Math.round(t.k); $('#goal').textContent = c.kcal;
  const fg = $('#ringFg'), pr = Math.min(1, t.k / c.kcal);
  fg.style.strokeDashoffset = 339.29 * (1 - pr); fg.classList.toggle('over', left < 0);
  [['#mP', 'Белки', t.p, c.prot], ['#mF', 'Жиры', t.f, c.fat], ['#mC', 'Углеводы', t.c, c.carb]].forEach(([s, n, v, g]) => {
    $(s).style.setProperty('--v', Math.min(100, g ? v / g * 100 : 0) + '%');
    $(s + ' span').textContent = `${n}: ${Math.round(v)} из ${g} г`;
  });
  const wg = c.water + Math.round((d.work || 0) * 12 / 50) * 50;
  $('#waterNow').textContent = d.water; $('#waterGoal').textContent = wg;
  $('#waterBar').style.width = Math.min(100, d.water / wg * 100) + '%';
  // серия дней с едой
  let n = 0, x = new Date(); if (!get(iso(x)).food.length) x.setDate(x.getDate() - 1);
  while (get(iso(x)).food.length) { n++; x.setDate(x.getDate() - 1); }
  $('#streak').textContent = n ? `Серия записей: ${n} ${n % 10 == 1 && n != 11 ? 'день' : (n % 10 > 1 && n % 10 < 5 && (n < 12 || n > 14)) ? 'дня' : 'дней'} подряд` : 'Запишите первый приём пищи — серия начнётся.';
  // список еды
  const ul = $('#foodList'); ul.innerHTML = '';
  if (!d.food.length) ul.innerHTML = '<li class="muted">В этот день пока пусто. Добавьте первый приём пищи выше.</li>';
  d.food.forEach((f, i) => {
    const li = document.createElement('li'), a = document.createElement('div'), bt = document.createElement('button');
    a.innerHTML = '<b></b><small></small>'; a.firstChild.textContent = f.n;
    a.lastChild.textContent = `${f.meal} · ${Math.round(f.k)} ккал · Б ${r1(f.p)} Ж ${r1(f.f)} У ${r1(f.c)}`;
    bt.textContent = 'Удалить'; bt.className = 'ghost';
    bt.onclick = () => { put().food.splice(i, 1); save(); renderDay(); };
    li.append(a, bt); ul.append(li);
  });
  const rc = $('#recent'); rc.innerHTML = '';
  S.recent.forEach(f => {
    const b = document.createElement('button'); b.textContent = `${f.n} · ${Math.round(f.k)}`;
    b.onclick = () => { put().food.push({ ...f, meal: $('#fMeal').value }); save(); renderDay(); toast('Добавлено'); };
    rc.append(b);
  });
  $('#mW').value = d.weight ?? ''; $('#mSleep').value = d.sleep ?? ''; $('#mSteps').value = d.steps ?? '';
  $('#mWork').value = d.work ?? ''; $('#mNote').value = d.note ?? '';
  $$('#mood button').forEach(b => b.classList.toggle('on', +b.dataset.m === d.mood));
}

/* форма еды */
function foodFromForm() {
  const per100 = $('#fMode').value === '100', g = num($('#fG').value), m = per100 ? g / 100 : 1;
  return { n: $('#fName').value.trim(), k: num($('#fK').value) * m, p: num($('#fP').value) * m, f: num($('#fF').value) * m, c: num($('#fC').value) * m };
}
function updPreview() {
  const per100 = $('#fMode').value === '100'; $('#gWrap').hidden = !per100; $('#fG').required = per100;
  const f = foodFromForm();
  $('#preview').textContent = f.k || f.p || f.f || f.c ? `Итог порции: ${Math.round(f.k)} ккал · Б ${r1(f.p)} · Ж ${r1(f.f)} · У ${r1(f.c)}` : '';
}
$('#foodForm').addEventListener('input', updPreview);
$('#foodForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = foodFromForm(); if (!f.n) return;
  put().food.push({ ...f, meal: $('#fMeal').value });
  S.recent = [{ n: f.n, k: f.k, p: f.p, f: f.f, c: f.c }, ...S.recent.filter(x => x.n !== f.n)].slice(0, 8);
  save(); e.target.reset(); updPreview(); renderDay(); toast('Добавлено'); $('#fName').focus();
});

/* вода, показатели */
$$('[data-w]').forEach(b => b.onclick = () => { const d = put(); d.water = Math.max(0, d.water + +b.dataset.w); save(); renderDay(); });
[['#mW', 'weight'], ['#mSleep', 'sleep'], ['#mSteps', 'steps'], ['#mWork', 'work']].forEach(([s, k]) =>
  $(s).addEventListener('change', e => { const v = num(e.target.value); const d = put(); if (v > 0) d[k] = v; else delete d[k]; save(); renderDay(); renderMe(); }));
$('#mNote').addEventListener('input', e => { put().note = e.target.value; save(); });
$$('#mood button').forEach(b => b.onclick = () => { const d = put(); d.mood = d.mood === +b.dataset.m ? 0 : +b.dataset.m; save(); renderDay(); });

/* дата */
const go = n => { const x = new Date(cur + 'T12:00'); x.setDate(x.getDate() + n); cur = iso(x); renderDay(); };
$('#prev').onclick = () => go(-1); $('#next').onclick = () => go(1);
$('#today').onclick = () => { cur = iso(new Date()); renderDay(); };
$('#date').onchange = e => { if (e.target.value) { cur = e.target.value; renderDay(); } };
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1);
});

/* ---------- Профиль и результаты ---------- */
const PF = { sex: '#pSex', age: '#pAge', h: '#pH', w: '#pW', act: '#pAct', goal: '#pGoal', rate: '#pRate' };
function fillProfile() { for (const k in PF) $(PF[k]).value = S.p[k]; }
for (const k in PF) $(PF[k]).addEventListener('change', e => {
  const v = e.target.value; S.p[k] = (k === 'sex' || k === 'goal') ? v : num(v);
  const lim = { age: [10, 100], h: [100, 250], w: [30, 300] }[k];
  if (lim) S.p[k] = Math.min(lim[1], Math.max(lim[0], S.p[k] || lim[0]));
  save(); fillProfile(); renderMe(); renderDay();
});
function renderMe() {
  const c = calc(), st = $('#stats'), p = S.p;
  const items = [
    ['big', c.kcal, 'ккал в день — ваша цель'],
    ['', Math.round(c.bmr), 'ккал в покое (базовый обмен)'],
    ['', Math.round(c.tdee), 'ккал на поддержание веса'],
    ['', r1(c.bmi), 'ИМТ: ' + bmiCat(c.bmi)],
    ['', `${r1(c.lo)}–${r1(c.hi)} кг`, 'вес при ИМТ 18,5–24,9'],
    ['', c.prot + ' г', 'белки в день'], ['', c.fat + ' г', 'жиры в день'], ['', c.carb + ' г', 'углеводы в день'],
    ['', c.water + ' мл', 'вода в день (+12 мл за минуту тренировки)'],
  ];
  st.innerHTML = items.map(([c2, v, l]) => `<div class="stat ${c2}"><b>${v}</b><span>${l}</span></div>`).join('');
  let a = `Расчёт для веса ${r1(c.w)} кг по формуле Миффлина — Сан-Жеора.`;
  if (p.goal !== 'keep') {
    const wk = p.goal === 'lose' ? c.bmi - 0 : 0;
    a += ` Темп ${p.rate} кг в неделю — это ${p.goal === 'lose' ? 'дефицит' : 'профицит'} около ${Math.round(p.rate * 1100)} ккал в день.`;
    if (c.floored) a += ' Цель поднята до безопасного минимума — не опускайтесь ниже без врача.';
    if (p.goal === 'lose' && c.w * 0.01 < p.rate) a += ' Темп выше 1% веса в неделю — это быстро, лучше снизить.';
  }
  a += ' Это оценка: через 2–3 недели сверьте её с реальным изменением веса и поправьте активность.';
  $('#advice').textContent = a;
}
function renderQ() {
  const g = num($('#qG').value), m = g / 100, k = num($('#qK').value);
  $('#qOut').textContent = g && (k || num($('#qP').value) || num($('#qF').value) || num($('#qC').value))
    ? `${g} г = ${Math.round(k * m)} ккал · Б ${r1(num($('#qP').value) * m)} · Ж ${r1(num($('#qF').value) * m)} · У ${r1(num($('#qC').value) * m)}`
    : 'Введите значения — результат появится здесь.';
}
$$('#qK,#qG,#qP,#qF,#qC').forEach(i => i.addEventListener('input', renderQ));

/* ---------- История ---------- */
function series(metric, n) {
  const out = [], x = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const y = new Date(x); y.setDate(x.getDate() - i); const k = iso(y), d = get(k);
    const v = metric === 'kcal' ? (d.food.length ? tot(k).k : null) : metric === 'water' ? (d.water || null) : (d[metric] || null);
    out.push({ k, v });
  }
  return out;
}
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function renderHist() {
  const metric = $('#hMetric').value, n = +$('#hRange').value, data = series(metric, n);
  const cv = $('#chart'), dpr = devicePixelRatio || 1, W = cv.clientWidth, H = 220;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0, 0, W, H);
  const vals = data.map(d => d.v).filter(v => v != null), L = 40, B = 24, T = 10, R = 8;
  if (!vals.length) { x.fillStyle = css('--muted'); x.font = '14px Onest, sans-serif'; x.fillText('Данных за период пока нет', L, H / 2); $('#hSum').textContent = ''; }
  else {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (metric === 'weight') { lo -= 1; hi += 1; } else { lo = 0; hi = Math.max(hi, metric === 'kcal' ? calc().kcal : 1) * 1.1; }
    if (hi === lo) hi = lo + 1;
    const px = i => L + (W - L - R) * (n === 1 ? .5 : i / (n - 1)), py = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    x.font = '11px Onest, sans-serif'; x.strokeStyle = css('--line'); x.fillStyle = css('--muted');
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4, y = py(v); x.beginPath(); x.moveTo(L, y); x.lineTo(W - R, y); x.stroke();
      x.fillText(metric === 'weight' || metric === 'sleep' ? r1(v) : Math.round(v), 2, y + 4);
    }
    [0, Math.floor((n - 1) / 2), n - 1].forEach(i => x.fillText(data[i].k.slice(5).split('-').reverse().join('.'), Math.min(px(i) - 14, W - 40), H - 6));
    if (metric === 'kcal') { // линия цели
      const y = py(calc().kcal); x.setLineDash([5, 4]); x.strokeStyle = css('--mint'); x.beginPath(); x.moveTo(L, y); x.lineTo(W - R, y); x.stroke(); x.setLineDash([]);
    }
    const bars = metric !== 'weight';
    x.strokeStyle = x.fillStyle = css('--amber'); x.lineWidth = 2;
    if (bars) { const bw = Math.max(2, (W - L - R) / n * .6); data.forEach((d, i) => d.v != null && x.fillRect(px(i) - bw / 2, py(d.v), bw, py(lo) - py(d.v))); }
    else {
      x.beginPath(); let st = false;
      data.forEach((d, i) => { if (d.v == null) return; st ? x.lineTo(px(i), py(d.v)) : x.moveTo(px(i), py(d.v)); st = true; }); x.stroke();
      data.forEach((d, i) => { if (d.v != null) { x.beginPath(); x.arc(px(i), py(d.v), 3, 0, 7); x.fill(); } });
    }
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length, u = { kcal: 'ккал', weight: 'кг', water: 'мл', sleep: 'ч', steps: 'шагов' }[metric];
    $('#hSum').textContent = `Записей: ${vals.length}. Среднее: ${metric === 'weight' || metric === 'sleep' ? r1(avg) : Math.round(avg)} ${u}.` +
      (metric === 'weight' && vals.length > 1 ? ` Изменение: ${r1(vals.at(-1) - vals[0]) > 0 ? '+' : ''}${r1(vals.at(-1) - vals[0])} кг.` : '');
  }
  const ul = $('#dayList'); ul.innerHTML = '';
  const ks = Object.keys(S.days).filter(k => { const d = S.days[k]; return d.food.length || d.water || d.weight || d.note; }).sort().reverse().slice(0, 30);
  if (!ks.length) ul.innerHTML = '<li class="muted">Записей пока нет.</li>';
  ks.forEach(k => {
    const d = S.days[k], li = document.createElement('li'); li.className = 'dl'; li.style.cursor = 'pointer';
    li.innerHTML = '<div><b></b><small></small></div><span class="muted"></span>';
    li.querySelector('b').textContent = fmtD(k);
    li.querySelector('small').textContent = `${Math.round(tot(k).k)} ккал · вода ${d.water} мл` + (d.weight ? ` · ${d.weight} кг` : '');
    li.querySelector('span').textContent = '›';
    li.onclick = () => { cur = k; renderDay(); tab('day'); }; ul.append(li);
  });
}
$('#hMetric').onchange = $('#hRange').onchange = renderHist;
addEventListener('resize', () => $('#tab-hist').classList.contains('on') && renderHist());

/* ---------- Данные ---------- */
$('#exp').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
  a.download = `moy-den-${iso(new Date())}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Копия сохранена');
};
$('#imp').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (!j || typeof j.days !== 'object' || !j.p) throw 0;
    if (!confirm('Заменить текущие данные загруженной копией?')) return;
    S = Object.assign(structuredClone(DEF), j); save(); fillProfile(); renderAll(); toast('Данные загружены');
  } catch { toast('Не получилось: это не копия «Моего дня»'); }
  e.target.value = '';
};
$('#wipe').onclick = () => { if (confirm('Стереть все записи и настройки? Это нельзя отменить.')) { S = structuredClone(DEF); save(); fillProfile(); renderAll(); toast('Всё стёрто'); } };

/* ---------- Вкладки, тема ---------- */
function tab(n) {
  $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + n));
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === n));
  if (n === 'hist') renderHist(); if (n === 'me') renderMe();
  try { history.replaceState(null, '', '#' + n); } catch { }
}
$$('.tabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));
function theme() {
  const t = S.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#e8eff3' : '#12202b';
}
$('#theme').onclick = () => { S.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; save(); theme(); renderHist(); };

function renderAll() { theme(); renderDay(); renderMe(); renderQ(); updPreview(); }
fillProfile(); renderAll();
if (['me', 'hist'].includes(location.hash.slice(1))) tab(location.hash.slice(1));
  
