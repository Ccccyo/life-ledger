// ===== 一生账本 · 计算模型 v2（金额单位：元；全部按今天的钱） =====

// 上海口径的生活类基准值（切换城市时按当地城镇居民人均消费支出等比例缩放）
const SH_BASE = {
  food: { s: 2200, c: 3800 }, transport: { s: 500, c: 1000 }, comm: { s: 200, c: 350 },
  clothing: { s: 500, c: 900 }, daily: { s: 1100, c: 1950 },
  travel: { s: 12000, c: 20000 }, gifts: { s: 8000, c: 15000 }, shopping: { s: 10000, c: 15000 },
  childBase: 3000, infantCare: 2000,
};

const DEFAULTS = {
  city: 'sh',
  startAge: 27, retireAge: 60, endAge: 100,
  pensionAge: 63, selfPay: true, selfPayRate: 30,
  // 模式：need = 按生活算要赚多少；have = 按收入算能过什么生活
  mode: 'have',
  savings: 0,   // 现在已有的存款（元），从今年起按利率计息
  me: { salary: 16000, months: 12, growth: 3, until: 45, downAt: 50, down: 0 },
  sp: { salary: 12000, months: 12, growth: 3, until: 45, downAt: 50, down: 0, age: 27, retire: 60, pensionAge: 63, paid: 0, deemed: 0 },
  spSync: true,   // 配偶年龄、退休、领养老金默认跟我一样
  rate: 1.8, inflation: 0, borrowRate: 4.0,
  family: 'kid', kids: 1, kidGap: 3, birthAge: 31, laterKidPct: 80,
  marriageAge: 29, wedding: 0,
  // 日常生活（元/月）
  food: { s: 2200, c: 3800 }, transport: { s: 500, c: 1000 }, comm: { s: 200, c: 350 },
  clothing: { s: 500, c: 900 }, daily: { s: 1100, c: 1950 },
  // 快乐与人情（元/年）
  travel: { s: 12000, c: 20000 }, gifts: { s: 8000, c: 15000 }, shopping: { s: 10000, c: 15000 },
  // 自己医疗（元/年）
  medSelf: { s: 2000, c: 4000 }, insurance: { s: 3000, c: 6000 },
  // 住房
  housing: 'buy', buyAge: 30,   // buy 买房 | rent 一直租房 | own 已有房
  ownMortgage: 0, ownLoanYears: 0,   // 已有房时：现在每月还的房贷、还剩几年
  area: { s: 60, c: 90 }, rentArea: { s: 45, c: 70 },
  unitPrice: 51482, rentPerM2: 84.39, locFactor: 100,
  taxFeePct: 2.5, renoPerM2: 1500, furnish: { s: 30000, c: 50000 }, upkeepPerM2: 60,
  minDown: 20, commRate: 3.05, loanYears: 30, maxLoanAge: 70,   // commRate：房贷利率（按商贷；用公积金贷款可调低）
  support: { s: 0, c: 0 }, supportAt: 0,   // 家庭支持几岁到位；0 = 买房那年（不买房则今年）
  // 赡养、宠物、车
  parents: 500000,
  petYear: 0, petYears: 15,
  carPrice: 0, carRunning: 15000, carCycle: 10, carAge: 30, carUntil: 75,
  // 孩子
  birthCost: 15000, childBase: 3000, infantCare: 2000, infantSubsidy: 3600,
  tutor: 'normal', tutorCosts: { light: 500, normal: 1000, heavy: 3000 },
  route: 'cn', stages: { kg: 'pub', pri: 'pub', mid: 'pub', high: 'pub', uni: 'cnPub', grad: 'none' },
  eduFactor: 1.0, priYears: 5, eduCost: {},
  examPrep: 25000, applyFee: 30000,
  kidAfterYears: 3, kidAfterYear: 30000, kidHelp: 0, kidHelpAge: 28,   // 孩子毕业后还要贴补几年、每年多少；结婚买房一次性资助
  // 意外与波动
  // 三种情况：顺利 = 收入高 goodUp%；不顺 = 收入低 badCut%，badJobAge 岁那年你失业一整年，badShockAge 岁那年一笔 badShockAmt 意外支出
  goodUp: 20, badCut: 20, badJobAge: 40, badShockAge: 50, badShockAmt: 200000,
  // 养老
  retireSpend: 6200, coupleFactor: 2, pension: 5200, lateAge: 80, lateExtra: 0,
  paidYears: 0, deemedYears: 0,        // 今年之前已经交了几年社保；视同缴费年限（1992 年底前参加工作的才有）
  acctRate: 1.5, transRate: 1.2,       // 个人账户记账利率扣掉通胀后(%)；过渡性养老金计发比例(%，各省 1.0–1.4)
  // 收入与个税
  tiers: [20, 30, 40],
  baseLow: 7546, baseHigh: 37731, avgWage: 12577,   // 社保缴费基数上下限、社平工资（估算养老金用）
  grossRatio: 80,   // 到手约占税前的比例(%)：只用来从到手反推社保缴费基数、估算养老金
  split: 50,
  // 中途换城市：[{age, city, sell: 卖掉原来的房, home: 'rent'|'buy'|'own', area}]，最多 3 次
  moves: [], moveWage: true, sellFeePct: 2,
  // 人生大事：[{age, type, amount, years, who}]；type: gap 停工/进修 | salary 工资变化% | income 一次性进账(万) | expense 一次性支出(万) | study 在职读书(万/年) | side 副业(元/月,税后)
  events: [],
  houseGrowth: 0, leaseVacancy: 10,        // 房价每年实际涨跌(%)；出租空置率(%)
  stockPct: 0, stockReturn: 5,   // 存款里放股票基金的比例(%)、长期实际年化(%)
  // 父母：lump 按总额平摊 | timeline 按父母年龄和照护期
  parentsMode: 'timeline', parAge: 55, parSets: 2, parShare: 100, parMonthly: 0, careAge: 80, careMonthly: 3000, parEnd: 88,
};

const CATS = [
  ['living', '日常生活'], ['housing', '住房与贷款'], ['child', '孩子'], ['parents', '赡养父母'],
  ['fun', '快乐与人情'], ['medical', '自己医疗'], ['car', '买车养车'], ['wedding', '结婚'],
  ['pet', '宠物'], ['events', '人生大事'], ['social', '自缴社保'], ['retire', '养老'],
];

const cityById = id => CITIES.find(c => c.id === id) || CITIES[CITIES.length - 1];
const round = (v, step) => Math.round(v / step) * step;

function pmtMonthly(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  const i = annualRate / 100 / 12, n = years * 12;
  if (i === 0) return principal / n;
  return principal * i / (1 - Math.pow(1 + i, -n));
}

// ---------- 收入：直接用到手 ----------
// M = 每月到手（已扣个税、社保、公积金），months = 一年到手几个月（含年终奖）。不再模拟个税和公积金。
function netOf(p, M, months = 12) {
  const takeHome = Math.max(0, M) * months;
  return { M, months, takeHome, usable: takeHome };
}
const grossFor = (p, t, months = 12) => netOf(p, Math.max(0, t) / months, months);   // 反过来：一年要到手 t，每月到手多少
// 从到手反推社保缴费基数（估）：到手 ÷ grossRatio，夹在上下限之间
const baseFromTakeHome = (p, M) => Math.min(Math.max(M / ((p.grossRatio || 80) / 100), p.baseLow), p.baseHigh);

// 工资增长系数：startAge 时为 1，每年实际涨 growth%，涨到 until 岁后持平
function growthFactor(person, startAge, age) {
  const yrs = Math.max(0, Math.min(age, person.until) - startAge);
  const down = person.down > 0 ? Math.pow(1 - person.down / 100, Math.max(0, age - Math.max(person.downAt, startAge))) : 1;
  return Math.pow(1 + person.growth / 100, yrs) * down;
}

// 国家养老金粗估（今天的钱）：基础养老金 + 个人账户
// 计发月数（按开始领取年龄）
const PAY_MONTHS = { 50: 195, 51: 190, 52: 185, 53: 180, 54: 175, 55: 170, 56: 164, 57: 158, 58: 152, 59: 145, 60: 139, 61: 132, 62: 125, 63: 117, 64: 109, 65: 101 };
const pensionStart = p => Math.max(p.pensionAge, p.retireAge + 1);                 // 第一年领养老金的年龄
const gapYears = p => Math.max(0, pensionStart(p) - p.retireAge - 1);             // 不工作也没有养老金的年数
const contribYears = p => (p.retireAge - p.startAge + 1) + (p.selfPay ? gapYears(p) : 0) + (p.paidYears || 0);
// 养老金（今天的钱）：基础 = 计发基数 × (1 + 指数) ÷ 2 × (实际缴费 + 视同缴费)年 × 1%
// 个人账户 = 每年 基数 × 8% × 12，按记账利率（扣掉通胀）滚存到退休，÷ 计发月数
// 过渡性 = 计发基数 × 指数 × 视同缴费年限 × transRate%
// M = 缴费基数（月）；按到手估算时先用 baseFromTakeHome 换算
function pensionEstimate(p, M, years, payAge, deemed) {
  deemed = deemed || 0;
  const base = Math.min(Math.max(M, p.baseLow), p.baseHigh);
  const idx = base / p.avgWage;
  const basic = p.avgWage * (1 + idx) / 2 * (years + deemed) / 100;
  const months = PAY_MONTHS[Math.max(50, Math.min(65, payAge || pensionStart(p)))];
  const r = (p.acctRate == null ? 0 : p.acctRate) / 100;
  const acctYears = r ? (Math.pow(1 + r, years) - 1) / r : years;   // 每年交 1 份，滚到退休相当于几份
  const personal = base * 0.08 * 12 * acctYears / months;
  const trans = p.avgWage * idx * deemed * (p.transRate == null ? 1.2 : p.transRate) / 100;
  return { idx, basic, personal, trans, total: basic + personal + trans, months, acctYears, base, years, deemed };
}

// ---------- 城市预设 ----------
function applyCity(p, id) {
  const c = cityById(id);
  const k = c.cons / SH_CONS;
  p.city = c.id;
  p.unitPrice = c.price; p.rentPerM2 = c.rent; p.locFactor = 100;
  ['food', 'transport', 'comm', 'clothing', 'daily'].forEach(f => { p[f] = { s: round(SH_BASE[f].s * k, 50), c: round(SH_BASE[f].c * k, 50) }; });
  ['travel', 'gifts', 'shopping'].forEach(f => { p[f] = { s: round(SH_BASE[f].s * k, 500), c: round(SH_BASE[f].c * k, 500) }; });
  p.childBase = round(SH_BASE.childBase * k, 50);
  p.infantCare = round(SH_BASE.infantCare * k, 50);
  p.tutorCosts = { light: round(500 * k, 50), normal: round(1000 * k, 50), heavy: round(3000 * k, 50) };
  p.eduFactor = c.edu; p.priYears = c.pri; p.eduCost = {};
  p.baseLow = c.low; p.baseHigh = c.high; p.avgWage = c.wage;
  p.retireSpend = round(c.cons / 12 * 1.3, 100);
  p.pension = round(pensionEstimate(p, p.baseLow, contribYears(p), 0, p.deemedYears).total, 100);
  return p;
}

// ---------- 教育 ----------
function eduOpt(stage, id) { return EDU[stage].options.find(o => o.id === id) || EDU[stage].options[0]; }
function eduCost(p, stage, id) {
  const key = stage + '.' + id;
  if (p.eduCost && typeof p.eduCost[key] === 'number') return p.eduCost[key];
  const o = eduOpt(stage, id);
  return Math.round(o.cost * (o.scale === 'edu' ? p.eduFactor : 1));
}
function uniYears(st) { return eduOpt('uni', st.uni).years; }
function gradYears(st) { return st.uni === 'none' ? 0 : eduOpt('grad', st.grad).years; }
function eduEndAge(st) { return 17 + uniYears(st) + gradYears(st); } // 孩子最后一年受教育的年龄

// 孩子在 c 岁这一年的分项支出；k = 第几个孩子（0 起）；st = 路线
function childItems(p, c, k, st) {
  const it = { birth: 0, base: 0, infant: 0, tutor: 0, kg: 0, pri: 0, mid: 0, high: 0, uni: 0, grad: 0, prep: 0, after: 0, help: 0 };
  if (c < 0) return it;
  st = st || p.stages;
  const f = k > 0 ? p.laterKidPct / 100 : 1;
  const priEnd = 5 + p.priYears;
  if (c === 0) it.birth = p.birthCost;
  if (c <= 17) it.base = p.childBase * 12 * f;
  if (c <= 2) it.infant = Math.max(0, p.infantCare * 12 * f - p.infantSubsidy);
  if (c >= 3 && c <= 17) it.tutor = (p.tutorCosts[p.tutor] || 0) * 12;
  if (c >= 3 && c <= 5) it.kg = eduCost(p, 'kg', st.kg);
  if (c >= 6 && c <= priEnd) it.pri = eduCost(p, 'pri', st.pri);
  if (c > priEnd && c <= 14) it.mid = eduCost(p, 'mid', st.mid);
  if (c >= 15 && c <= 17) it.high = eduCost(p, 'high', st.high);
  const uy = uniYears(st), gy = gradYears(st);
  if (c >= 18 && c < 18 + uy) it.uni = eduCost(p, 'uni', st.uni);
  if (gy > 0 && c >= 18 + uy && c < 18 + uy + gy) it.grad = eduCost(p, 'grad', st.grad);
  if (eduOpt('uni', st.uni).abroad && c === 17) it.prep += p.examPrep + p.applyFee;
  if (gy > 0 && eduOpt('grad', st.grad).abroad && c === 17 + uy) it.prep += p.examPrep + p.applyFee;
  const end = 17 + uy + gy;   // 最后一年上学的年龄
  if (c > end && c <= end + p.kidAfterYears) it.after = p.kidAfterYear * f;
  if (p.kidHelp > 0 && c === p.kidHelpAge) it.help = p.kidHelp;
  return it;
}
const sumObj = o => Object.values(o).reduce((a, b) => a + b, 0);

// 一个孩子（第一个）走某条路线的分阶段总花费
function routeBreakdown(p, st, tutor) {
  if (tutor) p = { ...p, tutor };
  const out = { birth: 0, base: 0, infant: 0, tutor: 0, kg: 0, pri: 0, mid: 0, high: 0, uni: 0, grad: 0, prep: 0, after: 0, help: 0 };
  for (let c = 0; c <= 60; c++) { const it = childItems(p, c, 0, st); for (const k in out) out[k] += it[k]; }
  out.total = sumObj(out);
  out.school = out.kg + out.pri + out.mid + out.high + out.uni + out.grad + out.prep;
  out.endAge = eduEndAge(st);
  return out;
}

// ---------- 主计算 ----------
function compute(p, opts = {}) {
  if (p.buyAge < p.startAge) p = { ...p, buyAge: p.startAge };   // 买房年龄早于今年时按今年买
  const K = p.family === 'single' ? 's' : 'c';
  const adults = p.family === 'single' ? 1 : 2;
  const married = p.family !== 'single';
  const nKids = p.family === 'kid' ? Math.max(1, Math.min(3, Math.round(p.kids))) : 0;
  const infl = 1 + p.inflation / 100;
  const r = (1 + p.rate / 100) / infl - 1;
  const rb = (1 + (p.borrowRate ?? p.rate) / 100) / infl - 1;   // 存款为负时借钱的实际利率
  // 婚前按单身口径：日常、快乐、医疗、租房面积都按一个人，配偶收入从结婚那年起计入
  const mAge = married ? Math.max(p.marriageAge, p.startAge) : Infinity;
  const couple = a => a >= mAge;
  const kOf = a => couple(a) ? 'c' : 's';
  // 配偶时间线（用"我的年龄"做横轴，配偶年龄 = 我的年龄 + d）
  const d = married ? (p.sp.age - p.startAge) : 0;
  const spAge = a => a + d;
  const meWork = a => a <= p.retireAge;
  const spWork = a => couple(a) && spAge(a) <= p.sp.retire;
  const P0me = pensionStart(p);
  const P0sp = Math.max(p.sp.pensionAge, p.sp.retire + 1);          // 配偶第一年领养老金时配偶的年龄
  const lastWork = married ? Math.max(p.retireAge, Math.min(p.endAge, p.sp.retire - d)) : p.retireAge;   // 家里最后一个人停止工作时我的年龄
  const N = lastWork - p.startAge + 1;
  const R = p.endAge - lastWork;
  const F = Math.abs(r) < 1e-12 ? N : (Math.pow(1 + r, N) - 1) / r;
  const kidBirths = Array.from({ length: nKids }, (_, i) => p.birthAge + i * p.kidGap);
  const have = p.mode === 'have';
  const share = adults === 1 ? 1 : p.split / 100;
  // 城市时间线：搬家后房价、租金、生活开销、学费、社保基数、工资都按新城市
  const moves = (Array.isArray(p.moves) ? p.moves : []).filter(m => m && m.age > p.startAge && m.age <= p.endAge && CITIES.some(c => c.id === m.city))
    .map(m => ({ ...m, age: Math.round(m.age) })).sort((x, y) => x.age - y.age).slice(0, 3);
  const baseCity = cityById(p.city);
  const cityAt = a => { let c = p.city; for (const m of moves) if (a >= m.age) c = m.city; return c; };
  const PC = {};
  const pAt = a => {
    const id = cityAt(a); if (id === p.city) return p;
    if (PC[id]) return PC[id];
    const c = cityById(id), kc = c.cons / baseCity.cons;
    return (PC[id] = { ...p, city: id, unitPrice: c.price, rentPerM2: c.rent, baseLow: c.low, baseHigh: c.high, avgWage: c.wage,
      eduFactor: c.edu, priYears: c.pri, eduCost: {}, locFactor: 100,
      childBase: p.childBase * kc, infantCare: p.infantCare * kc,
      tutorCosts: { light: p.tutorCosts.light * kc, normal: p.tutorCosts.normal * kc, heavy: p.tutorCosts.heavy * kc },
      kc, wr: p.moveWage === false ? 1 : c.wage / baseCity.wage });
  };
  const kcAt = a => pAt(a).kc || 1, wrAt = a => pAt(a).wr || 1;
  // 人生大事
  const EV_TYPES = ['gap', 'salary', 'income', 'expense', 'study', 'side'];
  const events = (Array.isArray(p.events) ? p.events : []).filter(e => e && EV_TYPES.includes(e.type) && e.age >= p.startAge && e.age <= p.endAge)
    .map(e => ({ ...e, age: Math.round(e.age), years: Math.max(1, Math.round(e.years || 1)), amount: +e.amount || 0, who: e.who === 'sp' ? 'sp' : 'me' })).sort((x, y) => x.age - y.age).slice(0, 10);
  const incF = (who, a) => { let f = 1; for (const e of events) if (e.who === who) {
    if (e.type === 'gap' && a >= e.age && a < e.age + e.years) f = 0;
    if (e.type === 'salary' && a >= e.age && f > 0) f *= Math.max(0, 1 + e.amount / 100); } return f; };
  const gMe = a => growthFactor(p.me, p.startAge, a) * wrAt(a) * incF('me', a), gSp = a => growthFactor(p.sp, p.sp.age, spAge(a)) * wrAt(a) * incF('sp', a);
  const gHH = a => (meWork(a) ? share * gMe(a) : 0) + (adults === 2 && spWork(a) ? (1 - share) * gSp(a) : 0);
  let G1 = 0, Fg = 0;
  for (let a = p.startAge; a <= lastWork; a++) { G1 += gHH(a); Fg += gHH(a) * Math.pow(1 + r, lastWork - a); }
  // 国家养老金（每人每月）：正推模式且自动时，按各自一生平均工资估算
  // 缴费指数按今年的到手估算，不随工资增长上调：全页按今天的钱，社平工资也会随经济同步上涨，个人涨幅里大部分被抵掉（偏保守）
  const avgMe = p.me.salary * p.me.months / 12;
  const avgSp = p.sp.salary * p.sp.months / 12;
  const spGap = Math.max(0, P0sp - p.sp.retire - 1);
  const spContrib = (p.sp.retire - p.sp.age + 1) + (p.selfPay ? spGap : 0) + (p.sp.paid || 0);
  let pensMe = p.pension, pensSp = p.pension;
  if (have && p.pensionAuto) {
    pensMe = Math.round(pensionEstimate(p, baseFromTakeHome(p, avgMe), contribYears(p), P0me, p.deemedYears).total / 100) * 100;
    pensSp = Math.round(pensionEstimate(p, baseFromTakeHome(p, avgSp), spContrib, P0sp, p.sp.deemed).total / 100) * 100;
  }
  const pensMonthly = adults === 1 ? pensMe : pensMe + pensSp;

  // 住房
  const loc = p.locFactor / 100;
  const area = p.area[K];
  const rentArea = p.rentArea[K];
  const price = area * p.unitPrice * loc;
  const fees = price * p.taxFeePct / 100 + area * p.renoPerM2 + p.furnish[K];
  const rentOf = a => p.rentArea[kOf(a)] * p.rentPerM2 * loc;   // 每月房租（婚前按单身面积）
  const rentMonthly = rentArea * p.rentPerM2 * loc;
  const upkeep = area * p.upkeepPerM2;
  const support = p.support[K];
  const firstMove = moves.length ? moves[0].age : Infinity;
  const buy = p.housing === 'buy' && price > 0 && p.buyAge < firstMove;   // 搬家前才在原城市买
  // 买一套房：贷款年限受年龄限制（多数银行和公积金要求贷款到期时借款人不超过约 70 岁）
  const hg = (p.houseGrowth || 0) / 100;
  const valAt = (h, a) => h.value * Math.pow(1 + hg, a - h.start);
  function buyHouse(a, q, ar, avail, lc) {
    const pr = ar * q.unitPrice * lc * Math.pow(1 + hg, a - p.startAge), fe = pr * p.taxFeePct / 100 + ar * p.renoPerM2 + p.furnish[K];
    const ly = Math.max(0, Math.min(p.loanYears, (p.maxLoanAge || 70) - a));
    const mdA = pr * p.minDown / 100;
    const dn = ly > 0 ? Math.min(pr, Math.max(mdA, avail - fe)) : pr;
    const ln = pr - dn, mC = pmtMonthly(ln, p.commRate, ly);
    return { city: q.city, area: ar, value: pr, fees: fe, down: dn, loan: ln, cBal: ln, mC, start: a, ly, minDownAmt: mdA, interest: mC * 12 * ly - ln };
  }
  const h0 = buy ? buyHouse(p.buyAge, p, area, support, loc) : null;
  const loanYrs = h0 ? h0.ly : 0;
  const loanCapped = buy && loanYrs < p.loanYears;
  const down = h0 ? h0.down : 0, loan = h0 ? h0.loan : 0;
  const mPay = h0 ? h0.mC : 0, interest = h0 ? h0.interest : 0, minDownAmt = h0 ? h0.minDownAmt : 0;
  const supportAge = p.supportAt > 0 ? Math.max(p.startAge, Math.min(p.supportAt, p.endAge)) : buy ? Math.max(p.startAge, Math.min(p.buyAge, p.retireAge)) : p.startAge;
  const livOf = k => ['food', 'transport', 'comm', 'clothing', 'daily'].reduce((s, f) => s + p[f][k], 0);
  const funOf = k => ['travel', 'gifts', 'shopping'].reduce((s, f) => s + p[f][k], 0);
  const medOf = k => p.medSelf[k] + p.insurance[k];
  const livingM = livOf(K), funY = funOf(K), medY = medOf(K);
  const eduEnd = eduEndAge(p.stages);

  const years = [];
  const houses = [], moveLog = [];
  if (p.housing === 'own') houses.push({ city: p.city, area, value: price, fixed: p.ownMortgage * 12, fixedEnd: p.startAge + p.ownLoanYears, cBal: 0, start: p.startAge });
  let renting = p.housing !== 'own', ownFree = null, rentLoc = loc;
  const fixedBal = (h, a) => { const n = (h.fixedEnd - a) * 12, i = p.commRate / 1200; return h.fixed > 0 && n > 0 ? h.fixed / 12 * (i ? (1 - Math.pow(1 + i, -n)) / i : n) : 0; };
  for (let a = p.startAge; a <= p.endAge; a++) {
    const working = a <= lastWork;
    const k = kOf(a);
    const e = { age: a, working, meWork: meWork(a), spWork: spWork(a), couple: couple(a) };
    CATS.forEach(([c]) => { e[c] = 0; });
    const hs = { rent: 0, down: 0, fees: 0, mortgage: 0, upkeep: 0, interest: 0, principal: 0, loanLeft: 0 };
    const ci = { birth: 0, base: 0, infant: 0, tutor: 0, kg: 0, pri: 0, mid: 0, high: 0, uni: 0, grad: 0, prep: 0, after: 0, help: 0 };
    const q = pAt(a), kc = kcAt(a);
    e.city = cityAt(a);
    if (working) {
      e.living = livOf(k) * 12 * kc;
      if (p.parentsMode !== 'timeline') e.parents = p.parents / N;
      e.fun = funOf(k) * kc;
      e.medical = medOf(k);
    } else {
      e.retire = p.retireSpend * 12 * (couple(a) ? p.coupleFactor : 1) * kc;
      if (a >= p.lateAge && p.lateExtra > 0) { e.late = p.lateExtra * 12 * (couple(a) ? 2 : 1); e.retire += e.late; }
    }
    if (p.parentsMode === 'timeline') {
      const pa = p.parAge + (a - p.startAge);
      if (pa <= p.parEnd) e.parents = (couple(a) ? p.parSets : 1) * p.parShare / 100 * 12 * (pa >= p.careAge ? p.careMonthly : p.parMonthly);
    }
    // 人生大事
    e.windfall = 0; e.side = 0; e.lease = 0;
    for (const ev of events) {
      if (ev.type === 'income' && a === ev.age) e.windfall += ev.amount * 1e4;
      if (ev.type === 'expense' && a === ev.age) e.events += ev.amount * 1e4;
      if (ev.type === 'study' && a >= ev.age && a < ev.age + ev.years) e.events += ev.amount * 1e4;
      if (ev.type === 'side' && a >= ev.age && a < ev.age + ev.years) e.side += ev.amount * 12;
    }
    e.sale = 0;
    const mv = moves.find(m => m.age === a);
    if (mv) {
      const log = { age: a, city: mv.city, home: mv.home || 'rent', sold: 0, soldN: 0, kept: houses.length };
      const how = mv.sell === 'lease' ? 'lease' : mv.sell === false ? 'keep' : 'sell';
      log.how = how;
      if (how === 'sell') {
        for (const h of houses.splice(0)) { const net = valAt(h, a) * (1 - p.sellFeePct / 100) - h.cBal - fixedBal(h, a); e.sale += net; log.sold += net; log.soldN++; }
        log.kept = 0;
      } else if (how === 'lease') houses.forEach(h => { if (!h.leased) { h.leased = true; h.leaseM = h.area * pAt(a - 1).rentPerM2 * (h.city === p.city ? loc : 1); } });
      renting = false; ownFree = null;
      if (mv.home === 'buy') {
        const h = buyHouse(a, q, mv.area > 0 ? mv.area : area, Math.max(0, e.sale), 1);
        houses.push(h); hs.down += h.down; hs.fees += h.fees; Object.assign(log, { price: h.value, down: h.down, loan: h.loan, ly: h.ly, area: h.area, pay: h.mC });
      } else if (mv.home === 'own') { ownFree = { area: mv.area > 0 ? mv.area : area }; log.area = ownFree.area; }
      else { renting = true; rentLoc = 1; }
      moveLog.push(log);
    }
    if (buy && a === p.buyAge) { houses.push(h0); hs.down += h0.down; hs.fees += h0.fees; renting = false; }
    for (const h of houses) {
      if (h.fixed) { if (a < h.fixedEnd) hs.mortgage += h.fixed; }
      else if (h.cBal > 0.5 && a < h.start + h.ly) {
        hs.mortgage += h.mC * 12;
        // 按月摊还，拆出当年利息和本金
        for (let mo = 0; mo < 12; mo++) {
          const iC = h.cBal * p.commRate / 1200;
          hs.interest += iC;
          h.cBal = Math.max(0, h.cBal - (h.mC - iC));
        }
      }
      hs.upkeep += h.area * p.upkeepPerM2;
      if (h.leased) e.lease += h.leaseM * 12 * (1 - p.leaseVacancy / 100);
      hs.loanLeft += h.cBal + (h.fixed ? fixedBal(h, a + 1) : 0);
    }
    hs.principal = hs.mortgage - hs.interest;
    e.houseValue = houses.reduce((s2, h) => s2 + valAt(h, a), 0);
    if (ownFree) hs.upkeep += ownFree.area * p.upkeepPerM2;
    if (renting) hs.rent = p.rentArea[k] * q.rentPerM2 * (cityAt(a) === p.city ? rentLoc : 1) * 12;
    e.hs = hs;
    e.housing = hs.rent + hs.down + hs.fees + hs.mortgage + hs.upkeep;
    kidBirths.forEach((b, i) => { const it = childItems(q, a - b, i); for (const x in ci) ci[x] += it[x]; });
    e.ci = ci;
    e.child = sumObj(ci);
    if (married && a === p.marriageAge && p.marriageAge >= p.startAge) e.wedding = p.wedding;
    if (p.carPrice > 0 && a >= p.carAge && a <= p.carUntil) {
      e.car += p.carRunning;
      if ((a - p.carAge) % Math.max(1, p.carCycle) === 0 && a + 2 <= p.carUntil) e.car += p.carPrice;
    }
    if (p.petYear > 0 && a < p.startAge + p.petYears) e.pet = p.petYear;
    e.total = CATS.reduce((s, [c]) => s + e[c], 0);
    const soc = q.baseLow * p.selfPayRate / 100 * 12;
    if (p.selfPay && a > p.retireAge && a < P0me) e.social += soc;
    if (p.selfPay && adults === 2 && couple(a) && spAge(a) > p.sp.retire && spAge(a) < P0sp) e.social += soc;
    e.total += e.social;
    e.pensMe = a >= P0me ? pensMe * 12 : 0;
    e.pensSp = adults === 2 && couple(a) && spAge(a) >= P0sp ? pensSp * 12 : 0;
    e.pension = e.pensMe + e.pensSp;
    e.g = working ? gHH(a) : 0;
    e.pensionUsed = Math.min(e.pension, e.total);
    e.support = a === supportAge ? support : 0;
    e.inflow = e.sale + e.windfall + e.side + e.lease;   // 卖房、一次性进账、副业、出租，都是工资以外的进账
    // 按到手收入：你和配偶各自当年到手；gMeShare = 你那份占"需要的收入"的系数（不顺情况里算失业用）
    e.gMe = working && meWork(a) ? share * gMe(a) : 0;
    if (have && working) {
      e.actMe = meWork(a) ? netOf(q, p.me.salary * gMe(a), p.me.months).takeHome : 0;
      e.actSp = adults === 2 && spWork(a) ? netOf(q, p.sp.salary * gSp(a), p.sp.months).takeHome : 0;
    } else { e.actMe = 0; e.actSp = 0; }
    e.actCash = e.actMe + e.actSp;
    e.act = e.actCash;
    years.push(e);
  }

  const sum = f => years.reduce((s, y) => s + f(y), 0);
  const byCat = {}, byCatWork = {}, byCatRet = {};
  CATS.forEach(([k]) => { byCat[k] = sum(y => y[k]); byCatWork[k] = sum(y => y.working ? y[k] : 0); byCatRet[k] = sum(y => y.working ? 0 : y[k]); });
  const housingParts = { rent: 0, down: 0, fees: 0, mortgage: 0, upkeep: 0 };
  const childParts = { birth: 0, base: 0, infant: 0, tutor: 0, kg: 0, pri: 0, mid: 0, high: 0, uni: 0, grad: 0, prep: 0, after: 0, help: 0 };
  years.forEach(y => { for (const k in housingParts) housingParts[k] += y.hs[k]; for (const k in childParts) childParts[k] += y.ci[k]; });
  const lateTotal = sum(y => y.late || 0);

  const workTotal = sum(y => y.working ? y.total : 0);
  const retTotal = sum(y => y.working ? 0 : y.total);
  const total = workTotal + retTotal;
  const pensionTotal = sum(y => y.pension);
  const pensionUsed = sum(y => y.pensionUsed);
  const savings = Math.max(0, p.savings || 0);
  const saleTotal = sum(y => y.sale), inflowTotal = sum(y => y.inflow), inflowWork = sum(y => y.working ? y.inflow : 0);
  const inflowParts = { sale: saleTotal, windfall: sum(y => y.windfall), side: sum(y => y.side), lease: sum(y => y.lease) };
  const selfFund = total - support - pensionUsed - savings - inflowTotal;

  const W = workTotal - support - savings - inflowWork - sum(y => y.working ? y.pensionUsed : 0);
  const G = sum(y => y.working ? 0 : Math.max(0, y.total - y.pension) - y.inflow);
  // 折算到起始年龄（按利率 r 贴现），让早花的钱和晚花的钱、早挣的钱和晚挣的钱可以直接相加比较
  const v = t => Math.pow(1 + r, -t);
  let PVw = 0, PVg = 0, PVinc = 0;
  years.forEach(y => {
    const t = y.age - p.startAge;
    // 养老金比当年开销多的年份，多出来的也存起来（和逐年滚动一致）
    if (y.working) { PVw += (y.total - y.support - y.inflow - y.pension) * v(t); PVinc += y.g * v(t); }
    else PVg += (y.total - y.pension - y.inflow - y.support) * v(t);
  });
  PVw -= savings;   // 现有存款在起点就在手上，直接抵扣
  const A = PVw / PVinc, B = PVg / PVinc, Ipv = A + B;   // 借款利率等于存款利率时的起步收入

  // 逐年滚动。cashOf(y, i) = 当年到手现金；extraOf(i) = 当年额外支出（不顺情况里的意外）
  // 存款为正时的收益：存款/国债部分按 r，股票基金部分按长期实际收益
  const w = Math.min(1, Math.max(0, (p.stockPct || 0) / 100));
  const rs = (1 + (p.stockReturn || 0) / 100) / infl - 1;
  const rMix = (1 - w) * r + w * rs;
  function simulate(cashOf, extraOf) {
    let bal = savings, minBal = Infinity, minAge = null, at60 = 0, firstNeg = null;
    const path = [], debtInt = [], inc = [];
    for (let i = 0; i < years.length; i++) {
      const y = years[i];
      const di = bal < 0 ? -bal * rb : 0;
      debtInt.push(di);
      const cash = y.working ? cashOf(y, i) : 0;
      bal = bal * (1 + (bal < 0 ? rb : rMix)) + cash + y.support + y.inflow + y.pension - y.total - (extraOf ? extraOf(i) : 0);
      path.push(bal); inc.push(cash);
      if (y.age === p.retireAge) at60 = bal;
      if (bal < minBal) { minBal = bal; minAge = y.age; }
      if (bal < -1 && firstNeg === null) firstNeg = y.age;
    }
    let lastOk = p.endAge;
    if (bal < -1) { lastOk = null; for (let i = path.length - 1; i >= 0; i--) if (path[i] >= -1) { lastOk = years[i].age; break; } }
    return { path, debtInt, debtIntTotal: debtInt.reduce((a, b) => a + b, 0), inc, minBal, minAge, end: bal, at60, firstNeg, lastOk };
  }
  const shares = adults === 1 ? [1] : [p.split / 100, 1 - p.split / 100];
  const who = [p.me, p.sp];
  const y0 = years[0];
  const earnersAt = I => shares.map((sh, i) => ({ share: sh, ...grossFor(p, I * sh, who[i].months) }));
  const simWith = I => simulate(y => I * y.g);
  // 二分求最小的起步收入 I，使 ok(simF(I)) 成立
  function solveI(ok, guess, simF = simWith) {
    if (ok(simF(0))) return 0;
    let lo = 0, hi = Math.max(guess * 1.2, 3e5);
    while (!ok(simF(hi)) && hi < 1e9) { lo = hi; hi *= 2; }
    for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (ok(simF(mid))) hi = mid; else lo = mid; }
    return hi;
  }
  const simAct = have ? simulate(y => y.actCash) : null;
  const act0 = have ? y0.act : 0;
  const actTotal = have ? sum(y => y.act) : 0;
  if (opts.light && have) return { p, K, adults, nKids, total: 0, years, sim: simAct, simAct, I: 0, act0, feasible: simAct.minBal >= -1 };

  // 需要的起步收入：逐年滚动到最后存款刚好为 0（缺钱的年份按借款利率付息）
  const I = solveI(sm => sm.end >= 0, Math.max(Ipv, 1e4)), enough = I === 0;
  const simNeed = simWith(I);
  const sim = have ? simAct : simNeed;
  if (opts.light) return { p, K, adults, nKids, total: 0, years, sim, simAct, I, act0, feasible: sim.minBal >= -1 };

  // 每一年都不缺钱时的起步收入
  let Istar = Math.max(I, solveI(sm => sm.minBal >= 0, I * 1.5));
  // 头几年没有工资（比如一开始就停工）时，收入再高也补不上那几年，这时不给"每年都不缺钱"的收入
  const istarOk = simWith(Istar).minBal >= -1 && Istar < 1e8;
  if (!istarOk) Istar = I;
  const simStar = simWith(Istar);

  // 三种情况：顺利 / 一般（就是你填的设定） / 不顺
  const up = (p.goodUp || 0) / 100, cutB = (p.badCut || 0) / 100;
  const ja = Math.max(p.startAge, p.badJobAge || 0), jobAge = ja <= Math.min(p.retireAge, p.endAge) ? ja : null;   // 你失业的那一年（已经不工作就没有）
  const shockAge = (p.badShockAmt || 0) > 0 ? Math.max(p.startAge, p.badShockAge || 0) : null;
  const shockI = shockAge !== null && shockAge <= p.endAge ? shockAge - p.startAge : -1;
  const badExtra = i => i === shockI ? p.badShockAmt : 0;
  const scen = { up: p.goodUp || 0, cut: p.badCut || 0, jobAge, shockAge: shockI >= 0 ? shockAge : null, shockAmt: p.badShockAmt || 0 };
  const goodF = I => simulate(y => I * y.g * (1 + up)), badF = I => simulate(y => I * (y.g - (y.age === jobAge ? y.gMe : 0)) * (1 - cutB), badExtra);
  if (have) {
    scen.good = simulate(y => y.actCash * (1 + up));
    scen.base = simAct;
    scen.bad = simulate(y => (y.actCash - (y.age === jobAge ? y.actMe : 0)) * (1 - cutB), badExtra);
  } else {
    scen.good = goodF(I); scen.base = simNeed; scen.bad = badF(I);
    scen.Igood = solveI(sm => sm.end >= 0, I / (1 + up), goodF);
    scen.Ibad = solveI(sm => sm.end >= 0, I * 1.3, badF);
  }
  const sStar = I > 0 ? Math.min(1, Math.max(0, B / I)) : 0;
  const tiers = p.tiers.map(sp => {
    const s = Math.min(0.95, Math.max(0.01, sp / 100));
    const needSpend = A / (1 - s), needSave = B / s;
    const inc = Math.max(needSpend, needSave, 0);
    const binding = needSpend >= needSave ? 'spend' : 'save';
    const extraSave = s * inc - B, extraAt60 = extraSave * Fg, extraSpend = (1 - s) * inc - A;
    const naive = Math.max(0, selfFund) / F / s;
    return { s: sp, inc, needSpend, needSave, binding, extraSave, extraAt60, extraSpend, naive };
  });

  const earners = earnersAt(I);
  const earnersStar = earnersAt(Istar);
  const actNet = have ? [netOf(p, p.me.salary, p.me.months)].concat(adults === 2 ? [netOf(p, p.sp.salary, p.sp.months)] : []) : [];

  // 人生阶段
  const seg = [];
  const lastEduEnd = nKids ? kidBirths[nKids - 1] + eduEnd : null;
  const cut = (a, b, name) => { a = Math.max(a, p.startAge); b = Math.min(b, p.endAge); if (b >= a) seg.push({ from: a, to: b, name }); };
  const R0 = lastWork;
  const RET = '不工作以后';
  if (nKids) {
    const fb = kidBirths[0];
    const m = Math.min(Math.max(p.marriageAge, p.startAge), fb);
    if (m > p.startAge) cut(p.startAge, Math.min(m - 1, R0), '婚前');
    cut(m, Math.min(fb - 1, R0), '婚后·孩子出生前');
    cut(fb, Math.min(lastEduEnd, R0), '养育与上学');
    if (lastEduEnd > R0) cut(R0 + 1, lastEduEnd, '孩子仍在读书（已不工作）');
    cut(Math.max(lastEduEnd + 1, fb), R0, '孩子独立后');
    cut(Math.max(R0 + 1, lastEduEnd + 1), p.endAge, RET);
  } else if (married) {
    const m = Math.max(p.marriageAge, p.startAge);
    if (m > p.startAge) cut(p.startAge, Math.min(m - 1, R0), '婚前');
    if (buy && p.buyAge > m) { cut(m, Math.min(p.buyAge - 1, R0), '婚后·买房前'); cut(p.buyAge, R0, '婚后·买房后'); }
    else cut(m, R0, '婚后');
    cut(R0 + 1, p.endAge, RET);
  } else {
    if (buy && p.buyAge > p.startAge) { cut(p.startAge, Math.min(p.buyAge - 1, R0), '工作·买房前'); cut(p.buyAge, R0, '工作·买房后'); }
    else cut(p.startAge, R0, '工作期');
    cut(R0 + 1, p.endAge, RET);
  }
  const P0 = Math.min(P0me, adults === 2 ? P0sp - d : Infinity), seg2 = [];
  seg.forEach(s => {
    if (s.from > R0 && s.from < P0) {
      seg2.push({ from: s.from, to: Math.min(s.to, P0 - 1), name: '不工作·还没领养老金' });
      if (s.to >= P0) seg2.push({ from: P0, to: s.to, name: s.name });
    } else seg2.push(s);
  });
  const stages = seg2.filter(s => s.to >= s.from).map(s => {
    const ys = years.filter(y => y.age >= s.from && y.age <= s.to);
    const tot = ys.reduce((a, y) => a + y.total, 0);
    const cat = {}; CATS.forEach(([k]) => { cat[k] = ys.reduce((a, y) => a + y[k], 0); });
    const top = CATS.map(([k, n]) => [n, cat[k]]).sort((a, b) => b[1] - a[1])[0];
    return { ...s, n: ys.length, total: tot, avg: tot / ys.length, top, cat };
  });

  return {
    p, K, adults, married, nKids, kidBirths, r, rb, N, R, F, buy, area, rentArea, price, fees: h0 ? h0.fees : fees, buyPrice: h0 ? h0.value : 0, rentMonthly, rentSingle: p.rentArea.s * p.rentPerM2 * loc, upkeep,
    down, loan, mPay, interest, minDownAmt, support, supportAge, loanYrs, loanCapped,
    livingM, livingS: livOf('s'), funY, medY, years, byCat, byCatWork, byCatRet, housingParts, childParts, lateTotal,
    workTotal, retTotal, total, pensionTotal, pensionUsed, selfFund,
    W, G, A, B, Ipv, I, enough, sStar, tiers, sim, Istar, simStar, earners, earnersStar, stages, lastEduEnd,
    savings, have, G1, Fg, gHH, avgMe, avgSp, PVw, PVg, PVinc, simNeed, simAct, act0, actTotal, actNet, pensMe, pensSp, pensMonthly,
    feasible: sim.minBal >= -1, istarOk, scen, simulate, moves, moveLog, saleTotal, inflowTotal, inflowParts, events, rMix, w, cityAt, houseEnd: years[years.length - 1].houseValue, mAge: married ? mAge : null, premarital: married && mAge > p.startAge,
    P0: P0me, gap: gapYears(p), contrib: contribYears(p), gapCost: years.filter(y => y.age > p.retireAge && y.age < P0me).reduce((a, y) => a + y.total, 0),
    d, lastWork, P0sp, spP0Me: P0sp - d, spGap, spContrib, spRetireMe: p.sp.retire - d, socialTotal: years.reduce((a, y) => a + y.social, 0),
  };
}

if (typeof module !== 'undefined') module.exports = { baseFromTakeHome, growthFactor, pensionStart, gapYears, contribYears, SH_BASE, DEFAULTS, CATS, compute, netOf, grossFor, pensionEstimate, applyCity, childItems, routeBreakdown, eduCost, eduOpt, eduEndAge, cityById };
