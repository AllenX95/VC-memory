# vc-memory — HTTP API contract (Host ↔ panel UI)

> **Status (2026-10-18):** implemented. `/upsert` handles projects only; industry uses the
> two-level boards under `行业/<theme>/_主题.md` + `行业/<theme>/<sector>.md`, with the endpoints
> below. Legacy flat `行业/*.md` files remain readable via `/entry` and are returned in
> `state.legacyIndustry`.

The Host half registers one route prefix on the Harness web server:

```
/vc-memory/api        (kind: 'prefix')
```

The panel UI is served from the same origin, so it calls `fetch('/vc-memory/api/…')` with
relative URLs. `GET` needs no headers. `POST` sends `content-type: application/json` and a body
under 256 KiB; the Host refuses a POST whose `Origin`/`Host` is not this same origin
(loopback / declared authority), like the shipped plugin market does.

Every response is JSON. Success is `{ ok: true, … }`; failure is an HTTP 400/404/500 with
`{ ok: false, error: "<readable Chinese message>" }`.

## Entry identity

* Current (project-style) `id` = `<类型目录>/<slug>`, e.g. `项目/aurora-ai` or `行业/ai-infra`
  (URL-encode it in query strings). The matching file is `<vaultDir>/<类型目录>/<slug>.md`.
* 类型目录 is `项目` for `project` and `行业` for `industry`.
* `slug` is derived from the name; Chinese characters are preserved.
* Future industry two-level ids (with the view-board implementation): theme
  `行业/<theme>/_主题`, sub-sector `行业/<theme>/<sector>`, view
  `行业/<theme>/<sector>#<view-id>`. Today `/entry` only accepts the project-style ids above.

## `GET /vc-memory/api/state`

```ts
{
  ok: true,
  vault: { dir: string, exists: boolean, writable: boolean, isOneDrive: boolean, isGit: boolean, fileCount: number },
  config: {
    vaultDir: string,            // effective directory
    reviewCycleDays: number,
    autoDigest: 'off'|'daily'|'weekly'|'monthly',
    digestWeekday: number, digestHour: number,
    injectPrompt: boolean,
    git: { enabled: boolean, autoCommit: boolean, autoPush: boolean, remote: string, branch: string }
  },
  counts: { project: number, industry: number /* legacy flat entries */, themes: number, sectors: number, views: number, due: number, total: number },
  entries: EntryMeta[],          // projects (+ legacy flat industry entries, flagged legacy: true)
  themes: Theme[],               // industry two-level boards
  legacyIndustry: EntryMeta[],   // old flat 行业/*.md entries, kept readable
  digests: { file: string, name: string, date: string, period: string }[],
  sync: {
    mode: 'onedrive'|'git'|'folder',
    label: string,               // human hint, e.g. "OneDrive 自动同步"
    gitAvailable: boolean,
    dirty: boolean | null,       // null when Git sync is off
    last: { at: string, ok: boolean, message: string } | null
  },
  warnings: string[],
  serverTime: string            // ISO
}
```

`EntryMeta`:

```ts
{
  id: string, type: 'project'|'industry', name: string,
  sector?: string, stage?: string,
  verdict?: '看好'|'观望'|'回避'|'已投'|'已退出'|string,
  confidence?: number,           // 1-5
  tags: string[], aliases: string[], links: string[],
  created?: string, updated?: string,          // YYYY-MM-DD
  lastReviewed?: string, nextReview?: string,  // YYYY-MM-DD
  reviewCycleDays: number,
  due: boolean, dueInDays: number | null,      // negative = overdue days
  example: boolean,
  file: string,                                // vault-relative, e.g. 项目/aurora-ai.md
  summary: string                              // first sentence of 一句话判断, for list rows
}
```

## `GET /vc-memory/api/entry?id=<encoded id>`

```ts
{
  ok: true,
  entry: EntryMeta,
  markdown: string,             // the whole file, for the "原文/编辑" view
  frontmatter: Record<string, string | string[]>,
  sections: { title: string, body: string }[]   // body split on `## ` headings, in order
}
```

## Industry API (theme / sector / view)

Current industry types (see `FORMAT.md`):

```ts
interface Theme {
  id: string                 // 行业/<theme>/_主题
  dir: string                // filesystem directory
  name: string
  scope: string
  updated: string
  views: View[]              // cross-sector views
  archived: View[]
  sectors: Sector[]
}
interface Sector {
  id: string                 // 行业/<theme>/<sector>
  file: string               // <sector>.md
  name: string
  sector: string
  scope: string
  updated: string
  views: View[]
  archived: View[]
}
interface View {
  id: string                 // #仓储-001
  date: string               // last revision date, YYYY-MM-DD
  conclusion: string         // current conclusion
  status: '有效'|'待验证'|'被削弱'|'已证伪'
  evidence: string[]
  counter: string[]
  related: string[]
}
```

### `GET /vc-memory/api/industry?id=<encoded id>`

Accepts `行业/<theme>/_主题`, `行业/<theme>/<sector>` or `…/<sector>#<view-id>`; returns the board
markdown plus parsed `views` / `archived` and `view` when a view id was given.

### `POST /vc-memory/api/theme`

```jsonc
{ "name": "机器人", "scope": "范围句", "confirm": true }
```

Creates `行业/<theme>/_主题.md`. `confirm` defaults to `true` for panel calls; a model/tool call may
send `false` to get a proposal without writing.

### `POST /vc-memory/api/sector`

```jsonc
{
  "theme": "机器人",
  "name": "仓储机器人",
  "scope": "赛道范围句",
  "themeScope": "主题不存在时一并创建主题用的范围句",
  "sectorLabel": "机器人 / 仓储自动化",
  "conclusion": "第一条观点",
  "evidence": "依据（可多行）",
  "counter": "反证（可多行）",
  "status": "待验证",
  "viewPrefix": "仓储",
  "confirm": true
}
```

Creates `行业/<theme>/<sector>.md` with its first view and refreshes the theme index.

### `POST /vc-memory/api/view`

```jsonc
{
  "op": "add",                 // add | revise | weaken | falsify | archive
  "theme": "机器人",
  "sector": "仓储机器人",       // use "_主题" for the theme board
  "id": "#仓储-001",           // required except for add
  "conclusion": "当前结论",     // add required; revise optional
  "status": "有效",             // optional; weaken/falsify set it themselves
  "evidence": "依据（可多行）",
  "counter": "反证（可多行）",
  "related": "项目/aurora-ai",
  "reason": "修正/削弱/证伪/归档原因"
}
```

The response carries the updated `view`, `boardId`, and (for archive) the archived record. Panels
should refresh `/state` afterwards.

## Vault location API

### `GET /vc-memory/api/config`

Returns `{ ok, vaultDir, defaultDir, settingsPath }`.

### `POST /vc-memory/api/config`

```jsonc
{ "vaultDir": "C:/Users/<you>/OneDrive/VC-Memory" }   // absolute path
{ "reset": true }                                       // back to patch/default location
```

Switches the live vault (creates the folder if needed, scans it) and persists the choice to
`<DSH_HOME>/vc-memory/settings.json`. The OneDrive default / profile patch remains the fallback;
`reset` removes the override. Existing vault files are never moved or deleted.

## `POST /vc-memory/api/upsert`

Create or update one **project** entry (`/upsert` rejects `type: "industry"`; use `/sector` and
`/view` for industry boards). When `id` is absent, an existing entry of the same `type` is matched
by case-insensitive `name` or `aliases`; otherwise a new file is created.

```jsonc
{
  "id": "项目/aurora-ai",          // optional; omit to create/match
  "type": "project",               // required on create: project | industry
  "name": "Aurora AI",             // required on create
  "sector": "AI Infra", "stage": "A 轮",
  "verdict": "看好", "confidence": 4,
  "tags": ["推理", "国产替代"], "aliases": ["Aurora"], "links": ["https://…"],
  "summary": "一句话判断",
  "thesis": "判断依据（Markdown 多行）",
  "assumptions": "- [ ] 假设一\n- [ ] 假设二",
  "risks": "风险与反证（Markdown）",
  "evidence": "2026-10-17 · 来源与事实",   // appended to 证据与时间线 when provided
  "reviewCycleDays": 30
}
```

→ `{ ok: true, created: boolean, entry: EntryMeta, file: string }`

## `POST /vc-memory/api/review`

Append a dated review block and advance the review clock.

```jsonc
{
  "id": "项目/aurora-ai",
  "outcome": "本轮进展符合判断 / 偏离 / 证伪",
  "progress": "事实与数据进展（Markdown）",
  "deviation": "判断偏差与原因",
  "nextVerdict": "看好",           // optional; changes the entry verdict
  "confidence": 3,                  // optional; changes confidence
  "nextReview": "2027-01-15",       // optional; else lastReviewed + reviewCycleDays
  "notes": "其他补充"
}
```

→ `{ ok: true, entry: EntryMeta, markdown: string }`

## `POST /vc-memory/api/digest`

```jsonc
{ "period": "week", "save": true }   // week | month
```

→ `{ ok: true, period: "week", title: "2026-W42 投资记忆周报", file: "简报/2026-W42.md",
     markdown: string, saved: boolean }`

`save: false` only previews. Saving writes/open the digest file under `简报/`.

## `POST /vc-memory/api/sync`

```jsonc
{ "action": "status" }   // status | commit | push   (default: commit when Git enabled)
```

→ `{ ok: true, mode: "git"|"folder"|"onedrive", output: string,
     last: { at: string, ok: boolean, message: string } }`

With Git sync off, `mode` reports the folder/OneDrive situation and `output` explains that
the vault is synced by the cloud folder itself.

## `POST /vc-memory/api/seed`

Writes the bundled `samples/*.md` entries into an empty vault (explicit user action only).

→ `{ ok: true, created: string[] }`

## `POST /vc-memory/api/search`

```jsonc
{ "q": "推理" }
```

→ `{ ok: true, matches: { entry: EntryMeta, snippet: string }[] }`

## UI expectations

* Refresh `state` on mount, after every mutation, on window focus, and every 30 s.
* The panel is a `main` slot keyed `vc-memory`; the sidebar icon is `sidebar.panellist` id
  `vc-memory`. Keep both mounted forever; do not navigate away programmatically.
* All colours come from `--dsw-alias-*` theme tokens. No imports from `@deepseek-ai/*`.
* UI language: Chinese (add an English dictionary only for slot labels if trivial).
