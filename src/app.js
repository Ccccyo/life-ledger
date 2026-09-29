(function () {
'use strict';
const STORE = 'lifeLedger.v2';
const clone = o => JSON.parse(JSON.stringify(o));
const $ = s => document.querySelector(s);

// ---------- 格式 ----------
const nf1 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 结论不显示到元：10 万以上取整到万，10 万以下保留一位小数
const W = n => { const v = n / 1e4; if (Math.abs(v) < 0.05) return '0'; return Math.abs(v) >= 10 ? nf0.format(v) : nf1.format(v); };
const M100 = n => nf0.format(Math.round(n / 100) * 100);   // 月收入取整到百元
const Wu = n => W(n) + ' 万';
const Y = n => nf0.format(Math.round(n));
const Yu = n => Y(n) + ' 元';
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
const FAM = { single: '单身', couple: '已婚无孩', kid: '已婚有孩' };
const L = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;

const GROUPS = [
  { name: '日常生活', color: 'var(--s1)', cats: ['living'] },
  { name: '住房与贷款', color: 'var(--s2)', cats: ['housing'] },
  { name: '孩子', color: 'var(--s3)', cats: ['child'] },
  { name: '赡养·快乐·医疗·其他', color: 'var(--s4)', cats: ['parents', 'fun', 'medical', 'car', 'wedding', 'pet', 'events', 'social'] },
  { name: '养老', color: 'var(--s5)', cats: ['retire'] },
];
const catColor = k => GROUPS.find(g => g.cats.includes(k)).color;

// ---------- 状态 ----------
function fresh() { const p = clone(DEFAULTS); applyCity(p, 'sh'); p.pensionAuto = true; return p; }
const HOMES = [['rent', '租房'], ['buy', '买房'], ['own', '住已有的房']];
const EVT = { gap: '停工一段时间', salary: '工资变化', income: '一次性进账', expense: '一次性大额支出', study: '在职读书/培训', side: '副业收入' };
const EVT_DEF = { gap: { years: 1 }, salary: { amount: 20 }, income: { amount: 50 }, expense: { amount: 20 }, study: { amount: 5, years: 2 }, side: { amount: 3000, years: 5 } };
function cleanMoves(list) {
  return (Array.isArray(list) ? list : []).filter(m => m && CITIES.some(c => c.id === m.city) && isFinite(+m.age)).slice(0, 3)
    .map(m => ({ age: Math.round(+m.age), city: m.city, sell: m.sell === 'lease' ? 'lease' : m.sell !== false, home: HOMES.some(h => h[0] === m.home) ? m.home : 'rent', area: +m.area > 0 ? +m.area : 0 }));
}
function merge(base, over) {
  for (const k in over) {
    if (k === 'eduCost') { if (over.eduCost && typeof over.eduCost === 'object') for (const x in over.eduCost) if (typeof over.eduCost[x] === 'number') base.eduCost[x] = over.eduCost[x]; continue; }
    if (k === 'stages') { if (over.stages) STAGE_KEYS.forEach(s => { const v = over.stages[s]; if (typeof v === 'string' && EDU[s].options.some(o => o.id === v)) base.stages[s] = v; }); continue; }
    if (k === 'pensionAuto') { base.pensionAuto = !!over.pensionAuto; continue; }
    if (k === 'moves') { base.moves = cleanMoves(over.moves); continue; }
    if (k === 'events') { base.events = cleanEvents(over.events); continue; }
    if (k === 'parentsMode') { if (typeof over[k] === 'string') base[k] = over[k]; continue; }
    if (!(k in base)) continue;
    const b = base[k], o = over[k];
    if (Array.isArray(b)) { if (Array.isArray(o)) o.forEach((v, i) => { if (typeof v === 'number' && i < b.length) b[i] = v; }); }
    else if (b && typeof b === 'object') { if (o && typeof o === 'object') for (const s in o) if (s in b && typeof o[s] === typeof b[s]) b[s] = o[s]; }
    else if (typeof o === typeof b) base[k] = o;
  }
  return base;
}
function sanitize(p) {
  ['area', 'rentArea'].forEach(k => ['s', 'c'].forEach(x => { if (!(p[k][x] >= 5)) p[k][x] = DEFAULTS[k][x]; }));
  if (!(p.unitPrice > 0)) applyCity(p, p.city);
  return p;
}
// v3 起收入改成填到手：旧存档里的每月到手、学费档不再沿用
function migrate(o) { if (o && typeof o === 'object' && o.v !== 3) { o.me && delete o.me.salary; o.sp && delete o.sp.salary; delete o.stages; delete o.tutor; delete o.commRate; } return o; }
function load() { try { const raw = localStorage.getItem(STORE); if (!raw) return null; return sanitize(merge(fresh(), migrate(JSON.parse(raw)))); } catch (e) { return null; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify({ ...P, v: 3 })); } catch (e) {} }
let P = load() || fresh();
let C = null;
const K = () => (P.family === 'single' ? 's' : 'c');
const city = () => cityById(P.city);

// ---------- 参数面板 ----------
// [路径, 标签, 单位, 缩放(模型值=显示值×缩放), 步长]
const PAIR_GROUPS = [
  { id: 'g-house', title: '住房', rows: [
    ['area', '买房面积', '㎡', 1, 5], ['rentArea', '租房面积（买房前或一直租）', '㎡', 1, 5],
    ['furnish', '家具家电', '元', 1, 5000], ['support', '家庭支持', '万', 1e4, 10],
  ], fields: [
    ['ownMortgage', '已有房：现在每月还房贷（没有填 0）', '元/月', 1, 500], ['ownLoanYears', '已有房：房贷还剩几年', '年', 1, 1],
    ['unitPrice', '房价单价：每平方米多少元（不是总价）', '元/㎡', 1, 500], ['locFactor', '区位系数（核心区高、郊区低）', '%', 1, 5],
    ['rentPerM2', '租金单价', '元/㎡/月', 1, 1], ['buyAge', '买房年龄', '岁', 1, 1], ['supportAt', '家庭支持几岁到位（0 = 买房那年，不买房就是今年）', '岁', 1, 1],
    ['taxFeePct', '税费和中介（占房价）', '%', 1, 0.5], ['sellFeePct', '卖房税费和中介（占房价）', '%', 1, 0.5], ['houseGrowth', '房价每年实际涨跌（扣通胀，负数为跌）', '%', 1, 0.5], ['leaseVacancy', '房子出租的空置率', '%', 1, 5], ['renoPerM2', '装修', '元/㎡', 1, 100], ['upkeepPerM2', '物业与维修', '元/㎡/年', 1, 5],
    ['minDown', '最低首付', '%', 1, 5], ['commRate', '房贷利率（按商贷；用公积金贷款可调低到约 2.6）', '%', 1, 0.05], ['loanYears', '贷款年限', '年', 1, 1], ['maxLoanAge', '贷款到期时最大年龄（多数银行约 70 岁）', '岁', 1, 1],
  ]},
  { id: 'g-living', title: '日常生活（每月）', sum: 'living', rows: [
    ['food', '餐饮', '元/月', 1, 100], ['transport', '交通', '元/月', 1, 50], ['comm', '通讯网络', '元/月', 1, 50],
    ['clothing', '衣着', '元/月', 1, 50], ['daily', '日用、水电、杂项', '元/月', 1, 50],
  ]},
  { id: 'g-fun', title: '快乐与人情（每年）', sum: 'fun', rows: [
    ['travel', '旅游', '元/年', 1, 1000], ['gifts', '送礼红包', '元/年', 1, 1000], ['shopping', '购物娱乐', '元/年', 1, 1000],
  ]},
  { id: 'g-med', title: '自己医疗（每年）', sum: 'med', rows: [
    ['medSelf', '医保外自付', '元/年', 1, 500], ['insurance', '商业保险', '元/年', 1, 500],
  ]},
];
const FIELD_GROUPS = [
  { id: 'g-parents', title: '赡养父母', parents: true, fields: [
    ['parents', '按总额：赡养父母（工作期合计）', '万', 1e4, 10],
    ['parAge', '父母现在大约多少岁', '岁', 1, 1], ['parSets', '要管几边父母（已婚时；单身按 1 边）', '边', 1, 1], ['parShare', '由你们家承担的比例（兄弟姐妹分摊时调低）', '%', 1, 5],
    ['parMonthly', '平时每月给每边父母', '元/月', 1, 500], ['careAge', '父母几岁起需要照护', '岁', 1, 1], ['careMonthly', '照护期每边每月花（护工、养老院、医疗自付）', '元/月', 1, 500], ['parEnd', '父母大约活到', '岁', 1, 1],
  ]},
  { id: 'g-invest', title: '投资', fields: [
    ['stockPct', '存款里放股票基金的比例（其余按存款利率）', '%', 1, 5], ['stockReturn', '股票基金长期实际年化收益（扣通胀）', '%', 1, 0.5]
  ]},
  { id: 'g-kid', title: '孩子', fields: [
    ['birthAge', '第一个孩子出生时你的年龄', '岁', 1, 1], ['kidGap', '孩子间隔', '年', 1, 1], ['laterKidPct', '老二、老三的养育费按老大的', '%', 1, 5],
    ['birthCost', '孕产（医保报销后）', '元', 1, 1000], ['childBase', '0–17 岁基础养育（吃穿用医）', '元/月', 1, 100],
    ['infantCare', '0–2 岁托育或阿姨', '元/月', 1, 100], ['infantSubsidy', '国家育儿补贴（0–2 岁）', '元/年', 1, 100],
    ['tutorCosts.light', '课外班：少量兴趣班', '元/月', 1, 50], ['tutorCosts.normal', '课外班：常规兴趣＋补习', '元/月', 1, 50], ['tutorCosts.heavy', '课外班：重度加码', '元/月', 1, 100],
    ['examPrep', '出国语培与考试（每次）', '元', 1, 1000], ['applyFee', '留学申请中介（每次）', '元', 1, 1000],
    ['kidAfterYears', '毕业后还要贴补几年（找工作、租房等）', '年', 1, 1], ['kidAfterYear', '毕业后每年贴补', '元/年', 1, 5000],
    ['kidHelp', '孩子结婚买房一次性资助（每个孩子）', '万', 1e4, 10], ['kidHelpAge', '资助时孩子几岁', '岁', 1, 1],
  ]},
  { id: 'g-edu', title: '当前路线的学费（每年）', edu: true },
  { id: 'g-opt', title: '结婚、买车、宠物（选填）', fields: [
    ['marriageAge', '结婚年龄', '岁', 1, 1], ['wedding', '结婚一次性花费（酒席、婚纱照、蜜月等）', '万', 1e4, 1],
    ['carPrice', '车价（0 = 不买车）', '万', 1e4, 1], ['carRunning', '每年养车（保险、油电、停车、保养）', '元/年', 1, 1000],
    ['carCycle', '多少年换一次车', '年', 1, 1], ['carAge', '第一次买车年龄', '岁', 1, 1], ['carUntil', '开车到', '岁', 1, 1],
    ['petYear', '宠物（每年）', '元/年', 1, 1000], ['petYears', '养宠物年数', '年', 1, 1],
  ]},
  { id: 'g-income', title: '工资怎么涨', fields: [
    ['me.months', '你一年到手几个月（含年终奖）', '个月', 1, 1], ['me.growth', '你的工资每年实际涨', '%', 1, 0.5], ['me.until', '你的工资涨到几岁后持平', '岁', 1, 1],
    ['me.downAt', '你的工资从几岁开始往下走', '岁', 1, 1], ['me.down', '之后每年降', '%', 1, 0.5],
    ['sp.months', '配偶一年到手几个月', '个月', 1, 1], ['sp.growth', '配偶的工资每年实际涨', '%', 1, 0.5], ['sp.until', '配偶的工资涨到几岁后持平', '岁', 1, 1],
    ['sp.downAt', '配偶的工资从几岁开始往下走', '岁', 1, 1], ['sp.down', '配偶之后每年降', '%', 1, 0.5],
  ]},
  { id: 'g-risk', title: '顺利与不顺', fields: [
    ['goodUp', '顺利：收入比你填的高', '%', 1, 5], ['badCut', '不顺：收入比你填的低', '%', 1, 5],
    ['badJobAge', '不顺：你几岁那年失业一整年', '岁', 1, 1], ['badShockAge', '不顺：几岁那年遇到一笔意外支出', '岁', 1, 1], ['badShockAmt', '不顺：意外支出金额（大病自付、家人急用等）', '万', 1e4, 1],
  ]},
  { id: 'g-tax', title: '利率与养老金口径', fields: [
    ['rate', '年化利率（存款、国债等）', '%', 1, 0.1], ['borrowRate', '缺钱时借款的年利率（消费贷、亲友借款等）', '%', 1, 0.1], ['inflation', '通胀率（0 = 全按今天的钱）', '%', 1, 0.1],
    ['tiers.0', '储蓄率对照 · 低档', '%', 1, 5], ['tiers.1', '储蓄率对照 · 中档', '%', 1, 5], ['tiers.2', '储蓄率对照 · 高档', '%', 1, 5],
    ['grossRatio', '到手约占税前的比例（只用来估算社保缴费基数和养老金）', '%', 1, 1],
    ['baseLow', '社保缴费基数下限', '元/月', 1, 1], ['baseHigh', '社保缴费基数上限', '元/月', 1, 1], ['avgWage', '社平工资＝养老金计发基数（上海 2025 年度 12577）', '元/月', 1, 1],
    ['acctRate', '养老金个人账户记账利率（扣掉通胀后）', '%', 1, 0.1], ['deemedYears', '你的视同缴费年限（1992 年底前参加工作才有）', '年', 1, 1], ['sp.deemed', '配偶的视同缴费年限', '年', 1, 1], ['transRate', '过渡性养老金计发比例（各省 1.0–1.4）', '%', 1, 0.1],
  ]},
];

function getPath(path, sub) {
  if (path.startsWith('edu.')) { const [, s, id] = path.split('.'); return eduCost(P, s, id); }
  const parts = path.split('.');
  let v = P[parts[0]];
  if (parts.length > 1) v = v[parts[1]];
  return sub ? v[sub] : v;
}
function setPath(path, sub, val) {
  if (path.startsWith('edu.')) { const [, s, id] = path.split('.'); P.eduCost[s + '.' + id] = val; return; }
  const parts = path.split('.');
  if (parts.length > 1) { P[parts[0]][parts[1]] = val; return; }
  if (sub) P[path][sub] = val; else P[path] = val;
}
const fmtIn = (v, scale) => Math.round(v / scale * 1000) / 1000;
const fieldHTML = ([key, label, unit, scale, step]) => {
  const id = 'f-' + key.replace(/\./g, '-');
  return `<div class="f" id="row-${key.replace(/\./g, '-')}"><label for="${id}">${label}</label><div class="num"><input type="number" id="${id}" data-key="${key}" data-scale="${scale}" step="${step}" inputmode="decimal"><span class="u">${unit}</span></div></div>`;
};

function buildPanel() {
  let h = '';
  // 养老
  h += `<details class="grp" id="g-retire"><summary>养老金与退休开销</summary><div class="fields">
    <div class="ctl"><span class="lab">退休后每人每月花多少</span><div class="num"><input id="f-retireSpend" data-key="retireSpend" data-scale="1" type="number" step="100" inputmode="decimal"><span class="u">元/人/月</span></div><span class="tip2" id="tip-retire"></span></div>
    <div class="ctl"><span class="lab">国家基本养老金</span><div class="num"><input id="f-pension" type="number" step="100" inputmode="decimal"><span class="u">元/人/月</span></div><span class="tip2" id="tip-pension"></span></div>
    <div class="ctl"><span class="lab">开始领养老金的年龄</span><div class="num"><input id="f-pensionAge" data-key="pensionAge" data-scale="1" type="number" step="1" inputmode="numeric"><span class="u">岁</span></div><div class="quick" id="q-page"><button type="button" data-v="63">男 63</button><button type="button" data-v="58">女 58</button><button type="button" data-v="55">女 55</button></div><span class="tip2">养老金要到法定退休年龄才能领，不是你不上班就能领。按 2025 年起的延迟退休规定，1985 年以后出生的男性 63 岁，女性 58 岁（原 50 岁退休的岗位为 55 岁）。</span></div>
    <label class="chk"><input type="checkbox" id="f-selfPay"> 不工作到领养老金之间，自己按最低基数继续缴社保（灵活就业）。这几年会算进缴费年限，否则养老金更少，最低缴费年限（将升到 20 年）也可能不够。</label>
    ${fieldHTML(['selfPayRate', '自缴社保比例（养老 20%＋医疗约 10%）', '%', 1, 1])}
    ${fieldHTML(['coupleFactor', '夫妻养老按几人份算', '人份', 1, 0.1])}
    ${fieldHTML(['lateExtra', '高龄护理：每人每月额外花（选填，如护工、养老院）', '元/人/月', 1, 500])}
    ${fieldHTML(['lateAge', '高龄护理从几岁开始', '岁', 1, 1])}
  </div></details>`;
  PAIR_GROUPS.forEach(g => {
    h += `<details class="grp" id="${g.id}"><summary>${g.title}<span class="sv" id="${g.id}-sv"></span></summary><div class="fields"><table class="pair"><thead><tr><th></th><th>单身</th><th>已婚</th></tr></thead><tbody>`;
    g.rows.forEach(([key, label, unit, scale, step]) => {
      h += `<tr><td>${label}<span class="u2">${unit}</span></td>`;
      ['s', 'c'].forEach(sub => { h += `<td><div class="num"><input type="number" id="f-${key}-${sub}" data-key="${key}" data-sub="${sub}" data-scale="${scale}" step="${step}" inputmode="decimal" aria-label="${label}（${sub === 's' ? '单身' : '已婚'}）"></div></td>`; });
      h += `</tr>`;
    });
    if (g.sum) h += `<tr class="sum"><td>合计</td><td id="${g.id}-s"></td><td id="${g.id}-c"></td></tr>`;
    h += `</tbody></table>`;
    if (g.fields) h += g.fields.map(fieldHTML).join('');
    h += `</div></details>`;
  });
  FIELD_GROUPS.forEach(g => {
    h += `<details class="grp" id="${g.id}"><summary>${g.title}<span class="sv" id="${g.id}-sv"></span></summary><div class="fields">`;
    if (g.parents) h += `<div class="seg pmode" id="seg-parents" role="group" aria-label="赡养父母怎么算"><button type="button" data-v="timeline">按父母年龄和照护期</button><button type="button" data-v="lump">按总额</button></div>`;
    if (g.edu) {
      h += `<p class="hint">只列你选的这条路线，其他学校的参考价见页面下方"教育费用参照"。按当前城市估算，改了以你填的为准；换城市会重置。</p><div class="fields" id="edu-fields"></div>`;
    } else h += g.fields.map(fieldHTML).join('');
    h += `</div></details>`;
  });
  const host = $('#groups');
  host.innerHTML = h;
  // 按"收入 → 生活 → 住房 → 家庭 → 养老 → 计算设定"的顺序排列，并加分节标题
  const ORDER = [['收入', ['g-income']], ['生活开销', ['g-living', 'g-fun', 'g-med']], ['住房', ['g-house']],
    ['家庭', ['g-kid', 'g-edu', 'g-parents', 'g-opt']], ['养老', ['g-retire']], ['顺利与不顺', ['g-risk']], ['投资', ['g-invest']], ['计算设定', ['g-tax']]];
  ORDER.forEach(([name, ids]) => {
    const hd = document.createElement('div'); hd.className = 'psec'; hd.textContent = name; host.appendChild(hd);
    ids.forEach(id => host.appendChild(document.getElementById(id)));
  });
  document.getElementById('g-income').open = true;
  host.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'f-selfPay') { P.selfPay = t.checked; update(); return; }
    if (t.dataset.key === 'pensionAge') { const v = parseFloat(t.value); if (v >= 50 && v <= 70) { P.pensionAge = Math.round(v); update(); } return; }
    if (t.id === 'f-pension') { const v = parseFloat(t.value); if (isFinite(v)) { P.pension = v; P.pensionAuto = false; update(); } return; }
    if (!t.dataset.key) return;
    const v = parseFloat(t.value);
    if (!isFinite(v)) return;
    if ((t.dataset.key === 'area' || t.dataset.key === 'rentArea') && v < 5) return;
    setPath(t.dataset.key, t.dataset.sub, v * +t.dataset.scale);
    update();
  });
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.closest('#q-page')) { P.pensionAge = +b.dataset.v; syncInputs(); update(); }
    if (b.closest('#seg-parents')) { P.parentsMode = b.dataset.v; syncInputs(); update(); }
    if (b.id === 'btn-pen-auto') { P.pensionAuto = true; update(); syncInputs(); }
    if (b.id === 'btn-pen-inc') { P.pension = +b.dataset.v; P.pensionAuto = false; syncInputs(); update(); }
  });
}

let eduSig = '';
function renderEduFields() {
  const sig = STAGE_KEYS.map(s => P.stages[s]).join('|');
  if (sig === eduSig) return;
  eduSig = sig;
  let h = '';
  STAGE_KEYS.forEach(s => {
    const o = eduOpt(s, P.stages[s]);
    if (!o.cost || (s === 'grad' && P.stages.uni === 'none')) return;
    h += fieldHTML([`edu.${s}.${o.id}`, `${EDU[s].name}：${o.name}`, '元/年', 1, 1000]);
  });
  $('#edu-fields').innerHTML = h || '<p class="hint">这条路线没有学费项。</p>';
}
function syncVisibility() {
  const kid = P.family === 'kid';
  ['g-kid', 'g-edu'].forEach(id => { $('#' + id).hidden = !kid; });
  ['row-kidGap', 'row-laterKidPct'].forEach(id => { const el = $('#' + id); if (el) el.hidden = !(kid && P.kids >= 2); });
  $('#row-marriageAge').hidden = P.family === 'single';
  ['row-ownMortgage', 'row-ownLoanYears'].forEach(id => { $('#' + id).hidden = P.housing !== 'own'; });
  ['row-sp-months', 'row-sp-growth', 'row-sp-until', 'row-sp-downAt', 'row-sp-down'].forEach(id => { const el = $('#' + id); if (el) el.hidden = P.family === 'single'; });
  const have = P.mode === 'have';
  $('#h-income').hidden = !have;
  $('#h-sp-wrap').hidden = P.family === 'single' || !have;
  $('#h-split-line').hidden = have || P.family === 'single';
  $('#h-sp-line').hidden = P.family === 'single';
  $('#h-sp-same').hidden = !!P.spSync;
  $('#h-work-hint').innerHTML = P.startAge >= 25 && !P.paidYears && P.retireAge >= P.startAge
    ? `<b>你 ${P.startAge} 岁，之前交过社保吗？</b>交过就把年数填进"之前已交社保"，养老金只按今后 ${P.retireAge - P.startAge + 1} 年算会偏低。` : '不工作不等于能领养老金：1985 年后出生男性 63 岁、女性 58 岁起领。';
  ['row-tiers-0', 'row-tiers-1', 'row-tiers-2'].forEach(id => { const el = $('#' + id); if (el) el.hidden = have; });
  $('#row-wedding').hidden = P.family === 'single';
}
function syncInputs() {
  renderEduFields();
  syncVisibility();
  document.querySelectorAll('#groups input[data-key]').forEach(inp => {
    if (document.activeElement === inp) return;
    inp.value = fmtIn(getPath(inp.dataset.key, inp.dataset.sub), +inp.dataset.scale);
  });
  const fp = $('#f-pension'); if (document.activeElement !== fp) fp.value = P.pension;
  const tl = P.parentsMode === 'timeline';
  document.querySelectorAll('#seg-parents button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === P.parentsMode ? 'true' : 'false'));
  $('#row-parents').hidden = tl;
  ['parAge', 'parSets', 'parShare', 'parMonthly', 'careAge', 'careMonthly', 'parEnd'].forEach(k => { $('#row-' + k).hidden = !tl; });
  $('#f-selfPay').checked = !!P.selfPay;
  $('#row-selfPayRate').hidden = !P.selfPay;
  const hs = { '#h-sp-age': P.sp.age, '#h-sp-ret': P.sp.retire, '#h-sp-page': P.sp.pensionAge, '#h-sav': fmtIn(P.savings, 1e4), '#h-split': P.split, '#h-me-sal': P.me.salary, '#h-me-mon': P.me.months, '#h-sp-sal': P.sp.salary, '#h-sp-mon': P.sp.months, '#h-start': P.startAge, '#h-retire': P.retireAge, '#h-page': P.pensionAge, '#h-end': P.endAge, '#h-paid': P.paidYears, '#h-sp-paid': P.sp.paid, '#h-support': fmtIn(P.support[K()], 1e4) };
  for (const s in hs) if (document.activeElement !== $(s)) $(s).value = hs[s];
  $('#h-city').value = P.city;
  $('#h-kids').value = String(P.kids);
  const rs = $('#h-route'), rid = routeId(P);
  rs.querySelector('option[value="custom"]').hidden = rid !== 'custom';
  rs.value = rid;
  syncSegs();
}
const routeOf = (q = P) => ROUTES.find(x => STAGE_KEYS.every(s => x.st[s] === q.stages[s]) && x.tutor === q.tutor);
function routeId(q = P) { const r = routeOf(q); return r ? r.id : 'custom'; }
function setRoute(q, r) { q.stages = clone(r.st); q.tutor = r.tutor; }
function syncSegs() {
  const map = { family: P.family, housing: P.housing, tutor: P.tutor, mode: P.mode };
  for (const k in map) document.querySelectorAll(`#seg-${k} button`).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === map[k] ? 'true' : 'false'));
  $('#h-kids-wrap').hidden = P.family !== 'kid';
  $('#h-route-wrap').hidden = P.family !== 'kid';
}

// ---------- 中途搬家 ----------
function renderMoves() {
  const host = $('#h-moves');
  if (host.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;   // 正在输入时不重画
  const opts = (sel, list) => list.map(([v, n]) => `<option value="${v}"${String(v) === String(sel) ? ' selected' : ''}>${n}</option>`).join('');
  const cityOpts = sel => opts(sel, CITIES.map(c => [c.id, c.name]));
  let h = P.moves.map((m, i) => {
    const hadHouse = P.housing !== 'rent' || i > 0;
    return `<p class="mv" data-i="${i}">${i ? '再之后' : '以后'} <input data-f="age" type="number" inputmode="numeric" value="${m.age}" aria-label="第 ${i + 1} 次搬家年龄"> 岁搬到 <select data-f="city" aria-label="搬到哪个城市">${cityOpts(m.city)}</select>` +
      (hadHouse ? `，原来的房子 <select data-f="sell" aria-label="原来的房子">${opts(m.sell === 'lease' ? 'lease' : m.sell === false ? 'keep' : 'sell', [['sell', '卖掉'], ['lease', '留着出租'], ['keep', '留着空置']])}</select>` : '') +
      `，到那边 <select data-f="home" aria-label="到新城市住哪">${opts(m.home, HOMES)}</select>` +
      (m.home !== 'rent' ? ` <input data-f="area" class="wide" type="number" inputmode="decimal" value="${m.area || P.area[K()]}" aria-label="新房面积"> ㎡` : '') +
      `。<button type="button" class="x" data-act="del" aria-label="删掉这次搬家" title="删掉">×</button></p>`;
  }).join('');
  if (P.moves.length) {
    const c0 = city(), c1 = cityById(P.moves[P.moves.length - 1].city);
    h += `<p class="mvnote">搬家后房价、租金、生活开销、学费和社保基数都按新城市（区位按全市均价）。<label><input type="checkbox" data-act="wage"${P.moveWage !== false ? ' checked' : ''}> 工资按两地平均工资比例调整（${c1.name}约为${c0.name}的 ${Math.round(c1.wage / c0.wage * 100)}%）</label></p>`;
  }
  if (P.moves.length < 3) h += `<p class="mv"><button type="button" class="linkbtn add" data-act="add">＋ 搬家或换房</button></p>`;
  host.innerHTML = h;
}
function cleanEvents(list) {
  return (Array.isArray(list) ? list : []).filter(e => e && EVT[e.type] && isFinite(+e.age)).slice(0, 10)
    .map(e => ({ age: Math.round(+e.age), type: e.type, amount: isFinite(+e.amount) ? +e.amount : 0, years: Math.max(1, Math.round(+e.years || 1)), who: e.who === 'sp' ? 'sp' : 'me' }));
}
function renderEvents() {
  const host = $('#h-events');
  if (host.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;
  const two = P.family !== 'single';
  const num = (f, v, label, cls = '') => `<input data-f="${f}" class="${cls}" type="number" inputmode="decimal" value="${v}" aria-label="${label}">`;
  const whoSel = e => two ? `<select data-f="who" class="sm" aria-label="谁">${[['me', '我'], ['sp', '配偶']].map(([v, n]) => `<option value="${v}"${e.who === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` : '';
  let h = P.events.map((e, i) => {
    let body = '';
    if (e.type === 'gap') body = `停工 ${num('years', e.years, '停工几年')} 年，这几年没有工资（进修、创业、休息、带孩子）`;
    else if (e.type === 'salary') body = `工资从这年起变化 ${num('amount', e.amount, '变化百分比')} %（转行、升职为正，降薪为负）`;
    else if (e.type === 'income') body = `一次性进账 ${num('amount', e.amount, '金额（万）', 'wide')} 万（继承、拆迁、卖车等）`;
    else if (e.type === 'expense') body = `一次性花 ${num('amount', e.amount, '金额（万）', 'wide')} 万（装修、换车、创业投入、帮亲戚等）`;
    else if (e.type === 'study') body = `在职读书/培训，每年 ${num('amount', e.amount, '每年学费（万）', 'wide')} 万，读 ${num('years', e.years, '读几年')} 年`;
    else if (e.type === 'side') body = `副业每月税后 ${num('amount', e.amount, '每月收入（元）', 'wider')} 元，做 ${num('years', e.years, '做几年')} 年`;
    return `<p class="mv ev" data-i="${i}">${num('age', e.age, '哪一岁')} 岁 ${e.type === 'gap' || e.type === 'salary' ? whoSel(e) : ''}<select data-f="type" aria-label="什么事">${Object.entries(EVT).map(([v, n]) => `<option value="${v}"${e.type === v ? ' selected' : ''}>${n}</option>`).join('')}</select>：${body}。<button type="button" class="x" data-act="del" aria-label="删掉这件事" title="删掉">×</button></p>`;
  }).join('');
  if (P.events.length < 10) h += `<p class="mv"><button type="button" class="linkbtn add" data-act="add">＋ 人生大事（继承、装修、副业……）</button><button type="button" class="linkbtn add" data-act="add-job" data-who="me">＋ 我的工作变动</button>${two ? '<button type="button" class="linkbtn add" data-act="add-job" data-who="sp">＋ 配偶的工作变动</button>' : ''}</p>`;
  host.innerHTML = h;
}
function bindEvents() {
  const host = $('#h-events');
  const upd = e => {
    const row = e.target.closest('.ev[data-i]'); const f = e.target.dataset.f; if (!row || !f) return;
    const ev = P.events[+row.dataset.i]; const v = e.target.value;
    if (f === 'age') { const n = Math.round(+v); if (!(n >= P.startAge && n <= P.endAge)) return; ev.age = n; }
    else if (f === 'type') { ev.type = v; Object.assign(ev, EVT_DEF[v]); }
    else if (f === 'who') ev.who = v;
    else if (f === 'amount') { const n = +v; if (!isFinite(n) || (ev.type === 'salary' && n < -100)) return; ev.amount = n; }
    else if (f === 'years') { const n = Math.round(+v); if (!(n >= 1 && n <= 60)) return; ev.years = n; }
    update();
  };
  host.addEventListener('input', e => { if (e.target.tagName === 'INPUT') upd(e); });
  host.addEventListener('change', e => { if (e.target.tagName === 'SELECT') { upd(e); renderEvents(); } });
  host.addEventListener('focusout', () => setTimeout(() => { if (!host.contains(document.activeElement)) renderEvents(); }, 0));
  host.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    if (b.dataset.act === 'add') P.events.push({ age: Math.min(P.endAge, P.startAge + 8), type: 'expense', amount: 20, years: 1, who: 'me' });
    else if (b.dataset.act === 'add-job') P.events.push({ age: Math.min(P.endAge, P.startAge + 5), type: 'salary', amount: 20, years: 1, who: b.dataset.who });
    else if (b.dataset.act === 'del') P.events.splice(+b.closest('.ev').dataset.i, 1);
    update(); renderEvents();
  });
}
function bindMoves() {
  const host = $('#h-moves');
  const upd = e => {
    const row = e.target.closest('.mv[data-i]'); const f = e.target.dataset.f; if (!row || !f) return;
    const m = P.moves[+row.dataset.i]; const v = e.target.value;
    if (f === 'age') { const n = Math.round(+v); if (!(n > P.startAge && n <= P.endAge)) return; m.age = n; }
    else if (f === 'city') m.city = v;
    else if (f === 'sell') m.sell = v === 'lease' ? 'lease' : v !== 'keep';
    else if (f === 'home') { m.home = v; update(); renderMoves(); return; }
    else if (f === 'area') { const n = +v; if (!(n >= 5)) return; m.area = n; }
    update();
  };
  host.addEventListener('input', e => { if (e.target.tagName === 'INPUT' && e.target.type === 'number') upd(e); });
  host.addEventListener('change', e => {
    if (e.target.dataset.act === 'wage') { P.moveWage = e.target.checked; update(); renderMoves(); return; }
    if (e.target.tagName === 'SELECT') { upd(e); renderMoves(); }
  });
  host.addEventListener('focusout', () => setTimeout(() => { if (!host.contains(document.activeElement)) renderMoves(); }, 0));
  host.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    if (b.dataset.act === 'add') {
      const last = P.moves.length ? P.moves[P.moves.length - 1].age : P.startAge;
      const age = Math.min(P.endAge, Math.max(last + 5, Math.min(P.startAge + 10, P.retireAge)));
      const prev = P.moves.length ? P.moves[P.moves.length - 1].city : P.city;
      P.moves.push({ age, city: prev !== P.city ? P.city : (P.city === 'cd' ? 'sh' : 'cd'), sell: true, home: 'buy', area: 0 });
    } else if (b.dataset.act === 'del') { P.moves.splice(+b.closest('.mv').dataset.i, 1); }
    update(); renderMoves();
  });
}

// ---------- 顶部那句话 ----------
function bindHero() {
  const sel = $('#h-city');
  const grp = (t, list) => `<optgroup label="${t}">${list.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`;
  sel.innerHTML = grp('一线城市', CITIES.filter(c => c.tier === 1)) + grp('新一线与二线', CITIES.filter(c => c.tier === 2)) + grp('其他', CITIES.filter(c => c.tier === 3));
  sel.addEventListener('change', () => { applyCity(P, sel.value); syncInputs(); update(); });
  const rsel = $('#h-route');
  rsel.innerHTML = ROUTES.map(r => `<option value="${r.id}">${r.name}</option>`).join('') + '<option value="custom">自定义路线</option>';
  rsel.addEventListener('change', () => { const r = ROUTES.find(x => x.id === rsel.value); if (r) { setRoute(P, r); update(); } });
  const num = (id, fn) => $(id).addEventListener('input', e => { const v = parseFloat(e.target.value); if (isFinite(v)) { fn(v); update(); } });
  num('#h-start', v => { if (v >= 16 && v < P.retireAge) { P.startAge = Math.round(v); if (P.buyAge < P.startAge) P.buyAge = P.startAge; } });
  num('#h-retire', v => { if (v > P.startAge && v < P.endAge) P.retireAge = Math.round(v); });
  num('#h-me-sal', v => { if (v >= 0) P.me.salary = v; });
  num('#h-sp-sal', v => { if (v >= 0) P.sp.salary = v; });
  num('#h-sav', v => { if (v >= 0) P.savings = v * 1e4; });
  num('#h-sp-age', v => { if (v >= 16 && v <= 80) { P.sp.age = Math.round(v); P.spSync = false; } });
  num('#h-sp-ret', v => { if (v >= 20 && v <= 80) { P.sp.retire = Math.round(v); P.spSync = false; } });
  num('#h-sp-page', v => { if (v >= 50 && v <= 70) { P.sp.pensionAge = Math.round(v); P.spSync = false; } });
  $('#h-sp-same').addEventListener('click', () => { P.spSync = true; update(); });
  num('#h-split', v => { if (v >= 0 && v <= 100) P.split = v; });
  num('#h-me-mon', v => { if (v >= 1 && v <= 30) P.me.months = v; });
  num('#h-sp-mon', v => { if (v >= 1 && v <= 30) P.sp.months = v; });
  $('#seg-mode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; P.mode = b.dataset.v; TAB = P.mode === 'have' ? 'sum' : 'spend'; syncInputs(); update(); });
  num('#h-page', v => { if (v >= 50 && v <= 70) P.pensionAge = Math.round(v); });
  num('#h-paid', v => { if (v >= 0 && v <= 50) P.paidYears = Math.round(v); });
  num('#h-sp-paid', v => { if (v >= 0 && v <= 50) { P.sp.paid = Math.round(v); P.spSync = false; } });
  num('#h-end', v => { if (v > P.retireAge && v <= 110) P.endAge = Math.round(v); });
  num('#h-support', v => { if (v >= 0) P.support[K()] = v * 1e4; });
  $('#h-kids').addEventListener('change', e => { P.kids = +e.target.value; update(); });
  ['family', 'housing'].forEach(k => $(`#seg-${k}`).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    P[k] = b.dataset.v; syncInputs(); update();
  }));
  $('#citycard').addEventListener('click', e => {
    const b = e.target.closest('button[data-loc]'); if (!b) return;
    P.locFactor = +b.dataset.loc; syncInputs(); update();
  });
  $('#citycard').addEventListener('input', e => {
    if (e.target.id !== 'h-area') return;
    const v = parseFloat(e.target.value); if (isFinite(v) && v >= 5) { P.area[K()] = v; syncInputs(); update(); }
  });
}

// ---------- 其他交互 ----------
function bindOther() {
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    TAB = b.dataset.tab; renderTabs(); renderCharts(); if (TAB === 'assume') renderAssume();
    const top = $('#report').getBoundingClientRect().top + scrollY - 8; if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
  });
  $('#mob-toggle').addEventListener('click', () => {
    const p = $('#panel'), open = p.classList.toggle('collapsed') === false;
    $('#mob-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('#mob-toggle').lastElementChild.textContent = open ? '－' : '＋';
  });
  $('#btn-reset').addEventListener('click', () => { P = fresh(); syncInputs(); update(); });
  $('#btn-city-reset').addEventListener('click', () => { applyCity(P, P.city); P.pensionAuto = true; syncInputs(); update(); });
  $('#routes').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const r = ROUTES.find(x => x.id === b.dataset.v); if (!r) return;
    setRoute(P, r); syncInputs(); update();
  });
  $('#routetable').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-route]'); if (!tr) return;
    const r = ROUTES.find(x => x.id === tr.dataset.route); if (r) { setRoute(P, r); if (P.family !== 'kid') P.family = 'kid'; syncInputs(); update(); $('#s2').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('#au-age').addEventListener('change', renderAuditYear);
  $('#ev-go').addEventListener('click', runEval);
  $('#au-csv').addEventListener('click', () => saveFile('一生账本-逐年明细.csv', csvText(), 'text/csv'));
  $('#au-json').addEventListener('click', () => saveFile('一生账本-参数与结果.json', JSON.stringify({ app: '一生账本', saved: new Date().toISOString().slice(0, 10), params: P, results: { 今后总支出: Math.round(C.total), 最终自筹: Math.round(C.selfFund), 起步需要到手: Math.round(C.I), 自检: auditChecks().map(([t, okk, d]) => ({ 项目: t, 通过: okk, 说明: d })) } }, null, 2), 'application/json'));
  $('#btn-copy').addEventListener('click', () => {
    const ta = $('#snap'), msg = $('#snap-msg');
    const fallback = () => { ta.focus(); ta.select(); msg.textContent = '已选中全部文字，按 Ctrl/⌘+C 复制'; };
    try { navigator.clipboard.writeText(ta.value).then(() => { msg.textContent = '已复制到剪贴板'; }, fallback); } catch (e) { fallback(); }
  });
  $('#btn-apply').addEventListener('click', () => {
    const msg = $('#snap-msg');
    try {
      let raw = $('#snap').value.trim(); const i = raw.indexOf('{'); if (i > 0) raw = raw.slice(i);
      const obj = JSON.parse(raw);
      P = sanitize(merge(fresh(), migrate(obj.params || obj))); syncInputs(); update();
      msg.textContent = '已按快照还原参数';
    } catch (e) { msg.textContent = '这段文字不是有效的快照。请粘贴"复制快照"得到的完整内容。'; }
  });
  // 鼠标滚轮经过聚焦的数字框时会悄悄改值，这里先让它失焦
  document.addEventListener('wheel', e => { const a = document.activeElement; if (a && a.type === 'number' && a.contains(e.target)) a.blur(); }, { passive: true });
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderCharts, 120); });
}

// ---------- 主流程 ----------
function focusKey() {
  const el = document.activeElement; if (!el) return null;
  for (const id of ['stagegrid', 'routes', 'seg-tutor', 'seg-loc']) {
    const host = document.getElementById(id);
    if (host && host.contains(el)) {
      if (el.dataset.stage) return `#${id} [data-stage="${el.dataset.stage}"]`;
      if (el.dataset.v) return `#${id} [data-v="${el.dataset.v}"]`;
      if (el.dataset.loc) return `#${id} [data-loc="${el.dataset.loc}"]`;
    }
  }
  return null;
}
let heavyT = null, first = true, TAB = null;
const TABS = [['sum', '能过什么生活', () => C.have], ['spend', '今后花多少'], ['edu', '孩子教育', () => P.family === 'kid'], ['earn', () => C.have ? '对照：要赚多少' : '每年要赚多少'], ['risk', '现金流与三种情况'], ['assume', '假设清单'], ['audit', '核对计算'], ['basis', '依据与存档']];
function renderTabs() {
  const list = TABS.filter(t => !t[2] || t[2]());
  if (!TAB || !list.some(t => t[0] === TAB)) TAB = list[0][0];
  const badge = { audit: AUDIT ? `${AUDIT.pass}/${AUDIT.n} 通过` : '', spend: Wu(C.total), earn: C.enough ? '0' : Wu(C.I), risk: C.have ? '不顺：' + outShort(C.scen.bad)[0] : (C.enough ? '' : '不顺 ' + Wu(C.scen.Ibad)), assume: ASSUME_N ? ASSUME_N + ' 条' : '' };
  $('#tabs').innerHTML = list.map(t => `<button type="button" role="tab" data-tab="${t[0]}" aria-selected="${t[0] === TAB}">${typeof t[1] === 'function' ? t[1]() : t[1]}${badge[t[0]] ? `<small>${badge[t[0]]}</small>` : ''}</button>`).join('');
  document.querySelectorAll('#report .sec[data-tab]').forEach(sec => { sec.hidden = sec.dataset.tab !== TAB; });
}
function update() {
  const fk = focusKey();
  if (P.spSync) { P.sp.age = P.startAge; P.sp.retire = P.retireAge; P.sp.pensionAge = P.pensionAge; P.sp.paid = P.paidYears; }
  const N = P.retireAge - P.startAge + 1;
  if (P.pensionAuto) P.pension = Math.round(pensionEstimate(P, P.baseLow, contribYears(P), 0, P.deemedYears).total / 100) * 100;
  C = compute(P);
  renderCity(); renderLead(); renderHow(); renderPanelBits(); renderTabs(); renderMoves(); renderEvents();
  $('#s4-title').textContent = C.have ? '对照：这个设定每年要赚多少' : '每年要赚多少';
  renderTimeline(); renderBreakdown(); renderStages(); renderYearTable();
  renderEdu(); renderEquation(); renderCalc(); renderTiers(); renderPension();
  renderCharts(); renderSim(); renderSources(); renderLimits(); renderSnap(); renderAudit();
  syncInputs();
  // 需要反复重算的表稍后再画，输入时不卡
  clearTimeout(heavyT);
  heavyT = setTimeout(() => { renderS0(); renderRouteTable(); renderScen(); renderTabs(); if (TAB === 'assume') renderAssume(); }, first ? 0 : 150);
  first = false;
  if (fk) { const el = document.querySelector(fk); if (el) el.focus(); }
  save();
}

const sameM = (c = C, key = 'earners') => c.adults === 1 || Math.abs(c[key][0].M - c[key][1].M) < 50;
const earnerLabel = (c = C) => c.adults === 1 ? '每月到手' : (sameM(c) ? '每月到手（每人）' : '每月到手（你 / 配偶）');
const mStr = (c = C, key = 'earners') => sameM(c, key) ? M100(c[key][0].M) : M100(c[key][0].M) + ' / ' + M100(c[key][1].M);
const selfTxt = (c = C) => c.selfFund > 0 ? `需要自己挣 <b>${Wu(c.selfFund)}</b>` : `不需要再自己挣，还富余 <b>${Wu(-c.selfFund)}</b>`;
const growthText = () => {
  const one = C.adults === 1;
  const t = pr => pr.growth ? `每年涨 ${pr.growth}% 到 ${pr.until} 岁` : '不涨';
  return one || (P.me.growth === P.sp.growth && P.me.until === P.sp.until && P.spSync) ? `工资${t(P.me)}` : `你的工资${t(P.me)}，配偶${t(P.sp)}`;
};
function routeName(q = P) { const r = routeOf(q); return r ? r.name : '自定义（在参数里改过学费档）'; }

const LOCS = [[180, '核心区'], [100, '全市均价'], [70, '外围'], [50, '远郊']];
function buildCityCard() {
  $('#citycard').innerHTML =
    `<div class="hd"><b id="cc-title"></b><span>已自动填进参数，可以逐项改。换城市会用新城市的数覆盖。</span></div>` +
    `<div class="cstats" id="cc-stats"></div>` +
    `<div class="house"><span id="h-area-lab">买房面积</span><div class="num"><input id="h-area" type="number" step="5" inputmode="decimal" aria-label="买房面积"><span class="u">㎡</span></div>` +
    `<span>区位</span><div class="seg" id="seg-loc" role="group" aria-label="区位">${LOCS.map(([v, n]) => `<button type="button" data-loc="${v}">${n}</button>`).join('')}</div>` +
    `<span class="calc-line" id="cc-calc"></span></div>`;
}
function renderCity() {
  const c = city(), k = K();
  const ratio = c.cons / SH_CONS;
  const stat = (label, v, note, est) => `<div class="cstat"><span class="k">${label}${est ? '<span class="est">估</span>' : ''}</span><span class="v">${v}</span><span class="n">${note}</span></div>`;
  $('#cc-title').textContent = c.name + '参考值';
  $('#cc-stats').innerHTML =
    stat('二手房均价', Y(c.price) + '<small> 元/㎡</small>', '房天下 2026 年 8 月挂牌价，成交价通常更低') +
    stat('住宅租金', c.rent.toFixed(c.rent % 1 ? 2 : 0) + '<small> 元/㎡/月</small>', c.rentEst ? '按租金房价比推算' : '中指研究院 2026 年', c.rentEst) +
    stat('城镇人均消费', Y(c.cons / 12) + '<small> 元/月</small>', `2025 年 ${Y(c.cons)} 元/年`) +
    stat('生活开销系数', ratio.toFixed(2), '以上海为 1，用来缩放日常、快乐和养育开销') +
    stat('社保缴费基数', `${Y(c.low)}–${Y(c.high)}`, (c.baseEst ? '按社平工资 60%–300% 估算' : '当地最新公布标准') + '，只用来估算养老金', c.baseEst);
  $('#h-area-lab').textContent = P.housing === 'own' ? '房子面积' : '买房面积';
  const inp = $('#h-area'); if (document.activeElement !== inp) inp.value = P.area[k];
  document.querySelectorAll('#seg-loc button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.loc === P.locFactor ? 'true' : 'false'));
  const odd = P.unitPrice > 200000 || P.unitPrice < 2000;
  $('#cc-calc').innerHTML = (odd ? `<span class="est">请检查</span> 单价 ${Y(P.unitPrice)} 元/㎡${P.unitPrice > 200000 ? '远高于任何城市的房价，是不是把总价填进了单价？' : '过低。'}这里要填每平方米的价格（${city().name}均价约 ${Y(city().price)} 元/㎡），可以在左侧"住房"里改，或点"按当前城市重填参考值"。<br>` : '') + `${P.area[k]}㎡ × ${Y(P.unitPrice)} 元/㎡ × 区位 ${P.locFactor}% = <b>${Wu(C.price)}</b>` +
    (P.housing === 'rent' ? `；当前选的是一直租房，${P.rentArea[k]}㎡ 月租约 ${Y(C.rentMonthly)} 元` : P.housing === 'own' ? `；当前选的是已有房，不再计房价，只计物业维修${P.ownMortgage > 0 ? `和剩余房贷 ${Y(P.ownMortgage)} 元/月 × ${P.ownLoanYears} 年` : ''}（面积用于估算物业维修）` : `；买房前租 ${P.rentArea[k]}㎡ 约 ${Y(C.rentMonthly)} 元/月`);
}

function scenarioName() {
  let s = `${city().name} · ${FAM[P.family]}`;
  if (P.family === 'kid') s += ` ${P.kids} 孩 · ${routeName(P)}`;
  s += ` · ${P.housing === 'buy' ? (C && !C.buy && C.moves.length ? '先租房' : '买 ' + P.area[K()] + '㎡ 房') : P.housing === 'own' ? '已有房' : '一直租房'}`;
  if (C && C.moves.length) s += C.moves.map(m => ` · ${m.age} 岁搬到${cityById(m.city).name}`).join('');
  return s;
}

// ---------- 三种情况 ----------
const scenBad = (c = C) => { const s = c.scen; return `收入低 ${s.cut}%${s.jobAge !== null ? `、${s.jobAge} 岁那年你失业一整年` : ''}${s.shockAge !== null ? `、${s.shockAge} 岁一笔 ${W(s.shockAmt)} 万意外支出` : ''}`; };
const SCEN = () => [['good', '顺利', `收入高 ${C.scen.up}%`], ['base', '一般', '就按你填的'], ['bad', '不顺', scenBad()]];
// 终点存款折回今天：几十年复利滚出来的数太大，不直观，折成今天的钱再说（存款按存款利率、欠款按借款利率折）
const pvEnd = s => s.end / Math.pow(1 + (s.end < 0 ? C.rb : C.rMix), P.endAge - P.startAge + 1);
const outcome = s => s.minBal >= -1 ? `<b class="ok">够</b>，到 ${P.endAge} 岁还有富余，折合今天约 ${Wu(pvEnd(s))}`
  : s.end >= -1 ? `<b class="warn">总账够，但中间缺钱</b>：${s.minAge} 岁前后最多要借约 ${Wu(-s.minBal)}`
  : `<b class="no">不够</b>：${s.lastOk === null ? '从今年起' : `${s.lastOk + 1} 岁起`}存款一直是负的，缺口折合今天约 ${Wu(-pvEnd(s))}`;
const outShort = s => s.minBal >= -1 ? ['够', ''] : s.end >= -1 ? ['中间缺钱', ''] : ['不够', ''];
function scenList() {
  const rows = SCEN().map(([k, n, d]) => C.have ? `<li><b>${n}</b>（${d}）：${outcome(C.scen[k])}</li>`
    : `<li><b>${n}</b>（${d}）：起步那年${C.adults === 2 ? '家庭' : ''}要到手约 <b>${Wu(k === 'good' ? C.scen.Igood : k === 'bad' ? C.scen.Ibad : C.I)}</b></li>`);
  return `<ul class="scen3">${rows.join('')}</ul>`;
}
function renderLead() {
  const s = C.sim;
  const gapMsg = C.gap ? `<p class="alert">${C.gap > 1 ? `${P.retireAge + 1}–${C.P0 - 1} 岁这 <b>${C.gap}</b> 年` : `${P.retireAge + 1} 岁这 <b>1</b> 年`}不工作，也还没到 ${C.P0} 岁领养老金，一共要花 <b>${Wu(C.gapCost)}</b>${C.socialTotal ? `（含自缴社保 ${Wu(C.socialTotal)}）` : ''}，全部从存款出，已经算进结果。</p>` : '';
  const spGapMsg = C.married && C.spGap ? `<p class="alert">配偶 ${P.sp.retire + 1}${C.spGap > 1 ? `–${C.P0sp - 1}` : ''} 岁这 <b>${C.spGap}</b> 年不工作、也还没到 ${C.P0sp} 岁领养老金，这几年家里少一份收入，已经算进结果。</p>` : '';
  const priceMsg = (P.unitPrice > 200000 && P.housing === 'buy') ? `<p class="alert">房价单价填成了 <b>${Y(P.unitPrice)}</b> 元/㎡，房子总价变成 <b>${Wu(C.price)}</b>，所有结果都会被放大。单价应该填每平方米的价格，${city().name}均价约 ${Y(city().price)} 元/㎡。</p>` : '';
  const loanMsg = C.loanCapped ? `<p class="alert">${P.buyAge} 岁买房，贷款到期时不能超过 ${P.maxLoanAge} 岁，${C.loanYrs > 0 ? `贷款年限从 ${P.loanYears} 年缩短到 <b>${C.loanYrs}</b> 年，月供更高` : '<b>只能全款买</b>'}，已经算进结果。</p>` : '';
  const warn = [];
  const lowSal = (v, who) => { if (v > 0 && v < 1000) warn.push(`${who}每月到手填的是 <b>${Y(v)}</b> 元，是不是少打了一个 0？`); if (v > 1e6) warn.push(`${who}每月到手填的是 <b>${Y(v)}</b> 元，请确认单位是元/月。`); };
  if (C.have) { lowSal(P.me.salary, '你的'); if (C.adults === 2) lowSal(P.sp.salary, '配偶'); }
  if (P.savings > 1e8) warn.push(`现有存款填的是 <b>${Wu(P.savings)}</b>（单位是万元），请确认没有多打 0。`);
  const inputMsg = warn.map(x => `<p class="alert">${x}</p>`).join('');
  const kpi = k => k.map(([a, v, u, sub], i) => `<div class="kpi${i === 2 ? ' hl' : ''}"><span class="k">${a}</span><span class="v">${v}<small>${u}</small></span><span class="s">${sub}</span></div>`).join('');
  const tail = `<p class="lead-note">这是按假设推出来的"如果……就……"，不是预测，也不评价怎么过日子才对。每条假设都在"假设清单"里，可以改，也可以告诉我们哪条不对。</p>`;
  const two = C.adults === 2;
  if (C.have) {
    const mo = two ? `你每月到手约 ${M100(P.me.salary)} 元、配偶约 ${M100(P.sp.salary)} 元` : `每月到手约 ${M100(P.me.salary)} 元`;
    $('#lead').innerHTML = `<b>如果</b>${mo}（${growthText()}），按这个设定生活（${scenarioName()}），从今年到 ${P.endAge} 岁大约要花 <b>${Wu(C.total)}</b>，<b>那么</b>：` + scenList() + tail;
    const g = outShort(C.scen.base), b = outShort(C.scen.bad);
    $('#kpis').innerHTML = kpi([
      [`今后总支出（${P.startAge}–${P.endAge} 岁）`, W(C.total), '万', `工作期 ${W(C.workTotal)} ＋ 不工作以后 ${W(C.retTotal)}`],
      [`你${two ? '们' : ''}今年到手`, W(C.act0), '万/年', `${two && !C.premarital ? '家庭合计 · ' : ''}${growthText()}`],
      ['一般情况', g[0], g[1], C.scen.base.minBal >= -1 ? `最紧那年还有 ${W(C.scen.base.minBal)} 万` : C.scen.base.end >= -1 ? `${C.scen.base.minAge} 岁前后最多借 ${W(-C.scen.base.minBal)} 万` : `${C.scen.base.lastOk === null ? '从今年起' : (C.scen.base.lastOk + 1) + ' 岁起'}存款一直为负`],
      ['不顺的情况', b[0], b[1], C.scen.bad.end < -1 ? `${C.scen.bad.lastOk === null ? '从今年起' : (C.scen.bad.lastOk + 1) + ' 岁起'}存款一直为负` : scenBad()],
    ]);
    setAlerts(inputMsg + priceMsg + loanMsg + gapMsg + spGapMsg);
    return;
  }
  const ga = Math.min(P.me.until, P.retireAge);
  const grows = C.gHH(ga) > 1.001;
  const hh = two ? (C.premarital ? '（结婚后两人合计）' : '家庭') : '';
  $('#lead').innerHTML = C.enough
    ? `<b>如果</b>按这个设定生活（${scenarioName()}），从今年到 ${P.endAge} 岁大约要花 <b>${Wu(C.total)}</b>。<b>那么</b>现有存款、家庭支持和国家养老金已经够付，按 ${P.rate}% 利率滚动，到 ${P.endAge} 岁还剩约 <b>${Wu(C.simNeed.end)}</b>。` + tail
    : `<b>如果</b>按这个设定生活（${scenarioName()}），从今年到 ${P.endAge} 岁大约要花 <b>${Wu(C.total)}</b>，扣掉家庭支持${C.savings ? '、现有存款' : ''}和国家养老金后${selfTxt()}。<b>那么</b>起步那年${hh}要到手：` + scenList() +
      `<p class="lead-note">一般情况折合${C.adults === 1 ? '你' : sameM() ? '两人各自' : '你和配偶分别'}每月到手约 <b>${mStr()} 元</b>${P.me.months !== 12 ? `（一年 ${P.me.months} 个月）` : ''}${grows ? `，${growthText()}` : ''}。</p>` + tail;
  $('#kpis').innerHTML = kpi([
    [`今后总支出（${P.startAge}–${P.endAge} 岁）`, W(C.total), '万', `工作期 ${W(C.workTotal)} ＋ 不工作以后 ${W(C.retTotal)}`],
    ['最终自筹', C.selfFund > 0 ? W(C.selfFund) : '0', '万', C.selfFund > 0 ? (C.savings ? '扣除家庭支持、现有存款与国家养老金' : '扣除家庭支持与国家养老金') : `现有资金富余 ${W(-C.selfFund)} 万`],
    ['起步那年要到手', C.enough ? '0' : W(C.I), '万/年', C.enough ? '现有资金已经够了' : `顺利 ${W(C.scen.Igood)} · 不顺 ${W(C.scen.Ibad)} 万`],
    [earnerLabel(), C.enough ? '0' : mStr(), '元', two ? `收入分配 ${P.split}% / ${100 - P.split}%` : grows ? `之后随工资涨，${ga} 岁时每月约 ${M100(C.earners[0].M * C.gHH(ga))} 元` : '一般情况'],
  ]);
  setAlerts(inputMsg + priceMsg + loanMsg + gapMsg + spGapMsg + (s.minBal < -1
    ? `<p class="alert">这个收入是按总账算的：到 ${P.endAge} 岁存款刚好用完，但中间 <b>${s.minAge}</b> 岁前后最多要借 <b>${Wu(-s.minBal)}</b>${C.buy && Math.abs(s.minAge - P.buyAge) <= 3 ? '，主要是买房首付和杂费要提前攒' : ''}，借款按 ${P.borrowRate}% 付息，一共 ${Wu(s.debtIntTotal)}，已经算进结果。${C.istarOk ? `如果要求每一年都不缺钱，起步需要到手 <b>${Wu(C.Istar)}</b>。` : '有几年本来就没有工资收入，起步收入再高也补不上那几年，只能靠存款或借钱。'}</p>`
    : ''));
}

function supportHint() {
  const s = C.sim;
  if (C.support > 0 && s.firstNeg !== null && s.firstNeg < C.supportAge) return ` 缺口出在家里的 ${Wu(C.support)} 到位之前：支持要到 ${C.supportAge} 岁${C.buy && !P.supportAt ? '买房那年' : ''}才给，${s.firstNeg}–${C.supportAge - 1} 岁只能靠自己的收入和存款。可以在左侧"住房"里把"家庭支持几岁到位"改早。`;
  return '';
}
const lastTxt = s => s.lastOk === null ? '今年起不够' : `${s.lastOk + 1} 岁起不够`;
// 提醒超过一条时，只露出第一条，其余收起
function setAlerts(html) {
  const parts = html.split('</p>').filter(x => x.trim()).map(x => x + '</p>');
  $('#alert').innerHTML = parts.length <= 1 ? parts.join('') : parts[0] + `<details class="more-alerts"><summary>还有 ${parts.length - 1} 条提醒</summary>${parts.slice(1).join('')}</details>`;
}
function verdictText() {
  const s = C.sim;
  if (C.feasible) return ` <b class="ok">够。</b>每一年存款都不为负，${P.retireAge} 岁时存款约 ${Wu(s.at60)}，到 ${P.endAge} 岁还有富余，折合今天约 ${Wu(pvEnd(s))}。`;
  if (s.end >= -1) return ` <b class="no">总账够，但中间会缺钱：</b>${s.firstNeg} 岁开始出现缺口，${s.minAge} 岁前后最多缺 ${Wu(-s.minBal)}，之后能补回来，到 ${P.endAge} 岁还有富余，折合今天约 ${Wu(pvEnd(s))}。` + supportHint();
  return ` <b class="no">不够：</b>${s.lastOk === null ? `今年（${s.firstNeg} 岁）就入不敷出，之后存款一直是负的` : `${s.firstNeg} 岁开始出现缺口，${s.lastOk + 1} 岁起存款一直是负的`}，缺口折合今天约 ${Wu(-pvEnd(s))}。` + supportHint();
}

// ---------- 怎么算的 ----------
function taxRows(e) {
  return `<table><tbody><tr class="res"><td>每月到手 ${Y(e.M)} 元 × ${e.months} 个月</td><td>${Y(e.takeHome)} 元/年</td></tr></tbody></table>`;
}
function renderHow() {
  const two = C.adults === 2, rs = P.rate + '%';
  const pen = `${Y(C.pensMonthly)} 元/月 × 12 × ${C.R - C.gap} 年（${C.P0} 岁起）`;
  let h = '<ol>';
  if (C.have) {
    h += `<li><b>你${two ? '们' : ''}的收入。</b>${growthText()}。<br>${taxRows(C.actNet[0])}${two ? `<span class="sm">配偶：每月到手 ${Y(P.sp.salary)} × ${P.sp.months} 个月，一年 ${Y(C.actNet[1].takeHome)} 元。</span><br>` : ''}起步那年${two ? '家庭' : ''}到手 <b>${Wu(C.act0)}</b>，按工资增长算，工作期一共到手 <b>${Wu(C.actTotal)}</b>。</li>`;
    h += `<li><b>今后要自己出多少。</b>今后总支出 ${Wu(C.total)} − 家庭支持 ${Wu(C.support)}${C.savings ? ` − 现有存款 ${Wu(C.savings)}` : ''} − 国家养老金 ${Wu(C.pensionUsed)} = <b>${Wu(C.selfFund)}</b>。${C.premarital ? `${P.startAge}–${C.mAge - 1} 岁婚前按单身开销，配偶收入从结婚那年计入。` : ''}<br><span class="sm">养老金按你${two ? '们' : ''}的工资估算${P.pensionAuto ? '' : '（你手动填了）'}：${two ? `你 ${Y(C.pensMe)}、配偶 ${Y(C.pensSp)}，合计` : ''} ${pen}。</span></li>`;
    h += `<li><b>逐年滚动。</b>每年到手收入减去当年支出，余下的存起来按 ${rs} 生息，不够就借，按 ${P.borrowRate}% 付息。<br>存款最紧的是 ${C.sim.minAge} 岁（${Wu(C.sim.minBal)}），${P.retireAge} 岁时 ${Wu(C.sim.at60)}，到 ${P.endAge} 岁 ${Wu(C.sim.end)}。</li>`;
    h += `<li><b>结论。</b>${verdictText()}<br><span class="sm">对照：这个设定按总账需要起步到手 ${C.enough ? '0（现有资金已够）' : Wu(C.I)}，你${two ? '们' : ''}现在是 ${Wu(C.act0)}。</span></li>`;
  } else {
    h += `<li><b>从今年起要花多少。</b>工作期（${P.startAge}–${C.lastWork} 岁）${Wu(C.workTotal)} ＋ 不工作以后（${C.lastWork + 1}–${P.endAge} 岁）${Wu(C.retTotal)} = <b>${Wu(C.total)}</b>。${C.premarital ? `<br><span class="sm">${P.startAge}–${C.mAge - 1} 岁还没结婚，开销按单身算，配偶的收入从 ${C.mAge} 岁结婚那年起计入。</span>` : ''}</li>`;
    if (!C.enough) h += `<li><b>拆成两笔。</b>工作期边挣边花的：${Wu(C.workTotal)} − 家庭支持 ${Wu(C.support)}${C.savings ? ` − 现有存款 ${Wu(C.savings)}` : ''} = <b>${Wu(C.W)}</b>。退休后养老金不够的缺口：${Wu(C.retTotal)} − 国家养老金 ${Wu(C.pensionUsed)} = <b>${Wu(C.G)}</b>。<br><span class="sm">国家养老金：${two ? `每人 ${Y(P.pension)} 元 × 2 人 = ` : ''}${pen}。</span></li>`;
    if (C.enough) {
      h += `<li><b>结论。</b>现有存款、家庭支持和国家养老金加起来，已经够付全部开销：按 ${rs} 利率逐年滚动，到 ${P.endAge} 岁还剩 <b>${Wu(C.simNeed.end)}</b>，不需要再挣钱。</li>`;
    } else {
      const adj = C.I - C.Ipv;
      h += `<li><b>折算成起步那年的收入。</b>早花的钱要早挣，晚花的钱可以多存几年利息，所以把每一年都按 ${rs} 折算到 ${P.startAge} 岁再比较：<br>工作期那笔折算后是 ${Wu(C.PVw)}，退休缺口折算后是 ${Wu(C.PVg)}；起步收入每 1 元，${growthText()}、挣到 ${P.retireAge} 岁，折算后相当于 ${nf2.format(C.PVinc)} 元。<br>(${W(C.PVw)} ＋ ${W(C.PVg)}) 万 ÷ ${nf2.format(C.PVinc)} = <b>${Wu(C.Ipv)}</b>${two ? '（家庭合计）' : ''}。` +
        (Math.abs(adj) >= 50 ? `<br>中间有几年存款为负要借钱，借款利率 ${P.borrowRate}% 比存款利率 ${rs} 高，多付的利息让起步收入再${adj > 0 ? '提高' : '降低'} ${W(Math.abs(adj))} 万，最后是 <b>${Wu(C.I)}</b>。` : '') +
        `按这个收入逐年滚动，到 ${P.endAge} 岁存款刚好用完。</li>`;
      h += `<li><b>换算成每月到手。</b>${two ? `按 ${P.split}% / ${100 - P.split}% 分给两个人，你一年要到手 ${Wu(C.earners[0].usable)}，` : ''}÷ ${C.earners[0].months} 个月 = ${two ? '你' : ''}每月到手约 <b>${M100(C.earners[0].M)} 元</b>${two && !sameM() ? `，配偶约 ${M100(C.earners[1].M)} 元` : ''}。</li>`;
    }
  }
  $('#how-body').innerHTML = h + '</ol>';
}

// ---------- 能过什么生活 ----------
function feasibleWith(mut) { const q = clone(P); mut(q); return compute(q, { light: true }); }
function maxFeasible(setter, lo, hi, iters = 26) {
  const ok = v => feasibleWith(q => setter(q, v)).feasible;
  if (!ok(lo)) return null;
  if (ok(hi)) return Infinity;
  for (let i = 0; i < iters; i++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
  return lo;
}
function minFeasibleCont(setter, lo, hi, iters = 26) {
  const ok = v => feasibleWith(q => setter(q, v)).feasible;
  if (ok(lo)) return lo;
  if (!ok(hi)) return null;
  for (let i = 0; i < iters; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}
function minFeasible(setter, lo, hi) {
  for (let v = lo; v <= hi; v++) if (feasibleWith(q => setter(q, v)).feasible) return v;
  return null;
}
function renderS0() {
  if (!C.have) return;
  const k = K(), two = C.adults === 2;
  $('#s0-sum').innerHTML = `<p class="verdict">按现在的设定：${verdictText()}</p>`;
  const rows = [];
  const stuck = `卡在 ${C.sim.minAge} 岁前后的大额支出${C.buy && Math.abs(C.sim.minAge - P.buyAge) <= 3 ? '（买房首付和税费）' : ''}，光省这一项解决不了，看下面"最早几岁能买房"和"家里至少要支持多少"`;
  // 日常开销
  const livKeys = ['food', 'transport', 'comm', 'clothing', 'daily'];
  const f = maxFeasible((q, v) => livKeys.forEach(x => { q[x][k] = P[x][k] * v; }), 0, 6);
  rows.push(['日常开销（吃穿行、通讯、日用）', `${Y(C.livingM)} 元/月`, f === null ? '<span class="no">减到 0 也不够</span>' : f === Infinity ? '6 倍以上' : `<b>${Y(C.livingM * f)}</b> 元/月`, f === null ? stuck : f !== Infinity ? (f >= 1 ? `还能多花 ${Y(C.livingM * (f - 1))} 元/月` : `要比现在少花 ${Y(C.livingM * (1 - f))} 元/月`) : '']);
  // 房子
  const area = P.housing === 'own' ? null : maxFeasible((q, v) => { q.housing = 'buy'; q.area[k] = v; }, 10, 400);
  const pr = a => a * P.unitPrice * P.locFactor / 100;
  if (P.housing !== 'own') rows.push([`买房面积（${P.locFactor === 100 ? '全市均价' : '区位 ' + P.locFactor + '%'}）`, P.housing === 'buy' ? `${P.area[k]}㎡，${Wu(C.price)}` : '现在是租房', area === null ? '<span class="no">10㎡ 也买不起</span>' : area === Infinity ? '400㎡ 以上' : `<b>${Math.floor(area)}㎡</b>，约 ${Wu(pr(Math.floor(area)))}`, area === null ? '可以试试租房、推迟买房、买在外围或家里多支持' : `${P.buyAge} 岁买`]);
  // 养老每月
  const rsMax = maxFeasible((q, v) => { q.retireSpend = v; }, 0, 100000);
  rows.push(['退休后每人每月花', `${Y(P.retireSpend)} 元`, rsMax === null ? '<span class="no">0 也不够</span>' : rsMax === Infinity ? '10 万以上' : `<b>${Y(Math.floor(rsMax / 100) * 100)}</b> 元`, rsMax === null ? stuck : `${city().name}城镇人均消费约 ${Y(city().cons / 12)} 元/月`]);
  // 最早不工作
  const early = minFeasible((q, v) => { q.retireAge = v; }, P.startAge + 5, Math.min(P.endAge - 1, 75));
  rows.push([C.married ? '你最早几岁可以不工作（配偶照原计划）' : '最早几岁可以不工作', `${P.retireAge} 岁`, early === null ? '<span class="no">工作到 75 岁也不够</span>' : `<b>${early} 岁</b>`, early === null ? stuck : early < C.P0 ? `${C.P0} 岁才能领养老金，中间 ${C.P0 - early - 1} 年靠存款` : '']);
  if (P.housing === 'buy') {
    const ba = minFeasible((q, v) => { q.buyAge = v; }, P.startAge, P.retireAge);
    rows.push(['最早几岁能买房', `${P.buyAge} 岁买 ${P.area[k]}㎡`, ba === null ? '<span class="no">一直攒到退休也不够</span>' : `<b>${ba} 岁</b>`, ba === null ? '按这个收入，换小一点、外围或租房可以再试' : ba > P.buyAge ? `比现在的计划晚 ${ba - P.buyAge} 年，中间多付的房租已算进去` : '按现在的计划就行']);
    const sup = minFeasibleCont((q, v) => { q.support[k] = v; }, 0, C.price + C.fees);
    rows.push(['家里至少要支持多少', `${Wu(P.support[k])}`, sup === null ? '<span class="no">全款都给也不够</span>' : `<b>${Wu(Math.ceil(sup / 1e4) * 1e4)}</b>`, sup === null ? '问题不在房子，在日常和养老开销' : sup <= P.support[k] ? '现在的支持已经够了' : `${P.buyAge} 岁买房时到位，比现在多 ${Wu(Math.ceil((sup - P.support[k]) / 1e4) * 1e4)}`]);
  }
  // 教育
  const kidsN = P.family === 'kid' ? P.kids : 1;
  const fits = ROUTES.map(r => ({ r, b: routeBreakdown(P, r.st, r.tutor), c: feasibleWith(q => { q.family = 'kid'; q.kids = kidsN; setRoute(q, r); }) }));
  const best = fits.filter(x => x.c.feasible).sort((a, b) => b.b.total - a.b.total)[0];
  rows.push([`教育路线（${P.family === 'kid' ? kidsN + ' 个孩子' : '如果要 1 个孩子'}）`, P.family === 'kid' ? routeName(P) : '—', best ? `<b>${best.r.name}</b>` : '<span class="no">最省的路线也不够</span>', best ? `一个孩子约 ${Wu(best.b.total)}` : stuck]);
  $('#knobs').innerHTML = `<thead><tr><th>项目</th><th>现在的设定</th><th>最多能到</th><th class="l">说明</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="wrap">${r[3]}</td></tr>`).join('') + '</tbody>';

  // 三档
  const cons = city().cons / 12;
  const funKeys = ['travel', 'gifts', 'shopping'];
  const tiers = [
    ['节俭', `日常开销 0.75 倍，${P.housing === 'own' ? '住已有的房' : '一直租房'}，孩子走基础档，养老每月花当地人均消费`, q => { livKeys.forEach(x => { q[x][k] = P[x][k] * 0.75; }); if (P.housing !== 'own') q.housing = 'rent'; setRoute(q, ROUTES[0]); q.retireSpend = Math.round(cons / 100) * 100; }],
    ['标准', '就是你现在的设定', q => {}],
    ['舒适', `日常开销 1.4 倍、快乐开销 2 倍，${P.housing === 'own' ? '住已有的房' : '买核心区'}，孩子走国际路线，养老每月花当地人均消费 1.8 倍`, q => { livKeys.forEach(x => { q[x][k] = P[x][k] * 1.4; }); funKeys.forEach(x => { q[x][k] = P[x][k] * 2; }); if (P.housing !== 'own') { q.housing = 'buy'; q.locFactor = 180; } setRoute(q, ROUTES.find(r => r.id === 'intl')); q.retireSpend = Math.round(cons * 1.8 / 100) * 100; }],
  ];
  $('#lifetiers-intro').textContent = `以${city().name}和你现在的家庭、面积为基准。孩子路线只在"已婚有孩"时计入。`;
  $('#lifetiers').innerHTML = `<thead><tr><th>档位</th><th class="l">怎么过</th><th>今后总支出</th><th>需要起步到手</th><th>够不够</th><th>最紧那年存款</th></tr></thead><tbody>` +
    tiers.map(([n, d, mut]) => { const q = clone(P); mut(q); const c = compute(q); const bad = !c.feasible;
      return `<tr${n === '标准' ? ' class="cur"' : ''}><td>${n}</td><td class="wrap">${d}</td><td>${Wu(c.total)}</td><td>${Wu(c.I)}</td><td class="${bad ? 'no' : 'ok'}">${bad ? (c.sim.end < -1 ? lastTxt(c.sim) : '中间缺钱') : '够'}</td><td>${Wu(c.sim.minBal)}</td></tr>`; }).join('') + '</tbody>';

}
function renderPanelBits() {
  const k = K(), c = city();
  $('#tip-retire').innerHTML = `${c.name}城镇居民人均消费约 ${Y(c.cons / 12)} 元/月。换城市时默认填它的 1.3 倍，多出的部分留给老年医疗和护理。`;
  const N = C.N;
  const lowEst = Math.round(pensionEstimate(P, P.baseLow, C.contrib).total / 100) * 100;
  const incEst = Math.round(pensionEstimate(P, C.earners[0].M, C.contrib).total / 100) * 100;
  $('#tip-pension').innerHTML = (P.pensionAuto && C.have ? `自动：按你${C.adults === 2 ? '们' : ''}填的工资缴 ${C.contrib} 年估算，${C.adults === 2 ? `你 ${Y(C.pensMe)} 元、配偶 ${Y(C.pensSp)} 元` : `约 ${Y(C.pensMe)} 元`}（上面输入框的数只在"按想过的生活"模式里用）。` : P.pensionAuto ? `自动：按社保最低基数缴 ${C.contrib} 年估算，约 ${Y(lowEst)} 元。` : `你填的数。<button type="button" id="btn-pen-auto">改回自动估算（${Y(lowEst)}）</button> `) +
    ` <button type="button" id="btn-pen-inc" data-v="${incEst}">按需要的收入缴社保估算：${Y(incEst)}</button>`;
  const sums = { 'g-living': ['food', 'transport', 'comm', 'clothing', 'daily'], 'g-fun': ['travel', 'gifts', 'shopping'], 'g-med': ['medSelf', 'insurance'] };
  for (const g in sums) ['s', 'c'].forEach(sub => { const el = $(`#${g}-${sub}`); if (el) el.textContent = Y(sums[g].reduce((a, f) => a + P[f][sub], 0)); });
  $('#g-living-sv').textContent = Y(C.livingM) + '/月';
  $('#g-fun-sv').textContent = Y(C.funY) + '/年';
  $('#g-med-sv').textContent = Y(C.medY) + '/年';
  $('#g-house-sv').textContent = P.housing === 'own' ? '已有房' : C.buy ? Wu(C.price) : Y(C.rentMonthly) + '/月';
  $('#g-parents-sv').textContent = Wu(C.byCat.parents);
  $('#g-invest-sv').textContent = P.stockPct ? `股票 ${P.stockPct}%` : '全存款';
  $('#g-risk-sv').textContent = `±${P.badCut}%`;
  $('#g-opt-sv').textContent = [P.wedding > 0 && C.married ? '结婚' : '', P.carPrice > 0 ? '买车' : '', P.petYear > 0 ? '宠物' : ''].filter(Boolean).join('·') || '未计';
}

function renderTimeline() {
  $('#s1-intro').textContent = `${P.startAge}–${C.lastWork} 岁${C.lastWork !== P.retireAge ? '家里至少有一人在工作' : '是工作期'}（含首尾共 ${C.N} 年），${C.lastWork + 1}–${P.endAge} 岁都不工作（${C.R} 年）。` +
    (C.gap ? `其中 ${P.retireAge + 1}–${C.P0 - 1} 岁这 ${C.gap} 年已经不工作、但还没到领养老金的年龄，开销全靠存款。` : '');
  const span = P.endAge - P.startAge + 1;
  const pos = a => ((a - P.startAge + 0.5) / span * 100);
  const wW = C.N / span * 100;
  const ev = [];
  if (C.married && P.marriageAge >= P.startAge && (P.wedding > 0 || P.family !== 'single')) ev.push([P.marriageAge, '结婚']);
  if (C.buy) ev.push([P.buyAge, '买房']);
  C.kidBirths.forEach((b, i) => ev.push([b, C.nKids > 1 ? `孩子${i + 1}出生` : '孩子出生']));
  if (C.nKids) ev.push([C.lastEduEnd, '最后一个孩子毕业']);
  if (P.parentsMode === 'timeline') { const ca = P.startAge + P.careAge - P.parAge, ea = P.startAge + P.parEnd - P.parAge; if (ca > P.startAge) ev.push([ca, '父母开始需要照护']); if (ea < P.endAge) ev.push([ea + 1, '父母照护结束']); }
  C.events.forEach(e => ev.push([e.age, e.type === 'gap' ? `${e.who === 'sp' ? '配偶' : '你'}停工 ${e.years} 年` : e.type === 'salary' ? `${e.who === 'sp' ? '配偶' : '你'}工资${e.amount >= 0 ? '涨' : '降'} ${Math.abs(e.amount)}%` : e.type === 'income' ? `进账 ${W(e.amount * 1e4)} 万` : e.type === 'expense' ? `花 ${W(e.amount * 1e4)} 万` : e.type === 'study' ? `在职读书 ${e.years} 年` : `副业 ${e.years} 年`]));
  C.moveLog.forEach(l => ev.push([l.age, `搬到${cityById(l.city).name}${l.soldN ? '，卖房' : l.how === 'lease' ? '，原房出租' : ''}${l.home === 'buy' ? '，买房' : l.home === 'own' ? '，住已有的房' : '，租房'}`]));
  if (C.buy && C.loanYrs > 0 && !C.moveLog.some(l => l.soldN && l.age <= P.buyAge + C.loanYrs - 1)) ev.push([P.buyAge + C.loanYrs - 1, '房贷最后一年']);
  ev.push([P.retireAge, C.married ? '你最后一个工作年' : '最后一个工作年']);
  if (C.married && !P.spSync) {
    if (C.spRetireMe >= P.startAge) ev.push([C.spRetireMe, `配偶最后一个工作年（配偶 ${P.sp.retire} 岁）`]);
    ev.push([C.spP0Me, `配偶开始领养老金（配偶 ${C.P0sp} 岁）`]);
  }
  if (C.gap) ev.push([C.P0, '开始领养老金']);
  const evs = ev.filter(e => e[0] >= P.startAge && e[0] <= P.endAge).sort((a, b) => a[0] - b[0]);
  $('#timeline').innerHTML =
    `<div class="tl-bar"><div class="tl-work" style="width:${wW}%">工作期 ${C.N} 年</div>${C.gap ? `<div class="tl-gap" style="width:${C.gap / span * 100}%" title="不工作也没有养老金">空窗 ${C.gap} 年</div>` : ''}<div class="tl-ret" style="width:${100 - wW - C.gap / span * 100}%">领养老金 ${C.R - C.gap} 年</div>` +
    `<div class="tl-marks">${evs.filter(e => e[0] !== P.retireAge).map(e => `<i style="left:${pos(e[0])}%"></i>`).join('')}</div></div>` +
    `<div class="tl-ticks">${[P.startAge, C.lastWork, P.endAge].map(a => `<span style="left:${a === P.startAge ? 1.5 : a === P.endAge ? 98 : pos(a)}%">${a}</span>`).join('')}</div>` +
    `<div class="tl-events">${evs.map(e => `<span><b>${e[0]} 岁</b>${e[1]}</span>`).join('')}</div>`;
}

function howText(k) {
  const Kk = K(), N = C.N;
  switch (k) {
    case 'living': return C.premarital ? `婚前 ${P.startAge}–${C.mAge - 1} 岁按单身 ${Y(C.livingS)} 元/月，之后 ${Y(C.livingM)} 元/月，工作期共 ${N} 年。` : `${Y(C.livingM)} 元/月 × 12 × ${N} 年。`;
    case 'housing': return housingText() + moveText();
    case 'housing0':
      if (P.housing === 'own') return `已有房，${P.area[Kk]}㎡，每年物业维修 ${Y(C.upkeep)} 元${P.ownMortgage > 0 ? `；现有房贷 ${Y(P.ownMortgage)} 元/月，还剩 ${P.ownLoanYears} 年` : '，没有房贷'}。`;
      if (!C.buy) return P.housing === 'buy' && C.moves.length ? `搬家前租房：${P.rentArea[Kk]}㎡，约 ${Y(C.rentMonthly)} 元/月。原计划 ${P.buyAge} 岁在${city().name}买房，但 ${C.moves[0].age} 岁就搬走了，所以不在${city().name}买。` : `一直租房：${P.rentArea[Kk]}㎡，约 ${Y(C.rentMonthly)} 元/月，从 ${P.startAge} 岁租${C.moves.length ? `到 ${C.moves[0].age - 1} 岁` : `到 ${P.endAge} 岁`}。`;
      return `${P.buyAge > P.startAge ? `${P.buyAge} 岁前租 ${P.rentArea[Kk]}㎡（${Y(C.rentMonthly)} 元/月${C.premarital ? `，婚前按 ${P.rentArea.s}㎡` : ''}）；` : ''}${P.buyAge} 岁买 ${P.area[Kk]}㎡，房价 ${W(C.buyPrice)} 万${Math.abs(C.buyPrice - C.price) > 1 ? `（按房价每年${P.houseGrowth > 0 ? '涨' : '跌'} ${Math.abs(P.houseGrowth)}% 算到那年）` : ''}，` + (C.loan > 0 ? `首付 ${W(C.down)} 万，贷款 ${W(C.loan)} 万（利率 ${P.commRate}%，${C.loanYrs} 年等额本息，月供 ${Y(C.mPay)} 元）。` : '全款。');
    case 'parents': return P.parentsMode === 'timeline'
      ? `父母现在约 ${P.parAge} 岁，${C.married ? `管 ${P.parSets} 边父母（婚后），` : ''}你们家出 ${P.parShare}%：${P.parMonthly ? `平时每边每月 ${Y(P.parMonthly)} 元，` : '平时不用给钱，'}父母 ${P.careAge} 岁起（你 ${P.startAge + P.careAge - P.parAge} 岁）每边每月照护 ${Y(P.careMonthly)} 元，算到父母 ${P.parEnd} 岁（你 ${P.startAge + P.parEnd - P.parAge} 岁）。`
      : `合计 ${W(P.parents)} 万，平摊到 ${N} 个工作年，每年 ${W(P.parents / N)} 万。`;
    case 'events': return C.events.filter(e => e.type === 'expense' || e.type === 'study').map(e => e.type === 'expense' ? `${e.age} 岁一次性 ${W(e.amount * 1e4)} 万` : `${e.age} 岁起在职读书 ${e.years} 年，每年 ${W(e.amount * 1e4)} 万`).join('；') + '。';
    case 'fun': return `${Y(C.funY)} 元/年 × ${N} 年${C.premarital ? '，婚前按单身' : ''}。`;
    case 'medical': return `${Y(C.medY)} 元/年 × ${N} 年${C.premarital ? '，婚前按单身' : ''}。`;
    case 'car': return `${P.carAge} 岁起每 ${P.carCycle} 年换一辆 ${W(P.carPrice)} 万的车，开到 ${P.carUntil} 岁，每年养车 ${Y(P.carRunning)} 元。`;
    case 'wedding': return `${P.marriageAge} 岁一次性支出。`;
    case 'pet': return `${Y(P.petYear)} 元/年 × ${P.petYears} 年。`;
    case 'child': return `${C.nKids} 个孩子，${routeName(P)}，从出生到毕业${P.kidAfterYears > 0 ? `，毕业后再贴补 ${P.kidAfterYears} 年` : ''}${P.kidHelp > 0 ? `，${P.kidHelpAge} 岁时资助 ${W(P.kidHelp)} 万` : ''}（第 2 步可换路线）。`;
    case 'social': return `${C.gap ? `你 ${P.retireAge + 1}–${C.P0 - 1} 岁` : ''}${C.married && C.spGap ? `${C.gap ? '，' : ''}配偶 ${P.sp.retire + 1}–${C.P0sp - 1} 岁` : ''}自己按最低基数 ${Y(P.baseLow)} 元缴社保，比例 ${P.selfPayRate}%，每人每年 ${Y(P.baseLow * P.selfPayRate / 100 * 12)} 元。`;
    case 'retire': return `${Y(P.retireSpend)} 元/人/月 × ${C.married ? P.coupleFactor : 1} 人份 × 12 × ${C.R} 年，含日常、医疗${C.lateTotal ? `；${P.lateAge} 岁起每人每月另加护理 ${Y(P.lateExtra)} 元，共 ${W(C.lateTotal)} 万` : ''}${P.housing === 'rent' ? '；房租另计在住房里' : ''}。`;
  }
  return '';
}
function housingText() { return howText('housing0'); }
function moveText() {
  if (!C.moveLog.length) return '';
  return ' ' + C.moveLog.map(l => `${l.age} 岁搬到${cityById(l.city).name}（日常、快乐和养老开销按当地消费水平，约为${city().name}的 ${Math.round(cityById(l.city).cons / city().cons * 100)}%）：${l.soldN ? `卖掉原来的房，扣掉 ${P.sellFeePct}% 税费和没还完的贷款，收回 ${W(l.sold)} 万；` : l.kept ? '原来的房子留着（房贷照还）；' : ''}` +
    (l.home === 'buy' ? `买 ${l.area}㎡，${W(l.price)} 万，${l.loan > 1 ? `首付 ${W(l.down)} 万，贷款 ${W(l.loan)} 万、${l.ly} 年，月供 ${Y(l.pay)} 元` : '全款'}。` : l.home === 'own' ? `住已有的 ${l.area}㎡，只计物业维修。` : `租 ${P.rentArea[K()]}㎡。`)).join('');
}
function subRow(parts) { const ps = parts.filter(x => x[1]); return ps.length ? `<div class="subrow">${ps.map(([a, b]) => `<span>${a}<b>${b}</b></span>`).join('')}</div>` : ''; }

function renderBreakdown() {
  const Kk = K();
  const rows = CATS.filter(([k]) => C.byCat[k] > 0 || k === 'living');
  const max = Math.max(...rows.map(([k]) => C.byCat[k]));
  let h = `<div class="h">项目</div><div class="h how-h">怎么算的</div><div class="h r">金额</div><div class="h r pc-h">占比</div>`;
  rows.forEach(([k, name]) => {
    const v = C.byCat[k];
    h += `<div class="name"><span class="sw" style="background:${catColor(k)}"></span>${name}</div>` +
      `<div class="how-cell"><div class="how">${howText(k)}</div><div class="bar" style="width:${(v / max * 100).toFixed(2)}%;background:${catColor(k)}"></div></div>` +
      `<div class="amt">${Wu(v)}</div><div class="pc">${pct(v / C.total)}</div>`;
    if (k === 'living') h += subRow([['餐饮', Y(P.food[Kk]) + '/月'], ['交通', Y(P.transport[Kk]) + '/月'], ['通讯网络', Y(P.comm[Kk]) + '/月'], ['衣着', Y(P.clothing[Kk]) + '/月'], ['日用水电杂项', Y(P.daily[Kk]) + '/月']]);
    if (k === 'fun') h += subRow([['旅游', Y(P.travel[Kk]) + '/年'], ['送礼红包', Y(P.gifts[Kk]) + '/年'], ['购物娱乐', Y(P.shopping[Kk]) + '/年']]);
    if (k === 'medical') h += subRow([['医保外自付', Y(P.medSelf[Kk]) + '/年'], ['商业保险', Y(P.insurance[Kk]) + '/年']]);
    if (k === 'housing') { const hp = C.housingParts; h += subRow([['租金', hp.rent], ['首付', hp.down], ['税费装修家电', hp.fees], ['月供本息', hp.mortgage], ['其中利息', C.years.reduce((a, y) => a + y.hs.interest, 0)], ['物业维修', hp.upkeep]].map(([a, b]) => [a, b > 0 ? W(b) + ' 万' : 0])); }
    if (k === 'child') { const cp = C.childParts; h += subRow([['孕产', cp.birth], ['基础养育', cp.base], ['0–2 岁托育', cp.infant], ['课外班', cp.tutor], ['学前', cp.kg], ['小学', cp.pri], ['初中', cp.mid], ['高中', cp.high], ['本科', cp.uni], ['研究生', cp.grad], ['语培申请', cp.prep], ['毕业后贴补', cp.after], ['结婚买房资助', cp.help]].map(([a, b]) => [a, b > 0 ? W(b) + ' 万' : 0])); }
  });
  h += `<div class="name tot">工作期小计</div><div class="how-cell tot"><div class="how">${P.startAge}–${C.lastWork} 岁</div></div><div class="amt tot">${Wu(C.workTotal)}</div><div class="pc tot">${pct(C.workTotal / C.total)}</div>`;
  h += `<div class="name">不工作以后小计</div><div class="how-cell"><div class="how">${C.lastWork + 1}–${P.endAge} 岁</div></div><div class="amt">${Wu(C.retTotal)}</div><div class="pc">${pct(C.retTotal / C.total)}</div>`;
  h += `<div class="name tot">今后总支出</div><div class="how-cell tot"></div><div class="amt tot">${Wu(C.total)}</div><div class="pc tot">100%</div>`;
  $('#breakdown').innerHTML = h;
  const wy = C.workTotal / C.N, ry = C.R > 0 ? C.retTotal / C.R : 0;
  $('#per').innerHTML = `<span>工作期平均每年花 <b>${Wu(wy)}</b></span><span>每月 <b>${Y(wy / 12)}</b> 元</span><span>每天 <b>${Y(wy / 365)}</b> 元</span><span>不工作以后每月 <b>${Y(ry / 12)}</b> 元</span>`;
  $('#house-asset').textContent = C.buy
    ? `买房的钱没有凭空消失：房贷还清后你名下有一套房（按今天的价格约 ${W(C.price)} 万）。这里把它算作支出，因为这是"要挣到手的钱"；它同时也是晚年可以卖掉、换小或以房养老的资产。`
    : P.housing === 'own' ? '已有房：不计买房和房租，只计物业维修和剩余房贷。' : `一直租房时，不工作以后的房租也算在住房里。`;
}

function renderStages() {
  let h = `<thead><tr><th>阶段</th><th>年龄</th><th>年数</th><th>年均支出</th><th>月均</th><th>花得最多的</th><th>阶段合计</th></tr></thead><tbody>`;
  C.stages.forEach(s => {
    h += `<tr><td>${s.name}</td><td>${s.from}–${s.to}</td><td>${s.n}</td><td><b>${Wu(s.avg)}</b></td><td>${Y(s.avg / 12)}</td><td>${s.top[0]} ${pct(s.top[1] / s.total, 0)}</td><td>${Wu(s.total)}</td></tr>`;
  });
  $('#stages').innerHTML = h + `</tbody>`;
}

function renderYearTable() {
  const wrap = $('#yt-wrap');
  if (!wrap.open && !wrap.dataset.bound) { wrap.dataset.bound = '1'; wrap.addEventListener('toggle', () => { if (wrap.open) renderYearTable(); }); }
  if (!wrap.open) return;
  const mc = C.moves.length > 0, hv = C.years.some(y => y.houseValue > 0);
  let h = `<thead><tr><th>年龄</th>${mc ? '<th>城市</th>' : ''}<th>日常</th><th>住房与贷款</th><th>其中房贷利息</th><th>剩余房贷</th><th>孩子</th><th>赡养·快乐·医疗·其他</th><th>养老</th><th>合计</th><th>进账</th><th>借款利息</th><th>年末存款</th>${hv ? '<th>房产价值</th>' : ''}</tr></thead><tbody>`;
  C.years.forEach((y, i) => {
    const other = ['parents', 'fun', 'medical', 'car', 'wedding', 'pet', 'events', 'social'].reduce((a, k) => a + y[k], 0);
    const inc = C.sim.inc[i] + y.pension + y.support + y.inflow;
    const f = v => v ? W(v) : '—';
    h += `<tr><td>${y.age}</td>${mc ? `<td>${cityById(y.city).name}</td>` : ''}<td>${f(y.living)}</td><td>${f(y.housing)}</td><td>${f(y.hs.interest)}</td><td>${f(y.hs.loanLeft)}</td><td>${f(y.child)}</td><td>${f(other)}</td><td>${f(y.retire)}</td><td><b>${W(y.total)}</b></td><td>${W(inc)}</td><td class="${C.sim.debtInt[i] > 0 ? 'up' : ''}">${f(C.sim.debtInt[i])}</td><td class="${C.sim.path[i] < 0 ? 'up' : ''}">${W(C.sim.path[i])}</td>${hv ? `<td>${f(y.houseValue)}</td>` : ''}</tr>`;
  });
  $('#yeartable').innerHTML = h + `</tbody>`;
}

// ---------- 第 2 步：教育路线 ----------
function stageAges(s) {
  const pe = 5 + P.priYears;
  const st = P.stages;
  switch (s) {
    case 'kg': return ['3–5 岁', 3];
    case 'pri': return [`6–${pe} 岁`, P.priYears];
    case 'mid': return [`${pe + 1}–14 岁`, 14 - pe];
    case 'high': return ['15–17 岁', 3];
    case 'uni': { const y = eduOpt('uni', st.uni).years; return [y ? `18–${17 + y} 岁` : '—', y]; }
    case 'grad': { const uy = eduOpt('uni', st.uni).years; const y = st.uni === 'none' ? 0 : eduOpt('grad', st.grad).years; return [y ? `${18 + uy}–${17 + uy + y} 岁` : '—', y]; }
  }
}
function renderEdu() {
  const kid = P.family === 'kid';
  $('#s2-intro').textContent = kid
    ? `当前 ${P.kids} 个孩子都按"${routeName(P)}"算。教育合并成 5 档，每档包括各阶段的学校和 3–17 岁课外班强度；学费按${city().name}估算，某一项不符合你的情况，可以在参数"当前路线的学费"里改。`
    : `你现在选的是${FAM[P.family]}，今后的支出里没有孩子。下面 5 档的费用照样可以查看；在顶部把家庭改成"已婚有孩"就会计入。`;
  const cur = routeId(P);
  $('#routes').innerHTML = ROUTES.map(r => `<button type="button" data-v="${r.id}" aria-pressed="${r.id === cur}">${r.name}</button>`).join('');
  let g = '';
  STAGE_KEYS.forEach(s => {
    const o = eduOpt(s, P.stages[s]);
    const [ages, yrs] = stageAges(s);
    const cost = eduCost(P, s, o.id);
    const off = s === 'grad' && P.stages.uni === 'none';
    g += `<div class="stage"><div class="top"><b>${EDU[s].name}</b><span>${ages}</span></div><div class="oname">${off ? '—' : o.name}</div>` +
      `<div class="cost">${cost > 0 && yrs > 0 && !off ? `每年 <b>${Y(cost)}</b> 元 × ${yrs} 年 = <b>${Wu(cost * yrs)}</b>` : '不计费用'}</div>` +
      (o.note && !off ? `<div class="snote">${o.note}</div>` : '') + `</div>`;
  });
  const t = TUTOR.find(x => x.id === P.tutor);
  g += `<div class="stage"><div class="top"><b>课外班</b><span>3–17 岁</span></div><div class="oname">${t ? t.name : '—'}</div><div class="cost">${t && t.id !== 'none' ? `每月 <b>${Y(P.tutorCosts[t.id])}</b> 元` : '不计费用'}</div></div>`;
  $('#stagegrid').innerHTML = g;
}
function renderRouteTable() {
  const kid = P.family === 'kid', cur = routeName(P);
  // 路线对比
  const q0 = clone(P); q0.family = 'kid'; setRoute(q0, ROUTES[0]);
  const baseI = compute(q0).I;
  const nk = kid ? P.kids : 1;
  const hv = C.have;
  $('#routes-intro').textContent = `"养育＋课外"包含孕产、0–17 岁基础养育、0–2 岁托育（已扣育儿补贴）、课外班和毕业后的贴补资助；除课外班强度随档位变化外，其余各档相同。"每年多赚"是家庭起步到手收入要比基础档多多少（按 ${nk} 个孩子、其他参数不变）${hv ? '；"负担得起吗"按你们现在的收入逐年滚动，每一年存款都不为负才算' : ''}。点任意一行切换到那条路线。`;
  let h = `<thead><tr><th>路线</th><th>学前</th><th>小学＋初中</th><th>高中</th><th>本科/大专</th><th>研究生</th><th>语培申请</th><th>养育＋课外</th><th>一个孩子合计</th><th>每年多赚</th>${hv ? '<th>负担得起吗</th>' : ''}</tr></thead><tbody>`;
  ROUTES.forEach(r => {
    const b = routeBreakdown(P, r.st, r.tutor);
    const q = clone(P); q.family = 'kid'; setRoute(q, r);
    const cq = compute(q), dI = cq.I - baseI;
    const fit = hv ? (cq.feasible ? '<td class="ok">负担得起</td>' : `<td class="no">${cq.sim.end < -1 ? '负担不起' : '中间会缺钱'}</td>`) : '';
    const common = b.birth + b.base + b.infant + b.tutor + b.after + b.help;
    const isCur = r.name === cur;
    const f = v => v > 0 ? W(v) : '—';
    h += `<tr class="clickable${isCur ? ' cur' : ''}" data-route="${r.id}"><td>${r.name}</td><td>${f(b.kg)}</td><td>${f(b.pri + b.mid)}</td><td>${f(b.high)}</td><td>${f(b.uni)}</td><td>${f(b.grad)}</td><td>${f(b.prep)}</td><td>${W(common)}</td><td><b>${Wu(b.total)}</b></td><td class="${dI > 50 ? 'up' : dI < -50 ? 'down' : ''}">${Math.abs(dI) < 50 ? '—' : (dI > 0 ? '+' : '−') + W(Math.abs(dI)) + ' 万'}</td>${fit}</tr>`;
  });
  $('#routetable').innerHTML = h + `</tbody>`;
}

// ---------- 第 3、4 步 ----------
function renderEquation() {
  const T = C.total, w = v => (Math.max(0, v) / T * 100).toFixed(2) + '%';
  const sup = C.support, pen = C.pensionUsed, self = C.selfFund;
  $('#equation').innerHTML =
    `<div class="eq-row"><span class="lbl">今后总支出</span><div class="eq-track"><i style="left:0;width:100%;background:var(--ink-2)"></i></div><span class="val">${Wu(T)}</span></div>` +
    `<div class="eq-row"><span class="lbl">− 家庭支持</span><div class="eq-track"><i style="left:${w(T - sup)};width:${w(sup)};background:var(--line-strong)"></i></div><span class="val">−${Wu(sup)}</span></div>` +
    (C.savings ? `<div class="eq-row"><span class="lbl">− 现有存款</span><div class="eq-track"><i style="left:${w(T - sup - C.savings)};width:${w(C.savings)};background:var(--line-strong)"></i></div><span class="val">−${Wu(C.savings)}</span></div>` : '') +
    (C.inflowTotal ? `<div class="eq-row"><span class="lbl">− 工资以外的进账</span><div class="eq-track"><i style="left:${w(T - sup - C.savings - C.inflowTotal)};width:${w(C.inflowTotal)};background:var(--line-strong)"></i></div><span class="val">−${Wu(C.inflowTotal)}</span></div>` : '') +
    `<div class="eq-row"><span class="lbl">− 国家养老金</span><div class="eq-track"><i style="left:${w(T - sup - C.savings - C.inflowTotal - pen)};width:${w(pen)};background:var(--line-strong)"></i></div><span class="val">−${Wu(pen)}</span></div>` +
    `<div class="eq-row res"><span class="lbl">＝ 最终自筹</span><div class="eq-track"><i style="left:0;width:${w(self)};background:var(--accent)"></i></div><span class="val">${self > 0 ? Wu(self) : '0（富余 ' + Wu(-self) + '）'}</span></div>`;
  const n = [];
  if (C.buy) {
    const extra = C.down - Math.max(0, sup - C.fees);
    n.push(`<p class="dim">家庭支持 ${Wu(sup)}：${P.supportAt > 0 ? `在 ${C.supportAge} 岁到位，买房时` : `在 ${C.supportAge} 岁买房时一次到位，`}先付税费装修家电 ${W(C.fees)} 万，余下全部用作首付。${C.loan <= 0 ? `这套房是全款，房价 ${W(C.buyPrice)} 万里家里没出的部分要自己攒。` : extra > 1 ? `最低首付 ${P.minDown}% 是 ${W(C.minDownAmt)} 万，家里的钱不够的 ${W(extra + Math.max(0, C.fees - sup))} 万要自己攒。` : `首付 ${W(C.down)} 万，贷款只剩 ${W(C.loan)} 万。`}</p>`);
  } else n.push(`<p class="dim">家庭支持 ${Wu(sup)}：在 ${C.supportAge} 岁到位，存起来慢慢用。</p>`);
  if (C.buy && P.supportAt > 0 && P.supportAt !== P.buyAge) n.push(`<p class="dim">你把家庭支持设在 ${C.supportAge} 岁到位，和买房（${P.buyAge} 岁）不是同一年；首付按上面算，到位时间只影响中间哪几年缺钱。</p>`);
  n.push(`<p class="dim">国家养老金：${Y(P.pension)} 元/人/月 × ${C.adults} 人 × 12 × ${C.R - C.gap} 年（${C.P0} 岁起领） = ${Wu(C.pensionTotal)}。${C.pensionTotal - C.pensionUsed > 1 ? `其中 ${Wu(C.pensionTotal - C.pensionUsed)} 超过了不工作以后的开销，退休后的钱没法倒回去付年轻时的账，所以只抵扣 ${Wu(C.pensionUsed)}。` : '全部用于抵扣不工作以后的开销。'}</p>`);
  if (C.inflowTotal) { const ip = C.inflowParts; n.push(`<p class="dim">工资以外的进账 ${Wu(C.inflowTotal)}：${[['卖房收回', ip.sale], ['一次性进账', ip.windfall], ['副业', ip.side], ['房子出租（扣 ' + P.leaseVacancy + '% 空置）', ip.lease]].filter(x => x[1]).map(x => `${x[0]} ${Wu(x[1])}`).join('，')}。</p>`); }
  if (C.houseEnd > 0) n.push(`<p class="dim">另外，到 ${P.endAge} 岁时你名下还有房子，按${P.houseGrowth ? `房价每年${P.houseGrowth > 0 ? '涨' : '跌'} ${Math.abs(P.houseGrowth)}%` : '今天的房价'}算约值 <b>${Wu(C.houseEnd)}</b>。这笔钱没有算进上面的账，可以留给孩子，也可以晚年卖掉、换小或以房养老（在"以后搬到别的城市"里选同一个城市、卖掉、租房或买小房就能算）。</p>`);
  $('#s3-notes').innerHTML = n.join('');
}

function renderCalc() {
  const rs = P.rate + '%';
  $('#calc').innerHTML = [
    ['工作期要自己出的钱 W', `工作期支出 ${W(C.workTotal)} 万 − 家庭支持 ${W(C.support)} 万${C.savings ? ` − 现有存款 ${W(C.savings)} 万` : ''}`, Wu(C.W)],
    ['…折算到 ' + P.startAge + ' 岁', `每一年的数按 ${rs} 折回 ${P.startAge} 岁`, Wu(C.PVw)],
    ['养老缺口 G', `不工作以后的支出 ${W(C.retTotal)} 万 − 国家养老金 ${W(C.pensionUsed)} 万${C.gap ? `（其中 ${C.gap} 年空窗期没有养老金）` : ''}`, Wu(C.G)],
    ['…折算到 ' + P.startAge + ' 岁', `每一年的数按 ${rs} 折回 ${P.startAge} 岁`, Wu(C.PVg)],
    ['收入折算系数', `起步收入每 1 元，${growthText()}、按各自工作到的年龄，折回 ${P.startAge} 岁相当于多少元`, nf2.format(C.PVinc)],
    ['每年要花 A（起步口径）', 'W 折算值 ÷ 收入折算系数', Wu(C.A)],
    ['每年为养老存 B（起步口径）', 'G 折算值 ÷ 收入折算系数', Wu(C.B)],
    ['按总账算', 'A + B（借款利率和存款利率相同时）', Wu(Math.max(0, C.Ipv))],
    ['借款利息调整', `存款为负的年份按 ${P.borrowRate}% 借款付息，逐年滚动求出`, (C.I - Math.max(0, C.Ipv) >= 0 ? '+' : '−') + Wu(Math.abs(C.I - Math.max(0, C.Ipv)))],
    ['起步那年需要到手 I', C.enough ? '现有资金已经够付全部开销' : `${C.adults === 2 ? '家庭合计，' : ''}之后随工资增长`, Wu(C.I), 'key'],
  ].map(([t, sub, n, cls]) => `<div class="ln${cls ? ' ' + cls : ''}"><div class="t">${t}<small>${sub}</small></div><div class="n">${n}</div></div>`).join('');
  $('#factor-note').innerHTML = `<div class="note"><h4>为什么要折算</h4><p>不折算的话，${P.startAge} 岁花的一块钱和 ${P.endAge} 岁花的一块钱被当成一样，而中间差了几十年利息；工资会涨时，年轻时收入低、开销（买房、养孩子）却集中，简单平均会低估前期压力。折算之后，按起步收入 ${Wu(C.I)} 并随工资增长逐年滚动，到 ${P.endAge} 岁存款刚好用完，可以在"逐年现金流"里核对。</p><p>缺钱的年份（比如买房前后）按借款利率 ${P.borrowRate}% 付息，比存款利率高，所以最后用逐年滚动求出起步收入，让到 ${P.endAge} 岁时存款刚好为 0。</p><p>利率默认 1.8%，处在今天安全利率的上沿：2026 年储蓄国债 3 年期 1.63%、5 年期 1.70%；国有大行 3 年期大额存单约 1.55%，股份制银行 1.75%–1.8%。本页不计通胀，等于把利率当作扣除通胀后的实际利率。</p></div>`;
}

function renderTiers() {
  if (C.enough || C.sStar <= 0) { $('#tiers').innerHTML = '<tbody><tr><td>现有资金已经够付全部开销，不需要按储蓄率倒推收入。</td></tr></tbody>'; $('#naive-note').innerHTML = ''; return; }
  let h = `<thead><tr><th>储蓄率</th><th>存够养老需要</th><th>花够日常需要</th><th>实际需要（取大）</th><th>多出来的钱</th><th>简化公式结果</th></tr></thead><tbody>`;
  h += `<tr class="cur"><td>${pct(C.sStar)}（刚好）</td><td>${W(C.Ipv)} 万</td><td>${W(C.Ipv)} 万</td><td><b>${W(C.Ipv)} 万</b></td><td class="wrap">两边同时刚好满足，这是最低收入</td><td>—</td></tr>`;
  C.tiers.forEach(x => {
    const extra = x.binding === 'spend' ? `每年多存 ${W(x.extraSave)} 万，退休时多出 ${W(x.extraAt60)} 万` : `每年可多花 ${W(x.extraSpend)} 万`;
    h += `<tr><td>${x.s}%</td><td>${W(x.needSave)} 万</td><td>${W(x.needSpend)} 万</td><td><b>${W(x.inc)} 万</b> <span class="pill">${x.binding === 'save' ? '受养老约束' : '受日常约束'}</span></td><td class="wrap">${extra}</td><td>${W(x.naive)} 万</td></tr>`;
  });
  $('#tiers').innerHTML = h + `</tbody>`;
  const t0 = C.tiers[0];
  $('#naive-note').innerHTML = `<div class="note warn"><h4>为什么不直接用"自筹 ÷ 系数 ÷ 储蓄率"</h4>
    <p>这是很常见的简化算法，最后一列就是它的结果（${C.tiers.map(x => `${x.s}% 档 ${W(x.naive)} 万`).join('、')}），明显偏高。原因是工作期的日常开销被算了两次：一次已经包含在"最终自筹"里，另一次是收入里没存下来的那 ${100 - t0.s}%（那部分本来就是拿去花的）。另外，工作期的钱边挣边花，并不会在银行里放到退休生利息。</p>
    <p>本页的算法：把工作期要自己出的钱和养老缺口都折算到起步那年，分别除以收入折算系数，得到每年要花和每年要存，两者相加就是起步那年需要的到手收入。储蓄率低于 ${pct(C.sStar, 0)} 时，收入要抬高才能存够养老；高于它时，多存的部分变成退休时的安全垫。</p></div>`;
}

function renderPension() {
  const e = C.earners[0];
  const avgM = e.M * e.months / 12 * (C.PVinc > 0 ? (C.G1 / C.N) : 1);
  const pe = pensionEstimate(P, avgM, C.contrib, C.P0, P.deemedYears);
  const now = C.have ? (P.pensionAuto ? `按你${C.adults === 2 ? '们' : ''}填的工资自动估算：${C.adults === 2 ? `你 ${Y(C.pensMe)} 元、配偶 ${Y(C.pensSp)} 元` : `${Y(C.pensMe)} 元`}` : `你填的 ${Y(P.pension)} 元`) : `每人每月 <b class="mono">${Y(P.pension)}</b> 元${P.pensionAuto ? '（自动：按社保最低缴费基数估算，偏保守）' : '（你填的数）'}`;
  $('#pension-note').innerHTML = `<div class="note"><h4>国家养老金大概能拿多少</h4>
    <p>本页现在按${now}计。如果按上面算出的收入（工作期平均月薪约 ${Y(avgM)} 元）缴 ${C.contrib} 年社保（缴费指数约 ${pe.idx.toFixed(2)}），按现行公式粗估：基础养老金 ${Y(pe.basic)} 元 ＋ 个人账户 ${Y(pe.personal)} 元${pe.trans ? ` ＋ 过渡性养老金 ${Y(pe.trans)} 元` : ''} ≈ <b class="mono">${Y(pe.total)}</b> 元/月（今天的钱）。缴费年限 ${C.contrib} 年＝今年之前已交 ${P.paidYears} 年＋今后 ${C.contrib - P.paidYears} 年${P.deemedYears ? `，另有视同缴费 ${P.deemedYears} 年` : ''}。计发基数用${city().name}社平工资 ${Y(P.avgWage)} 元，个人账户按记账利率扣掉通胀后 ${P.acctRate}% 逐年滚存，计发月数 ${pe.months} 个月。可以在左侧"养老与利率"里一键换成这个估算值。</p>
    ${C.contrib < 20 ? `<p><b>注意：</b>按现在的设定只缴 ${C.contrib} 年社保。最低缴费年限从 2025 年起每年延长 6 个月，2039 年升到 20 年，不够的要补缴才能按月领取。</p>` : ''}
    <p>养老金和收入互相影响：养老金高了，需要的收入会下降，反过来也一样。</p></div>`;
}

// ---------- 图表 ----------
function niceStep(raw) { if (raw <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }
function niceScale(lo, hi, target) { const step = niceStep((hi - lo) / target || 1); return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step }; }
function tipHTML(title, rows, sum) {
  return `<div class="tt">${title}</div>` + rows.map(([c, n, v]) => `<div class="tr"><span>${c ? `<span class="sw" style="background:${c}"></span>` : ''}${n}</span><span>${v}</span></div>`).join('') + (sum ? `<div class="tr sum"><span>${sum[0]}</span><span>${sum[1]}</span></div>` : '');
}
function placeTip(tip, host, x, y) {
  const hw = host.clientWidth; tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = x + 14; if (left + tw > hw - 4) left = x - tw - 14; if (left < 4) left = 4;
  let top = y - th - 10; if (top < 4) top = y + 14;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function ageTicks() { return [P.startAge, 30, 40, 50, 60, 70, 80, 90, 100, P.endAge].filter((a, i, arr) => a >= P.startAge && a <= P.endAge && arr.indexOf(a) === i && (a === P.startAge || a - P.startAge >= 3) && (a === P.endAge || P.endAge - a >= 3)); }
function renderCharts() { if (!C) return; drawSpend(); drawBalance(); drawScen(); }

function drawSpend() {
  const host = $('#chart-spend');
  const Wd = Math.max(300, host.clientWidth - 20), H = 250;
  const m = { l: 44, r: 8, t: 14, b: 26 };
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b;
  const ys = C.years;
  const grp = y => GROUPS.map(g => g.cats.reduce((s, k) => s + y[k], 0));
  const sorted = ys.map(y => y.total).sort((a, b) => b - a);
  const cap = sorted.length > 3 && sorted[0] > sorted[3] * 2.2 ? sorted[3] : sorted[0];
  const sc = niceScale(0, cap * 1.04, 5), ymax = sc.hi;
  const band = pw / ys.length, bw = Math.max(1, band * 0.72);
  const X = i => m.l + i * band + (band - bw) / 2;
  const Yp = v => m.t + ph - Math.min(v, ymax) / ymax * ph;
  let s = `<svg viewBox="0 0 ${Wd} ${H}" height="${H}" role="img" aria-label="每年支出按类别堆叠的柱状图">`;
  for (let v = 0; v <= ymax + 1e-6; v += sc.step) { const y = Yp(v); s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${y}" y2="${y}" style="stroke:var(${v === 0 ? '--baseline' : '--grid'})"/><text x="${m.l - 6}" y="${y + 3.5}" text-anchor="end">${nf0.format(v / 1e4)}万</text>`; }
  const ri = ys.findIndex(y => !y.working);
  if (ri > 0) { const xr = m.l + ri * band; s += `<line x1="${xr}" x2="${xr}" y1="${m.t}" y2="${m.t + ph}" stroke-dasharray="3 3" style="stroke:var(--line-strong)"/><text x="${xr + 4}" y="${m.t + 9}" class="lbl-strong">退休</text>`; }
  let labeled = 0;
  ys.forEach((y, i) => {
    const g = grp(y); let acc = 0;
    g.forEach((v, gi) => {
      if (v <= 0) return;
      const y0 = Yp(acc), y1 = Yp(acc + v); acc += v;
      if (y0 - y1 <= 0) return;
      s += `<rect x="${X(i).toFixed(2)}" y="${y1.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(0, y0 - y1 - (band > 5 ? 0.6 : 0)).toFixed(2)}" style="fill:${GROUPS[gi].color}"/>`;
    });
    if (y.total > ymax) {
      s += `<path d="M${X(i) - 2} ${m.t + 7} l${bw + 4} -4 M${X(i) - 2} ${m.t + 11} l${bw + 4} -4" stroke-width="2.5" style="stroke:var(--surface)"/>`;
      if (labeled < 2) { const right = X(i) < Wd * 0.7; s += `<text x="${X(i) + (right ? bw + 6 : -6)}" y="${m.t + 22 + labeled * 14}" text-anchor="${right ? 'start' : 'end'}" class="lbl-strong">${y.age} 岁 ${nf0.format(y.total / 1e4)} 万</text>`; labeled++; }
    }
  });
  ageTicks().forEach(a => { const i = a - P.startAge; s += `<text x="${X(i) + bw / 2}" y="${H - 8}" text-anchor="middle">${a}</text>`; });
  ys.forEach((y, i) => { s += `<rect class="hit" data-i="${i}" x="${m.l + i * band}" y="${m.t}" width="${band}" height="${ph}" fill="transparent"/>`; });
  s += `<rect id="spend-hl" x="0" y="${m.t}" width="${band}" height="${ph}" opacity="0" pointer-events="none" style="fill:var(--ink)"/></svg>`;
  host.innerHTML = `<div class="legend">${GROUPS.map(g => `<span><span class="sw" style="background:${g.color}"></span>${g.name}</span>`).join('')}</div>` + s + `<div class="tip" hidden></div>`;
  const tip = host.querySelector('.tip'), hl = host.querySelector('#spend-hl'), svg = host.querySelector('svg');
  const show = (evt, i) => {
    const y = ys[i], g = grp(y);
    const rows = GROUPS.map((gg, gi) => [gg.color, gg.name, Wu(g[gi])]).filter((r, gi) => g[gi] > 0);
    if (y.hs.down) rows.push(['', '其中首付＋税费装修', Wu(y.hs.down + y.hs.fees)]);
    if (y.hs.mortgage) rows.push(['', `其中月供 ${Y(y.hs.mortgage / 12)}/月（利息 ${W(y.hs.interest)} 万）`, `剩 ${Wu(y.hs.loanLeft)}`]);
    if (y.wedding) rows.push(['', '其中结婚', Wu(y.wedding)]);
    tip.innerHTML = tipHTML(`${y.age} 岁`, rows, ['合计', Wu(y.total)]);
    hl.setAttribute('x', m.l + i * band); hl.setAttribute('opacity', '0.06');
    const rect = host.getBoundingClientRect();
    placeTip(tip, host, evt.clientX - rect.left, evt.clientY - rect.top);
  };
  svg.addEventListener('mousemove', e => { const t = e.target.closest('.hit'); if (t) show(e, +t.dataset.i); });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; hl.setAttribute('opacity', '0'); });
  svg.addEventListener('touchstart', e => { const t = e.target.closest('.hit'); if (t) show(e.touches[0], +t.dataset.i); }, { passive: true });
}

function drawBalance() {
  const host = $('#chart-bal');
  const Wd = Math.max(300, host.clientWidth - 20), H = 220;
  const m = { l: 50, r: 10, t: 16, b: 26 };
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b;
  const path = C.sim.path, ys = C.years;
  const hasH = ys.some(y => y.houseValue > 0), nw = path.map((v, i) => v + ys[i].houseValue - ys[i].hs.loanLeft);
  const bs = niceScale(Math.min(0, ...path), Math.max(0, ...path, ...(hasH ? nw : [])) * 1.05, 4);
  const vmax = bs.hi, vmin = bs.lo;
  const X = i => m.l + (ys.length === 1 ? 0 : i / (ys.length - 1) * pw);
  const Yp = v => m.t + (vmax - v) / (vmax - vmin || 1) * ph;
  let s = `<svg viewBox="0 0 ${Wd} ${H}" height="${H}" role="img" aria-label="存款余额随年龄变化">`;
  for (let v = vmin; v <= vmax + 1e-6; v += bs.step) { const y = Yp(v); s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${y}" y2="${y}" style="stroke:var(--grid)"/><text x="${m.l - 6}" y="${y + 3.5}" text-anchor="end">${nf0.format(v / 1e4)}万</text>`; }
  s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Yp(0)}" y2="${Yp(0)}" style="stroke:var(--baseline)"/>`;
  const pts = path.map((v, i) => `${X(i).toFixed(2)},${Yp(v).toFixed(2)}`);
  s += `<path d="M${X(0)},${Yp(0)} L${pts.join(' L')} L${X(path.length - 1)},${Yp(0)} Z" opacity="0.14" style="fill:var(--s1)"/>`;
  s += `<path d="M${pts.join(' L')}" fill="none" stroke-width="2" stroke-linejoin="round" style="stroke:var(--s1)"/>`;
  if (hasH) s += `<path d="M${nw.map((v, i) => `${X(i).toFixed(2)},${Yp(v).toFixed(2)}`).join(' L')}" fill="none" stroke-width="1.5" stroke-dasharray="5 3" style="stroke:var(--s3)"/>`;
  const iR = ys.findIndex(y => y.age === P.retireAge);
  if (iR >= 0) { const lx = X(iR), anchor = lx > Wd * 0.7 ? 'end' : 'start'; s += `<circle cx="${lx}" cy="${Yp(path[iR])}" r="4.5" stroke-width="2" style="fill:var(--s1);stroke:var(--surface)"/><text x="${lx + (anchor === 'start' ? 8 : -8)}" y="${Yp(path[iR]) - 8}" text-anchor="${anchor}" class="lbl-strong">${P.retireAge} 岁 ${nf0.format(path[iR] / 1e4)} 万</text>`; }
  if (C.sim.minBal < -1) { const im = ys.findIndex(y => y.age === C.sim.minAge); s += `<circle cx="${X(im)}" cy="${Yp(path[im])}" r="4.5" stroke-width="2" style="fill:var(--s2);stroke:var(--surface)"/><text x="${X(im) + 8}" y="${Yp(path[im]) + 14}" class="lbl-strong">${C.sim.minAge} 岁 ${nf0.format(path[im] / 1e4)} 万</text>`; }
  ageTicks().forEach(a => { s += `<text x="${X(a - P.startAge)}" y="${H - 8}" text-anchor="middle">${a}</text>`; });
  s += `<line id="bal-x" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke-width="1" opacity="0" style="stroke:var(--ink-2)"/><circle id="bal-dot" r="4" stroke-width="2" opacity="0" style="fill:var(--s1);stroke:var(--surface)"/><rect id="bal-hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
  host.innerHTML = (hasH ? `<div class="balleg"><span><span class="sw" style="background:var(--s1)"></span>存款（负数是欠的钱）</span><span><span class="sw" style="background:var(--s3)"></span>虚线：净资产（存款＋房产−没还完的房贷）</span></div>` : '') + s + `<div class="tip" hidden></div>`;
  const tip = host.querySelector('.tip'), svg = host.querySelector('svg');
  const hitEl = host.querySelector('#bal-hit'), xl = host.querySelector('#bal-x'), dot = host.querySelector('#bal-dot');
  const show = evt => {
    const rect = svg.getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (Wd / rect.width);
    let i = Math.round((sx - m.l) / pw * (ys.length - 1)); i = Math.max(0, Math.min(ys.length - 1, i));
    const y = ys[i];
    xl.setAttribute('x1', X(i)); xl.setAttribute('x2', X(i)); xl.setAttribute('opacity', '0.5');
    dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Yp(path[i])); dot.setAttribute('opacity', '1');
    tip.innerHTML = tipHTML(`${y.age} 岁`, [
      ...(y.working ? [['', '当年到手收入', Wu(C.sim.inc[i])]] : []),
      ...(y.pension ? [['', '国家养老金', Wu(y.pension)]] : []),
      ...(!y.working && !y.pension ? [['', '没有收入（空窗期）', '0']] : []),
      ...(y.support ? [['', '家庭支持', Wu(y.support)]] : []),
      ...(y.inflow ? [['', y.sale ? '卖房收回等进账' : '工资以外的进账', Wu(y.inflow)]] : []),
      ['', '当年支出', Wu(y.total)],
      ...(C.sim.debtInt[i] > 0 ? [['', '借款利息（按 ' + P.borrowRate + '%）', Wu(C.sim.debtInt[i])]] : []),
    ...(y.houseValue ? [['', '名下房产价值', Wu(y.houseValue)], ['', '净资产（含房产、扣房贷）', Wu(nw[i])]] : [])], ['年末存款', Wu(path[i])]);
    const hr = host.getBoundingClientRect();
    placeTip(tip, host, evt.clientX - hr.left, evt.clientY - hr.top);
  };
  hitEl.addEventListener('mousemove', show);
  hitEl.addEventListener('mouseleave', () => { tip.hidden = true; xl.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); });
  hitEl.addEventListener('touchstart', e => show(e.touches[0]), { passive: true });
}

function renderSim() {
  const s = C.sim;
  if (C.have) {
    $('#bal-title').textContent = `存款余额（按你${C.adults === 2 ? '们' : ''}的真实收入逐年滚动）`;
    $('#sim-text').innerHTML = `今年到手 ${Wu(C.act0)}，${growthText()}。` + verdictText();
    return;
  }
  $('#bal-title').textContent = C.enough ? '存款余额（不再挣钱，靠现有资金逐年滚动）' : `存款余额（起步到手 ${Wu(C.I)}，随工资增长逐年滚动）`;
  if (C.enough) { $('#sim-text').innerHTML = `不再挣钱，只靠现有存款、家庭支持和国家养老金，到 ${P.endAge} 岁还剩 <b class="mono">${Wu(s.end)}</b>${s.minBal < -1 ? `；但 ${s.minAge} 岁前后会短暂缺 ${Wu(-s.minBal)}` : ''}。`; return; }
  let t = `按起步 ${Wu(C.I)}、${growthText()}逐年滚动，到 ${P.endAge} 岁存款刚好用完。`;
  t += s.minBal < -1
    ? `中间 <b class="mono">${s.minAge}</b> 岁前后存款最低到 <b class="mono">−${Wu(-s.minBal)}</b>，那几年需要借钱、家里多支持或提前多存；${P.retireAge} 岁时约 ${Wu(s.at60)}。`
    : `每一年都不缺钱，${P.retireAge} 岁时约 <b class="mono">${Wu(s.at60)}</b>。`;
  t += supportHint();
  if (C.houseEnd > 0) t += ` 到 ${P.endAge} 岁存款用完，但名下房子还值约 ${Wu(C.houseEnd)}。`;
  if (s.minBal < -1 && C.istarOk) t += ` 如果要求每一年余额都不为负，起步需要 <b class="mono">${Wu(C.Istar)}</b>（${earnerLabel()}约 ${mStr(C, 'earnersStar')} 元）。`;
  $('#sim-text').innerHTML = t;
}

// ---------- 三种情况 ----------
function renderScen() {
  const sc = C.scen, have = C.have;
  $('#mc-intro').innerHTML = `上面是"一般情况"：一切按你填的走。真实人生有好有坏，这里只看两种好解释、能手算核对的情况：<b>顺利</b>＝收入一直比你填的高 ${sc.up}%；<b>不顺</b>＝${scenBad()}。${have ? '三条线都按你们的真实收入逐年滚动。' : `三条线都按一般情况算出的起步收入 ${Wu(C.I)} 滚动；表里另算了每种情况各自要到手多少才刚好够。`}可以在参数"顺利与不顺"里改这几个数。`;
  const rows = SCEN().map(([k, n, d]) => {
    const s = sc[k];
    const need = have ? '' : `<td>${Wu(k === 'good' ? sc.Igood : k === 'bad' ? sc.Ibad : C.I)}</td>`;
    return `<tr${k === 'base' ? ' class="cur"' : ''}><td>${n}</td><td class="wrap">${d}</td>${need}<td class="wrap">${outcome(s)}</td><td>${s.end < -1 ? `${s.lastOk === null ? '今年' : s.lastOk + 1 + ' 岁'}起一直为负` : `${s.minBal >= 0 ? W(s.minBal) : '−' + W(-s.minBal)} 万（${s.minAge} 岁）`}</td></tr>`;
  });
  $('#scentable').innerHTML = `<thead><tr><th>情况</th><th class="l">怎么算</th>${have ? '' : '<th>要刚好够，起步要到手</th>'}<th class="l">${have ? '结果' : `按 ${W(C.I)} 万滚动的结果`}</th><th>最紧那年存款</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  const b = sc.bad;
  $('#mc-text').innerHTML = have
    ? (b.minBal >= -1 ? `不顺的情况下也不缺钱，最紧那年还有 ${Wu(b.minBal)}。` : `不顺的情况下，${b.end >= -1 ? `${b.minAge} 岁前后最多要借 ${Wu(-b.minBal)}，之后能补回来` : (b.lastOk === null ? '从今年起存款一直是负的' : `${b.lastOk + 1} 岁起存款一直是负的`)}。要给不顺留余量，可以看"能过什么生活"里哪一项最容易调。`)
    : (C.enough ? '' : `一般和不顺之间差 <b>${Wu(sc.Ibad - C.I)}</b>/年，这就是给坏运气留的余量。`);
  drawScen();
}
function drawScen() {
  const host = $('#chart-mc'); if (!host || !C) return;
  const sc = C.scen, L = [['good', '顺利', 'var(--s3)', ''], ['base', '一般', 'var(--ink-2)', ''], ['bad', '不顺', 'var(--s2)', '4 3']];
  const Wd = Math.max(300, host.clientWidth - 20), H = 220;
  const m = { l: 56, r: 10, t: 16, b: 26 };
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b, n = sc.base.path.length;
  const all = L.flatMap(([k]) => sc[k].path);
  const hi = Math.max(0, ...all) * 1.05;
  const lo = Math.min(0, Math.max(Math.min(...all), -hi));   // 借款越滚越多时截断显示，免得压扁整张图
  const cl = v => Math.max(v, lo);
  const bs = niceScale(lo, hi, 4);
  const X = i => m.l + (n === 1 ? 0 : i / (n - 1) * pw);
  const Yp = v => m.t + (bs.hi - v) / (bs.hi - bs.lo || 1) * ph;
  let s = `<svg viewBox="0 0 ${Wd} ${H}" height="${H}" role="img" aria-label="顺利、一般、不顺三种情况的存款">`;
  for (let v = bs.lo; v <= bs.hi + 1e-6; v += bs.step) { const y = Yp(v); s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${y}" y2="${y}" style="stroke:var(--grid)"/><text x="${m.l - 6}" y="${y + 3.5}" text-anchor="end">${nf0.format(v / 1e4)}万</text>`; }
  s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Yp(0)}" y2="${Yp(0)}" style="stroke:var(--baseline)"/>`;
  L.forEach(([k, , col, dash]) => { s += `<path d="M${sc[k].path.map((v, i) => `${X(i).toFixed(1)},${Yp(cl(v)).toFixed(1)}`).join(' L')}" fill="none" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''} style="stroke:${col}"/>`; });
  ageTicks().forEach(a => { s += `<text x="${X(a - P.startAge)}" y="${H - 8}" text-anchor="middle">${a}</text>`; });
  s += `</svg>`;
  host.innerHTML = `<div class="legend">${L.map(([, nm, col]) => `<span><span class="sw" style="background:${col}"></span>${nm}</span>`).join('')}</div>` + s;
}

// ---------- 假设清单 ----------
// 每条：[类别, 名称, 当前取值, 依据（来源和年份）, 参数（点"改"跳过去）, 影响试算 [说明, 改法] 或 null]
const FEEDBACK_URL = 'https://github.com/Ccccyo/life-ledger/issues/new';   // 部署时填 GitHub Issues 地址，例如 'https://github.com/你的用户名/life-ledger/issues/new'；空着就只复制到剪贴板
let ASSUME_N = 0, FB_ITEM = null;
function assumptions() {
  const k = K(), c = city(), two = C.adults === 2, kid = P.family === 'kid', buyish = P.housing === 'buy' || C.houseEnd > 0;
  const liv = C.livingM, fun = C.funY, med = C.medY;
  const mul = (keys, f) => q => keys.forEach(x => { q[x][k] = P[x][k] * f; });
  return [
    ['钱的口径', '全部按今天的钱算，不算通胀', '通胀 0%，利率、工资涨幅、房价涨跌都用扣掉通胀后的实际值', '长期规划的常用做法：几十年后的名义金额没法直观比较', 'inflation', null],
    ['钱的口径', '存款的实际收益', `每年 ${P.rate}%`, '2026 年储蓄国债 3 年 1.63%、5 年 1.70%，大额存单约 1.55%–1.8%（财政部、各银行公布）', 'rate', ['如果只有 1%', q => { q.rate = 1; }]],
    ['钱的口径', '缺钱时借钱的利率', `每年 ${P.borrowRate}%`, '按消费贷、亲友周转的大致水平估，本页假设', 'borrowRate', ['如果是 8%', q => { q.borrowRate = 8; }]],
    ['钱的口径', '投资', P.stockPct ? `存款里 ${P.stockPct}% 放股票基金，实际年化 ${P.stockReturn}%` : '不算投资收益，存款全按存款利率', '本页估计，不是承诺；长期实际收益各研究差别很大', 'stockPct', P.stockPct ? ['如果不投资', q => { q.stockPct = 0; }] : ['如果一半放股票基金（年化 5%）', q => { q.stockPct = 50; q.stockReturn = 5; }]],
    ['收入', '收入口径', `你填的每月到手${two ? '（两个人分别填）' : ''} × 一年 ${P.me.months} 个月`, '直接用到手，不模拟个税、社保和公积金；公积金账户余额不算（偏保守）', 'me.months', null],
    ['收入', '工资怎么涨', growthText(), '本页假设；实际涨幅因行业、个人差别很大', 'me.growth', P.me.growth ? ['如果以后都不涨', q => { q.me.growth = 0; q.sp.growth = 0; }] : ['如果每年涨 3% 到 45 岁', q => { q.me.growth = 3; q.me.until = 45; q.sp.growth = 3; q.sp.until = 45; }]],
    ['收入', '"顺利"的定义', `收入一直比你填的高 ${P.goodUp}%`, '本页自定，为了好解释、能手算核对', 'goodUp', null],
    ['收入', '"不顺"的定义', scenBad(), '本页自定：收入打八折、中年失业一年、一笔大病或家人急用的支出', 'badCut', null],
    ['生活开销', '日常开销（吃穿行、通讯、日用）', `${Y(liv)} 元/月`, `以上海${two ? '已婚' : '单身'}口径为基准，按${c.name} 2025 年城镇居民人均消费（${Y(c.cons)} 元/年）等比例缩放；来源各市统计公报`, 'food', ['如果多 20%', mul(['food', 'transport', 'comm', 'clothing', 'daily'], 1.2)]],
    ['生活开销', '快乐与人情（旅游、送礼、购物娱乐）', `${W(fun)} 万/年`, '本页估计，同样按城市消费水平缩放', 'travel', ['如果多 50%', mul(['travel', 'gifts', 'shopping'], 1.5)]],
    ['生活开销', '自己的医疗', `医保外自付＋商业保险 ${Y(med)} 元/年`, '本页估计；大病只在"不顺"里算一笔', 'medSelf', ['如果翻倍', mul(['medSelf', 'insurance'], 2)]],
    ['养老', '不工作以后每人每月花', `${Y(P.retireSpend)} 元`, `默认约为${c.name}城镇人均消费的 1.3 倍`, 'retireSpend', ['如果多 30%', q => { q.retireSpend = P.retireSpend * 1.3; }]],
    ['养老', '高龄护理', P.lateExtra ? `${P.lateAge} 岁起每人每月多 ${Y(P.lateExtra)} 元` : '默认不另算', '护工、养老院费用差别很大，本页默认不计', 'lateExtra', P.lateExtra ? ['如果不算', q => { q.lateExtra = 0; }] : ['如果 80 岁起每人每月多 5,000 元', q => { q.lateExtra = 5000; q.lateAge = 80; }]],
    ['养老', '国家养老金', `${two ? `你约 ${M100(C.pensMe)}、配偶约 ${M100(C.pensSp)}` : `约 ${M100(C.pensMe)}`} 元/月，${C.P0} 岁起领`, `按现行计发公式估：社平工资 ${Y(P.avgWage)} 元（上海为 2025 年度全口径）、缴费基数 = 到手 ÷ ${P.grossRatio}%、个人账户记账利率扣通胀后 ${P.acctRate}%、缴费 ${C.contrib} 年。以后计发办法可能调整`, 'avgWage', ['如果少 30%', q => { q.pensionAuto = false; q.pension = Math.round((two ? (C.pensMe + C.pensSp) / 2 : C.pensMe) * 0.7); }]],
    ['养老', '几岁开始领养老金', `${P.pensionAge} 岁`, '2025 年起延迟退休：1985 年以后出生的男性 63 岁、女性 58 岁（原 50 岁退休岗位 55 岁）', 'pensionAge', P.pensionAge < 65 ? ['如果推到 65 岁', q => { q.pensionAge = 65; q.sp.pensionAge = Math.max(q.sp.pensionAge, 65); }] : null],
    ['养老', '不工作到领养老金之间', P.selfPay ? `自己按最低基数缴社保，比例 ${P.selfPayRate}%` : '不自己缴社保', '灵活就业参保规定；缴费年限不够 20 年要补缴', 'selfPayRate', null],
    ...(P.housing !== 'own' ? [['住房', '房价', `${Y(P.unitPrice)} 元/㎡ × 区位 ${P.locFactor}%`, `房天下 2026 年 8 月${c.name}二手房挂牌均价（成交一般更低）`, 'unitPrice', P.housing === 'buy' ? ['如果贵 20%', q => { q.unitPrice = P.unitPrice * 1.2; }] : null]] : []),
    ...(buyish ? [['住房', '房价以后涨跌', P.houseGrowth ? `每年实际${P.houseGrowth > 0 ? '涨' : '跌'} ${Math.abs(P.houseGrowth)}%` : '不涨不跌（按今天的钱）', '本页假设，没人能准确预测', 'houseGrowth', ['如果每年跌 2%', q => { q.houseGrowth = -2; }]]] : []),
    ...(P.housing === 'buy' ? [['住房', '房贷', `利率 ${P.commRate}%，首付至少 ${P.minDown}%，${P.loanYears} 年，到期不超过 ${P.maxLoanAge} 岁`, '上海首套 = 5 年期 LPR 3.5% − 45 个基点（2026 年 9 月）；用公积金贷款利率更低', 'commRate', ['如果利率 4%', q => { q.commRate = 4; }]],
      ['住房', '买房的额外花费', `税费中介 ${P.taxFeePct}%、装修 ${Y(P.renoPerM2)} 元/㎡、家具家电 ${W(P.furnish[k])} 万、物业维修 ${P.upkeepPerM2} 元/㎡/年`, '首套 140㎡ 以下契税 1%，中介 1%–2%；装修按中等标准估', 'renoPerM2', ['如果装修翻倍', q => { q.renoPerM2 = P.renoPerM2 * 2; }]]] : []),
    ...(P.housing !== 'own' ? [['住房', '房租', `${Y(P.rentPerM2)} 元/㎡/月 × ${P.rentArea[k]}㎡`, c.rentEst ? '按租金房价比推算' : '中指研究院 2026 年住宅租金', 'rentPerM2', ['如果贵 20%', q => { q.rentPerM2 = P.rentPerM2 * 1.2; }]]] : []),
    ...(kid ? [['孩子', '基础养育（吃穿用医）', `0–17 岁每月 ${Y(P.childBase)} 元，0–2 岁托育另加 ${Y(P.infantCare)} 元/月`, '本页估计，按城市消费水平缩放；已扣国家育儿补贴 3,600 元/年', 'childBase', ['如果多 30%', q => { q.childBase = P.childBase * 1.3; q.infantCare = P.infantCare * 1.3; }]],
      ['孩子', '教育档', routeName(P), '5 档合并自常见路线，学费见"孩子教育"和"依据与存档"里的来源', 'tutorCosts.normal', routeId(P) !== 'plus' ? ['如果换成加码档', q => setRoute(q, ROUTES.find(r => r.id === 'plus'))] : ['如果换成常规档', q => setRoute(q, ROUTES.find(r => r.id === 'normal'))]],
      ['孩子', '毕业以后', `再贴补 ${P.kidAfterYears} 年、每年 ${W(P.kidAfterYear)} 万${P.kidHelp ? `，结婚买房资助 ${W(P.kidHelp)} 万` : ''}`, '本页估计', 'kidAfterYear', P.kidHelp ? null : ['如果资助买房 50 万', q => { q.kidHelp = 5e5; }]]] : []),
    ['父母', '父母', P.parentsMode === 'timeline' ? `现在约 ${P.parAge} 岁，${P.careAge} 岁起照护，每边每月 ${Y(P.careMonthly)} 元，算到 ${P.parEnd} 岁` : `工作期合计 ${W(P.parents)} 万`, '本页估计；父母自己的养老金和积蓄可以通过调低金额体现', 'careMonthly', P.parentsMode === 'timeline' ? ['如果照护费翻倍', q => { q.careMonthly = P.careMonthly * 2; }] : null],
  ];
}
// 影响的口径：按现在的收入看时，用终点存款折回今天（按存款利率）；按想过的生活看时，用起步要到手
const metricOf = c => C.have ? c.sim.end / Math.pow(1 + C.r, P.endAge - P.startAge + 1) : c.I;
function renderAssume() {
  const list = assumptions();
  ASSUME_N = list.length;
  const base = metricOf(C);
  const rows = list.map((it, i) => {
    const [cat, name, val, basis, key, alt] = it;
    let imp = null, txt = '—';
    if (alt) {
      const q = clone(P); alt[1](q); const c = compute(q, { light: true }); const d = metricOf(c) - base;
      imp = Math.abs(d);
      const verdict = C.have ? outShort(c.sim)[0] : '';
      txt = `${alt[0]}：` + (Math.abs(d) < 5000 ? '几乎不变' : C.have ? `相当于今天${d > 0 ? '多' : '少'}一笔 ${Wu(Math.abs(d))}${verdict !== outShort(C.sim)[0] ? `，结论变成"${verdict}"` : ''}` : `起步每年要${d > 0 ? '多' : '少'}到手 ${Wu(Math.abs(d))}`);
    }
    return { i, cat, name, val, basis, key, imp, txt };
  });
  const sorted = rows.slice().sort((x, y) => (y.imp ?? -1) - (x.imp ?? -1));
  const max = Math.max(1, ...rows.map(x => x.imp || 0));
  $('#assume-tbl').innerHTML = `<thead><tr><th class="l">假设</th><th class="l">现在取值和依据</th><th class="l">影响（只改这一条）</th><th></th></tr></thead><tbody>` +
    sorted.map(x => `<tr><td class="l nm"><small>${x.cat}</small><b>${x.name}</b></td><td class="wrap">${x.val}<small class="src">${x.basis}</small></td><td class="wrap">${x.imp !== null ? `<span class="bar"><i style="width:${Math.max(2, x.imp / max * 100).toFixed(0)}%"></i></span>` : ''}${x.txt}</td><td class="acts"><button type="button" class="linkbtn" data-edit="${x.key}">改</button><button type="button" class="linkbtn" data-fb="${x.i}">这条不对？</button></td></tr>`).join('') + '</tbody>';
  renderSens();
  renderTabs();
}
// 点"改"：打开参数面板里对应的那一项
function focusParam(key) {
  let el = document.querySelector(`#groups [data-key="${key}"][data-sub="${K()}"]`) || document.querySelector(`#groups [data-key="${key}"]`) || document.querySelector(`#groups #f-${key}`);
  if (!el) return;
  const p = $('#panel'); if (p.classList.contains('collapsed')) $('#mob-toggle').click();
  for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus({ preventScroll: true }), 300);
  const row = el.closest('.f, tr, .ctl'); if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1600); }
}
function bindAssume() {
  $('#assume-tbl').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit) { focusParam(b.dataset.edit); return; }
    if (b.dataset.fb) {
      const it = assumptions()[+b.dataset.fb]; FB_ITEM = it;
      $('#fb-q').innerHTML = `关于<b>「${it[1]}」</b>：现在是 ${it[2]}。`;
      $('#fb-text').value = ''; $('#fb-msg').textContent = ''; $('#fb').hidden = false;
      $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); $('#fb-text').focus();
    }
  });
  $('#fb-cancel').addEventListener('click', () => { $('#fb').hidden = true; });
  $('#fb-send').addEventListener('click', () => {
    if (!FB_ITEM) return;
    const body = `【一生账本 · 假设反馈】\n假设：${FB_ITEM[1]}\n页面取值：${String(FB_ITEM[2]).replace(/<[^>]+>/g, '')}\n页面依据：${FB_ITEM[3]}\n我的意见：${$('#fb-text').value.trim() || '（没填）'}\n情形：${scenarioName()}，${C.have ? '按现在的收入' : '按想过的生活'}`;
    const done = m => { $('#fb-msg').textContent = m; };
    const copy = () => { try { return navigator.clipboard.writeText(body); } catch (e) { return Promise.reject(e); } };
    copy().then(() => done(FEEDBACK_URL ? '已复制，正在打开反馈页，粘贴即可。' : '已复制到剪贴板，可以发给作者或贴到项目的 Issues 里。谢谢！'), () => { $('#fb-text').value = body; $('#fb-text').select(); done('浏览器不让自动复制，已放进上面的框里，请手动复制。'); });
    if (FEEDBACK_URL) window.open(`${FEEDBACK_URL}?title=${encodeURIComponent('假设反馈：' + FB_ITEM[1])}&body=${encodeURIComponent(body)}`, '_blank', 'noopener');
  });
}

// ---------- 对比 ----------
function variant(over) { const q = clone(P); for (const k in over) { if (typeof over[k] === 'function') over[k](q); else q[k] = over[k]; } return compute(q); }
function renderSens() {
  const list = [
    ['当前设定', {}],
    ['利率降到 1.0%', { rate: 1.0 }],
    ['利率升到 3%', { rate: 3 }],
    ...(P.stockPct < 50 ? [[`存款一半放股票基金（年化 ${P.stockReturn}%）`, { stockPct: 50 }]] : []),
    ...(C.buy || C.houseEnd > 0 ? [['房价每年实际涨 2%', { houseGrowth: 2 }], ['房价每年实际跌 2%', { houseGrowth: -2 }]] : []),
    ...(P.parentsMode === 'timeline' ? [['父母照护费用翻倍', { careMonthly: P.careMonthly * 2 }]] : []),
    ...(P.borrowRate > P.rate ? [[`借款利率降到和存款一样（${P.rate}%）`, { borrowRate: P.rate }]] : []),
    ['国家养老金每人多 3,000 元/月', { pension: P.pension + 3000 }],
    ['养老每月少花 30%', { retireSpend: P.retireSpend * 0.7 }],
    ['养老每月多花 30%', { retireSpend: P.retireSpend * 1.3 }],
    ...(P.housing === 'own' ? [] : [['不买房，一直租', { housing: 'rent' }], ['买在外围（区位 70%）', { locFactor: 70 }], ['推迟 3 年买房', { buyAge: P.buyAge + 3 }]]),
    ...(P.moves.length ? [['不搬家，一直留在' + city().name, { moves: [] }]] : []),
    ['家里多支持 100 万', { support: q => { q.support.s += 1e6; q.support.c += 1e6; } }],
    [`一直工作到领养老金（${pensionStart(P) - 1} 岁）`, { retireAge: Math.max(P.retireAge, P.pensionAge - 1) }],
    ['提前退休后不自缴社保', { selfPay: false }],
  ];
  let h = `<thead><tr><th>只改这一项</th><th>最终自筹</th><th>起步每年要到手</th><th>比当前</th><th>${earnerLabel()}</th></tr></thead><tbody>`;
  list.forEach(([name, o], i) => {
    const c = variant(o), d = c.I - C.I;
    if (i > 0 && c.enough && C.enough) return;
    const cls = Math.abs(d) < 50 ? '' : d > 0 ? 'up' : 'down';
    h += `<tr${i === 0 ? ' class="cur"' : ''}><td>${name}</td><td>${W(c.selfFund)} 万</td><td><b>${W(c.I)} 万</b></td><td class="${cls}">${i === 0 || Math.abs(d) < 500 ? '—' : (d > 0 ? '+' : '−') + W(Math.abs(d)) + ' 万'}</td><td>${mStr(c)}</td></tr>`;
  });
  $('#sens').innerHTML = h + `</tbody>`;
}

// ---------- 来源 ----------
function renderSources() {
  let h = `<thead><tr><th>城市</th><th>二手房挂牌均价（元/㎡）</th><th>租金（元/㎡/月）</th><th>城镇人均消费（元/年）</th><th>社保基数（元/月）</th><th>教育系数</th></tr></thead><tbody>`;
  CITIES.forEach(c => {
    h += `<tr${c.id === P.city ? ' class="cur"' : ''}><td>${c.name}</td><td>${Y(c.price)}</td><td>${c.rent.toFixed(c.rent % 1 ? 2 : 0)}${c.rentEst ? '<span class="est">估</span>' : ''}</td><td>${Y(c.cons)}</td><td>${Y(c.low)}–${Y(c.high)}${c.baseEst ? '<span class="est">估</span>' : ''}</td><td>${c.edu.toFixed(2)}</td></tr>`;
  });
  h += `<tr><td colspan="6" class="src">` +
    `房价：${L('https://m.fang.com/fangjia/fjmap.html', '房天下 2026 年 8 月城市二手房挂牌均价')}（挂牌价，实际成交一般低一些，可按区位系数或直接改单价）；"其他城市"取${L('https://news.qq.com/rain/a/20260901A02TJ400', '中指研究院百城二手住宅均价 12,527 元/㎡')}。` +
    `租金：${L('https://m.sohu.com/a/1034440627_114986', '中指 2026 年 5 月租金 TOP10')}，上海取${L('https://news.qq.com/rain/a/20260910A0AEMZ00', '8 月 84.39 元')}；其余城市不在 TOP10，按${L('https://news.qq.com/rain/a/20260416A03Z1E00', '中指二线城市平均租金房价比 2.36%')}推算并校准。` +
    `消费：各市 2025 年统计公报或调查队数据，如${L('https://tjj.sh.gov.cn/tjgb/20260330/e0772941e8e041eaaad2df850b44ef98.html', '上海')}、${L('https://www.beijing.gov.cn/gongkai/shuju/sjjd/202601/t20260121_4452967.html', '北京')}、${L('https://www.gz.gov.cn/zwgk/sjfb/tjgb/content/post_10804075.html', '广州')}、${L('https://xinwen.bjd.com.cn/content/s6a14e4c9e4b03fa51a7ed112.html', '深圳')}、${L('https://tjj.wuhan.gov.cn/tjfw/tjgb/202604/t20260408_2750693.shtml', '武汉')}；"其他城市"取${L('https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html', '全国城镇居民 35,869 元')}。` +
    `社保：${L('https://sh.bendibao.com/shsi/2026818/308504.shtm', '上海')}、${L('https://www.sohu.com/a/1076604059_119798', '北京及四川、湖南、福建等省')}、${L('https://news.qq.com/rain/a/20260901A0569600', '天津')}、${L('https://news.qq.com/rain/a/20260901A0A0NG00', '陕西')}、${L('https://www.gz.gov.cn/zwfw/zxfw/sbfw/content/post_10510453.html', '广东')}、${L('https://zhejiang.chinatax.gov.cn/art/2025/12/11/art_13314_645797.html', '浙江')}、${L('https://www.wuhan.gov.cn/zwgk/tzgg/202509/t20250922_2650944.shtml', '武汉（市政府公告）')}；江苏、重庆按社平工资估算。` +
    `教育系数是本页的估算：一线城市为 1，其他城市民办和双语学费按比例打折。</td></tr>`;
  $('#citytable').innerHTML = h + `</tbody>`;

  $('#edu-ref-intro').textContent = `每年总花费，本科和研究生含学费、住宿和生活费。标"按城市"的项目已乘以${city().name}的教育系数 ${P.eduFactor.toFixed(2)}。`;
  let e = `<thead><tr><th>阶段</th><th class="l">选项</th><th>每年（${city().name}）</th><th>年数</th><th>说明</th></tr></thead><tbody>`;
  STAGE_KEYS.forEach(s => EDU[s].options.filter(o => o.cost > 0).forEach(o => {
    const yrs = s === 'uni' || s === 'grad' ? o.years : s === 'kg' || s === 'high' ? 3 : s === 'pri' ? P.priYears : 14 - (5 + P.priYears);
    e += `<tr><td>${EDU[s].name}</td><td class="l">${o.name}${o.scale === 'edu' ? '<span class="est">按城市</span>' : ''}</td><td>${Y(eduCost(P, s, o.id))}</td><td>${yrs}</td><td class="wrap">${o.note}</td></tr>`;
  }));
  e += `<tr><td colspan="5" class="src">来源：${L('https://www.jingan.gov.cn/sy/004009/004009010/004009010007/004009010007003/004009010007003006/20241028/752410cc-2bf9-4c53-8cd8-0331ea069eab.html', '静安区公办高中收费标准')}；${L('https://zwgk.shcn.gov.cn/xxgk/jysf-jyjzdgz/2025/188/78039.html', '长宁区 2025 学年民办中小学收费公示')}；${L('https://fgw.sh.gov.cn/fgw_gzzcbc/20241011/45b5d686cb9444b2a0a5e44638ce57d5.html', '上海市民办中小学收费管理办法')}；${L('https://m.gk100.com/read_12985702.htm', '2026 中外合作大学学费汇总')}；${L('https://admission.cuhk.edu.hk/fees-financing-your-studies/fees/', '香港中文大学 2026-27 学费')}、${L('https://admissions.hku.hk/fees-and-scholarships/fees', '香港大学学费')}；${L('https://www.nus.edu.sg/registrar/docs/info/administrative-policies-procedures/ugtuitioncurrent.pdf', '新加坡国立大学 AY2025/26 学费')}；${L('https://www.mext.go.jp/b_menu/shingi/kokuritu/005/gijiroku/attach/1386502.htm', '日本文部科学省国立大学标准学费')}；${L('https://www.ucl.ac.uk/prospective-students/undergraduate/degrees/computer-science-bsc-2026', 'UCL 2026/27 学费')}、${L('https://www.gov.uk/guidance/financial-evidence-for-student-and-child-student-route-applicants', '英国学生签证资金要求')}；${L('https://research.collegeboard.org/media/pdf/Trends-in-College-Pricing-and-Student-Aid-2025-final_1.pdf', 'College Board 2025 大学费用报告')}；${L('https://www.sydney.edu.au/study/fees-and-loans/international-student-tuition-fees.html', '悉尼大学 2026 国际生学费')}、${L('https://www.unsw.edu.au/study/your-future/cost-of-living-sydney', '澳洲学签生活费 29,710 澳元（新南威尔士大学转引内政部）')}；${L('https://www150.statcan.gc.ca/n1/daily-quotidien/250910/dq250910d-eng.htm', '加拿大统计局 2025/26 学费')}、${L('https://www.cicnews.com/2025/09/increased-fund-requirements-for-study-permits-take-effect-0959314.html', '加拿大学签资金要求')}；${L('https://chinadigitaltimes.net/chinese/727638.html', '育娲《中国生育成本报告 2026》')}（上海每孩月均 4,751 元，基础养育按各地消费水平等比例缩放）；${L('https://www.nbd.com.cn/articles/2025-12-10/4175435.html', '育儿补贴每孩每年 3,600 元')}。汇率按约 1 美元 7.1 元、1 英镑 9.6 元、1 澳元 4.7 元、1 加元 5.2 元、1 港币 0.91 元、1 新币 5.5 元粗算。</td></tr>`;
  $('#edutable').innerHTML = e + `</tbody>`;

  const rows = [
    ['年化利率', `${P.rate}%`, '2026 年储蓄国债 3 年 1.63%、5 年 1.70%；国有大行 3 年大额存单约 1.55%，股份行 1.75–1.8%。', L('http://zwgls.mof.gov.cn/ywgg/202606/t20260608_3991303.htm', '财政部储蓄国债') + '；' + L('https://news.qq.com/rain/a/20260306A050UJ00', '大额存单利率')],
    ['房贷利率', `${P.commRate}%`, '按商贷：上海首套 = 5 年期以上 LPR 3.5% − 45 个基点 = 3.05%（上海市民云公布的执行口径）；各城市差别不大。用公积金贷款利率更低（首套 5 年以上 2.6%），本页不区分，可以把这里调低。', L('https://m.thepaper.cn/newsDetail_forward_31694612', '澎湃：上海首套房贷利率') + '；' + L('https://www.chinanews.com.cn/cj/2026/09-20/10699777.shtml', '9 月 LPR')],
    ['借款利率', `${P.borrowRate}%`, '存款不够的年份按这个利率借钱付息。默认按消费贷、亲友周转的大致水平估，属于本页假设。', '本页假设'],
    ['贷款年龄', `到期不超过 ${P.maxLoanAge} 岁`, '多数银行和公积金中心要求贷款到期时借款人年龄不超过 65–70 岁，具体以当地规定为准；买房越晚，可贷年限越短。', '各地公积金中心与银行规定'],
    ['最低首付', `${P.minDown}%`, '各地首套首付多为 15%–25%。', L('https://k.sina.cn/article_5953466437_162dab0450670bd0rc.html', '上海首付比例')],
    ['税费装修', `${P.taxFeePct}% ＋ ${Y(P.renoPerM2)} 元/㎡`, '首套 140㎡ 以下契税 1%，二手房中介约 1–2%；装修按 1,500 元/㎡ 估。', '—'],
    ['日常与快乐开销', '按城市缩放', '以上海单身 4,500 元/月、快乐人情 3 万/年为基准，按各地城镇居民人均消费等比例缩放；已婚按 1.8 倍左右。', '—'],
    ['退休后每月花', `${Y(P.retireSpend)} 元/人`, '默认取当地城镇居民人均消费的 1.3 倍。', '—'],
    ['国家养老金', `${Y(P.pension)} 元/人/月`, `基础养老金 = 计发基数 ×（1＋平均缴费指数）÷ 2 × 缴费年限 × 1%，另加个人账户 ÷ 计发月数。缴费基数由到手 ÷ ${P.grossRatio}% 估算。上海 2025 年度全口径平均工资 12,577 元，缴费基数上下限 7,546–37,731 元（2026 年 7 月起）。`, L('https://news.qq.com/rain/a/20260822A03CMF00', '养老金计发') + '；' + L('https://news.qq.com/rain/a/20260902A0BT7F00', '上海 2025 年社平工资')],
    ['到手占税前', `${P.grossRatio}%`, '一线城市月薪 1–3 万时，扣掉社保、公积金（个人 17.5% 左右）和个税，到手大约是税前的 75%–82%。只用来反推社保缴费基数、估算养老金，不影响收入本身。', '本页估算'],
  ];
  let t = `<thead><tr><th>参数</th><th>当前取值</th><th>依据</th><th>来源</th></tr></thead><tbody>`;
  rows.forEach(r => { t += `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="wrap">${r[2]}</td><td class="src">${r[3]}</td></tr>`; });
  $('#sources').innerHTML = t + `</tbody>`;
}

// ---------- 核对计算 ----------
let AUDIT = null;
function auditChecks() {
  const ys = C.years, sm = C.sim, out = [];
  // 1 逐年余额递推
  let prev = C.savings, maxErr = 0;
  ys.forEach((y, i) => {
    const rate = prev < 0 ? C.rb : C.rMix;
    const calc = prev * (1 + rate) + sm.inc[i] + y.support + y.inflow + y.pension - y.total;
    maxErr = Math.max(maxErr, Math.abs(calc - sm.path[i])); prev = sm.path[i];
  });
  out.push(['每一年：年末存款 = 年初存款 ×（1＋利率）＋ 当年进账 − 当年支出', maxErr < 1, `最大误差 ${Y(maxErr)} 元`]);
  // 2 分项加总
  let catErr = 0; ys.forEach(y => { catErr = Math.max(catErr, Math.abs(CATS.reduce((a, [k]) => a + y[k], 0) - y.total)); });
  out.push(['每一年：各分项加起来 = 当年合计', catErr < 1, `最大误差 ${Y(catErr)} 元`]);
  // 3 总账
  const lhs = C.total - C.support - C.savings - C.inflowTotal - C.pensionUsed;
  out.push(['总账：今后总支出 − 家庭支持 − 现有存款 − 工资以外进账 − 国家养老金 = 最终自筹', Math.abs(lhs - C.selfFund) < 1 && Math.abs(C.W + C.G - C.selfFund) < 1, `${W(lhs)} 万 = ${W(C.selfFund)} 万`]);
  // 4 收入解
  if (!C.enough) out.push(['按"每年要赚多少"的收入逐年滚动，到最后一岁存款刚好为 0', Math.abs(C.simNeed.end) < 100, `终点存款 ${Y(C.simNeed.end)} 元`]);
  // 5 房贷
  if (C.buy && !C.moveLog.some(l => l.soldN)) { const pr = ys.reduce((a, y) => a + y.hs.principal, 0); out.push(['房贷：每年还的本金加起来 = 贷款总额', Math.abs(pr - C.loan) < 10, `${W(pr)} 万 = ${W(C.loan)} 万`]); }
  // 6 不顺：按定义逐年手算一遍，和图上的线对照
  { const sc = C.scen, cut = 1 - sc.cut / 100; let bal = C.savings, err = 0;
    ys.forEach((y, i) => {
      const base = C.have ? y.actCash - (y.age === sc.jobAge ? y.actMe : 0) : C.I * (y.g - (y.age === sc.jobAge ? y.gMe : 0));
      const cash = y.working ? base * cut : 0, extra = y.age === sc.shockAge ? sc.shockAmt : 0;
      bal = bal * (1 + (bal < 0 ? C.rb : C.rMix)) + cash + y.support + y.inflow + y.pension - y.total - extra;
      err = Math.max(err, Math.abs(bal - sc.bad.path[i]));
    });
    out.push([`不顺：按"${scenBad()}"逐年手算，和图上的线一致`, err < 1, `最大误差 ${Y(err)} 元`]); }
  // 7 养老金
  const pe = pensionEstimate(P, P.baseLow, C.contrib, C.P0, P.deemedYears);
  let acct = 0; for (let k = 0; k < C.contrib; k++) acct = acct * (1 + P.acctRate / 100) + P.baseLow * 0.08 * 12;   // 逐年滚存，和公式里的年金系数独立核对
  const hand = P.avgWage * (1 + pe.idx) / 2 * (C.contrib + P.deemedYears) / 100 + acct / pe.months + P.avgWage * pe.idx * P.deemedYears * P.transRate / 100;
  out.push(['养老金：按公式手算的最低基数估算值与页面一致', Math.abs(hand - pe.total) < 1, `${Y(hand)} 元/月`]);
  return out;
}
function renderAudit() {
  const ck = auditChecks();
  AUDIT = { n: ck.length, pass: ck.filter(x => x[1]).length };
  $('#au-checks').innerHTML = ck.map(([t, okk, d]) => `<li><span class="${okk ? 'ok' : 'no'}">${okk ? '✓' : '✗'}</span><span>${t}</span><small>${d}</small></li>`).join('');
  const e = C.have ? C.actNet[0] : C.earners[0];
  const r = C.r, two = C.adults === 2;
  const pe = pensionEstimate(P, P.baseLow, C.contrib, C.P0, P.deemedYears);
  const fm = [
    ['实际利率', `r = (1 ＋ 名义利率) ÷ (1 ＋ 通胀率) − 1\n  = (1 ＋ ${P.rate}%) ÷ (1 ＋ ${P.inflation}%) − 1 = ${(r * 100).toFixed(2)}%\n存款为负时按借款利率：(1 ＋ ${P.borrowRate}%) ÷ (1 ＋ ${P.inflation}%) − 1 = ${(C.rb * 100).toFixed(2)}%${C.w ? `\n存款里 ${P.stockPct}% 放股票基金时：${(C.rMix * 100).toFixed(2)}%` : ''}`, '全部金额按今天的钱，所以用扣掉通胀后的利率。'],
    ['逐年滚动（全页的核心）', `年末存款 = 年初存款 × (1 ＋ 利率)\n        ＋ 工资到手 ＋ 家庭支持 ＋ 工资以外的进账 ＋ 国家养老金\n        − 当年全部支出\n起点：年初存款 = 现有存款 ${Wu(C.savings)}`, '"够不够"就是看这条线：每一年都不为负叫"够"，只有最后为正叫"总账够、中间缺钱"。下面可以挑任意一年代入核对。'],
    ...(e && e.M > 0 ? [['收入（起步那年）', `一年到手 = 每月到手 × 一年几个月 = ${Y(e.M)} × ${e.months} = ${Y(e.takeHome)}${two && C.have ? `\n配偶：${Y(C.actNet[1].M)} × ${C.actNet[1].months} = ${Y(C.actNet[1].takeHome)}` : ''}\n以后每年 = 起步 × 工资增长系数（${growthText()}）`, '直接用你填的到手，不再模拟个税、社保和公积金。']] : []),
    ...(C.buy ? [['房贷月供（等额本息）', `月供 = 本金 × i ÷ (1 − (1 ＋ i)^(−n))，i = 年利率 ÷ 12，n = 年数 × 12\n贷款：${Y(C.loan)} 元，${P.commRate}%，${C.loanYrs} 年 → ${Y(C.mPay)} 元/月\n每个月的利息 = 剩余本金 × i，其余还本金`, `首付 = max(房价 × ${P.minDown}%，家庭支持 − 税费装修家电)；贷款年限不超过 ${P.maxLoanAge} 岁到期。`]] : []),
    ['国家养老金（每人每月，今天的钱）', `缴费年限 = 今年之前已交 ${P.paidYears} ＋ 今后 ${C.contrib - P.paidYears} = ${C.contrib} 年${P.deemedYears ? `，视同缴费 ${P.deemedYears} 年` : ''}\n基础养老金 = 计发基数 × (1 ＋ 缴费指数) ÷ 2 × (缴费年限 ＋ 视同缴费年限) × 1%\n个人账户 = Σ 每年(缴费基数 × 8% × 12) 按记账利率 ${P.acctRate}%（扣掉通胀后）滚存到退休 ÷ 计发月数\n  滚存系数：${C.contrib} 年相当于 ${pe.acctYears.toFixed(1)} 年的缴费\n过渡性养老金 = 计发基数 × 缴费指数 × 视同缴费年限 × ${P.transRate}%${P.deemedYears ? '' : '（你没有视同缴费年限，为 0）'}\n按最低基数：${Y(P.avgWage)} × (1 ＋ ${pe.idx.toFixed(2)}) ÷ 2 × ${C.contrib + P.deemedYears} × 1% ＋ ${Y(P.baseLow)} × 8% × 12 × ${pe.acctYears.toFixed(1)} ÷ ${pe.months}${pe.trans ? ` ＋ ${Y(pe.trans)}` : ''} = ${Y(pe.total)}`, `${C.P0} 岁起领。数据口径统一用同一年：${city().name}社平工资 ${Y(P.avgWage)} 元（上海为 2025 年度全口径平均工资，已与养老金计发基数并轨），缴费基数上下限 ${Y(P.baseLow)}–${Y(P.baseHigh)} 元正是它的 60% 和 300%（2026 年 7 月起执行）。全页按今天的钱算，所以社平工资不再往上涨，记账利率也用扣掉通胀后的。`],
    ...(!C.have && !C.enough ? [['每年要赚多少', `找一个起步收入 I，让"逐年滚动"到 ${P.endAge} 岁时存款刚好为 0\n以后每年收入 = I × 工资增长系数（${growthText()}）\n用二分法求解：I = ${Wu(C.I)}（家庭合计到手）\n对照：借款利率等于存款利率时，折现公式给出 (PV工作期 ＋ PV养老缺口) ÷ PV收入系数 = (${W(C.PVw)} ＋ ${W(C.PVg)}) ÷ ${nf2.format(C.PVinc)} = ${Wu(C.Ipv)}`, '两种算法在借款利率等于存款利率时完全一致，自检里也验证了这一点。']] : []),
    ['三种情况', `一般：就是上面的逐年滚动\n顺利：每年工资到手 × (1 ＋ ${C.scen.up}%)\n不顺：每年工资到手 × (1 − ${C.scen.cut}%)${C.scen.jobAge !== null ? `；${C.scen.jobAge} 岁那年你的那份工资为 0` : ''}${C.scen.shockAge !== null ? `；${C.scen.shockAge} 岁那年多一笔 ${Y(C.scen.shockAmt)} 元支出` : ''}\n其余（支出、家庭支持、养老金、利率）三种情况完全一样`, '没有随机数，每种情况都能用上面的逐年公式手算复现，自检里已经对"不顺"算了一遍。']
  ];
  $('#au-formulas').innerHTML = fm.map(([t, eq, note]) => `<div class="fm"><h4>${t}</h4><div class="eq">${eq.replace(/\\n/g, '\n')}</div><p>${note}</p></div>`).join('');
  // 单年
  const sel = $('#au-age');
  const cur = +sel.value || (C.buy ? P.buyAge : P.startAge);
  sel.innerHTML = C.years.map(y => `<option value="${y.age}"${y.age === cur ? ' selected' : ''}>${y.age} 岁${y.working ? '' : '（不工作）'}</option>`).join('');
  renderAuditYear();
}
function renderAuditYear() {
  const age = +$('#au-age').value || P.startAge;
  const i = C.years.findIndex(y => y.age === age); if (i < 0) return;
  const y = C.years[i], sm = C.sim, prev = i ? sm.path[i - 1] : C.savings;
  const rate = prev < 0 ? C.rb : C.rMix;
  const row = (a, v, f = '') => `<tr><td class="l">${a}</td><td>${v === '' ? '' : Y(v)}</td><td class="f">${f}</td></tr>`;
  const grp = t => `<tr class="grp"><td class="l" colspan="3">${t}</td></tr>`;
  let h = `<thead><tr><th class="l">项目</th><th>元</th><th class="l">怎么来的</th></tr></thead><tbody>`;
  h += grp(`${age} 岁 · ${cityById(y.city).name} · ${y.working ? '工作' : '不工作'}${y.couple ? ' · 已婚' : ''}`);
  h += grp('当年支出');
  CATS.forEach(([k, n]) => { if (y[k]) h += row(n, y[k], k === 'housing' ? [['房租', y.hs.rent], ['首付', y.hs.down], ['税费装修家电', y.hs.fees], ['月供', y.hs.mortgage], ['物业维修', y.hs.upkeep]].filter(x => x[1]).map(x => `${x[0]} ${Y(x[1])}`).join(' ＋ ') + (y.hs.interest ? `（月供里利息 ${Y(y.hs.interest)}、本金 ${Y(y.hs.principal)}）` : '')
    : k === 'child' ? Object.entries({ birth: '孕产', base: '基础养育', infant: '托育', tutor: '课外班', kg: '学前', pri: '小学', mid: '初中', high: '高中', uni: '本科', grad: '研究生', prep: '语培申请', after: '毕业后贴补', help: '资助' }).filter(([x]) => y.ci[x]).map(([x, nm]) => `${nm} ${Y(y.ci[x])}`).join(' ＋ ')
    : k === 'retire' && y.late ? `含高龄护理 ${Y(y.late)}` : ''); });
  h += row('<b>支出合计</b>', y.total, '上面各项相加');
  h += grp('当年进账');
  const cash = sm.inc[i];
  if (cash) h += row('工资到手', cash, C.have ? '你填的每月到手 × 月数 × 当年的工资增长系数' : `起步收入 ${Wu(C.I)} × 增长系数 ${nf2.format(y.g)}`);
  if (y.support) h += row('家庭支持', y.support);
  [['卖房收回', y.sale], ['一次性进账', y.windfall], ['副业', y.side], ['房租收入', y.lease]].forEach(([n, v]) => { if (v) h += row(n, v); });
  if (y.pension) h += row('国家养老金', y.pension, [y.pensMe ? `你 ${Y(y.pensMe / 12)}/月` : '', y.pensSp ? `配偶 ${Y(y.pensSp / 12)}/月` : ''].filter(Boolean).join('，') + ' × 12');
  h += grp('存款变化');
  h += row('年初存款', prev);
  h += row('利息', prev * rate, `${Y(prev)} × ${(rate * 100).toFixed(2)}%${prev < 0 ? '（欠钱，按借款利率）' : ''}`);
  h += row('<b>年末存款</b>', sm.path[i], '年初 ＋ 利息 ＋ 进账 − 支出');
  $('#au-year').innerHTML = h + '</tbody>';
  const calc = prev * (1 + rate) + sm.inc[i] + y.support + y.inflow + y.pension - y.total;
  $('#au-rec').innerHTML = `验算：${Y(prev)} × (1 ＋ ${(rate * 100).toFixed(2)}%) ＋ ${Y(sm.inc[i] + y.support + y.inflow + y.pension)} − ${Y(y.total)} = <b class="mono">${Y(calc)}</b> 元，页面显示 ${Y(sm.path[i])} 元，${Math.abs(calc - sm.path[i]) < 1 ? '一致' : '<b class="no">不一致</b>'}。`;
}
async function saveFile(name, text, mime) {
  const msg = $('#au-msg');
  try {
    if (window.claude && window.claude.use) { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename: name, data: new Blob([text], { type: mime }) }); msg.textContent = ''; return; } }
  } catch (e) { if (e && e.code === 'cancelled') return; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '已开始下载。'; }
  catch (e) { msg.textContent = '这个环境不允许下载，可以用"参数快照"复制。'; }
}
function csvText() {
  const cols = [['年龄', y => y.age], ['城市', y => cityById(y.city).name], ['是否工作', y => y.working ? '是' : '否'], ...CATS.map(([k, n]) => [n, y => Math.round(y[k])]),
    ['支出合计', y => Math.round(y.total)], ['其中房租', y => Math.round(y.hs.rent)], ['其中月供', y => Math.round(y.hs.mortgage)], ['其中房贷利息', y => Math.round(y.hs.interest)], ['剩余房贷', y => Math.round(y.hs.loanLeft)],
    ['工资到手', (y, i) => Math.round(C.sim.inc[i])], ['家庭支持', y => Math.round(y.support)], ['工资以外进账', y => Math.round(y.inflow)], ['国家养老金', y => Math.round(y.pension)],
    ['借款利息', (y, i) => Math.round(C.sim.debtInt[i])], ['年末存款', (y, i) => Math.round(C.sim.path[i])], ['房产价值', y => Math.round(y.houseValue)]];
  return '\ufeff' + cols.map(c => c[0]).join(',') + '\n' + C.years.map((y, i) => cols.map(c => c[1](y, i)).join(',')).join('\n');
}
// ---------- AI 填表评测（开发者用：在 Claude 里打开时可以跑） ----------
function evalCompare(k, got, want) {
  const f = FILL[k];
  if (f.moves || f.events) {
    const list = JSON.parse(got);
    return want.every(w => list.some(g => Object.keys(w).every(x => String(g[x]) === String(w[x]))));
  }
  if (f.enum) return String(got) === String(want);
  const g = got / (f.scale || 1);
  if (['岁', '个', '个月', '年', '%', '边', '人份', '㎡'].includes(f.unit)) return Math.abs(g - want) < 0.01;   // 年龄、个数、比例必须完全对
  return Math.abs(g - want) <= Math.abs(want) * 0.02 + 0.01;   // 金额允许 2% 误差（如年薪除以月数的取整）
}
// 对照评测：同一套用例，比较提示词版本和模型档位
const EVAL_CONFIGS = [
  { id: 'v1-default', name: '提示词 v1 · 默认档', ver: 'v1', tier: 'default' },
  { id: 'v2-default', name: '提示词 v2 · 默认档', ver: 'v2', tier: 'default' },
  { id: 'v2-quick', name: '提示词 v2 · 快速档', ver: 'v2', tier: 'quick' },
];
async function evalOne(c, cfg, signal) {
  const base = fresh(); const q = clone(base);
  const r = { id: c.id, cat: c.cat, tag: c.tag, ok: 0, want: Object.keys(c.expect).length, wrong: [], missing: [], extra: [], forbidden: [], asked: false, blocked: 0, json: true, ms: 0, chars: 0 };
  const prompt = fillPrompt(c.text, base, cfg.ver);
  const t0 = performance.now();
  try {
    const res = await SAMPLE.json(prompt, { signal, cache: false, modelTier: cfg.tier });
    r.ms = performance.now() - t0; r.chars = prompt.length + JSON.stringify(res || {}).length;
    if (AI_KIND === 'deepseek' && SAMPLE.lastUsage) { r.tokens = SAMPLE.lastUsage.in + SAMPLE.lastUsage.out; r.usd = dsCost(SAMPLE.lastUsage); }
    const { done, bad } = applyPatch(q, res && res.changes);
    r.blocked = bad.length;
    r.asked = cleanQuestions(res && res.questions).length > 0;
    const changed = done.map(d => d[0]);
    for (const [k, w] of Object.entries(c.expect)) {
      if (evalCompare(k, fillGet(q, k), w)) r.ok++;
      else if (changed.includes(k) || (res && res.changes && k in res.changes)) r.wrong.push(`${FILL[k].label}：填成 ${fillShow(k, fillGet(q, k))}`);
      else r.missing.push(FILL[k].label);
    }
    changed.forEach(k => { if (!(k in c.expect)) r.extra.push(`${FILL[k].label}：${fillShow(k, fillGet(q, k))}`); });
    (c.forbid || []).forEach(k => { if (changed.includes(k)) r.forbidden.push(FILL[k].label); });
  } catch (e) { if (e && e.code === 'cancelled') throw e; r.ms = performance.now() - t0; r.json = false; r.chars = prompt.length; r.err = (e && e.code) || 'error'; }
  r.pass = r.json && r.ok === r.want && !r.forbidden.length && (!c.ask || r.asked);
  return r;
}
function evalSummary(rows) {
  const n = rows.length, fields = rows.reduce((a, r) => a + r.want, 0), okF = rows.reduce((a, r) => a + r.ok, 0);
  const askCases = rows.filter(r => EVAL_CASES.find(c => c.id === r.id).ask), noAsk = rows.filter(r => !EVAL_CASES.find(c => c.id === r.id).ask);
  return { 用例: n, 完全正确: rows.filter(r => r.pass).length, 完全正确率: rows.filter(r => r.pass).length / Math.max(1, n), 字段准确率: fields ? okF / fields : 0,
    填错值: rows.reduce((a, r) => a + r.wrong.length, 0), 漏填: rows.reduce((a, r) => a + r.missing.length, 0), 多填: rows.reduce((a, r) => a + r.extra.length, 0),
    不该填却填了: rows.reduce((a, r) => a + r.forbidden.length, 0), 该问的问了: `${askCases.filter(r => r.asked).length}/${askCases.length}`, 多余追问: noAsk.filter(r => r.asked).length,
    格式错误: rows.filter(r => !r.json).length, 平均token: rows.some(r => r.tokens) ? Math.round(rows.reduce((a, r) => a + (r.tokens || 0), 0) / Math.max(1, n)) : null, 总费用美元: rows.some(r => r.usd != null) ? rows.reduce((a, r) => a + (r.usd || 0), 0) : null, 平均耗时秒: rows.reduce((a, r) => a + r.ms, 0) / Math.max(1, n) / 1000, 平均字数: Math.round(rows.reduce((a, r) => a + r.chars, 0) / Math.max(1, n)) };
}
function evalConclusion(res) {
  const s = Object.fromEntries(res.map(x => [x.cfg.id, x.sum]));
  const pc = x => Math.round(x * 100) + '%';
  const lines = [];
  if (s['v1-default'] && s['v2-default']) {
    const d = s['v2-default'].完全正确率 - s['v1-default'].完全正确率;
    lines.push(`提示词 v2 比 v1 完全正确率${d >= 0 ? '提高' : '下降'} ${Math.abs(Math.round(d * 100))} 个百分点（${pc(s['v1-default'].完全正确率)} → ${pc(s['v2-default'].完全正确率)}），不该填却填了 ${s['v1-default'].不该填却填了} → ${s['v2-default'].不该填却填了} 处，${d >= 0 ? '保留 v2' : '需要回看 v2 的改动'}。`);
  }
  if (s['v2-default'] && s['v2-quick']) {
    const dq = s['v2-default'].完全正确率 - s['v2-quick'].完全正确率, sp = s['v2-default'].平均耗时秒 / Math.max(0.01, s['v2-quick'].平均耗时秒);
    const fast = sp >= 1.2 ? `平均耗时是默认档的 ${Math.round(100 / sp)}%` : '速度没有明显优势';
    lines.push(dq <= 0.05 && s['v2-quick'].不该填却填了 === 0
      ? `快速档完全正确率只比默认档低 ${Math.max(0, Math.round(dq * 100))} 个百分点，${fast}，单价也更低：填表这种短任务用快速档；问答解读需要推理，保留默认档。`
      : `快速档完全正确率比默认档低 ${Math.max(0, Math.round(dq * 100))} 个百分点、不该填却填了 ${s['v2-quick'].不该填却填了} 处（${fast}），填错会直接改变测算结果：填表继续用默认档，快速档只考虑用于不改数字的场景。`);
  }
  return lines;
}
async function runEval() {
  if (!SAMPLE) return;
  const cfgs = EVAL_CONFIGS.filter(c => { const cb = document.querySelector(`#ev-cfgs input[value="${c.id}"]`); return cb && cb.checked; });
  if (!cfgs.length) { $('#ev-out').textContent = '至少选一个配置。'; return; }
  const btn = $('#ev-go'), out = $('#ev-out'); btn.disabled = true; $('#ev-stop').hidden = false;
  const ctl = new AbortController(); $('#ev-stop').onclick = () => ctl.abort();
  const res = [];
  try {
    for (const cfg of cfgs) {
      const rows = [];
      for (const c of EVAL_CASES) {
        out.textContent = `正在跑「${cfg.name}」第 ${c.id} / ${EVAL_CASES.length} 条（共 ${cfgs.length} 个配置）……`;
        rows.push(await evalOne(c, cfg, ctl.signal));
      }
      res.push({ cfg, rows, sum: evalSummary(rows) });
    }
  } catch (e) { if (!(e && e.code === 'cancelled')) throw e; out.textContent = '已停止。'; btn.disabled = false; $('#ev-stop').hidden = true; if (!res.length) return; }
  EVAL_RESULT = { at: new Date().toISOString(), provider: aiName(), cases: EVAL_CASES.length, configs: res.map(x => ({ 配置: x.cfg.name, 汇总: x.sum, 明细: x.rows })) };
  renderEvalReport(res);
  btn.disabled = false; $('#ev-stop').hidden = true;
}
function renderEvalReport(res) {
  const pc = x => Math.round(x * 100) + '%';
  const cats = [...new Set(EVAL_CASES.map(c => c.cat))];
  let h = `<h4>对照结果（${EVAL_CASES.length} 条用例）</h4><div class="tbl"><table class="t dense"><thead><tr><th class="l">配置</th><th>完全正确</th><th>字段准确率</th><th>填错值</th><th>漏填</th><th>多填</th><th>不该填却填了</th><th>该问的问了</th><th>多余追问</th><th>格式错误</th><th>平均耗时</th><th>平均字数</th>${res.some(x => x.sum.平均token) ? '<th>平均 token</th><th>总费用</th>' : ''}</tr></thead><tbody>` +
    res.map(({ cfg, sum: s }) => `<tr><td class="l">${cfg.name}</td><td><b>${pc(s.完全正确率)}</b></td><td>${pc(s.字段准确率)}</td><td>${s.填错值}</td><td>${s.漏填}</td><td>${s.多填}</td><td>${s.不该填却填了}</td><td>${s.该问的问了}</td><td>${s.多余追问}</td><td>${s.格式错误}</td><td>${s.平均耗时秒.toFixed(1)} 秒</td><td>${nf0.format(s.平均字数)}</td>${res.some(x => x.sum.平均token) ? `<td>${s.平均token ? nf0.format(s.平均token) : '—'}</td><td>${s.总费用美元 != null ? '$' + s.总费用美元.toFixed(4) : '—'}</td>` : ''}</tr>`).join('') + `</tbody></table></div>`;
  h += `<p class="dim">平均字数 = 每次调用的输入加输出字数，是成本的近似：按用量计费时成本与它成正比，快速档单价更低。</p>`;
  const concl = evalConclusion(res); if (concl.length) h += `<p><b>结论：</b>${concl.join(' ')}</p>`;
  h += `<h4>按能力类别看（通过条数）</h4><div class="tbl"><table class="t dense"><thead><tr><th class="l">类别</th><th>用例</th>${res.map(x => `<th>${x.cfg.name}</th>`).join('')}<th class="l">对策</th></tr></thead><tbody>` +
    cats.map(cat => { const n = EVAL_CASES.filter(c => c.cat === cat).length; return `<tr><td class="l">${cat}</td><td>${n}</td>${res.map(x => { const k = x.rows.filter(r => r.cat === cat && r.pass).length; return `<td class="${k < n ? 'no' : 'ok'}">${k}/${n}</td>`; }).join('')}<td class="l wrap">${EVAL_FIXES[cat] || ''}</td></tr>`; }).join('') + `</tbody></table></div>`;
  res.forEach(({ cfg, rows }) => {
    const bad = rows.filter(r => !r.pass);
    h += `<details class="more"><summary>${cfg.name}：没通过的 ${bad.length} 条</summary><div class="tbl"><table class="t dense"><thead><tr><th>#</th><th class="l">类别</th><th class="l">说法</th><th class="l">问题</th></tr></thead><tbody>${bad.map(r => { const c = EVAL_CASES.find(x => x.id === r.id); const why = [...r.wrong, ...r.missing.map(x => `漏填${x}`), ...r.extra.map(x => `多填${x}`), ...r.forbidden.map(x => `不该填${x}`), ...(c.ask && !r.asked ? ['该追问没追问'] : []), ...(r.json ? [] : [`格式错误（${r.err}）`])]; return `<tr><td>${r.id}</td><td class="l">${esc(r.cat)}</td><td class="l wrap">${esc(c.text)}</td><td class="l wrap">${esc(why.join('；'))}</td></tr>`; }).join('')}</tbody></table></div></details>`;
  });
  h += `<div class="snap-actions"><button type="button" class="btn" id="ev-dl">下载评测结果 JSON</button></div>`;
  $('#ev-out').innerHTML = h;
  $('#ev-dl').onclick = () => saveFile('一生账本-AI填表对照评测.json', JSON.stringify(EVAL_RESULT, null, 2), 'application/json');
}
let EVAL_RESULT = null;
function renderLimits() {
  const Ls = [
    '投资只分"存款国债"和"股票基金"两类，按长期平均收益算；具体产品、再平衡、手续费和税都没有细算。',
    '城市参考值是全市平均，房价用的是挂牌价。核心区和郊区的房价、租金能差两三倍，用区位系数调整。',
    '收入直接用你填的每月到手，不再模拟个税、社保和公积金；公积金账户里的钱不算进可用的钱（偏保守，买房时能提的那部分会被低估）。副业收入按你填的税后金额计。',
    '通胀不算：全部金额按今天的购买力，利率、工资涨幅、房价涨跌都是扣掉通胀后的实际值。',
    '随机波动不算：只看顺利、一般、不顺三种写清楚的情况，不做概率预测。现实中可能比"不顺"更糟，也可能更好。',
    '税制和社保政策按现在的规定，以后可能调整；遗产、赠与、离婚分割、子女反哺都没算。',
    '医疗只算常态开销。重大疾病默认由医保和商业保险覆盖，只在"不顺"情况里算一笔意外支出；高龄护理默认不额外计，可在"养老金与退休开销"里填。',
    '孩子毕业后按你填的年数继续贴补；结婚买房资助默认 0，可以在"孩子"里填。老二、老三的基础养育按老大的一定比例计，学费不打折。',
    '父母的照护费用按每月固定金额估算，没有区分居家、护工和养老院；父母自己的养老金和积蓄可以通过调低金额或"你们家承担的比例"体现。',
    '房价涨跌按每年固定比例，租金按今天的水平不变；房产价值不计入"够不够"的判断，只作为额外资产列出。',
    '中途搬家时，国家养老金仍按原城市估算，社保跨地区转移接续没有细算；搬家后的房价、租金按新城市全市均价。',
    '家庭支持按一次性到位计算；分几年给的话，逐年现金流会有差别，但总账不变。',
    '中立性：本页不接受任何机构付费修改默认假设（利率、投资收益、房价等），不在结果里插入金融产品推荐；计算规则全部公开在"核对计算"页，AI 被要求不推荐具体产品。',
    '这是个人规划测算工具，不构成投资、税务或法律建议。'
  ];
  $('#limits').innerHTML = Ls.map(x => `<li>${x}</li>`).join('');
  $('#foot').innerHTML = `一生账本 · 城市、政策和教育费用数据核对于 2026-09-29 · 所有计算都在你的浏览器里完成，不上传、不收集任何数据；只有你点 AI 按钮时，才会把描述或问题连同本页参数发给你选择的 AI 服务（Claude 或 DeepSeek） · 仅供个人规划参考，不构成投资、税务或法律建议。`;
}

function renderSnap() {
  const ta = $('#snap');
  if (document.activeElement === ta) return;
  ta.value = JSON.stringify({ app: '一生账本', v: 2, saved: new Date().toISOString().slice(0, 10), summary: `${scenarioName()} → 每年需到手 ${Wu(C.I)}`, params: P });
}

// ---------- AI：帮我填、问问这份账本（用 Claude 的 sample 能力；页面外打开时自动隐藏） ----------
// 能被 AI 改的参数白名单：[路径, 说明, 单位, 下限, 上限, 缩放(模型值=填写值×缩放)] 或枚举
const FILL = {
  city: { label: '城市', enum: () => CITIES.map(c => [c.id, c.name]) },
  mode: { label: '计算方向', enum: () => [['need', '按想过的生活算要赚多少'], ['have', '按现在收入算能过什么生活']] },
  startAge: { label: '今年年龄', unit: '岁', min: 16, max: 70 },
  savings: { label: '现有存款', unit: '万', min: 0, max: 100000, scale: 1e4 },
  retireAge: { label: '打算工作到', unit: '岁', min: 20, max: 80 },
  pensionAge: { label: '开始领养老金', unit: '岁', min: 50, max: 70 },
  endAge: { label: '账算到', unit: '岁', min: 60, max: 110 },
  family: { label: '家庭', enum: () => [['single', '单身'], ['couple', '已婚无孩'], ['kid', '已婚有孩']] },
  kids: { label: '孩子个数', unit: '个', min: 1, max: 3 },
  route: { label: '教育路线', enum: () => ROUTES.map(r => [r.id, r.name]) },
  housing: { label: '住房', enum: () => [['buy', '买房'], ['rent', '一直租房'], ['own', '已有房']] },
  support: { label: '家里能支持', unit: '万', min: 0, max: 100000, scale: 1e4 },
  supportAt: { label: '家庭支持几岁到位（0=买房那年）', unit: '岁', min: 0, max: 100 },
  buyAge: { label: '买房年龄', unit: '岁', min: 16, max: 90 },
  area: { label: '买房（或已有房）面积', unit: '㎡', min: 10, max: 500 },
  locFactor: { label: '区位', enum: () => [[180, '核心区'], [100, '全市均价'], [70, '外围'], [50, '远郊']] },
  ownMortgage: { label: '已有房每月房贷', unit: '元/月', min: 0, max: 200000 },
  ownLoanYears: { label: '已有房房贷还剩几年', unit: '年', min: 0, max: 30 },
  'me.salary': { label: '你每月到手（扣完个税社保公积金）', unit: '元/月', min: 0, max: 2000000 },
  'me.months': { label: '你一年到手几个月（含年终奖）', unit: '个月', min: 1, max: 30 },
  'me.growth': { label: '你的工资每年实际涨', unit: '%', min: -5, max: 20 },
  'sp.salary': { label: '配偶每月到手', unit: '元/月', min: 0, max: 2000000 },
  'sp.months': { label: '配偶一年到手几个月', unit: '个月', min: 1, max: 30 },
  'sp.age': { label: '配偶今年年龄', unit: '岁', min: 16, max: 80 },
  'sp.retire': { label: '配偶工作到', unit: '岁', min: 20, max: 80 },
  split: { label: '你的收入占家庭比例', unit: '%', min: 0, max: 100 },
  marriageAge: { label: '结婚年龄', unit: '岁', min: 16, max: 80 },
  birthAge: { label: '第一个孩子出生时你的年龄', unit: '岁', min: 16, max: 60 },
  wedding: { label: '结婚花费', unit: '万', min: 0, max: 1000, scale: 1e4 },
  parents: { label: '赡养父母（工作期合计）', unit: '万', min: 0, max: 2000, scale: 1e4 },
  carPrice: { label: '车价（0=不买车）', unit: '万', min: 0, max: 500, scale: 1e4 },
  petYear: { label: '宠物每年', unit: '元/年', min: 0, max: 200000 },
  retireSpend: { label: '退休后每人每月花', unit: '元/月', min: 0, max: 200000 },
  kidHelp: { label: '孩子结婚买房资助（每个）', unit: '万', min: 0, max: 5000, scale: 1e4 },
  moves: { label: '中途搬家', moves: true },
  events: { label: '人生大事', events: true },
  parAge: { label: '父母现在大约多少岁', unit: '岁', min: 30, max: 100 },
  careMonthly: { label: '父母照护期每边每月', unit: '元/月', min: 0, max: 100000 },
  stockPct: { label: '存款里放股票基金的比例', unit: '%', min: 0, max: 100 },
  houseGrowth: { label: '房价每年实际涨跌', unit: '%', min: -10, max: 10 },
  pension: { label: '国家基本养老金（每人每月，填了就不再自动估算）', unit: '元/月', min: 0, max: 100000 },
  paidYears: { label: '你今年之前已交社保', unit: '年', min: 0, max: 50 },
  'sp.paid': { label: '配偶今年之前已交社保', unit: '年', min: 0, max: 50 },
};
// 左侧参数面板里的每一项也都允许 AI 填：从面板定义自动生成，保证"能在页面上改的，AI 也能改"
(function extendFill() {
  const add = ([key, label, unit, scale], pair) => {
    if (FILL[key] || key.startsWith('tiers.')) return;
    const pct = unit === '%', age = unit === '岁';
    FILL[key] = { label: label.replace(/（[^）]*）/g, ''), unit: scale === 1e4 ? '万' : unit, min: pct ? -100 : 0, max: pct ? 100 : age ? 120 : 1e9, scale: scale === 1 ? undefined : scale, pair };
  };
  PAIR_GROUPS.forEach(g => { g.rows.forEach(r => add(r, true)); (g.fields || []).forEach(r => add(r, false)); });
  FIELD_GROUPS.forEach(g => (g.fields || []).forEach(r => add(r, false)));
  [['retireSpend', '退休后每人每月花', '元/月', 1], ['lateExtra', '高龄护理每人每月额外花', '元/月', 1], ['lateAge', '高龄护理从几岁开始', '岁', 1], ['selfPayRate', '自缴社保比例', '%', 1], ['coupleFactor', '夫妻养老按几人份算', '人份', 1]].forEach(r => add(r, false));
  FILL.support.pair = true; FILL.area.pair = true;
})();
const fillGet = (q, k) => {
  if (k === 'moves') return JSON.stringify(q.moves);
  if (k === 'events') return JSON.stringify(q.events);
  if (k === 'route') return routeId(q);
  if (FILL[k] && FILL[k].pair) return q[k][q.family === 'single' ? 's' : 'c'];
  const [a, b] = k.split('.'); return b ? q[a][b] : q[a];
};
const fillShow = (k, v) => {
  const f = FILL[k]; if (v === undefined || v === null) return '—';
  if (f.events) { const l = JSON.parse(v); return l.length ? l.map(e => `${e.age}岁${EVT[e.type]}${e.type === 'salary' ? e.amount + '%' : e.type === 'side' ? e.amount + '元/月' : e.type === 'gap' ? e.years + '年' : e.amount + '万'}`).join('；') : '无'; }
  if (f.moves) { const l = JSON.parse(v); return l.length ? l.map(m => `${m.age}岁搬到${cityById(m.city).name}${m.sell ? '卖房' : ''}${(HOMES.find(h => h[0] === m.home) || [, ''])[1]}`).join('；') : '不搬家'; }
  if (f.enum) { const e = f.enum().find(x => String(x[0]) === String(v)); return e ? e[1] : String(v); }
  return nf0.format(Math.round(v / (f.scale || 1) * 100) / 100) + ' ' + f.unit;
};
// 校验并应用；返回改了什么、拒绝了什么
function applyPatch(q, changes) {
  const done = [], bad = [], same = [];
  const keys = Object.keys(changes || {}).filter(k => k in FILL).sort((a, b) => (a === 'city' ? -1 : b === 'city' ? 1 : 0));
  Object.keys(changes || {}).filter(k => !(k in FILL)).forEach(k => bad.push([k, changes[k], '不能改这一项']));
  for (const k of keys) {
    const f = FILL[k]; let v = changes[k];
    const before = fillGet(q, k);
    if (f.events) {
      const list = cleanEvents(v).filter(e => e.age >= q.startAge && e.age <= q.endAge);
      if (Array.isArray(v) && list.length < v.length) bad.push([k, JSON.stringify(v), '有的事件信息不完整或年龄不对，已略过']);
      q.events = list;
    } else if (f.moves) {
      const raw = (Array.isArray(v) ? v : []).map(m => ({ ...m, city: (CITIES.find(c => c.id === (m && m.city) || c.name === (m && m.city)) || {}).id }));
      const list = cleanMoves(raw).filter(m => m.age > q.startAge && m.age <= q.endAge);
      if (Array.isArray(v) && list.length < v.length) bad.push([k, JSON.stringify(v), '有的搬家信息不完整或年龄不对，已略过']);
      q.moves = list;
    } else if (f.enum) {
      const ok = f.enum().find(x => String(x[0]) === String(v) || x[1] === v);
      if (!ok) { bad.push([k, v, '不是可选的值']); continue; }
      v = ok[0];
      if (k === 'city') applyCity(q, v);
      else if (k === 'route') setRoute(q, ROUTES.find(r => r.id === v));
      else q[k] = v;
    } else {
      v = Number(v);
      if (!isFinite(v)) { bad.push([k, changes[k], '不是数字']); continue; }
      if (v < f.min || v > f.max) { bad.push([k, v, `超出合理范围 ${f.min}–${f.max} ${f.unit}`]); continue; }
      if (['startAge', 'retireAge', 'pensionAge', 'endAge', 'kids', 'buyAge', 'marriageAge', 'birthAge', 'sp.age', 'sp.retire', 'supportAt'].includes(k)) v = Math.round(v);
      const mv = v * (f.scale || 1);
      if (f.pair) { q[k].s = mv; q[k].c = mv; }
      else { const [a, b] = k.split('.'); if (b) q[a][b] = mv; else q[a] = mv; }
      if (k === 'sp.age' || k === 'sp.retire' || k === 'sp.pensionAge') q.spSync = false;
      if (k === 'pension') q.pensionAuto = false;
    }
    const after = fillGet(q, k);
    if (String(after) !== String(before)) done.push([k, before, after]); else same.push(k);
  }
  // 基本一致性
  if (!(q.retireAge > q.startAge)) { bad.push(['retireAge', q.retireAge, '要大于今年年龄，已改回']); q.retireAge = Math.max(q.startAge + 1, 60); }
  if (!(q.endAge > q.retireAge)) { q.endAge = Math.max(q.retireAge + 1, 90); }
  if (q.buyAge < q.startAge) q.buyAge = q.startAge;
  return { done, bad, same };
}

// AI 评测是给开发和面试展示用的，不对普通用户显示：网址末尾加 #dev 才出现
const DEV = /(^|[#&])dev\b/.test(location.hash);
let SAMPLE = null, TOOLS_OK = false, aiCtl = null, askCtl = null, undoP = null;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function md(t) {
  const lines = esc(t).split('\n'); let h = '', inList = false;
  for (let ln of lines) {
    ln = ln.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#+\s*/, '');
    if (/^\s*[-*•]\s+/.test(ln)) { if (!inList) { h += '<ul>'; inList = true; } h += `<li>${ln.replace(/^\s*[-*•]\s+/, '')}</li>`; }
    else { if (inList) { h += '</ul>'; inList = false; } if (ln.trim()) h += `<p>${ln}</p>`; }
  }
  return h + (inList ? '</ul>' : '');
}
const ERR = {
  not_granted: '你没有允许这个页面使用 Claude，AI 功能已关闭。', sampling_disabled: '这个账号暂时不能用 AI 功能。',
  rate_limited: '问得太频繁或用量到上限了，过一会儿再试。', session_expired: '登录过期了，请重新登录 Claude。',
  refused: 'AI 没有回答这个问题，换个问法试试。', invalid_json: 'AI 没按格式回答，再点一次试试。',
  empty_completion: 'AI 没有给出回答，换个问法试试。', prompt_too_large: '内容太长了，少写一点再试。',
  bad_key: 'DeepSeek API Key 不对或已失效，请到设置里重新填。', no_balance: 'DeepSeek 账户余额不足，请先充值。',
  network: '连不上 DeepSeek。可能是网络问题，或浏览器拦截了跨域请求：可以按 README 部署一个转发地址，填到设置里的"接口地址"。',
  invalid_request: '请求被 DeepSeek 拒绝了，检查设置里的模型和接口地址。',
};
const errText = e => ERR[e && e.code] || '出了点问题，稍后再试。';
function hideAI() { if (AI_KIND !== 'claude') return; $('#ai-fill').hidden = true; $('#ask-fab').hidden = true; $('#ask-drawer').hidden = true; SAMPLE = null; }

// 提示词两个版本：v1 = 第一版；v2 = 评测后改进（"到手"不当税前、相对时间换算、信息含糊时主动追问）
const PROMPT_RULES = {   // 用函数取值：换算比例跟着参数走
  v1: () => `1. 只填用户明确说了、或能直接推出的项；没提到的不要填，不要猜默认值。
2. 金额按下面的单位换算：月薪是"每月到手（元/月，已扣个税、社保、公积金）"；用户说税前、或没说是税前还是到手时，按到手 ≈ 税前 × ${P.grossRatio}% 换算，并在 assumptions 里说明；说年薪就先除以一年发几个月（没说按 12）。
3. 用户说了女朋友/男朋友/对象但没说结婚年龄，family 按已婚处理（有孩子计划就是 kid），并在 assumptions 里说明。
4. 城市不在列表里用 "other"。教育路线要从列表里选最接近的。
5. 年龄都是用户本人的年龄口径，配偶的年龄填 sp.age。
6. 只输出一个 JSON 对象，不要其他文字：{"changes": {参数名: 值}, "assumptions": ["你做的推断"], "unclear": ["用户提到但没法填或需要确认的"]}`,
  v2: () => `1. 只填用户明确说了、或能直接推出的项；没提到的不要填，不要猜默认值。
2. 金额按下面的单位换算：月薪是"每月到手（元/月，已扣个税、社保、公积金）"；用户说税前、或没说是税前还是到手时，按到手 ≈ 税前 × ${P.grossRatio}% 换算，并在 assumptions 里说明；说年薪就先除以一年发几个月（没说按 12）。
3. 用户说了女朋友/男朋友/对象但没说结婚年龄，family 按已婚处理（有孩子计划就是 kid），并在 assumptions 里说明。
4. 城市不在列表里用 "other"。教育路线要从列表里选最接近的。
5. 年龄都是用户本人的年龄口径，配偶的年龄填 sp.age。
6. "明年""后年""比我大两岁"这类说法，按当前值里的今年年龄换算成具体年龄。
7. 关键数字含糊、会明显影响结果时不要猜：比如没说是每月还是每年、只说"几十万""两万多"。把它放进 questions，每个问题附 2–3 个可选答案；能确定的部分照常填。没有含糊的就给空数组，不要为问而问。
8. 只输出一个 JSON 对象，不要其他文字：{"changes": {参数名: 值}, "assumptions": ["你做的推断"], "questions": [{"q": "问题", "options": ["可选答案"]}], "unclear": ["提到了但没法填的"]}`,
};
function fillPrompt(text, q = P, ver = 'v2') {
  const spec = Object.entries(FILL).map(([k, f]) => f.events
    ? `- events（人生大事，最多 10 件，没提就不要填）：数组，每项 {"age": 你的年龄, "type": 类型, "amount": 数值, "years": 持续几年, "who": "me"或"sp"}。type 只能是：gap 停工（years 年，没工资）、salary 工资从这年起变化（amount 为百分比，如 30 或 -20）、income 一次性进账（amount 万）、expense 一次性支出（amount 万）、study 在职读书（amount 每年万，years 年）、side 副业（amount 每月税后元，years 年）`
    : f.moves
    ? `- moves（中途搬家，最多 3 次，没提搬家就不要填）：数组，每项 {"age": 搬家时你的年龄, "city": 城市代码, "sell": 是否卖掉原来的房 true/false, "home": "rent"租房|"buy"买房|"own"住已有的房（如回老家住父母的房）, "area": 新房面积㎡（买房或已有房时）}`
    : f.enum
    ? `- ${k}（${f.label}）：只能取 ${f.enum().map(x => JSON.stringify(x[0]) + '=' + x[1]).join('，')}`
    : `- ${k}（${f.label}）：数字，单位 ${f.unit}，范围 ${f.min}–${f.max}`).join('\n');
  const cur = Object.keys(FILL).filter(k => !FILL[k].moves && !FILL[k].events).map(k => `${k}=${JSON.stringify(fillGet(q, k) / (FILL[k].scale || 1) || fillGet(q, k))}`).join('，');
  return `你是"一生账本"（中国家庭一生收支测算器）的填表助手。把用户的描述转成参数修改。

规则：
${PROMPT_RULES[ver]()}

可填的参数：
${spec}

当前值：${cur}

用户的描述：
"""${text.slice(0, 2000)}"""`;
}
// 主动追问：AI 觉得关键数字含糊时，先问清楚再填
function cleanQuestions(list) {
  return (Array.isArray(list) ? list : []).filter(x => x && typeof x.q === 'string' && x.q.trim()).slice(0, 4)
    .map(x => ({ q: x.q.slice(0, 120), options: (Array.isArray(x.options) ? x.options : []).filter(o => typeof o === 'string').slice(0, 4).map(o => o.slice(0, 40)) }));
}
function questionsHTML(qs) {
  if (!qs.length) return '';
  return `<div class="aiq"><p><b>AI 想先确认：</b></p>${qs.map((x, i) => `<div class="qrow" data-i="${i}"><span class="qq">${esc(x.q)}</span><span class="opts">${x.options.map(o => `<button type="button" class="chip" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}<input type="text" placeholder="或者自己写" aria-label="回答：${esc(x.q)}"></span></div>`).join('')}<button type="button" class="btn primary" id="ai-refill">补充后重新填</button></div>`;
}
async function runFill() {
  const text = $('#ai-text').value.trim();
  if (!text) return;
  if (!SAMPLE) { $('#ai-status').textContent = '先设置 AI 服务。'; $('#ai-setup').hidden = false; renderAIProvider(); return; }
  aiCtl = new AbortController();
  $('#ai-go').disabled = true; $('#ai-stop').hidden = false; $('#ai-status').textContent = '正在读你的描述……'; $('#ai-diff').innerHTML = '';
  try {
    const out = await SAMPLE.json(fillPrompt(text), { signal: aiCtl.signal, cache: false });
    const q = clone(P);
    const { done, bad, same } = applyPatch(q, out && out.changes);
    const list0 = arr => (Array.isArray(arr) ? arr : []).filter(x => typeof x === 'string').slice(0, 8).map(x => `<li>${esc(x)}</li>`).join('');
    const qs = cleanQuestions(out && out.questions);
    if (!done.length && !bad.length) {
      $('#ai-status').textContent = qs.length ? 'AI 有几处需要先问清楚，回答后再填。' : same.length ? `你说的 ${same.map(k => FILL[k].label).join('、')} 和现在填的一样，不用改。` : '没从描述里找到能填的参数，可以说得具体些（城市、年龄、月薪、房子、孩子、养老金……）。';
      $('#ai-diff').innerHTML = (list0(out && out.unclear) ? `<div class="aidiff"><p>AI 的说明：</p><ul>${list0(out.unclear)}</ul></div>` : '') + questionsHTML(qs);
      return;
    }
    undoP = clone(P); P = sanitize(q); syncInputs(); update();
    const list = arr => (Array.isArray(arr) ? arr : []).filter(x => typeof x === 'string').slice(0, 8).map(x => `<li>${esc(x)}</li>`).join('');
    $('#ai-status').textContent = `改了 ${done.length} 项，结果已重算。`;
    $('#ai-diff').innerHTML = `<div class="aidiff"><p class="ai-tag">以下改动由 AI 根据你的描述生成，请核对</p><table><tbody>${done.map(([k, a, b]) => `<tr><td>${FILL[k].label}</td><td class="v">${esc(fillShow(k, a))}</td><td>→</td><td class="v"><b>${esc(fillShow(k, b))}</b></td></tr>`).join('')}` +
      bad.map(([k, v, why]) => `<tr class="bad"><td>${esc(FILL[k] ? FILL[k].label : k)}</td><td class="v" colspan="2">${esc(String(v))}</td><td>没采用：${esc(why)}</td></tr>`).join('') + `</tbody></table>` +
      (list(out.assumptions) ? `<p>AI 做的推断：</p><ul>${list(out.assumptions)}</ul>` : '') + (list(out.unclear) ? `<p>需要你确认：</p><ul>${list(out.unclear)}</ul>` : '') +
      `<button type="button" class="btn" id="ai-undo">撤销这次填写</button></div>` + questionsHTML(qs);
  } catch (e) {
    if (e && e.code === 'cancelled') $('#ai-status').textContent = '已停止。';
    else { $('#ai-status').textContent = errText(e); if (e && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code)) setTimeout(hideAI, 4000); }
  } finally { $('#ai-go').disabled = false; $('#ai-stop').hidden = true; }
}

// ---- 问答 ----
const brief = c => ({
  起步需要到手万: +(c.I / 1e4).toFixed(1), 每年都不缺钱需要万: c.istarOk ? +(c.Istar / 1e4).toFixed(1) : '做不到（有几年没有工资）', 起步每月到手: c.earners.map(e => Math.round(e.M)),
  今后总支出万: +(c.total / 1e4).toFixed(1), 最终自筹万: +(c.selfFund / 1e4).toFixed(1), 现有资金已够: c.enough,
  ...(c.have ? { 今年到手万: +(c.act0 / 1e4).toFixed(1), 每年都不缺钱: c.feasible } : {}),
  终点房产价值万: +((c.houseEnd || 0) / 1e4).toFixed(0), 工资以外进账万: +((c.inflowTotal || 0) / 1e4).toFixed(0),
  存款最低: { 年龄: c.sim.minAge, 万: +(c.sim.minBal / 1e4).toFixed(1) }, 终点存款万: +(c.sim.end / 1e4).toFixed(1),
});
function askContext() {
  const cats = {}; CATS.forEach(([k, n]) => { if (C.byCat[k] > 0) cats[n] = +(C.byCat[k] / 1e4).toFixed(1); });
  const ctx = {
    场景: scenarioName(), 计算方向: C.have ? '按现在收入算能过什么生活' : '按想过的生活算要赚多少',
    参数: Object.fromEntries(Object.keys(FILL).map(k => [FILL[k].label, fillShow(k, fillGet(P, k))])),
    结果: brief(C), 今后支出分项万: cats,
    人生阶段: C.stages.map(s => `${s.name} ${s.from}-${s.to}岁 年均${(s.avg / 1e4).toFixed(1)}万 最多花在${s.top[0]}`),
    三种情况: C.have ? { 顺利: outShort(C.scen.good).join(''), 一般: outShort(C.scen.base).join(''), 不顺: outShort(C.scen.bad).join(''), 不顺的定义: scenBad() } : { 顺利要到手万: +(C.scen.Igood / 1e4).toFixed(1), 一般要到手万: +(C.I / 1e4).toFixed(1), 不顺要到手万: +(C.scen.Ibad / 1e4).toFixed(1), 不顺的定义: scenBad() },
    主要假设: [`金额按今天的钱`, `存款利率${P.rate}%，借款利率${P.borrowRate}%`, growthText(), `国家养老金每人每月约${Y(C.pensMonthly / C.adults)}元，${C.P0}岁起领`, `收入按每月到手填写，不模拟个税社保公积金`],
  };
  return JSON.stringify(ctx);
}
const ASK_RULES = () => `你是"一生账本"的解读助手，帮用户看懂这份中国家庭一生收支测算，并回答"为什么""怎么办""如果……会怎样"。

规则：
- 只用下面"账本数据"和工具返回的数字，不要编造数据，也不要自己做复杂计算。
- 用户问"如果改某项会怎样"，${TOOLS_OK ? '一定调用 whatIf 工具让页面现算，可以一次比较几个方案；需要看某几年的明细用 getYears' : '只能根据数据定性回答，并建议用户在页面上改参数看结果'}。
- 金额单位用"万"，说清是"起步那年到手收入"还是"每月到手"。
- 中文，直接、简短：先一句结论，再最多 5 条要点。不写开场白。
- 这是规划测算，不是投资、税务或法律建议；涉及具体产品或投资不要推荐。
- 用"如果……那么……"的方式说，不评价用户该不该生孩子、买房、怎么花钱；可以说哪条假设影响最大。
${TOOLS_OK ? `- whatIf 可改的参数名：${Object.keys(FILL).join('、')}（金额单位与数据里一致：万或元/月）。` : ''}

账本数据：
${askContext()}`;
let turns = [];
function askTools() {
  return [
    { name: 'whatIf', description: '在当前设定上改几个参数，用本页的计算器重算，返回关键结果（起步需要到手、每月到手、最终自筹、存款最低点等）。可以一次传多个方案比较。',
      inputSchema: { type: 'object', properties: { scenarios: { type: 'array', description: '方案列表，每个方案是 {name: 方案名, changes: {参数名: 新值}}', items: { type: 'object', properties: { name: { type: 'string' }, changes: { type: 'object' } }, required: ['changes'] } } }, required: ['scenarios'] },
      execute: input => {
        const list = Array.isArray(input.scenarios) ? input.scenarios.slice(0, 6) : [];
        if (!list.length) throw new Error('scenarios 为空');
        return list.map(sc => { const q = clone(P); const { done, bad } = applyPatch(q, sc && sc.changes); const c = compute(q);
          return { 方案: String(sc.name || ''), 实际改动: done.map(([k, a, b]) => `${FILL[k].label}: ${fillShow(k, a)} → ${fillShow(k, b)}`), 没采用: bad.map(([k, v, w]) => `${k}=${v}：${w}`), 结果: brief(c), 当前结果: brief(C) }; });
      } },
    { name: 'getYears', description: '返回当前设定下某几年的逐年明细（年龄、当年支出、收入、年末存款，单位万），最多 15 年。',
      inputSchema: { type: 'object', properties: { from: { type: 'number' }, to: { type: 'number' } }, required: ['from', 'to'] },
      execute: input => {
        const a = Math.max(P.startAge, Math.round(Number(input.from))), b = Math.min(P.endAge, Math.round(Number(input.to)), a + 14);
        return C.years.filter(y => y.age >= a && y.age <= b).map(y => { const i = y.age - P.startAge; return { 年龄: y.age, 支出: +(y.total / 1e4).toFixed(1), 其中住房: +(y.housing / 1e4).toFixed(1), 其中孩子: +(y.child / 1e4).toFixed(1), 收入: +((C.sim.inc[i] + y.pension + y.support) / 1e4).toFixed(1), 年末存款: +(C.sim.path[i] / 1e4).toFixed(1) }; });
      } },
  ];
}
async function runAsk(qText) {
  const q = (qText || $('#ask-text').value).trim();
  if (!q) return;
  if (!SAMPLE) { const th = $('#ask-thread'); $('#ask-empty').hidden = true; th.insertAdjacentHTML('beforeend', `<div class="msg-a"><p>还没设置 AI 服务。<button type="button" class="linkbtn" id="ai-setup-open">去设置 DeepSeek</button></p></div>`); return; }
  $('#ask-text').value = ''; growBox($('#ask-text'));
  const th = $('#ask-thread');
  $('#ask-empty').hidden = true; $('#ask-clear').hidden = false;
  const qa = document.createElement('div'); qa.className = 'msg-q'; qa.textContent = q; th.appendChild(qa);
  const ans = document.createElement('div'); ans.className = 'msg-a'; ans.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; th.appendChild(ans);
  toBottom();
  const toolNote = []; askCtl = new AbortController();
  $('#ask-go').hidden = true; $('#ask-stop').hidden = false;
  turns.push({ role: 'user', content: q });
  const input = [{ role: 'user', content: ASK_RULES() }, ...turns.slice(-6)];
  const opts = { signal: askCtl.signal, cache: false, onText: ({ text }) => { const near = nearBottom(); ans.innerHTML = (toolNote.length ? `<p class="tool">${toolNote.join(' · ')}</p>` : '') + md(text); if (near) toBottom(); } };
  if (TOOLS_OK) opts.tools = askTools().map(t => ({ ...t, execute: (inp, ctx) => { toolNote.push(t.name === 'whatIf' ? '用计算器试算了方案' : '查了逐年明细'); ans.innerHTML = `<p class="tool">${toolNote.join(' · ')}……</p><span class="typing"><i></i><i></i><i></i></span>`; toBottom(); return t.execute(inp, ctx); } }));
  try {
    const { text, truncated } = await SAMPLE(input, opts);
    turns.push({ role: 'assistant', content: text });
    ans.insertAdjacentHTML('beforeend', '<p class="ai-tag">以上内容由 AI 生成 · 数字来自本页计算器 · 不构成投资建议</p>');
    if (truncated) ans.insertAdjacentHTML('beforeend', '<p class="err">回答太长被截断了，可以问得更具体些。</p>');
  } catch (e) {
    turns.pop();
    ans.innerHTML = (e && e.text ? md(e.text) : '') + (e && e.code === 'cancelled' ? '<p class="tool">已停止。</p>' : `<p class="err">${errText(e)}</p>`);
    if (e && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code)) setTimeout(hideAI, 4000);
  } finally { $('#ask-go').hidden = false; $('#ask-go').disabled = false; $('#ask-stop').hidden = true; toBottom(); }
}
const nearBottom = () => { const b = $('#ask-body'); return b.scrollHeight - b.scrollTop - b.clientHeight < 80; };
const toBottom = () => { const b = $('#ask-body'); b.scrollTop = b.scrollHeight; };
const growBox = el => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 140) + 'px'; };

// ---- 语音输入：浏览器自带的语音识别（Chrome、Edge、Safari）；不支持时不显示按钮 ----
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function bindVoice(btn, box, onStatus) {
  if (!SR) return;
  btn.hidden = false;
  let rec = null, base = '';
  const stop = () => { if (rec) rec.stop(); };
  btn.addEventListener('click', () => {
    if (rec) { stop(); return; }
    rec = new SR(); rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = true;
    base = box.value.replace(/\s*$/, '');
    rec.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; box.value = base + t; growBox(box); };
    rec.onerror = e => { onStatus(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? '没有麦克风权限。可以在浏览器地址栏允许麦克风，或者用手机输入法自带的语音输入。' : e.error === 'network' ? '语音识别连不上网络服务，可以用手机输入法自带的语音输入。' : e.error === 'no-speech' ? '没听到声音，再试一次。' : '语音识别出错了，可以直接打字。'); };
    rec.onend = () => { rec = null; btn.classList.remove('rec'); btn.setAttribute('aria-pressed', 'false'); onStatus(''); };
    try { rec.start(); btn.classList.add('rec'); btn.setAttribute('aria-pressed', 'true'); onStatus('正在听……说完再点一下麦克风。'); } catch (err) { rec = null; onStatus('语音识别没能启动，可以直接打字。'); }
  });
}
function bindAI() {
  bindVoice($('#ai-mic'), $('#ai-text'), t => { $('#ai-status').textContent = t; });
  bindVoice($('#ask-mic'), $('#ask-text'), t => { $('#ask-text').placeholder = t || '问点什么，比如：55 岁不工作要多挣多少？'; });
  $('#ask-text').addEventListener('input', e => growBox(e.target));
  $('#ask-clear').addEventListener('click', () => { if (askCtl) askCtl.abort(); turns = []; $('#ask-thread').innerHTML = ''; $('#ask-empty').hidden = false; $('#ask-clear').hidden = true; });
  $('#ai-go').addEventListener('click', runFill);
  $('#ai-stop').addEventListener('click', () => aiCtl && aiCtl.abort());
  $('#ai-diff').addEventListener('click', e => {
    const opt = e.target.closest('button[data-opt]');
    if (opt) { const row = opt.closest('.qrow'); row.querySelector('input').value = opt.dataset.opt; row.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === opt ? 'true' : 'false')); return; }
    if (e.target.id === 'ai-refill') {
      const ans = [...document.querySelectorAll('#ai-diff .qrow')].map(r => [r.querySelector('.qq').textContent, r.querySelector('input').value.trim()]).filter(x => x[1]);
      if (!ans.length) { $('#ai-status').textContent = '先回答至少一个问题。'; return; }
      if (undoP) { P = undoP; undoP = null; syncInputs(); update(); }
      $('#ai-text').value = $('#ai-text').value.trim() + '\n补充说明：' + ans.map(([q, a]) => `${q}——${a}`).join('；');
      runFill(); return;
    }
    if (e.target.id === 'ai-undo' && undoP) { P = undoP; undoP = null; syncInputs(); update(); $('#ai-diff').innerHTML = ''; $('#ai-status').textContent = '已撤销，参数恢复到填写前。'; } });
  $('#ask-go').addEventListener('click', () => runAsk());
  const openAsk = on => { $('#ask-drawer').hidden = !on; $('#ask-fab').hidden = on; document.body.classList.toggle('drawer-open', on); if (on) $('#ask-text').focus(); };
  $('#ask-fab').addEventListener('click', () => openAsk(true));
  $('#ask-close').addEventListener('click', () => openAsk(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ask-drawer').hidden) openAsk(false); });
  $('#ask-stop').addEventListener('click', () => askCtl && askCtl.abort());
  $('#ask-text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); runAsk(); } });
  const chips = ['为什么要这么多钱？', '哪一项少花最有用？', '想 55 岁不工作，要多挣多少？', '哪几年最紧，怎么缓过去？', '买房和一直租房，哪个更划算？'];
  $('#ask-chips').innerHTML = chips.map(c => `<button type="button">${c}</button>`).join('');
  $('#ask-chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) runAsk(b.textContent); });
  bindAISetup();
  if (!window.claude || typeof window.claude.use !== 'function') { useDeepSeekIfSet(); return; }
  window.claude.use('sample').then(async s => {
    if (!s) { useDeepSeekIfSet(); return; }
    SAMPLE = s; AI_KIND = 'claude';
    const lim = await s.limits().catch(() => null);
    TOOLS_OK = !!(lim && lim.tools);
    $('#ai-fill').hidden = false; $('#ask-fab').hidden = false; $('#ev-box').hidden = !DEV;
    renderAIProvider();
  }).catch(() => useDeepSeekIfSet());
}

// ---------- AI 服务：在 Claude 里用 Claude；其他地方（GitHub Pages、本地打开）用 DeepSeek，Key 由用户自己填 ----------
// 两种服务包装成同一个接口：sample(input, opts) → {text}、sample.json(prompt, opts) → 对象、sample.limits()
const AI_STORE = 'lifeLedger.ai';
const DS_MODELS = [['deepseek-flash', 'deepseek-flash（快、便宜）'], ['deepseek-v4-pro', 'deepseek-v4-pro（更强、更贵）']];
// 美元 / 百万 token，按 DeepSeek 官网 2026-09 高峰时段价格（未命中缓存）；非高峰为一半
const DS_PRICE = { 'deepseek-flash': { in: 0.3, out: 1.2 }, 'deepseek-v4-pro': { in: 1.32, out: 3.96 } };
let AI_KIND = null;
function aiCfg() { try { return JSON.parse(localStorage.getItem(AI_STORE) || '{}') || {}; } catch (e) { return {}; } }
function aiCfgSave(c) { try { if (c) localStorage.setItem(AI_STORE, JSON.stringify(c)); else localStorage.removeItem(AI_STORE); } catch (e) {} }
function dsErr(code, message) { return { code, message }; }
async function dsCall(body, signal) {
  const c = aiCfg();
  const base = (c.base || 'https://api.deepseek.com').replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(base + '/chat/completions', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key }, body: JSON.stringify(body) });
  } catch (e) {
    if (e && e.name === 'AbortError') throw dsErr('cancelled', 'aborted');
    throw dsErr('network', String(e && e.message || e));
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw dsErr(res.status === 401 ? 'bad_key' : res.status === 402 ? 'no_balance' : res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'upstream_error' : 'invalid_request', `${res.status} ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return j;
}
function dsModel(tier) { const c = aiCfg(); return tier === 'quick' ? 'deepseek-flash' : (c.model || 'deepseek-flash'); }
function dsThinking(tier) { return tier === 'quick' ? { type: 'disabled' } : { type: 'enabled', reasoning_effort: 'low' }; }
function makeDeepSeek() {
  const addUsage = (acc, j, model) => { const u = j.usage || {}; acc.in += u.prompt_tokens || 0; acc.out += u.completion_tokens || 0; acc.model = model; };
  const ds = async (input, opts = {}) => {
    const msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : input.map((m, i) => ({ role: i === 0 && m.role === 'user' && input.length > 1 ? 'system' : m.role, content: m.content }));
    const tools = (opts.tools || []).map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema || { type: 'object', properties: {} } } }));
    const usage = { in: 0, out: 0 }; const model = dsModel('quick');
    let text = '';
    for (let round = 0; round < 5; round++) {
      const body = { model, messages: msgs, thinking: { type: 'disabled' }, max_tokens: 2000, stream: false };
      if (tools.length) { body.tools = tools; body.tool_choice = round < 4 ? 'auto' : 'none'; }
      const j = await dsCall(body, opts.signal); addUsage(usage, j, model);
      const m = (j.choices && j.choices[0] && j.choices[0].message) || {};
      if (m.tool_calls && m.tool_calls.length && tools.length) {
        msgs.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
        for (const call of m.tool_calls) {
          const t = opts.tools.find(x => x.name === call.function.name);
          let out;
          try { const args = JSON.parse(call.function.arguments || '{}'); out = t ? await t.execute(args, { signal: opts.signal }) : '没有这个工具'; }
          catch (e) { out = 'Error: ' + (e && e.message || e); }
          msgs.push({ role: 'tool', tool_call_id: call.id, content: (typeof out === 'string' ? out : JSON.stringify(out)).slice(0, 8000) });
        }
        continue;
      }
      text = m.content || '';
      break;
    }
    ds.lastUsage = usage;
    if (!text.trim()) throw dsErr('empty_completion', 'empty');
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false, modelTierApplied: 'default' };
  };
  ds.json = async (prompt, opts = {}) => {
    const tier = opts.modelTier === 'quick' ? 'quick' : 'default', model = dsModel(tier);
    const j = await dsCall({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, thinking: dsThinking(tier), max_tokens: 4000, stream: false }, opts.signal);
    const usage = { in: 0, out: 0 }; addUsage(usage, j, model); ds.lastUsage = usage;
    const c = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    try { return JSON.parse(c); } catch (e) { throw { code: 'invalid_json', message: 'bad json', text: c }; }
  };
  ds.limits = async () => ({ maxPromptBytes: 200000, tools: { maxCount: 8 } });
  ds.kind = 'deepseek';
  return ds;
}
const dsCost = u => { if (!u || !u.model) return null; const p = DS_PRICE[u.model]; return p ? (u.in * p.in + u.out * p.out) / 1e6 : null; };
function aiName() { return AI_KIND === 'claude' ? 'Claude' : AI_KIND === 'deepseek' ? `DeepSeek（${aiCfg().model || 'deepseek-flash'}）` : '还没设置'; }
function renderAIProvider() {
  const c = aiCfg();
  $('#ai-provider').innerHTML = AI_KIND === 'claude' ? 'AI 服务：Claude（在 Claude 里打开时自动使用，用你自己的 Claude 额度）'
    : AI_KIND === 'deepseek' ? `AI 服务：${esc(aiName())}，Key 只存在这台设备的浏览器里 <button type="button" class="linkbtn" id="ai-setup-open">设置</button>`
    : `还没设置 AI 服务。填上你自己的 DeepSeek API Key 就能用 <button type="button" class="linkbtn" id="ai-setup-open">去设置</button>`;
  $('#ask-foot').textContent = `提问时会把本页参数和结果发给 ${AI_KIND === 'claude' ? 'Claude' : 'DeepSeek'} · 测算解读，不是投资建议`;
  $('#ev-note').textContent = AI_KIND === 'deepseek' ? '用 DeepSeek 时：默认档 = 你选的模型（开思考，低强度），快速档 = deepseek-flash（不思考）；会显示实际 token 用量和按官网高峰价估算的费用（美元）。' : '用 Claude 时：默认档和快速档是 Claude 的两个模型档位。';
  if (!$('#ai-setup').hidden) { $('#ds-key').value = c.key || ''; $('#ds-model').value = c.model || 'deepseek-flash'; $('#ds-base').value = c.base || 'https://api.deepseek.com'; }
}
function useDeepSeekIfSet() {
  if (AI_KIND === 'claude') return;
  const c = aiCfg();
  if (c.key) { SAMPLE = makeDeepSeek(); TOOLS_OK = true; AI_KIND = 'deepseek'; }
  else { SAMPLE = null; AI_KIND = null; }
  $('#ai-fill').hidden = false; $('#ask-fab').hidden = false; $('#ev-box').hidden = !SAMPLE || !DEV;
  renderAIProvider();
}
function bindAISetup() {
  $('#ds-model').innerHTML = DS_MODELS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  document.addEventListener('click', e => {
    if (e.target.id === 'ai-setup-open') { $('#ai-fill').open = true; $('#ai-setup').hidden = false; renderAIProvider(); $('#ds-key').focus(); if (!$('#ask-drawer').hidden) $('#ask-close').click(); $('#ai-fill').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('#ds-save').addEventListener('click', async () => {
    const key = $('#ds-key').value.trim(); if (!key) { $('#ds-msg').textContent = '先填 API Key。'; return; }
    aiCfgSave({ key, model: $('#ds-model').value, base: $('#ds-base').value.trim() || 'https://api.deepseek.com' });
    useDeepSeekIfSet(); $('#ds-msg').textContent = '已保存，正在测试连接……';
    try { await SAMPLE.json('只输出 JSON：{"ok": true}', { modelTier: 'quick' }); $('#ds-msg').textContent = '连接成功，可以用了。'; }
    catch (e) { $('#ds-msg').textContent = errText(e); }
  });
  $('#ds-clear').addEventListener('click', () => { aiCfgSave(null); $('#ds-key').value = ''; useDeepSeekIfSet(); $('#ds-msg').textContent = '已清除，这台设备上不再保存 Key。'; });
  $('#ds-close').addEventListener('click', () => { $('#ai-setup').hidden = true; });
}

// ---------- 启动 ----------
buildPanel();
buildCityCard();
bindHero();
bindMoves();
bindEvents();
bindOther();
bindAssume();
bindAI();
syncInputs();
update();
})();
