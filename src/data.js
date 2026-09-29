// ===== 一生账本 · 参考数据（核对于 2026-09-29；金额均为今天的钱） =====

// 城市参考值
// price: 二手住宅挂牌均价 元/㎡（房天下 2026-08）；rent: 住宅租金 元/㎡/月（中指 CREIS；est=按租金房价比估算）
// cons: 2025 年城镇常住居民人均消费支出 元/年；low/high: 社保缴费基数 元/月；wage: 社平工资/计发基数 元/月
// hf: 公积金贷款上限 [个人, 家庭] 万元（hfOk=false 为通用默认值，待按当地核实）；edu: 民办/双语学费相对一线城市的估算系数；pri: 小学年数
const CITIES = [
  { id: 'sh', name: '上海', tier: 1, price: 51482, rent: 84.39, cons: 57076, low: 7546, high: 37731, wage: 12577, hf: [100, 200], hfOk: true, edu: 1.0, pri: 5 },
  { id: 'bj', name: '北京', tier: 1, price: 54431, rent: 81.41, cons: 54122, low: 7270, high: 36348, wage: 12116, hf: [120, 240], hfOk: true, edu: 1.0, pri: 6 },
  { id: 'sz', name: '深圳', tier: 1, price: 53199, rent: 82.47, cons: 53548, low: 4775, high: 27549, wage: 9493, hf: [70, 130], hfOk: true, edu: 1.0, pri: 6 },
  { id: 'gz', name: '广州', tier: 1, price: 30067, rent: 47.69, cons: 51860, low: 5510, high: 27549, wage: 9493, hf: [60, 120], hfOk: false, edu: 0.9, pri: 6 },
  { id: 'hz', name: '杭州', tier: 2, price: 29960, rent: 48.29, cons: 59484, low: 4986, high: 25299, wage: 8433, hf: [60, 120], hfOk: false, edu: 0.85, pri: 6 },
  { id: 'nj', name: '南京', tier: 2, price: 19377, rent: 35.92, cons: 49506, low: 4850, high: 24250, wage: 8083, baseEst: true, hf: [60, 120], hfOk: false, edu: 0.8, pri: 6 },
  { id: 'suz', name: '苏州', tier: 2, price: 14785, rent: 33.70, cons: 54897, low: 4850, high: 24250, wage: 8083, baseEst: true, hf: [60, 120], hfOk: false, edu: 0.8, pri: 6 },
  { id: 'xm', name: '厦门', tier: 2, price: 31973, rent: 38.12, cons: 52326, low: 4579, high: 22893, wage: 7632, hf: [60, 120], hfOk: false, edu: 0.75, pri: 6 },
  { id: 'tj', name: '天津', tier: 2, price: 17664, rent: 25, rentEst: true, cons: 39693, low: 5180, high: 25902, wage: 8634, hf: [60, 120], hfOk: false, edu: 0.7, pri: 6 },
  { id: 'cd', name: '成都', tier: 2, price: 14308, rent: 24, rentEst: true, cons: 37100, low: 4699, high: 23493, wage: 7832, hf: [60, 120], hfOk: false, edu: 0.7, pri: 6 },
  { id: 'wh', name: '武汉', tier: 2, price: 12664, rent: 23, rentEst: true, cons: 43233, low: 4498, high: 22488, wage: 7496, hf: [60, 120], hfOk: false, edu: 0.7, pri: 6 },
  { id: 'cs', name: '长沙', tier: 2, price: 8843, rent: 22, rentEst: true, cons: 48547, low: 4106, high: 20529, wage: 6843, hf: [60, 120], hfOk: false, edu: 0.65, pri: 6 },
  { id: 'xa', name: '西安', tier: 2, price: 12774, rent: 22, rentEst: true, cons: 33665, low: 4737, high: 23685, wage: 7895, hf: [60, 120], hfOk: false, edu: 0.65, pri: 6 },
  { id: 'cq', name: '重庆', tier: 2, price: 9334, rent: 19, rentEst: true, cons: 32764, low: 4524, high: 22620, wage: 7540, baseEst: true, hf: [60, 120], hfOk: false, edu: 0.65, pri: 6 },
  { id: 'other', name: '其他城市', tier: 3, price: 12527, rent: 25, rentEst: true, cons: 35869, low: 4500, high: 22500, wage: 7500, baseEst: true, hf: [60, 120], hfOk: false, edu: 0.6, pri: 6 },
];
const SH_CONS = 57076; // 以上海为基准缩放生活类开销

// 教育选项目录：cost = 每年总花费（一线城市口径），scale: 'edu' 乘城市教育系数，'none' 不缩放
// years 仅对本科、研究生有效；abroad 表示需要语培和申请
const EDU = {
  kg: { name: '学前', ages: '3–5 岁', options: [
    { id: 'pub', name: '公办幼儿园', cost: 6000, scale: 'none', note: '保教费＋伙食。2025 年秋季学期起公办幼儿园大班免保教费。' },
    { id: 'prv', name: '普通民办幼儿园', cost: 40000, scale: 'edu', note: '一线城市普惠及普通民办约 2,000–4,000 元/月。' },
    { id: 'bil', name: '高端双语/国际幼儿园', cost: 150000, scale: 'edu', note: '一线城市常见 12–20 万/年（估，以园所公示为准）。' },
  ]},
  pri: { name: '小学', ages: '6 岁起', options: [
    { id: 'pub', name: '公办小学', cost: 4000, scale: 'none', note: '免学杂费；餐费、校服、活动等。' },
    { id: 'prv', name: '普通民办小学', cost: 60000, scale: 'edu', note: '上海 2025 年示例：金苹果 2.8 万/学期、华盛怀少 2.16 万/学期；部分纳入政府购买学位只补差价。' },
    { id: 'bil', name: '双语学校', cost: 160000, scale: 'edu', note: '上海长宁区 2025 学年公示：民办中小学学费每学期约 2.4–9.5 万元，包玉刚实验学校小学 8.4 万/学期。' },
  ]},
  mid: { name: '初中', ages: '到 14 岁', options: [
    { id: 'pub', name: '公办初中', cost: 5000, scale: 'none', note: '免学杂费；餐费、书本、活动等。' },
    { id: 'prv', name: '普通民办初中', cost: 60000, scale: 'edu', note: '上海 2025 年示例：金苹果初中 3 万/学期；多所民办初中 2.4 万/学期。' },
    { id: 'bil', name: '双语学校', cost: 180000, scale: 'edu', note: '一线双语名校初中常见 8–10 万/学期（以区教育局公示为准）。' },
  ]},
  high: { name: '高中', ages: '15–17 岁', options: [
    { id: 'pub', name: '公办普高', cost: 6000, scale: 'none', note: '学费 1,800–4,000 元/年（上海：一般、区重点、市重点、寄宿制），另计餐费书本。' },
    { id: 'prv', name: '普通民办高中', cost: 60000, scale: 'edu', note: '上海示例：金苹果高中 3.1 万/学期。' },
    { id: 'intl', name: '国际课程高中', cost: 200000, scale: 'edu', note: '上海示例：华旭 8.45 万/学期＋住宿，科德 9 万/学期＋住宿 1 万/学期。' },
    { id: 'voc', name: '中职（职业高中）', cost: 4000, scale: 'none', note: '中职免学费，计住宿、餐费、杂费。' },
  ]},
  uni: { name: '本科', ages: '18 岁起', options: [
    { id: 'cnPub', name: '国内公办本科', cost: 32000, years: 4, scale: 'none', note: '学费 5,000–8,000 元/年，住宿 1,200–1,500 元/年，生活费约 2,000 元/月。' },
    { id: 'cnPrv', name: '国内民办本科', cost: 50000, years: 4, scale: 'none', note: '学费 1.5–3 万/年，另计住宿和生活费。' },
    { id: 'hvoc', name: '高职/大专', cost: 25000, years: 3, scale: 'none', note: '学费 6,000–1 万/年＋生活费。' },
    { id: 'coop', name: '中外合作大学', cost: 130000, years: 4, scale: 'none', note: '西交利物浦 9.3 万/年、宁波诺丁汉 10 万/年、温州肯恩 7.5 万/年、港中深 14 万/年（学校招生章程），另计住宿生活 2–5 万。以各校当年招生章程为准。' },
    { id: 'coopHi', name: '中外合作（上纽大、昆山杜克）', cost: 230000, years: 4, scale: 'none', note: '上海纽约大学 20–23 万/年、昆山杜克 20 万/年，另计住宿生活。' },
    { id: 'hk', name: '香港本科', cost: 280000, years: 4, abroad: true, scale: 'none', note: '港中文 2026-27 非本地本科学费 21.4 万港币/年，校方估住宿＋生活约 6.2 万港币；港大 2027/28 为 25 万（非 STEM）/ 28 万（STEM）港币。一年约 25–33 万元。' },
    { id: 'sg', name: '新加坡本科（申请助学金）', cost: 200000, years: 4, abroad: true, scale: 'none', note: '新加坡国立大学 2025/26 计算机、工程：领助学金后 2 万新币/年，不领 3.92 万新币；领助学金须毕业后在新加坡工作 3 年。生活住宿另计，约 1.5–2 万新币/年（估）。' },
    { id: 'jp', name: '日本本科（含 1 年语言学校）', cost: 100000, years: 5, abroad: true, scale: 'none', note: '国立大学标准学费 53.58 万日元/年（约 2.6 万元）、入学金 28.2 万日元（文部科学省标准，部分东京大学上浮至多 20%）；东京生活费约 7–8 万元/年（估）。' },
    { id: 'uk', name: '英国本科（非伦敦）', cost: 400000, years: 3, abroad: true, scale: 'none', note: '国际生学费因校因专业约 2.5–4 万英镑/年（以学校官网为准）；英国签证资金要求伦敦以外 1,171 英镑/月。一年约 35–50 万元。英格兰本科 3 年，苏格兰 4 年。' },
    { id: 'ukL', name: '英国本科（伦敦/G5）', cost: 600000, years: 3, abroad: true, scale: 'none', note: 'UCL 计算机 2026/27 国际生学费 4.67 万英镑/年；签证资金要求伦敦 1,529 英镑/月。一年约 55–65 万元。' },
    { id: 'usPub', name: '美国公立本科（州外）', cost: 380000, years: 4, abroad: true, scale: 'none', note: 'College Board 2025-26：四年制公立州外学费 3.19 万美元，含食宿 4.58 万美元/年；另有书本、交通、保险。' },
    { id: 'usPrv', name: '美国私立本科', cost: 480000, years: 4, abroad: true, scale: 'none', note: 'College Board 2025-26：四年制私立非营利学费 4.5 万美元，含食宿 6.09 万美元/年；另有书本、交通、保险。' },
    { id: 'usTop', name: '美国顶尖私立本科', cost: 650000, years: 4, abroad: true, scale: 'none', note: '顶尖私立大学官网公布的年度总花费（cost of attendance）多在 8 万美元以上（估），以各校官网为准。' },
    { id: 'au', name: '澳洲本科', cost: 380000, years: 3, abroad: true, scale: 'none', note: '悉尼大学 2026 国际生学费 5.6–6.1 万澳元/年，其他学校多在 4–5 万；学生签证资金证明生活费 29,710 澳元/年（澳洲内政部，2024 年 5 月起）。一年约 33–42 万元。多数专业 3 年。' },
    { id: 'ca', name: '加拿大本科', cost: 350000, years: 4, abroad: true, scale: 'none', note: '加拿大统计局 2025/26 国际本科生平均学费 41,746 加元/年；学签资金证明生活费 22,895 加元/年（2025 年 9 月起）。一年约 33 万元，大城市更高。' },
    { id: 'none', name: '不读本科，直接工作', cost: 0, years: 0, scale: 'none', note: '孩子 18 岁后不再计教育支出。' },
  ]},
  grad: { name: '研究生', ages: '本科后', options: [
    { id: 'none', name: '不读研', cost: 0, years: 0, scale: 'none', note: '' },
    { id: 'cn', name: '国内硕士', cost: 45000, years: 3, scale: 'none', note: '学术硕士学费约 8,000 元/年，专业硕士 1.5–3 万/年，另计生活费。' },
    { id: 'uk', name: '英国一年硕士', cost: 380000, years: 1, abroad: true, scale: 'none', note: '授课型硕士学费约 2.5–4 万英镑（以学校官网为准）＋生活费（签证要求伦敦以外 1,171 英镑/月）。一年约 35–45 万元，伦敦更高。' },
    { id: 'hk', name: '香港一年硕士', cost: 320000, years: 1, abroad: true, scale: 'none', note: '授课型硕士学费多在 15–35 万港币（以各校官网为准），生活住宿约 8–10 万港币（估）。' },
    { id: 'sg', name: '新加坡一年硕士', cost: 350000, years: 1, abroad: true, scale: 'none', note: '授课型硕士学费多在 4–6 万新币（以各校官网为准）＋生活费约 1.8 万新币（估）。' },
    { id: 'us', name: '美国硕士（2 年）', cost: 500000, years: 2, abroad: true, scale: 'none', note: '两年学费＋生活，公立 STEM 约 70–90 万元（估），私立和商科更高；以各校 cost of attendance 为准。' },
    { id: 'au', name: '澳洲硕士（2 年）', cost: 380000, years: 2, abroad: true, scale: 'none', note: '学费多在 4–5.5 万澳元/年（以学校官网为准）＋生活费 29,710 澳元/年。' },
  ]},
};
const STAGE_KEYS = ['kg', 'pri', 'mid', 'high', 'uni', 'grad'];

// 课外班强度：上海口径 元/月（3–17 岁），按城市消费水平缩放
const TUTOR = [
  { id: 'none', name: '不报', cost: 0 },
  { id: 'light', name: '少量兴趣班', cost: 500 },
  { id: 'normal', name: '常规兴趣＋补习', cost: 1000 },
  { id: 'heavy', name: '重度加码', cost: 3000 },
];

// 教育 5 档：每档 = 各阶段学校 + 课外班强度。学费按城市教育系数缩放，可在参数里改。
const ROUTES = [
  { id: 'basic', name: '基础：公办一路＋国内本科，少量兴趣班', tutor: 'light', st: { kg: 'pub', pri: 'pub', mid: 'pub', high: 'pub', uni: 'cnPub', grad: 'none' } },
  { id: 'normal', name: '常规：公办一路＋国内本科，常规兴趣班和补习', tutor: 'normal', st: { kg: 'pub', pri: 'pub', mid: 'pub', high: 'pub', uni: 'cnPub', grad: 'none' } },
  { id: 'plus', name: '加码：民办一路＋国内本科＋国内读研，重度补习', tutor: 'heavy', st: { kg: 'prv', pri: 'prv', mid: 'prv', high: 'prv', uni: 'cnPub', grad: 'cn' } },
  { id: 'abroadMS', name: '出国读研：公办一路＋国内本科＋英国一年硕士', tutor: 'normal', st: { kg: 'pub', pri: 'pub', mid: 'pub', high: 'pub', uni: 'cnPub', grad: 'uk' } },
  { id: 'intl', name: '国际路线：国际高中＋海外本科（按美国公立本科）', tutor: 'normal', st: { kg: 'pub', pri: 'pub', mid: 'pub', high: 'intl', uni: 'usPub', grad: 'none' } },
];

if (typeof module !== 'undefined') module.exports = { CITIES, SH_CONS, EDU, STAGE_KEYS, TUTOR, ROUTES };
