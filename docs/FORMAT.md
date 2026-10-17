# vc-memory — Markdown vault format

**Status (2026-10-18):** project entries, the industry two-level view-board structure, digests and
the change log are implemented (restart Harness to activate). Legacy flat industry files remain
readable and are shown read-only under "旧格式行业条目（待迁移）". See `EXAMPLE.md` for virtual
examples.

Everything lives in **one plain folder** (`vaultDir`). OneDrive, iCloud Drive, Dropbox or a Git
repository can sync that folder between machines; the plugin keeps no database and no hidden
state, so a file edited by hand or on another device is picked up on the next scan.

```
VC-Memory/
├── README.md
├── 日志.md
├── 项目/                      project decision records
│   └── aurora-ai.md
├── 行业/                      industry view boards, two levels
│   ├── 机器人/
│   │   ├── _主题.md           theme board: scope + cross-sector views + index
│   │   ├── 仓储机器人.md       sub-sector view board
│   │   └── 人形机器人.md
│   └── AI-Infra/
│       ├── _主题.md
│       └── 推理芯片.md
└── 简报/
    └── 2026-W42.md
```

Two memory objects, on purpose:

| | `项目/` | `行业/<主题>/` |
| --- | --- | --- |
| What | 决策记录：投/不投、轮次、估值、条款、关键假设、复盘 | 当前观点板：主题级 + 细分赛道级 |
| Shape | 一篇完整条目，六个正文小节 | 主题板 `_主题.md` + 每个细分赛道一个文件 |
| Time | 按复盘周期（`next_review`）提醒 | 事件驱动修正；不设下次复盘日期 |
| History | `## 复盘记录` 只追加 | 观点原地更新；旧→新记入 `日志.md`，完整旧文靠版本历史 |

## 项目条目 (project entry)

Markdown with YAML frontmatter. Frontmatter values the plugin writes are simple scalars or
JSON-style inline arrays — readable in Obsidian, Typora, VS Code and GitHub.

```markdown
---
id: 项目/aurora-ai
type: project
name: Aurora AI
aliases: ["Aurora"]
sector: AI Infra
stage: A 轮
verdict: 看好
confidence: 4
tags: ["推理", "国产替代"]
links: []
created: 2026-10-01
updated: 2026-10-17
last_reviewed: 2026-10-17
review_cycle_days: 30
next_review: 2026-11-16
example: false
---

# Aurora AI

## 一句话判断
国产推理芯片里少有的软硬协同团队，A 轮进入可接受，关键看 Q4 流片与两家云厂商的适配。

## 判断依据
…

## 关键假设
- [ ] 2027 年 Q1 前完成 7nm 流片并点亮
- [ ] 至少一家头部云厂商完成适配验收

## 风险与反证
…

## 证据与时间线
- 2026-10-17 · 与 CTO 交流，流片节点确认在 2027 年 1 月

## 复盘记录
### 2026-10-17 · 复盘
- 结论：本轮进展符合判断
- 进展/证据：…
- 判断偏差：…
- 更新判断：看好（置信度 4）
- 下次复盘：2026-11-16
```

### Frontmatter fields (project entries)

| key | required | notes |
| --- | --- | --- |
| `id` | written by plugin | `项目/<slug>` — stable identity |
| `type` | yes | `project` |
| `name` | yes | display name; becomes the file name when created |
| `aliases` | no | other names the company is called |
| `sector` | no | sector / 细分方向 |
| `stage` | no | 轮次 |
| `verdict` | no | 看好 / 观望 / 回避 / 已投 / 已退出 |
| `confidence` | no | 1–5 |
| `tags` | no | free-form tags |
| `links` | no | source URLs |
| `created` / `updated` | plugin | `YYYY-MM-DD` |
| `last_reviewed` | plugin | `YYYY-MM-DD` |
| `review_cycle_days` | plugin | default from config |
| `next_review` | plugin | `last_reviewed + review_cycle_days` unless set explicitly |
| `example` | plugin | `true` for bundled samples |

### Body section order (project entries)

The plugin writes and refreshes these second-level headings in order; it preserves anything else
you add:

1. `## 一句话判断`
2. `## 判断依据`
3. `## 关键假设`
4. `## 风险与反证`
5. `## 证据与时间线`
6. `## 复盘记录`

`## 复盘记录` is append-only. Each review block starts with `### YYYY-MM-DD · 复盘`.

## 行业结构 (industry structure)

Two levels, both real directories/files — not tags:

* **主题（theme）** = directory + `_主题.md`.
* **细分赛道（sub-sector）** = one Markdown file inside that directory.

```
行业/机器人/_主题.md
行业/机器人/仓储机器人.md
```

IDs: `行业/机器人/_主题`, `行业/机器人/仓储机器人`, and a single view is
`行业/机器人/仓储机器人#仓储-001`. Project entries may link to a view by that full id.

### 主题板 (`_主题.md`)

A theme board is **not** a theme-level verdict. It contains only:

1. a scope sentence (what is in / out of this theme);
2. an index of its sub-sector boards (counts, statuses, last update);
3. cross-sector views that apply to ≥2 sub-sectors.

```markdown
---
type: theme
name: 机器人
updated: 2026-10-18
---

# 机器人 · 主题

> 范围：工业 / 仓储 / 人形机器人整机与核心部件；不含纯软件与上游通用芯片。
> 下级细分赛道：
> - 仓储机器人（5 条观点 · 2 条待验证）
> - 人形机器人（3 条观点 · 1 条被削弱）
> 跨赛道主线：专用形态会先于通用人形跑通 ROI；本体降价先压缩集成商毛利。

## 2026-10-17 · 专用形态会先于通用人形跑通 ROI
`#机器人-001` · **有效** · 关联：行业/机器人/仓储机器人#仓储-001
- 依据：仓储/分拣有明确节拍与验收标准，通用人形仍在找场景
- 反证：若通用人形的数据闭环成本快速下降，专用形态的窗口会缩短
```

If the theme has no cross-sector view yet, the board is just the scope + index (still worth having:
it makes the directory tree and the "which theme does this belong to?" question explicit).

### 细分赛道板 (`行业/<主题>/<赛道>.md`)

Minimal frontmatter + a current view board:

```markdown
---
type: industry
name: 仓储机器人
sector: 机器人 / 仓储自动化
updated: 2026-10-17
---

# 仓储机器人 · 行业观点

> 最后更新：2026-10-17 23:29｜有效 1 · 待验证 1 · 被削弱 1 · 已证伪 1
> 当前主线：
> 1. 仓储会先于通用人形跑通单工位 ROI（2027–2028）
> 2. 现场交付能力比本体价格更决定渗透速度

## 2026-10-17 · 仓储会先于通用人形跑通单工位 ROI，时间点在 2027–2028
`#仓储-001` · **有效** · 关联：项目/aurora-ai
- 依据：客户按单班次效率、可用率算账；3 个 POC 中 2 个进入复购谈判
- 反证：夜班稳定性仍是硬约束

## 已归档观点（保留教训，不再作为当前判断）
- `#仓储-000` · 已取代 · 2026-09-01：“人形机器人会直接替代仓储专用设备。”
  → 过度外推，已并入 #仓储-001。
```

Rules:

* The heading is **last revision date + current conclusion**; the current conclusion is always the
  most prominent text. The date is not the creation date.
* Each view has a stable id (`#<sector-short>-<n>`); status is one of
  `有效 / 待验证 / 被削弱 / 已证伪`. Superseded or no-longer-current views move to
  `## 已归档观点` (one line each).
* Only `依据 / 反证 / 关联` are required. No `verdict`, `confidence`, `stage`, `next_review`, or
  review cycle for industry views.
* Revisions are edited **in place**: update the date, conclusion, status, and evidence. The old→new
  summary goes to `日志.md`; the full old wording is preserved by OneDrive/Git version history.
* Sort views by status priority (有效 / 待验证 / 被削弱 / 已证伪) and then by date descending;
  keep the archived section at the bottom.
* The top `当前主线` bullets are a 3–5 line summary of the most important current views.

## 创建与维护规则 (creation and maintenance)

**Who creates what**

| Action | Who starts it | Confirmation | Notes |
| --- | --- | --- | --- |
| 新建主题 | user, or model proposal | **user must confirm** | model never invents a theme silently |
| 新建细分赛道 | user, or model proposal | **user must confirm**, except an explicit "记一下这个行业" instruction | explicit instruction may create at most one theme + one sub-sector, with scope + initial view + log |
| 新增/修正观点 | model may propose | one-step confirmation (or direct write when the user explicitly asked to record) | daily operation, not a structure change |
| 归类到已有板 | model | automatic if it fits the scope | unclear → put in the theme board and mark `待分流`, or ask |
| 拆分/合并板 | model proposes in digest/review | **user must confirm** | move views, log the migration, archive the old board |
| 归档观点/板 | user, or model proposal | **user must confirm** | never delete; move to `已归档` |

**When to create a theme**

* two or more sub-sectors exist and need a home for cross-sector views; or
* a cross-sector view cannot fit any existing sub-sector; or
* the user explicitly asks to track this direction.

Keep themes few (3–8). A theme with only one sub-sector forever should be merged back or demoted.

**When to create a sub-sector**

All five tests: comparable customer/competitor set, reusable evidence, different investment
decision, falsifiable view, reusable across ≥2 projects. Plus at least:

1. a scope sentence (what is in / out);
2. 3+ comparable companies (or an explicit watch list);
3. one falsifiable initial view.

If it only serves one company, it is project memory. If it does not pass the tests, put the view in
the nearest theme board and mark it `待分流` until there is enough evidence to split.

**Split / merge signals**

* Split: >20 comparable companies, >15 active views, or evidence/customers clearly form two clusters.
* Merge: two boards share ~80% of evidence and move together.
* Move views between boards and log `迁移观点：A → B（原因）`; archive the old view/board rather than
  deleting it.

## 简报 (digest file)

`简报/` holds **derived reports, not memory entries**:

* `简报/2026-W42.md` (week) or `简报/2026-10.md` (month) is generated from `项目/` and `行业/`
  by the panel button, the `vc_memory(digest)` action, or the optional timer.
* Responsible for: a readable snapshot of what changed in the period — new project entries,
  project reviews, overdue project reviews, industry view changes grouped by theme (new / revised /
  weakened / falsified), stale `待验证` views, proposed split/merge actions, and the questions that
  should be answered next.
* NOT responsible for: storing new judgements, being recalled as evidence, or replacing a project or
  industry file. The entry folders are the only source of truth; the digest is read-only input to
  them. Hand edits are possible but will be overwritten on the next generation — conclusions belong
  in the project's `复盘记录` or the industry view board.
* The same period is regenerated into the same file, so it is safe to delete and rebuild.

## 变更日志 (`日志.md`)

Append-only, one line per write operation; the plugin writes it and never reads it back except for
the last lines in `/state`.

```markdown
- 2026-10-18 00:20 · 新建主题 · 行业/机器人/_主题 · 范围：工业/仓储/人形机器人整机与核心部件
- 2026-10-18 00:21 · 新建细分赛道 · 行业/机器人/仓储机器人 · 范围：移动机器人整机与拣选方案
- 2026-10-18 00:25 · 新建观点 · 行业/机器人/仓储机器人#仓储-001 · 仓储先于通用人形跑通 ROI（待验证）
- 2026-10-18 00:30 · 修正观点 · 行业/机器人/仓储机器人#仓储-001 · "2027 前"→"2027–2028"（夜班稳定性约束）
- 2026-10-18 00:35 · 迁移观点 · 行业/机器人/仓储机器人#仓储-002 → 行业/机器人/_主题#机器人-003 · 跨赛道
- 2026-10-18 00:40 · 简报 · 简报/2026-W42.md · 新增观点 2 / 项目复盘 1 / 到期 1
```

Actions: project `新建 / 更新 / 复盘 / 简报 / 同步 / 示例`; industry structure
`新建主题 / 新建细分赛道 / 拆分 / 合并 / 迁移观点 / 归档观点`; industry views
`新建观点 / 修正观点 / 削弱观点 / 证伪观点`. The log is the **event-level** trail and the only
place for old→new view wording; `简报` is the **periodic summary**. Truncating the log is safe.

## Compatibility promises

* Hand edits are safe: the plugin reparses each file on scan. Project entries keep unknown
  frontmatter keys and unknown body sections; industry boards are treated as the current board.
* File names may contain Chinese; project id = vault-relative path without `.md`; industry view id =
  `行业/<主题>/<赛道>#<view-id>`.
* Because industry views are edited in place, full prior wording lives in the change log summary and
  in OneDrive/Git version history, not in the board itself.
* If two devices edit the same file, the cloud folder / Git decides (`last write wins`); the project
  review log is append-only so conflicts stay rare.
