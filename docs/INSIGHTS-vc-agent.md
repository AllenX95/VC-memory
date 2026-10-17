# 从 vc-agent 的记忆设计中能学到什么（`@local/vc-memory` v2 设计输入）

> 来源：`E:\claude-projects\vc-agent\docs`（115 个文件，2026-07-06 → 2026-08-15）。
> 已通读/摘录其中约 30 篇与「记忆 / 反思 / 复盘 / Dream / recall」相关的核心文档；解析、OCR、Office、Skills、Sub-Agent、打包等文档与本插件无关。
> 结论先行：**帮助很大，但要「抄原则、不抄机器」。** 他们花了两代设计才收敛：07-06 的 Dream + Reflection，到 08-11 的 CognitionReviewModule + Learning Epoch 重置。我们 v1 目前大致相当于他们明确批评的「模型判断后直接写记忆」阶段，缺 4 个关键件：**写入门控、先独立后对照的复盘、去标识的跨项目原则层、可追溯的版本演进**。

## 1. 相关文档地图

| 主题 | 文档 |
| --- | --- |
| 总设计（Project/Long-term Memory、recall、evolution、Dream） | `superpowers/specs/2026-07-06-vc-desktop-agent-design.md` §Project Memory（约 L1110–1150）/ §Long-Term Memory（L1198–1283）/ §Dream（L1371–1525） |
| 最终收敛的评审模块 | `superpowers/specs/2026-08-11-cognition-review-redesign-spec.md`；ADR-0064、ADR-0065 |
| 两阶段上下文隔离 | ADR-0010、ADR-0011；07-06 §Staged Context Isolation |
| 记忆可挑战 / 保留人机分歧 | ADR-0010、ADR-0020；07-06 L1340 |
| 版本化演进 | ADR-0013、ADR-0014；07-06 §Long-Term Memory Evolution |
| Dream / 候选 / 截止线 / 覆盖 | ADR-0003、0029、0031、0032；08-11 §8 Strict Coverage |
| 写入必须用户确认 | ADR-0025、ADR-0042；08-11 §10、§12 |
| 去标识的跨项目长期记忆 | ADR-0053 |
| 调研：coding agent 的 reflection / dream 机制 | `research/coding-agent-reflection-mechanisms.md`（Gemini CLI / MiMo / Copilot / Claude Code / Cursor / Devin 对比） |
| DSH / Pi 架构参考 | `research/deepseek-harness-notes.md`、`deepseek-harness-product-architecture-html-brief.md`、`deepseek-harness-vs-pi-agent-core.md` |

## 2. 他们的最终架构（摘要）

```text
原始轨迹（session log，唯一文本权威）
   │  捕获：显式"记住"、用户纠正、确认的判断、重复出现的偏好/方法
   ▼
候选 / 提案（尚未生效；Review Bundle）
   │  用户逐项 Adopt / Defer / Reject + patch 预览 + 显式 commit
   ▼
活跃记忆：Project Memory（项目内） + Long-term Memory（跨项目、去标识）
   │  Add / Reinforce / Narrow / Revise / Contradict
   ▼
历史：Cognitive Evolution History（永久） / Condensation Archive（默认 90 天）
```

- **Project Memory**：只写用户确认过的项目判断、纠正、决定；普通 agent 输出、材料、OCR、网页不得直接写入。
- **Long-term Memory**：最高具体度只到「行业 / 融资阶段 / 可类比的跨项目情境」；公司名、未公开指标、交易条款、材料原文留在项目层（ADR-0053）。`Recall: automatic | explicit-only` 控制召回。
- **演进动作**：`Add / Reinforce / Narrow / Revise / Contradict`。`Revise` 必须有用户明确纠正或用户确认的复盘结论；否则只能 `Contradict`，保留「Unresolved Memory Conflict」，两派一起召回。`Narrow/Revise` 必须保留旧版本与当时的理由。
- **候选生成 ≠ 学习**：reflection / dream 只产出候选和 patch 预览；活跃记忆只在用户确认后**原子提交**（ADR-0025、0064；调研原则 A）。
- **两阶段反思**：先做**不含个人记忆的独立证据评估**（结论/置信度/理由/反证/最可能改变判断的问题），再进入带记忆的批判性对话；第一阶段原文、推理不进第二阶段，防止记忆锚定（ADR-0011）。
- **批判性立场**：记忆是「用户过去怎么想」的证据，不是事实、不是指令，可以被挑战；但反对必须有证据/推理，不能为反而反（ADR-0010）。
- **两道门控**：写入门控（证据是否足够/是否用户信号）+ 召回门控（当前是否相关、来源是否仍成立）。不做复杂综合评分（调研原则 C）。
- **成本控制**：确定性资格（闲置时长、消息数、已处理水位、锁），不调用每轮分类器（ADR-0032）。
- **召回**：常驻上下文只放小索引（id / 一句话 / 作用域 / 适用性 / 新鲜度 / 冲突标记），正文按需展开；召回时区分「用户确认的判断」与「来源事实」；冲突两派同时出现。

## 3. 他们踩过 / 明确否定的坑

1. **12 条上下文截断造成覆盖漏洞**：v1 Dream 每 scope 最多 12 条，cutoff 可以越过从未检查的源。最后只能重构并删除旧代码。→ 我们做批次记录时也不要用「固定条数」截断；用字节/条数双预算 + 显式 carried-over。
2. **自动直写 / 静默改写记忆**：他们最终要求所有持久认知变更走「提案 → 用户确认 → 原子提交」。
3. **每轮记忆分类器**：token/延迟代价高，改为确定性捕获 + 同轮信号 + 事后补漏。
4. **一次对话里塞完整轨迹/记忆正文**：常驻只放索引，正文按需。
5. **把 compaction / rules / skill / personalization 混成一种产物**：边界不清会让召回、审批、失效规则复杂化。
6. **用「最新 / 最多 / 语气最强」解决冲突**：明确禁止；只能 `Contradict` 保留冲突。
7. **启动即自动续跑 / 自动模型调用**：只允许模型无关的 due check；需要用户显式恢复。
8. **把 checkbox 当验收**：他们的实现里计划全部打勾，但覆盖不变量仍有漏洞。→ 不变量必须有测试。

## 4. 我们 v1 与他们的差距

| 维度 | vc-memory v1 现状 | 他们的结论 | 差距 |
| --- | --- | --- | --- |
| 写入 | 模型判断后可直接 `upsert` 持久化 | 持久记忆变更必须用户确认；模型只能提议 | **高（最该先补）** |
| 复盘 | `review` 一次写结论 | 先独立证据 → 再对照记忆 → 确认后写 | 高 |
| 记忆分层 | 项目 / 行业两类，混着事实与原则 | Project Memory vs 去标识 Long-term Memory | 高 |
| 演进 | 覆盖式更新 + 追加复盘 | 五类动作 + 版本血缘 + 冲突保留 | 中高 |
| 外部编辑 | 承诺 last-write-wins | 检测变更、拒绝静默覆盖、标记 stale | **高（会丢数据）** |
| 召回 | 工具按需 read/search，提示词只给计数/近期摘要 | 同样按需 + 召回时验证 + 冲突同现 + explicit-only | 中 |
| 证据 | 有证据时间线，但事实/推断/假设未区分 | 无证据闸门，但必须标注 fact vs inference vs hypothesis | 中 |
| 定期触发 | 插件内 `setInterval`（进程退出即停，无补跑记录） | 用调度服务做持久提醒；提醒不自动改记忆 | 中 |
| 新鲜度 | `last_reviewed` / `next_review` | 另有 `as_of` / 失效键 / 召回时验证 | 中 |
| 人机分歧 | 复盘有「判断偏差」 | 保留模型独立判断与用户判断的分歧直到解决 | 中 |
| 覆盖 | digest 只汇总有变化的内容 | 批次必须对每个到期项给出处置（含 no_signal） | 中 |

## 5. v2 建议（按优先级）

### P0：先补「可信」，否则记忆越多越危险

1. **写入候选化（写入门控）**
   - 工具新增 `propose`（模型只能提议）与 `confirm` / `discard`；`upsert` 只在用户明确要求时直写。
   - 落盘仍是 Markdown：`待确认/YYYY-MM-DD-<slug>.md`（frontmatter：来源、作用域、建议动作、置信度、证据引用、`status: proposed`）。
   - 面板加「待确认 / 已采纳 / 历史」三视图；提示词改为「可以提议，但不要静默写入」。
   - DSH：Host 已有 Markdown 写入逻辑，新增目录 + 动作 + 面板 tab。工作量 M。

2. **加一层「认知原则」`原则/`（去标识的跨项目学习）**
   - 只放行业/阶段/情境级原则，例如「早期硬科技 memo 中保守处理 TAM」；公司名、交易条款不进。
   - frontmatter：`maturity`（tentative / repeated / retrospective / user-authored）、`applies_to`、`limitations`、`recall: auto|explicit-only`、`source_refs`、`as_of`、`valid_until`、`supersedes`、`conflict_with`。
   - `search` 覆盖项目/行业/原则；提示词只注入原则的短索引。
   - 工作量 M；这是「Dream 综合」真正的产物。

3. **复盘升级：先独立、再对照、再确认**
   - 表单拆成：独立评估（证据 / 反例 / 最可能改变判断的问题）→ 对照记忆中的关键假设 → 结论 / 偏差 / 更新判断 / 下次复盘。
   - 保留「模型独立判断 vs 我的判断」分歧字段；未解决标 `disagreement: open`。
   - 提示词加 Critical Reflection Stance 与证据纪律：记忆是历史观点，不是事实；区分 fact / inference / hypothesis；不因「最新/最多」改判。
   - 工作量 S–M（主要是 prompt 与表单，逻辑已有）。

4. **外部编辑 / 多设备并发保护**
   - 写入前比较 `updated` 或内容哈希；不一致返回 `stale`，不静默覆盖；检测 OneDrive 冲突副本并提示。
   - 手改文件优先：解析失败只警告、不重写、不进入提示词。
   - 当前 `FORMAT.md` 写的 last-write-wins 要改成「检测到变化则拒绝写，由用户决定」。
   - 工作量 S–M；这是会直接丢数据的坑。

5. **召回时验证与新鲜度**
   - `search` / `read` 返回 `as_of`、`last_reviewed`、「可能过期」标记；面板给 stale 徽标。
   - 到期未复盘的不作为当前结论引用；`行业/` 判断要求 `valid_until` 或下次复核。
   - 工作量 S。

### P1：形成闭环

6. **Dream / Consolidation（提案式）**：新增 `consolidate` 动作，扫描近期更新+复盘+简报，产出 `待确认/dream-YYYY-MM-DD.md`：去重、合并、Narrow/Revise/Contradict、把项目内学习提升为原则（去标识）。绝不直接改写活跃记忆。
7. **复盘批次记录（Markdown 版 Coverage Ledger）**：每次复盘生成 `简报/复盘-YYYY-MM-DD.md`，对每个到期项记录 `reviewed / updated / no_signal / deferred / carried_over`；不要求模型必须产出变化。
8. **持久定时提醒**：用 DSH `schedule` 服务创建「到期复盘 / 每周 dream」提醒（可唤醒 agent），而不是只靠插件 `setInterval`；提醒不自动写记忆，遗漏周可补发。
9. **召回反馈日志**：记录「被召回且有用 / 无效 / 从未召回」，支撑清理，而不是只看生成数量。
10. **冲突保留与并排展示**：`conflict_with` 两派一起召回、一起显示；不允许自动选赢家。
11. **只读模式**：`readOnly: true` 暂停写入与候选生成，保留检索与查看。

### P2：规模化后再做

- 多 vault / 项目作用域（对应他们的 Project 隔离）；`explicit-only` 召回已预留。
- 假设追踪：关键假设升级为可逐条复盘、可被证据关闭。
- 从记忆直接生成 IC memo / 复盘报告模板。
- 语义检索（embedding）——他们明确放到 first release 之外，我们也不急。
- 与 session 历史联动（"上次我们讨论了什么"）：DSH 有 session 查询能力，但插件目前拿不到 session 上下文，需要评估。

## 6. 可直接采用的字段与命名

已存在：`verdict`、`confidence`、`last_reviewed`、`next_review`、`review_cycle_days`。

建议新增（照抄他们的语义，不抄存储）：

```yaml
status: current | superseded | conflict      # 当前/已被取代/存在未解冲突
scope: project | global                      # 项目判断 / 跨项目原则
maturity: tentative | repeated | retrospective | user-authored
applies_to: "早期硬科技 / A 轮 / IC memo"
limitations: "样本仅来自 3 个项目"
recall: automatic | explicit-only
source_kind: user | link | document | inference
source_refs: ["项目/xxx", "https://…"]
as_of: 2026-10-17
valid_until: 2027-01-17
supersedes / superseded_by: 项目/...
conflict_with: 行业/...
disagreement: open | resolved
```

评审状态命名（若做 inbox）：`pending | no_signal | represented | carried_over`；决策：`adopt | defer | reject`。判断结论可以增加一个合法值：「证据不足，暂不判断」。

## 7. 不该照搬的部分

- **SQLite 状态、Coverage Ledger 的机器、extraction chunk、五文件原子事务、依赖哈希、Learning Epoch 重置**：那是多项目 + 多 Provider + 强审计的产品；个人 Markdown 单文件夹不需要，Git/OneDrive 版本 + `updated` 字段即可。
- **两阶段物理隔离的模型调用**：DSH 插件不掌控模型调用编排；用提示词协议实现「先独立列证据、再对照记忆」的轻量版即可。
- **每轮记忆分类器 / 自动 dream 直接改记忆**：成本与风险都高，他们明确否定。
- **把 reflection、compaction、rules、skill 混成一种产物**：四种产物边界要清晰。
- **自动 resume 未完成的反思**：中断就停在候选状态，等用户重新发起。
- **Personal Cognition Backup 的校验清单**：OneDrive/Git 已覆盖，不需要再做 manifest。

## 8. DSH 侧需要先验证的实现假设

- **提示词段落的可审计性**：动态 `systemPrompt.section({ text: () => … })` 的内容是否随 session log 可复现（DSH 原则要求「模型看到的内容必须能从日志重建」）。若不满足，v2 应改为「静态规则段 + 小索引变量/context」，并考虑快照。
- **提示词常驻预算**：当前段落含到期列表和最近条目，每一步都计费且会扰动缓存前缀；建议降为一行索引 + 计数变量（`ctx.systemPrompt.variable()`）。
- **调度服务语义**：`schedule.create(sessionId, …)` 绑定会话、可唤醒 agent；插件内 `setInterval` 在进程退出后不补跑。v2 优先用 `schedule`，插件 timer 只做兜底。
- **侧边栏角标**：`sidebar.panellist` 是图标入口；「7 条到期」这类角标要确认是否有 `sidebar.session.row.*` 之外的全局角标 slot（或用 label 变体）。
- **面板内确认**：DSH 的 approval 需要打开的 turn，不能用于离线批次；因此候选确认必须落在面板队列，而不是后台审批弹窗。
- **市场已有通用记忆插件**（如 `dsh-memory`、`dsh-engram` 等）：我们的差异化不是「记忆」本身，而是 VC 判断 schema（verdict / 假设 / 风险 / 复盘周期 / 简报 / 原则层），不要把通用功能当护城河。

## 9. 建议的两个迭代

**v1.1（1–2 天）**：P0-3 复盘升级 + P0-4 外部编辑保护 + P0-5 新鲜度 + 提示词预算压缩 + 字段扩展（status/scope/maturity/recall/source_kind）。
**v1.2（3–5 天）**：P0-1 候选 inbox（Host + 工具 + 面板 tab）+ P0-2 原则层 + P1-6 dream 提案 + P1-7 复盘批次记录 + P1-8 schedule 提醒。
**v2（更远）**：召回反馈统计、会话历史联动、假设追踪、IC memo 生成；embedding 暂缓。

## 10. 一句话

他们两代设计最值钱的三条，正好补我们最薄的三块：**写入要过用户、反思先独立、原则要去标识。** 再加上一条我们已有的优势——纯 Markdown、无数据库、云端文件夹同步——这套东西会从「会写 Markdown 的记忆本」变成「可审计、可演进、不会自我强化偏见的投资认知系统」。
