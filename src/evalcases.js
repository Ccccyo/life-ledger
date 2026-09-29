// ===== AI 帮我填 · 评测集 v3（32 条；收入口径改为每月到手）=====
// cat：考察的能力类别；ask：这句话含糊，理想做法是追问
// expect：填完以后这些参数应该是什么值（单位与"可填的参数"一致：金额万、月薪=每月到手 元/月；说税前或没说口径的按到手≈税前×80%换算）
// forbid：这些参数不应该被改动；events/moves 只核对列出的字段
const EVAL_CASES = [
  { id: 1, cat: '基础抽取', tag: '城市+年龄+月薪', text: '我28岁，在杭州工作，税前月薪2万。', expect: { city: 'hz', startAge: 28, 'me.salary': 16000 } },
  { id: 2, cat: '单位换算', tag: '年薪换算', text: '今年30，北京，年薪36万，每年发14个月。', expect: { city: 'bj', startAge: 30, 'me.months': 14, 'me.salary': 20571 } },
  { id: 3, cat: '基础抽取', tag: '夫妻收入', text: '我和老婆都在深圳，我月薪3万，她2万，我们都32岁。', expect: { city: 'sz', startAge: 32, 'me.salary': 24000, 'sp.salary': 16000, 'sp.age': 32 } },
  { id: 4, cat: '列表映射', tag: '单身租房', text: '单身，不打算结婚，一直租房，成都，26岁。', expect: { family: 'single', housing: 'rent', city: 'cd', startAge: 26 } },
  { id: 5, cat: '基础抽取', tag: '已有房贷', text: '已经有房了，每个月还8000房贷，还剩20年。', expect: { housing: 'own', ownMortgage: 8000, ownLoanYears: 20 } },
  { id: 6, cat: '单位换算', tag: '家庭支持', text: '父母能给我们150万首付。', expect: { support: 150 } },
  { id: 7, cat: '单位换算', tag: '存款', text: '现在存款大概40万。', expect: { savings: 40 } },
  { id: 8, cat: '列表映射', tag: '孩子+教育路线', text: '想要两个孩子，走国际高中然后去英国读本科。', expect: { family: 'kid', kids: 2, route: 'intl' } },
  { id: 9, cat: '基础抽取', tag: '提前退休', text: '打算55岁就不工作了。', expect: { retireAge: 55 } },
  { id: 10, cat: '相对时间', tag: '相对时间', text: '我们计划明年结婚，后年生孩子。', expect: { marriageAge: 28, birthAge: 29 } },
  { id: 11, cat: '复合事件', tag: '搬家回老家', text: '35岁准备搬回武汉老家，把上海的房子卖了，回去住父母的房子。', expect: { moves: [{ age: 35, city: 'wh', sell: true, home: 'own' }] } },
  { id: 12, cat: '复合事件', tag: '停工读书', text: '40岁左右想停工两年去读个MBA，学费一年20万。', expect: { events: [{ age: 40, type: 'gap', years: 2 }, { age: 40, type: 'study', amount: 20, years: 2 }] } },
  { id: 13, cat: '基础抽取', tag: '父母年龄', text: '爸妈现在60岁了。', expect: { parAge: 60 } },
  { id: 14, cat: '单位换算', tag: '投资比例', text: '存款一半拿去买指数基金。', expect: { stockPct: 50 } },
  { id: 15, cat: '基础抽取', tag: '房价预期', text: '我觉得房价以后每年会跌2%。', expect: { houseGrowth: -2 } },
  { id: 16, cat: '单位换算', tag: '到手直接填', text: '我到手每个月1.5万。', expect: { 'me.salary': 15000 } },
  { id: 17, cat: '列表映射', tag: '面积+区位', text: '想买个100平的房子，在外环外面。', expect: { area: 100, locFactor: 70 } },
  { id: 18, cat: '单位换算', tag: '买车', text: '买车预算30万。', expect: { carPrice: 30 } },
  { id: 19, cat: '相对时间', tag: '配偶相对年龄', text: '我女朋友比我大两岁，她月薪1.8万。', expect: { 'sp.age': 29, 'sp.salary': 14400 } },
  { id: 20, cat: '列表映射', tag: '城市+教育档', text: '我在苏州，孩子走公办读国内本科就行，兴趣班少报点。', expect: { city: 'suz', route: 'basic' } },
  { id: 21, cat: '基础抽取', tag: '退休开销', text: '退休后每个月打算花8000。', expect: { retireSpend: 8000 } },
  { id: 22, cat: '列表映射', tag: '列表外城市', text: '我在一个三线小城市，月薪8000。', expect: { city: 'other', 'me.salary': 6400 } },
  { id: 23, cat: '基础抽取', tag: '中年+养老金年龄', text: '我45岁了，打算工作到65岁，63岁领养老金。', expect: { startAge: 45, retireAge: 65, pensionAge: 63 } },
  { id: 24, cat: '复合事件', tag: '副业', text: '从现在起副业每个月能多赚3000，大概能做5年。', expect: { events: [{ age: 27, type: 'side', amount: 3000, years: 5 }] } },
  { id: 25, cat: '复合事件', tag: '继承', text: '50岁左右能继承一套房，大概值200万。', expect: { events: [{ age: 50, type: 'income', amount: 200 }] } },
  { id: 26, cat: '单位换算', tag: '婚礼', text: '婚礼大概花20万。', expect: { wedding: 20 } },
  { id: 27, cat: '面板细项', tag: '面板细项：养老金', text: '我的国家养老金一个月可以发1w', expect: { pension: 10000 } },
  { id: 28, cat: '单位换算', tag: '收入占比', text: '我收入占家里七成。', expect: { split: 70 } },
  { id: 29, cat: '基础抽取', tag: '规划终点', text: '账算到90岁就行。', expect: { endAge: 90 } },
  { id: 30, cat: '综合多项', tag: '综合', text: '我和老公在广州，他月薪4万我月薪1万，家里给了80万，准备明年买房。', expect: { city: 'gz', 'me.salary': 8000, 'sp.salary': 32000, support: 80, buyAge: 28 } },
  { id: 31, cat: '含糊需追问', tag: '范围说法（该追问）', text: '家里大概能支援几十万首付。', expect: {}, forbid: ['support'], ask: true },
  { id: 32, cat: '含糊需追问', tag: '范围说法（两万多，该追问）', text: '我在上海，一个月挣两万多。', expect: { city: 'sh' }, ask: true },
];
// 错误类别对应的对策（评测报告里按类别汇总后给出）
const EVAL_FIXES = {
  基础抽取: '字段说明写清口径和单位；白名单和范围校验兜底。',
  单位换算: '规则里写明换算方法（年薪 ÷ 发薪月数、"七成"= 70%）；数值越界时护栏拦下。',
  相对时间: '把"今年年龄"放进提示词，要求"明年/后年/比我大两岁"换算成具体岁数。',
  列表映射: '列出可选值；常见说法（外环外、三线城市）补进说明；只接受列表里的值。',
  复合事件: '给出搬家、人生大事的结构示例；缺字段（如年龄）的条目丢弃并提示。',
  含糊需追问: '含糊时进 questions 追问，不猜；税前按比例换成到手并写进 assumptions。',
  面板细项: '白名单从参数面板自动生成，页面能改的 AI 都能改。',
  综合多项: '一句话多项信息时逐项核对；结果以"原值→新值"列出，用户可撤销。',
};
if (typeof module !== 'undefined') module.exports = { EVAL_CASES, EVAL_FIXES };
