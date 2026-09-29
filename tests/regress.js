// 一生账本 · 回归测试：node regress.js
Object.assign(global, require('../src/data.js'));
const M = require('../src/model.js');
let pass = 0, fail = 0;
const ok = (cond, name, info = '') => { if (cond) pass++; else { fail++; console.log('✗', name, info); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const base = (city = 'sh') => { const p = JSON.parse(JSON.stringify(M.DEFAULTS)); M.applyCity(p, city); p.pensionAuto = true; p.mode = 'need'; return p; };
const set = (p, o) => { for (const k in o) { if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && p[k] && typeof p[k] === 'object') Object.assign(p[k], o[k]); else p[k] = o[k]; } return p; };

// 1. 收入：直接用到手（不再模拟个税、社保、公积金）
{ const p = base(); const n = M.netOf(p, 16000, 13);
  ok(n.takeHome === 16000 * 13 && n.usable === n.takeHome, '一年到手 = 每月到手 × 月数');
  ok(near(M.grossFor(p, 208000, 13).M, 16000, 1e-9), '反推每月到手');
  ok(near(M.baseFromTakeHome(p, 16000), 20000, 1e-9) && M.baseFromTakeHome(p, 1000) === p.baseLow && M.baseFromTakeHome(p, 1e6) === p.baseHigh, '缴费基数 = 到手 ÷ 80%，夹在上下限之间'); }

// 2. 数据完整性
CITIES.forEach(c => ok(c.price > 0 && c.rent > 0 && c.cons > 0 && c.low < c.high && c.wage > c.low, '城市数据 ' + c.name));
ROUTES.forEach(r => ok(STAGE_KEYS.every(s => EDU[s].options.some(o => o.id === r.st[s])) && TUTOR.some(t => t.id === r.tutor), '教育档合法 ' + r.name));
ok(ROUTES.length === 5, '教育合并成 5 档');
{ const t = ROUTES.map(r => M.routeBreakdown(base(), r.st, r.tutor).total); ok(t[0] < t[1] && t[1] < t[2], '基础 < 常规 < 加码', t.map(x => Math.round(x / 1e4))); }

// 3. 默认情形的恒等式
{ const c = M.compute(base());
  ok(near(c.W + c.G, c.selfFund, 1), 'W+G = 最终自筹');
  ok(near(c.simNeed.end, 0, 10), '需要模式到终点存款为 0', c.simNeed.end);
  ok(c.Istar >= c.I && c.simStar.minBal >= -1, '每年不缺钱的收入 ≥ 按总账');
  const lastY = c.years.find(y => y.hs.mortgage > 0 && y.age === 30 + c.loanYrs - 1);
  ok(lastY && near(lastY.hs.loanLeft, 0, 1), '房贷到期余额为 0');
  const prin = c.years.reduce((a, y) => a + y.hs.principal, 0); ok(near(prin, c.loan, 5), '本金合计 = 贷款', prin - c.loan);
  const y27 = c.years[0], y30 = c.years[3];
  ok(!y27.couple && !y27.spWork && y27.living === c.livingS * 12, '婚前按单身开销、配偶不计收入');
  ok(y30.couple && y30.living === c.livingM * 12, '婚后按已婚开销'); }

// 4. 借款利率等于存款利率时，逐年滚动与折现公式一致
for (const o of [{}, { family: 'single' }, { housing: 'rent' }, { housing: 'own' }, { kids: 2 }, { rate: 0 }, { inflation: 2 }, { spSync: false, sp: { age: 33, retire: 65 } }]) {
  const p = set(base(), o); p.borrowRate = p.rate; const c = M.compute(p);
  ok(c.Ipv <= 0 || near(c.I, c.Ipv, Math.max(20, c.Ipv * 1e-3)), '折现公式一致 ' + JSON.stringify(o), [c.I, c.Ipv]);
}
// 5. 借款更贵时收入只会更高
{ const p = base(); p.borrowRate = p.rate; const a = M.compute(p).I; p.borrowRate = 6; const b = M.compute(p).I; ok(b >= a, '借款利率越高收入越高', [a, b]); }

// 6. 钱够了不出现负数
{ const c = M.compute(set(base(), { savings: 5e7 })); ok(c.I === 0 && c.enough && c.Istar === 0, '存款足够时收入为 0'); }

// 8. 贷款年龄上限
{ let c = M.compute(set(base(), { buyAge: 50 })); ok(c.loanYrs === 20 && c.loanCapped, '50 岁买房贷 20 年');
  c = M.compute(set(base(), { buyAge: 70 })); ok(c.loanYrs === 0 && c.loan === 0 && c.down === c.price, '70 岁买房只能全款'); }

// 9. 高龄护理
{ const a = M.compute(base()), b = M.compute(set(base(), { lateExtra: 3000 }));
  ok(near(b.retTotal - a.retTotal, 3000 * 12 * 2 * (100 - 80 + 1), 1), '高龄护理按夫妻两人 80–100 岁计'); }

// 10. 房贷只按一个利率
{ const c = M.compute(base()); const i = 3.05 / 1200, n = c.loanYrs * 12;
  ok(near(c.mPay, c.loan * i / (1 - Math.pow(1 + i, -n)), 1e-6), '月供 = 等额本息公式'); }

// 11. 正推模式：收入很高够、收入为 0 不够
{ const p = set(base(), { mode: 'have', me: { salary: 200000 }, sp: { salary: 200000 } }); ok(M.compute(p).feasible, '高收入负担得起');
  const q = set(base(), { mode: 'have', me: { salary: 0 }, sp: { salary: 0 } }); ok(!M.compute(q).feasible, '零收入负担不起'); }

// 12. 养老金空窗
{ const p = set(base(), { retireAge: 55, pensionAge: 63 }); ok(M.gapYears(p) === 7 && M.pensionStart(p) === 63, '55 岁不工作、63 岁领：空窗 7 年'); }

// 12b. 今年就入不敷出时不能说"撑到比今年还小的年龄"
{ const p = set(base(), { mode: 'have', family: 'single', startAge: 24, me: { salary: 9, months: 13 } }); const c = M.compute(p);
  ok(c.sim.lastOk === null || c.sim.lastOk >= p.startAge, '撑到的年龄不早于今年', c.sim.lastOk); }

// 14. 孩子毕业后、工资下降
{ const k0 = M.compute(set(base(), { kidAfterYears: 0 })), k3 = M.compute(base());
  ok(near(k3.childParts.after, 3 * 30000, 1), '毕业后贴补 3 年 × 3 万');
  ok(k3.I > k0.I, '毕业后贴补增加收入需求');
  const h = M.compute(set(base(), { kidHelp: 500000 })); ok(near(h.childParts.help, 500000, 1), '结婚买房资助一次');
  const g = M.growthFactor({ growth: 3, until: 45, downAt: 50, down: 2 }, 27, 55); ok(near(g, Math.pow(1.03, 18) * Math.pow(0.98, 5), 1e-9), '50 岁后每年降 2%'); }

// 14b. 三种情况：顺利、一般、不顺
{ const p = base(), c = M.compute(p), sc = c.scen;
  ok(sc.base === c.simNeed, '一般 = 按你填的');
  ok(sc.Igood < c.I && c.I < sc.Ibad, '顺利要的收入 < 一般 < 不顺', [sc.Igood, c.I, sc.Ibad].map(Math.round));
  ok(near(sc.Igood, c.I / 1.2, c.I * 1e-6), '顺利收入高 20%：要的起步收入正好是一般的 1/1.2');
  ok(sc.jobAge === 40 && sc.shockAge === 50, '不顺：40 岁失业、50 岁意外');
  ok(near(M.compute(p).scen.bad.end, sc.bad.end, 1e-6), '没有随机数，重算结果一样');
  // 不顺按定义手算
  let bal = c.savings, err = 0;
  c.years.forEach((y, i) => { const cash = y.working ? c.I * (y.g - (y.age === 40 ? y.gMe : 0)) * 0.8 : 0; bal = bal * (1 + (bal < 0 ? c.rb : c.rMix)) + cash + y.support + y.inflow + y.pension - y.total - (y.age === 50 ? 2e5 : 0); err = Math.max(err, Math.abs(bal - sc.bad.path[i])); });
  ok(err < 1, '不顺的逐年存款可手算复现', err);
  const h = M.compute(set(base(), { mode: 'have' })); ok(h.scen.good.end > h.scen.base.end && h.scen.base.end > h.scen.bad.end, '按现在的收入：顺利 > 一般 > 不顺');
  const old = M.compute(set(base(), { startAge: 55, retireAge: 60, sp: { age: 55, retire: 60 } })); ok(old.scen.jobAge === 55, '已经过了 40 岁：从今年算失业');
  const ret = M.compute(set(base(), { startAge: 65, retireAge: 64, endAge: 95, sp: { age: 65, retire: 64 } })); ok(ret.scen.jobAge === null, '已经不工作：没有失业这一项'); }

// 15. 中途换城市
{ const a = M.compute(base());
  const b = M.compute(set(base(), { moves: [{ age: 40, city: 'cd', sell: true, home: 'rent' }] }));
  ok(b.years.find(y => y.age === 39).city === 'sh' && b.years.find(y => y.age === 40).city === 'cd', '40 岁起按成都');
  const y40 = b.years.find(y => y.age === 40), y39 = b.years.find(y => y.age === 39);
  ok(y40.hs.mortgage === 0 && y40.hs.rent > 0 && y40.hs.loanLeft === 0, '卖房后不再还贷、改租房');
  ok(y40.living < y39.living, '成都日常开销更低');
  const bal = a.years.find(y => y.age === 39).hs.loanLeft;
  ok(near(y40.sale, a.price * 0.98 - bal, 5), '卖房收回 = 房价扣 2% 再扣剩余贷款', [y40.sale, a.price * 0.98 - bal]);
  ok(near(b.W + b.G, b.selfFund, 1) && near(b.simNeed.end, 0, 50), '搬家后恒等式仍成立');
  const c = M.compute(set(base(), { moves: [{ age: 40, city: 'cd', sell: true, home: 'buy', area: 100 }] }));
  const l = c.moveLog[0]; ok(l.price > 0 && near(l.price, 100 * CITIES.find(x => x.id === 'cd').price, 1) && l.loan === 0, '卖上海房全款买成都房');
  const d = M.compute(set(base(), { moves: [{ age: 35, city: 'cd', sell: false, home: 'rent' }] }));
  const yd = d.years.find(y => y.age === 36); ok(yd.hs.mortgage > 0 && yd.hs.rent > 0, '不卖房：房贷照还还要租房');
  const e = M.compute(set(base(), { moves: [{ age: 25, city: 'cd' }, { age: 999, city: 'bj' }, { age: 40, city: 'nope' }] }));
  ok(e.moves.length === 0, '无效搬家被忽略');
  const f = M.compute(set(base(), { moves: [{ age: 29, city: 'cd', sell: true, home: 'buy' }] }));
  ok(!f.buy && f.moveLog[0].loan > 0, '买房前就搬走：不在原城市买，到新城市贷款买');
  const g = M.compute(set(base(), { moveWage: false, moves: [{ age: 40, city: 'cd', sell: true, home: 'rent' }] }));
  ok(g.I < b.I, '工资不随城市下降时，需要的起步收入更低'); }

// 16. 人生大事、房产、投资、父母、收入
{ const a = M.compute(base());
  const gap = M.compute(set(base(), { events: [{ age: 35, type: 'gap', years: 2, who: 'me' }] }));
  ok(gap.years.find(y => y.age === 35).g < a.years.find(y => y.age === 35).g && gap.I > a.I, '停工两年：那两年少收入，起步收入要更高');
  ok(near(gap.years.find(y => y.age === 37).g, a.years.find(y => y.age === 37).g, 1e-9), '停工结束后收入恢复');
  const up = M.compute(set(base(), { events: [{ age: 32, type: 'salary', amount: 30 }] })); ok(up.I < a.I, '32 岁涨薪 30%，起步收入可以更低');
  const inh = M.compute(set(base(), { events: [{ age: 50, type: 'income', amount: 200 }] })); ok(near(inh.inflowParts.windfall, 2e6, 1) && near(inh.selfFund, a.selfFund - 2e6, 1), '继承 200 万抵扣自筹');
  const ex = M.compute(set(base(), { events: [{ age: 45, type: 'expense', amount: 50 }] })); ok(near(ex.byCat.events, 5e5, 1) && near(ex.total, a.total + 5e5, 1), '装修 50 万计入人生大事');
  const side = M.compute(set(base(), { events: [{ age: 30, type: 'side', amount: 3000, years: 10 }] })); ok(near(side.inflowParts.side, 3000 * 12 * 10, 1), '副业 3000 元/月 × 10 年');
  const hg = M.compute(set(base(), { houseGrowth: 2 })); ok(near(hg.houseEnd, hg.buyPrice * Math.pow(1.02, 100 - 30), 10) && near(hg.buyPrice, a.price * Math.pow(1.02, 3), 10), '房价每年涨 2%：买时更贵、终值更高');
  const lease = M.compute(set(base(), { moves: [{ age: 40, city: 'cd', sell: 'lease', home: 'rent' }] }));
  const yl = lease.years.find(y => y.age === 41); ok(near(yl.lease, 90 * 84.39 * 12 * 0.9, 1) && yl.hs.mortgage > 0, '原房出租：租金扣 10% 空置、房贷照还');
  const st = M.compute(set(base(), { stockPct: 100, stockReturn: 5, rate: 1.8 })); ok(near(st.rMix, 0.05, 1e-9), '全放股票基金按 5% 收益');
  const lump = M.compute(set(base(), { parentsMode: 'lump' })); ok(near(lump.byCat.parents, 5e5, 1), '按总额赡养 50 万');
  ok(near(a.byCat.parents, 2 * 3000 * 12 * (88 - 80 + 1), 1), '默认：两边父母 80–88 岁每边每月 3000');
  }

// 13. 随机参数不出现 NaN 且不变量成立
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
let bad = 0;
for (let i = 0; i < 1500; i++) {
  const p = base(pick(CITIES).id); p.pensionAuto = Math.random() < .5;
  p.startAge = Math.round(rnd(20, 45)); p.retireAge = Math.round(rnd(p.startAge + 1, 70)); p.endAge = Math.round(rnd(p.retireAge + 1, 105));
  p.pensionAge = Math.round(rnd(50, 70)); p.family = pick(['single', 'couple', 'kid']); p.kids = pick([1, 2, 3]);
  p.birthAge = Math.round(rnd(18, 50)); p.marriageAge = Math.round(rnd(18, 50)); p.buyAge = Math.round(rnd(18, 70));
  p.housing = pick(['buy', 'rent', 'own']); p.mode = pick(['need', 'have']); p.savings = pick([0, 5e5, 5e6]);
  p.inflation = pick([0, 2]); p.rate = pick([0, 1.8, 4]); p.borrowRate = pick([p.rate, 4, 8]); { const rr = pick(ROUTES); p.stages = rr.st; p.tutor = rr.tutor; } p.spSync = false;
  p.sp.age = Math.round(rnd(18, 60)); p.sp.retire = Math.round(rnd(p.sp.age, 70)); p.sp.pensionAge = Math.round(rnd(50, 70));
  p.me.growth = pick([0, 3, 8]); p.lateExtra = pick([0, 3000]);
  if (Math.random() < .5) p.events = [{ age: Math.round(rnd(p.startAge, p.endAge)), type: pick(['gap', 'salary', 'income', 'expense', 'study', 'side']), amount: pick([-30, 20, 100]), years: pick([1, 3]), who: pick(['me', 'sp']) }];
  p.stockPct = pick([0, 50]); p.houseGrowth = pick([0, 2, -2]); p.parentsMode = pick(['lump', 'timeline']);
  if (Math.random() < .5) p.moves = [{ age: Math.round(rnd(p.startAge + 1, p.endAge)), city: pick(CITIES).id, sell: Math.random() < .7, home: pick(['rent', 'buy', 'own']), area: pick([0, 60, 120]) }, ...(Math.random() < .3 ? [{ age: Math.round(rnd(p.startAge + 1, p.endAge)), city: pick(CITIES).id, sell: true, home: pick(['rent', 'buy', 'own']) }] : [])];
  const c = M.compute(p);
  const vals = [c.total, c.I, c.Istar, c.selfFund, c.sim.end, c.earners[0].M, ...c.sim.path];
  if (vals.concat(c.scen.bad.path, c.scen.good.path, c.scen.Ibad || 0, c.scen.Igood || 0).some(v => !isFinite(v)) || c.I < 0 || c.Istar < c.I - 1 || (c.istarOk && c.simStar.minBal < -1) || (c.I > 0 && Math.abs(c.simNeed.end) > 50) || Math.abs(c.W + c.G - c.selfFund) > 1 || (!c.have && !c.enough && (c.scen.Ibad < c.I - 1 || c.scen.Igood > c.I + 1))) bad++;
}
ok(bad === 0, '随机 1500 组参数不变量', bad);

// 17 养老金：已交年限、记账利率、视同缴费与过渡性养老金
{
  const p = base(); p.acctRate = 0;
  const e0 = M.pensionEstimate(p, 12577, 35, 60);
  ok(Math.abs(e0.total - (12577 * 2 / 2 * 35 / 100 + 12577 * 0.08 * 12 * 35 / 139)) < 1e-6, '养老金：记账利率 0 时退回旧公式');
  p.acctRate = 1.5; const e1 = M.pensionEstimate(p, 12577, 35, 60);
  let acc = 0; for (let k = 0; k < 35; k++) acc = acc * 1.015 + 12577 * 0.08 * 12;
  ok(Math.abs(e1.personal - acc / 139) < 1e-6, '养老金：个人账户逐年滚存', e1.personal);
  const e2 = M.pensionEstimate(p, 12577, 20, 60, 10);
  ok(Math.abs(e2.trans - 12577 * 1 * 10 * 0.012) < 1e-6 && Math.abs(e2.basic - 12577 * 30 / 100) < 1e-6, '养老金：视同缴费计入基础＋过渡性');
  const q = base(); q.mode = 'have'; q.pensionAuto = true; q.startAge = 30;
  const a = M.compute(q); q.paidYears = 7; const b2 = M.compute(q);
  ok(b2.contrib === a.contrib + 7 && b2.pensMe > a.pensMe, '养老金：填了之前已交年限，缴费年限和养老金都增加', `${a.pensMe}→${b2.pensMe}`);
}

console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
