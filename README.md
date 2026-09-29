# 一生账本

把一辈子的钱摊开：按现在的收入，看能过什么样的生活；或按想过的生活，算每年要赚多少。每个数都能在页面里核对。

- **在线体验**：https://life-ledger-fancyai-d7gh9blu34e2ce05d.webapps.tcloudbase.com/
- **本地打开**：`dist/index.html`（单文件，无需服务器，数据只存在浏览器里）
- **项目文档**：需求、计算规则、数据字典、AI 设计与评测、验收结果（见作品集链接）

## 功能

- 收入直接填每月到手，不模拟个税、社保、公积金（少一层会被质疑的计算）
- 15 个城市的房价、租金、消费、社保基数自动填入，并标注来源
- 逐年现金流：日常、住房与贷款、孩子（教育 5 档）、父母照护、养老
- 中途换城市、人生大事（停工、转行、继承、装修、副业）、房产与净资产、投资
- 三种情况：顺利（收入高 20%）、一般、不顺（收入低 20%、失业一年、一笔 20 万意外），没有随机数，都能手算复现
- 假设清单：25 条左右假设逐条标依据和年份，按对结论的影响排序，可一键跳去修改或反馈"这条不对"
- 核对计算页：页面自检、公式代入你的数、任意一年逐项验算、下载明细
- AI 帮我填（支持语音）与问问这份账本：AI 只负责听懂和解释，数字全部由计算器算
- AI 服务两种：在 Claude 里打开时自动用 Claude；单独部署时用你自己的 DeepSeek API Key

## 目录

```
src/page.html   页面结构        src/model.js   计算模型（纯函数，可在 Node 里单测）
src/style.css   样式            src/app.js     界面与 AI 功能
src/data.js     城市与教育数据  src/evalcases.js  AI 填表评测集（32 条，含错误类别与对策）
src/build.py    打包成单文件    tests/         回归测试与随机测试
proxy/cloudflare-worker.js      可选的 DeepSeek 转发（解决浏览器跨域）
```

## 构建与测试

```bash
cd src && python3 build.py          # 生成 index.html（自托管版）和 life-ledger.html
node tests/regress.js               # 89 项验收用例
node tests/fuzz.js                  # 3000 组随机参数
```

## 部署到 GitHub Pages

1. 新建仓库，把本目录推上去（`dist/index.html` 是完整页面）。
2. 仓库 Settings → Pages → Source 选 `main` 分支、`/dist` 目录（或把 `dist/index.html` 放到根目录）。
3. 几分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

GitHub Pages 在中国大陆访问时快时慢；只是放作品集、给面试官看，一般够用。

## 反馈与开发者模式

- 假设清单里的"这条不对？"默认把反馈复制到剪贴板。同时会打开本仓库预填好的 Issue（地址在 `src/app.js` 的 `FEEDBACK_URL`，fork 后改成你自己的仓库）。
- AI 填表评测不对普通用户显示。网址末尾加 `#dev` 才出现，用于开发时跑对照评测。

## 用 DeepSeek 作为 AI 服务

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com) 注册、充值，创建 API Key。
2. 打开页面 → "AI 帮我填" → "去设置"，填入 Key，选模型（deepseek-flash 快且便宜；deepseek-v4-pro 更强），点"保存并测试"。
3. 如果提示网络错误（浏览器跨域被拦），部署 `proxy/cloudflare-worker.js`，把"接口地址"改成你的 Worker 地址。

**Key 的安全：**

- **绝对不要把 API Key 写进代码或提交到仓库。** 公开仓库里的 Key 几分钟内就会被扫走盗刷。
- 页面只把 Key 存在当前浏览器的 localStorage 里，每个访问者用自己的 Key、自己付费；"清除"按钮可删掉。
- 不建议在公共电脑上保存 Key。

## 说明

仅供个人规划参考，不构成投资、税务或法律建议。代码在 AI 编程助手辅助下完成；需求定义、方案取舍、数据核对与验收由作者负责。
