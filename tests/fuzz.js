Object.assign(global, require('../src/data.js')); const M = require('../src/model.js');
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
let bad = [], endErr = 0, n = 0;
for (let i = 0; i < 3000; i++) {
  const p = JSON.parse(JSON.stringify(M.DEFAULTS)); M.applyCity(p, pick(CITIES).id); p.pensionAuto = Math.random() < .5;
  p.startAge = Math.round(rnd(20, 45)); p.retireAge = Math.round(rnd(p.startAge + 1, 70)); p.endAge = Math.round(rnd(p.retireAge + 1, 105));
  p.pensionAge = Math.round(rnd(50, 70)); p.family = pick(['single', 'couple', 'kid']); p.kids = pick([1, 2, 3]);
  p.birthAge = Math.round(rnd(18, 50)); p.marriageAge = Math.round(rnd(18, 50)); p.buyAge = Math.round(rnd(18, 70));
  p.housing = pick(['buy', 'rent', 'own']); p.mode = pick(['need', 'have']); p.savings = pick([0, 5e5, 5e6]);
  p.inflation = pick([0, 2]); p.rate = pick([0, 1.8, 4]); p.stages = pick(ROUTES).st; p.spSync = false;
  p.sp.age = Math.round(rnd(18, 60)); p.sp.retire = Math.round(rnd(p.sp.age, 70)); p.sp.pensionAge = Math.round(rnd(50, 70));
  p.me.growth = pick([0, 3, 8]); p.ownMortgage = pick([0, 8000]); p.ownLoanYears = pick([0, 20]); p.support.c = pick([0, 4e6]);
  let c; try { c = M.compute(p); } catch (e) { bad.push(['EXC', e.message, JSON.stringify({ s: p.startAge, r: p.retireAge, e: p.endAge })]); continue; }
  const vals = [c.total, c.I, c.selfFund, c.Istar, c.sim.end, c.earners[0].M, ...c.sim.path];
  if (vals.some(v => !isFinite(v))) bad.push(['NaN', p.family, p.housing, p.mode, p.startAge, p.retireAge, p.endAge, p.rate, c.I]);
  n++;
  if (p.mode === 'need' && Math.abs(c.simNeed.end) > 1e3 && c.I > 0) endErr++;
  if (c.simStar.minBal < -1) bad.push(['IstarBad', c.I, c.Istar, c.simStar.minBal]);
  if (c.I < 0 || c.Istar < c.I - 1) bad.push(['order', c.I, c.Istar]);
}
console.log('runs', n, 'issues', bad.length, 'need-mode end≠0', endErr);
const agg = {}; bad.forEach(b => agg[b[0]] = (agg[b[0]] || 0) + 1); console.log(agg); console.log(bad.slice(0, 6));
