# VC-memory — investment judgement memory for DeepSeek Harness

> Source: https://github.com/AllenX95/VC-memory

`@local/vc-memory` (投资记忆) keeps a VC investor's project and industry judgements as plain Markdown in one vault folder. Projects are one decision record each (verdict, assumptions, risks, review log); industries are **two-level view boards** — a theme board `行业/<theme>/_主题.md` (scope, cross-sector views, index) plus one file per sub-sector holding atomic, revisable views shown as "timestamp + current conclusion". A sidebar panel browses and edits them, one agent tool lets the assistant recall and update them in conversation, and the plugin writes periodic digests and an append-only change log. No database, no plugin-run service. Full Chinese guide: [README.zh.md](README.zh.md).

> **Implementation status (2026-10-18):** project entries, the industry two-level view boards (theme board + sub-sector boards + view actions), digests and the change log are implemented; restart Harness to activate. Legacy flat industry files remain readable and are shown read-only under "旧格式行业条目（待迁移）".

## What you get

- **Projects = decision records** — one `.md` per company in `项目/` (verdict, assumptions, risks, append-only review log) with a review clock (`last_reviewed` / `next_review` / `review_cycle_days`).
- **Industries = two-level view boards** (next format) — a theme board `行业/<theme>/_主题.md` (scope + cross-sector views + sub-sector index) and one sub-sector file per theme holding atomic views shown as "last revision date + current conclusion", with status 有效 / 待验证 / 被削弱 / 已证伪; revisions update in place and old→new summaries go to the log.
- An append-only `日志.md` change log beside them: one line per create/update/review/digest/sync/seed (and per industry view revision).
- A **投资记忆** sidebar panel: list/filter/search, detail, create/edit, review, digest, sync, sample seeding.
- An agent tool **`vc_memory`** (single tool, `action` parameter).
- An automatic **投资记忆** system-prompt section: counts, due reviews, vault path, usage rules.

## Install

Install the bundle through the Harness plugin manager in this profile and enable it. No separate server or port: the host half mounts `/vc-memory/api` on the existing Harness web server, and the panel is a sidebar entry. Restart Harness if the entry does not appear.

## Where the data lives

With `vaultDir: ''` the vault is `<OneDrive>/VC-Memory` when OneDrive exists, else `~/Documents/VC-Memory` (e.g. `C:\Users\<you>\OneDrive\VC-Memory`). You can also change it from the panel: **设置 → 知识库位置** (choose or type an absolute path, save; 恢复默认 goes back to the auto-resolved location). Switching only changes where the plugin points; old files are not moved or deleted.

```
VC-Memory/
├── README.md
├── 日志.md                       # append-only change log (one line per write)
├── 项目/<slug>.md               # project decision record
├── 行业/<theme>/_主题.md        # theme board (scope + cross-sector views + index)
├── 行业/<theme>/<sector>.md     # sub-sector view board
└── 简报/2026-W42.md
```

A project entry's id is its vault-relative path without `.md` (e.g. `项目/xinghu-intelligence`); a theme board is `行业/机器人/_主题`; a sub-sector is `行业/机器人/仓储机器人`; a view is `行业/机器人/仓储机器人#仓储-001`. Project format (six body sections) and the industry theme/sub-sector format are in [docs/FORMAT.md](docs/FORMAT.md). Hand edits are safe — project entries keep unknown fields and sections; industry boards are the current view board.

## Panel and tool

Tabs 全部 / 项目 / 行业 / 到期, client-side search, detail pane, 新建/编辑, 复盘, digest preview/save, 同步, 刷新, 设置 (外观：跟随系统/亮色/暗色；知识库位置), and 写入示例记录 for an empty vault; overdue project reviews are highlighted and state refreshes on focus and every 30 s.

> The industry theme/sub-sector tree, view actions and "new theme / new sub-sector" controls are implemented (restart Harness to activate). Structure creation is user-confirmed, except that an explicit "记一下这个行业" instruction lets the model create one theme + one sub-sector directly.

| `vc_memory` action | What it does |
| --- | --- |
| `status` | vault path/writability, config, counts, due reviews, sync mode, warnings |
| `list` / `search` (`query`) / `read` | entries; keyword hits with snippets; one entry's full markdown |
| `upsert` | create or update (matched by name/aliases) |
| `review` | append a dated review and advance the review clock |
| `digest` | generate a week/month digest, saved under `简报/` |
| `sync` | Git status/commit/push; reports the cloud-folder mode when Git is off |
| `theme` / `sector` / `view` | Industry structure and views: theme/sector create/list/read and view add/revise/weaken/falsify/archive |

Other parameters mirror the HTTP fields in [docs/API.md](docs/API.md). `upsert` is project-only now; industry uses `theme`/`sector`/`view`. Example prompts: “Note 星弧智能: A round, bullish, confidence 4 — the thesis is …”; “Why was I bullish on edge AI infrastructure? Which assumptions are unverified?”; “What's due this week? Update 星弧智能, then write the weekly digest.”

## Three triggers

1. **Manual** — panel actions, or ask the assistant to call `vc_memory`.
2. **Automatic** — with `injectPrompt: true` the model gets counts, due reviews, the vault path and usage rules in its system prompt, so it recalls memory unprompted.
3. **Scheduled** — `autoDigest` (off / daily / weekly / monthly) + `digestWeekday` + `digestHour`. Weekly runs on ISO weekday `digestWeekday` (1 = Monday … 7 = Sunday; default 1), monthly on day 1–28, at `digestHour`, on the first 5-minute plugin check while the Harness process runs. **The timer only runs while Harness is running**; a period missed entirely (machine off) is not back-filled — use 本周简报 / `vc_memory(digest)` instead.

## Sync

**OneDrive (default)**: the vault already lives in OneDrive — sign in to the same account on the other machine, keep the default path or point `vaultDir` at the synced folder; conflicts are handled by OneDrive.

**Git (optional, not configured by default)**: `git init` the vault, commit, add a remote (e.g. `origin`) and push; clone on the second machine and point `vaultDir` at it. Only if you want Git sync, add a `git:` block to the profile's `vc-memory` row (`git.enabled: true`, `autoCommit`, `autoPush`, `remote: origin`, `branch: main`). Doing nothing keeps the OneDrive folder mode.

Pull before editing (the plugin does not merge); the 同步 button commits and, with `autoPush`, pushes. Conflicts are last-write-wins via Git/OneDrive: project entries keep both append-only review blocks; industry view boards are edited in place, so keep the newer conclusion and record the old one in `日志.md`.

## Configuration

Edit the `vc-memory` row in the profile's `cordis.patch.yml` (e.g. `~/.dsh/profiles/desktop/cordis.patch.yml`). This plugin registers no config form, so the patch layer is the source of truth. Defaults:

```yaml
vaultDir: ''   # auto: <OneDrive>/VC-Memory, else ~/Documents/VC-Memory (panel 设置 can override)
language: zh
reviewCycleDays: 30
autoDigest: weekly   # off | daily | weekly | monthly
digestWeekday: 1     # weekly: ISO weekday 1-7 (1 = Monday); monthly: day 1-28
digestHour: 9
injectPrompt: true
# `git:` is intentionally absent: OneDrive is the default sync, and Git is an
# opt-in block you add only when you need it.
```

## Privacy

Plain Markdown: no database, no hidden state, no telemetry, no plugin-run cloud service. Files leave the machine only through the sync provider you choose. The system-prompt section holds counts, due reviews, the path and usage rules — not entry bodies; content read or written in a conversation goes to the model provider like any conversation.

## Samples

[`samples/`](samples/) holds five fictitious entries (`example: true`, names prefixed 示例 ·): projects 星弧智能 (industrial multimodal QC, A round, bullish), 边云科技 (edge compute scheduling, A+ round, watch), 智枢智能 (enterprise agent platform, A round, invested); industries 边缘算力基础设施 (AI infra, bullish), 具身智能机器人 (robotics, watch). Format demos only; quantitative notes are assumptions. The industry samples still use the old project-style layout and will be converted with the view-board implementation.

## FAQ

- **Empty vault / missing folder** — check the path at the top of the panel; a custom `vaultDir` must exist and be writable.
- **Git not available** — install Git on PATH and restart, or keep `git.enabled: false` and use OneDrive.
- **Due count** — `next_review <= today`; a review sets `next_review = review date + review_cycle_days`.
- **Rename/move/delete** — editing the name in the panel keeps the file put; move or delete the `.md` on disk and refresh (the id is the relative path).
- **Digest missing** — the timer runs only while Harness runs; a fully missed period is not back-filled.
- **Industry view boards** — a theme board `行业/<theme>/_主题.md` (scope + cross-sector views + index) plus one sub-sector file per theme, with atomic views ("last revision date + current conclusion", status 有效/待验证/被削弱/已证伪). Old wording is kept in `日志.md` summaries plus OneDrive/Git history.
- **Industry theme/sector tree** — the panel renders 全部 / 项目 / 行业 / 到期; the 行业 tab is a theme → sub-sector → view tree with theme/sector detail panes, 新建主题/细分赛道/观点 and 修正/削弱/证伪/归档 actions. Legacy flat industry entries are shown read-only under "旧格式行业条目（待迁移）".
- **Who creates themes/sub-sectors** — user-confirmed by default; the model may propose. Exception: an explicit "记一下这个行业" instruction lets the model directly create one theme + one sub-sector, but it must write the scope sentence, an initial view and a log line; ambiguous placement remains a proposal. A sub-sector needs the five tests (comparable set, reusable evidence, different decision, falsifiable view, ≥2-project reuse), a scope sentence, 3+ comparable companies and one initial view.

## Docs

- [docs/FORMAT.md](docs/FORMAT.md) — project entries, industry theme boards and sub-sector view boards
- [docs/EXAMPLE.md](docs/EXAMPLE.md) — virtual project, theme board, sub-sector board, digest and log examples
- [docs/API.md](docs/API.md) — Host HTTP contract
- [CHANGELOG.md](CHANGELOG.md) — plugin changes
