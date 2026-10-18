// vc-memory host half — a plain Cordis plugin.
//
// What it owns:
//   - a Markdown vault (one folder; OneDrive/iCloud/Dropbox/Git syncs it),
//     with 项目/ (project judgements), 行业/ (industry judgements) and 简报/
//     (digests). No database, no hidden state: every fact is a file.
//   - the `vc_memory` agent tool (single tool, `action` parameter) so the
//     assistant recalls and updates judgements inside a conversation.
//   - a compact dynamic system-prompt section: counts, due reviews, vault
//     path and the recall/update rules. This is the "automatic" trigger —
//     it is assembled before every model step, so a new session already
//     knows what is due without anyone asking.
//   - a periodic digest writer (daily/weekly/monthly) and a vault rescan
//     loop, so files synced from another machine appear without a restart.
//   - the same-origin JSON API under /vc-memory/api that the panel UI uses;
//     the UI calls the very same functions the tool calls (one operation,
//     two callers).
//
// Design notes:
//   - Markdown is the contract. Frontmatter keys and body headings are
//     documented in docs/FORMAT.md and are Obsidian/Typora/VS Code friendly.
//   - Unknown frontmatter keys and unknown body sections are preserved.
//   - Writes are last-write-wins inside one process; across devices the
//     cloud folder / Git decides. The review log is append-only, so a
//     conflict costs a section, never the whole entry.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'vc-memory'
// webServer is needed for the panel UI; tools/systemPrompt for the agent side.
export const inject = ['tools', 'systemPrompt', 'webServer']

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const API_PREFIX = '/vc-memory/api'
const SAMPLE_DIR = join(__dirname, 'samples')
const DIGEST_DIR = '简报'
const LOG_FILE = '日志.md'
const LOG_HEADER = '# 投资记忆变更日志\n\n> 由 vc-memory 自动追加：新建、更新、复盘、简报、手动同步、示例导入各记一行；只追加，不改写历史。\n\n'
const TYPES = {
  project: { dir: '项目', label: '项目' },
  industry: { dir: '行业', label: '行业' },
}
const TYPE_BY_DIR = { 项目: 'project', 行业: 'industry' }
const VERDICTS = ['看好', '观望', '回避', '已投', '已退出']
const KNOWN_TITLES = ['一句话判断', '判断依据', '关键假设', '风险与反证', '证据与时间线', '复盘记录']
const FM_ORDER = [
  'id', 'type', 'name', 'aliases', 'sector', 'stage', 'verdict', 'confidence',
  'tags', 'links', 'created', 'updated', 'last_reviewed', 'review_cycle_days',
  'next_review', 'example',
]

// ── small helpers ──────────────────────────────────────────────────────

const msg = (e) => (e instanceof Error ? e.message : String(e))
const clampInt = (v, min, max, fallback) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [])
const truncate = (s, n) => {
  const t = String(s ?? '')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function pad2(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function today() { return fmtDate(new Date()) }
function fmtTime(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
function parseDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return null
  const d = new Date(s.trim() + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}
function addDays(dateStr, days) {
  const d = parseDay(dateStr) ?? new Date()
  d.setDate(d.getDate() + Math.round(days))
  return fmtDate(d)
}
function diffDaysFromToday(dateStr) {
  const d = parseDay(dateStr)
  if (!d) return null
  const t = parseDay(today())
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}
function isoWeekLabel(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7)) // nearest Thursday
  const isoYear = x.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  const week = 1 + Math.round((x.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${isoYear}-W${pad2(week)}`
}
function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function stripMarkdown(s) {
  return String(s ?? '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
function firstSentence(s, max = 90) {
  const t = stripMarkdown(s)
  if (!t) return ''
  const m = /^(.{1,120}?[。！？.!?])(\s|$)/.exec(t)
  return truncate(m ? m[1] : t, max)
}

// ── frontmatter (a strict, tiny YAML subset: the plugin writes it itself) ──

function parseScalar(raw) {
  if (raw === '') return ''
  if (raw.startsWith('[')) {
    try { return JSON.parse(raw) } catch {
      return raw.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }
  }
  if (raw.startsWith('"')) {
    try { return JSON.parse(raw) } catch { return raw.replace(/^"|"$/g, '') }
  }
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  return raw
}
function yamlValue(v) {
  if (Array.isArray(v)) return '[' + v.map((x) => JSON.stringify(String(x))).join(', ') + ']'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(String(v ?? ''))
}
function parseFrontmatter(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n---[ \t]*\n?/.exec(src)
  if (!m) return { data: {}, body: src.trim() }
  const data = {}
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    if (!key || key.startsWith('- ')) continue
    data[key] = parseScalar(line.slice(idx + 1).trim())
  }
  return { data, body: src.slice(m[0].length).trim() }
}
function serializeFrontmatter(fm) {
  const known = FM_ORDER.filter((k) => {
    const v = fm[k]
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  })
  const unknown = Object.keys(fm)
    .filter((k) => !FM_ORDER.includes(k) && fm[k] !== undefined && fm[k] !== '')
    .sort()
  const keys = [...known, ...unknown]
  return '---\n' + keys.map((k) => `${k}: ${yamlValue(fm[k])}`).join('\n') + '\n---\n'
}

// ── Markdown body <-> sections ─────────────────────────────────────────

function splitSections(body) {
  const lines = String(body ?? '').replace(/\r\n/g, '\n').split('\n')
  const sections = new Map()
  let preamble = []
  let current = null
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      current = { title: m[1].trim(), lines: [] }
      sections.set(current.title, current.lines)
      continue
    }
    if (current) current.lines.push(line)
    else preamble.push(line)
  }
  let pre = preamble.join('\n').trim()
  const map = new Map()
  for (const [title, list] of sections) map.set(title, list.join('\n').trim())
  return { preamble: pre, sections: map }
}
function rebuildBody(preamble, sections) {
  const known = KNOWN_TITLES.filter((t) => sections.has(t))
  const extra = [...sections.keys()].filter((t) => !KNOWN_TITLES.includes(t))
  const parts = []
  if (preamble) parts.push(preamble.trim())
  for (const title of [...known, ...extra]) {
    const text = String(sections.get(title) ?? '').trim()
    parts.push(text ? `## ${title}\n\n${text}` : `## ${title}`)
  }
  return parts.join('\n\n').trim() + '\n'
}

// ── config, vault, scan ────────────────────────────────────────────────

function oneDriveHome() {
  const env = (process.env.OneDrive || '').trim()
  if (env && existsSync(env)) return env
  const fallback = join(homedir(), 'OneDrive')
  return existsSync(fallback) ? fallback : ''
}
function effectiveConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const oneDrive = oneDriveHome()
  const vaultDir = typeof r.vaultDir === 'string' && r.vaultDir.trim()
    ? resolve(r.vaultDir.trim())
    : oneDrive ? join(oneDrive, 'VC-Memory') : join(homedir(), 'Documents', 'VC-Memory')
  const gitRaw = r.git && typeof r.git === 'object' ? r.git : {}
  return {
    vaultDir,
    language: r.language === 'en' ? 'en' : 'zh',
    reviewCycleDays: clampInt(r.reviewCycleDays, 1, 3650, 30),
    autoDigest: ['off', 'daily', 'weekly', 'monthly'].includes(r.autoDigest) ? r.autoDigest : 'weekly',
    digestWeekday: clampInt(r.digestWeekday, 1, 28, 1),
    digestHour: clampInt(r.digestHour, 0, 23, 9),
    injectPrompt: r.injectPrompt !== false,
    git: {
      enabled: gitRaw.enabled === true,
      autoCommit: gitRaw.autoCommit === true,
      autoPush: gitRaw.autoPush === true,
      remote: typeof gitRaw.remote === 'string' && gitRaw.remote.trim() ? gitRaw.remote.trim() : 'origin',
      branch: typeof gitRaw.branch === 'string' ? gitRaw.branch.trim() : '',
    },
  }
}
function isUnderOneDrive(dir) {
  const od = oneDriveHome()
  return !!od && resolve(dir).toLowerCase().startsWith(resolve(od).toLowerCase())
}

// User-chosen vault location, persisted outside the vault so it survives a
// move. The profile patch/config stays the fallback source of truth.
function userSettingsFile() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'vc-memory', 'settings.json')
}
function readUserSettings() {
  try {
    const data = JSON.parse(readFileSync(userSettingsFile(), 'utf8'))
    return data && typeof data.vaultDir === 'string' && data.vaultDir.trim() ? data : {}
  } catch { return {} }
}
async function writeUserSettings(data) {
  const file = userSettingsFile()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

const VAULT_README = `# VC 投资记忆（vc-memory）

这个文件夹由 DeepSeek Harness 的 \`vc-memory\` 插件维护。项目判断是决策记录，行业判断是「主题板 + 细分赛道观点板」；
纯 Markdown，可直接用 Obsidian / Typora / VS Code 打开；同步交给 OneDrive / iCloud / Git，插件不持有数据库。

## 结构

\`\`\`
项目/<公司>.md              项目决策记录：判断、关键假设、证据与复盘（六小节）
行业/<主题>/_主题.md        主题板：范围 + 跨赛道观点 + 下级索引
行业/<主题>/<细分赛道>.md   细分赛道观点板：时间戳 + 当前结论
简报/<period>.md            插件按周期生成的周报/月报
日志.md                     变更日志：每次写入追加一行概要
\`\`\`

## 约定

- 项目条目：YAML frontmatter（type/name/verdict/confidence/last_reviewed/next_review/review_cycle_days 等）
  + 六个正文小节（一句话判断 / 判断依据 / 关键假设 / 风险与反证 / 证据与时间线 / 复盘记录）；
  \`复盘记录\` 只追加，不覆盖。
- 行业观点板：观点原地更新（日期 + 当前结论 + 状态 + 依据/反证），旧→新摘要写入 \`日志.md\`；
  状态只用 有效 / 待验证 / 被削弱 / 已证伪。
- 主题/细分赛道：默认由你创建或确认；只有你明确说"记一下这个行业/赛道"且没有对应板时，才允许自动建一个主题 + 一个细分赛道。
- 手改文件是安全的：插件每次扫描都会重新解析；项目条目的未知字段和未知小节会原样保留。

## 多设备

把整个文件夹放在 OneDrive 或 iCloud Drive 里，两台设备指向同一个目录即可；或者
\`git init\` 后用插件里的「同步」按钮 / \`vc_memory(sync)\` 提交并推送。
`

async function ensureVault(cfg) {
  await mkdir(cfg.vaultDir, { recursive: true })
  for (const def of Object.values(TYPES)) await mkdir(join(cfg.vaultDir, def.dir), { recursive: true })
  await mkdir(join(cfg.vaultDir, DIGEST_DIR), { recursive: true })
  const readme = join(cfg.vaultDir, 'README.md')
  if (!existsSync(readme)) await writeFile(readme, VAULT_README, 'utf8')
  const log = join(cfg.vaultDir, LOG_FILE)
  if (!existsSync(log)) await writeFile(log, LOG_HEADER, 'utf8')
}

/** Switch the live vault directory (UI choice). Rolls back on failure. */
async function switchVault(state, dir) {
  const previous = state.cfg.vaultDir
  state.cfg.vaultDir = resolve(String(dir))
  state.problems = []
  try {
    await ensureVault(state.cfg)
    await refresh(state)
    state.vault = { ...(state.vault || {}), ...vaultInfo(state) }
  } catch (e) {
    state.cfg.vaultDir = previous
    try { await refresh(state) } catch { /* keep old cache */ }
    state.vault = { ...(state.vault || {}), ...vaultInfo(state) }
    throw e
  }
}

/** Append one human-readable line to <vault>/日志.md. Logging never fails a write. */
async function appendLog(state, action, id, summary) {
  try {
    const line = `- ${today()} ${fmtTime(new Date())} · ${action} · ${id || '—'} · ${truncate(summary || '', 160)}`
    await appendFile(join(state.cfg.vaultDir, LOG_FILE), line + '\n', 'utf8')
  } catch (e) {
    state.warnings = [...(state.warnings || []), `写变更日志失败：${msg(e)}`]
  }
}

/** Last N log lines (header excluded), for /state and the panel. */function readLogLines(cfg, limit = 20) {
  try {
    const text = readFileSync(join(cfg.vaultDir, LOG_FILE), 'utf8')
    return text.split('\n').filter((line) => line.startsWith('- ')).slice(-limit)
  } catch { return [] }
}

/** Parsed log entries (all), for digest grouping. */
async function readLogEntries(cfg) {
  try {
    const text = await readFile(join(cfg.vaultDir, LOG_FILE), 'utf8')
    return text.split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => {
        const m = /^- (\d{4}-\d{2}-\d{2}) \d{2}:\d{2} · ([^·]+) · ([^·]+) · (.*)$/.exec(line)
        return m ? { date: m[1], action: m[2].trim(), id: m[3].trim(), summary: m[4].trim(), line } : null
      })
      .filter(Boolean)
  } catch { return [] }
}

function slugify(name) {
  const s = String(name ?? '').trim()
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return (s.slice(0, 80) || 'entry')
}
function idParts(id) {
  const s = String(id ?? '').trim()
  const m = /^(项目|行业)\/(.+)$/.exec(s)
  if (!m) return null
  const slug = m[2].replace(/\.md$/i, '')
  if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('..')) return null
  return { dir: m[1], slug }
}
function relOf(type, slug) { return `${TYPES[type].dir}/${slug}.md` }
function absOf(cfg, type, slug) { return join(cfg.vaultDir, TYPES[type].dir, `${slug}.md`) }

function toMeta(fm, type, slug, sections, cfg) {
  const nextReview = typeof fm.next_review === 'string' ? fm.next_review : ''
  const dueInDays = nextReview ? diffDaysFromToday(nextReview) : null
  return {
    id: `${TYPES[type].dir}/${slug}`,
    type,
    name: String(fm.name || slug),
    sector: fm.sector ? String(fm.sector) : undefined,
    stage: fm.stage ? String(fm.stage) : undefined,
    verdict: fm.verdict ? String(fm.verdict) : undefined,
    confidence: fm.confidence !== undefined && fm.confidence !== '' ? Number(fm.confidence) || undefined : undefined,
    tags: asArray(fm.tags),
    aliases: asArray(fm.aliases),
    links: asArray(fm.links),
    created: fm.created ? String(fm.created) : undefined,
    updated: fm.updated ? String(fm.updated) : undefined,
    lastReviewed: fm.last_reviewed ? String(fm.last_reviewed) : undefined,
    nextReview: nextReview || undefined,
    reviewCycleDays: clampInt(fm.review_cycle_days, 1, 3650, cfg.reviewCycleDays),
    due: dueInDays !== null && dueInDays <= 0,
    dueInDays,
    example: fm.example === true,
    file: `${TYPES[type].dir}/${slug}.md`,
    summary: firstSentence(sections.get('一句话判断') || ''),
  }
}

function reviewDatesOf(sections) {
  const text = sections.get('复盘记录') || ''
  const out = []
  const re = /^###\s+(\d{4}-\d{2}-\d{2})\s*(?:·\s*)?复盘/mg
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1])
  return out
}

async function readEntryFile(cfg, type, slug) {
  const text = await readFile(absOf(cfg, type, slug), 'utf8')
  const { data, body } = parseFrontmatter(text)
  const { preamble, sections } = splitSections(body)
  return { fm: data, preamble, sections, text, body }
}

// ── industry: theme directories + sub-sector view boards ──────────────

const THEME_FILE = '_主题.md'
const VIEW_STATUSES = ['有效', '待验证', '被削弱', '已证伪']
const STATUS_RANK = { 有效: 0, 待验证: 1, 被削弱: 2, 已证伪: 3 }
const ARCHIVED_TITLE = '已归档观点（保留教训，不再作为当前判断）'

function statusCounts(views) {
  const counts = {}
  for (const view of views) counts[view.status] = (counts[view.status] || 0) + 1
  return counts
}
function statusLine(views) {
  const counts = statusCounts(views)
  return VIEW_STATUSES.map((s) => `${s} ${counts[s] || 0}`).join(' · ')
}
function sortViews(views) {
  return [...views].sort((a, b) => {
    const sa = STATUS_RANK[a.status] ?? 9
    const sb = STATUS_RANK[b.status] ?? 9
    if (sa !== sb) return sa - sb
    return String(b.date || '').localeCompare(String(a.date || ''))
  })
}
function boardScope(body) {
  const m = /^\s*>\s*范围[：:]\s*(.+)$/m.exec(String(body || ''))
  return m ? m[1].trim() : ''
}
function parseBoardViews(body) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n')
  const views = []
  const archived = []
  let inArchive = false
  let current = null
  const finish = () => {
    if (!current) return
    current.conclusion = current.conclusion.trim()
    if (current.id && current.status) views.push(current)
    current = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^##\s*已归档观点/.test(line)) { finish(); inArchive = true; continue }
    const heading = /^##\s+(\d{4}-\d{2}-\d{2})\s*·\s*(.+)$/.exec(line)
    if (heading && !inArchive) {
      finish()
      current = { date: heading[1], conclusion: heading[2].trim(), id: '', status: '', evidence: [], counter: [], related: [] }
      continue
    }
    if (inArchive) {
      const a = /^-\s*`?(#[^\s`]+)`?\s*·\s*(\S+)\s*·\s*(\d{4}-\d{2}-\d{2})\s*[：:]\s*(.*)$/.exec(line)
      if (a) {
        archived.push({
          id: a[1], status: a[2], date: a[3],
          conclusion: a[4].replace(/^[“"]|[”"]$/g, '').trim(), reason: '',
        })
      } else if (/^→/.test(line) && archived.length) {
        archived[archived.length - 1].reason = line.replace(/^→\s*/, '').trim()
      }
      continue
    }
    if (!current) continue
    const meta = /^`?(#[^\s`]+)`?\s*·\s*\*\*(有效|待验证|被削弱|已证伪)\*\*(.*)$/.exec(line)
    if (meta) {
      current.id = meta[1]
      current.status = meta[2]
      const related = /关联[：:]\s*(.+)/.exec(meta[3] || '')
      if (related) current.related = related[1].split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
      continue
    }
    const evidence = /^-\s*依据[：:]\s*(.*)$/.exec(line)
    if (evidence) { current.evidence.push(evidence[1].trim()); continue }
    const counter = /^-\s*反证[：:]\s*(.*)$/.exec(line)
    if (counter) { current.counter.push(counter[1].trim()); continue }
    const related = /^-\s*关联[：:]\s*(.*)$/.exec(line)
    if (related) current.related.push(...related[1].split(/[、,，]/).map((s) => s.trim()).filter(Boolean))
  }
  finish()
  return { views, archived }
}
function parseThemeBoard(text) {
  const { data, body } = parseFrontmatter(text)
  const { views, archived } = parseBoardViews(body)
  return { fm: data, scope: boardScope(body), views, archived }
}
function parseSectorBoard(text) {
  const { data, body } = parseFrontmatter(text)
  const { views, archived } = parseBoardViews(body)
  return { fm: data, scope: boardScope(body), views, archived }
}
function nextViewId(views, fallbackPrefix) {
  const counters = new Map()
  for (const view of views) {
    const m = /^#(.+)-(\d+)$/.exec(view.id || '')
    if (m) counters.set(m[1], Math.max(counters.get(m[1]) || 0, Number(m[2])))
  }
  const prefix = [...counters.keys()][0] || fallbackPrefix || '观点'
  return `#${prefix}-${String((counters.get(prefix) || 0) + 1).padStart(3, '0')}`
}
function serializeBoard({ kind, name, sector, scope, updated, views, archived, sectors }) {
  const fm = ['---', `type: ${kind === 'theme' ? 'theme' : 'industry'}`, `name: ${yamlValue(name)}`]
  if (kind !== 'theme') fm.push(`sector: ${yamlValue(sector || '')}`)
  fm.push(`updated: ${yamlValue(updated)}`, '---', '')
  const body = [`# ${name} · ${kind === 'theme' ? '主题' : '行业观点'}`, '']
  body.push(`> 最后更新：${updated || '-'}｜${statusLine(views)}`)
  if (scope) body.push(`> 范围：${scope}`)
  if (kind === 'theme' && sectors && sectors.length) {
    body.push('> 下级细分赛道：')
    for (const s of sectors) body.push(`> - ${s.name}（${s.viewCount} 条观点 · ${statusLine(s.views || [])}）`)
  }
  const mainline = sortViews(views).slice(0, 3).map((v) => truncate(stripMarkdown(v.conclusion), 80))
  if (mainline.length) {
    body.push('> 当前主线：')
    for (const line of mainline) body.push(`> - ${line}`)
  }
  body.push('')
  for (const view of sortViews(views)) {
    body.push(`## ${view.date} · ${view.conclusion}`)
    const related = view.related && view.related.length ? ` · 关联：${view.related.join('、')}` : ''
    body.push(`\`${view.id}\` · **${view.status}**${related}`)
    for (const e of view.evidence || []) body.push(`- 依据：${e}`)
    for (const c of view.counter || []) body.push(`- 反证：${c}`)
    body.push('')
  }
  if (archived && archived.length) {
    body.push(`## ${ARCHIVED_TITLE}`)
    for (const a of archived) {
      body.push(`- \`${a.id}\` · ${a.status} · ${a.date}：“${a.conclusion}”`)
      if (a.reason) body.push(`  → ${a.reason}`)
    }
    body.push('')
  }
  return `${fm.join('\n')}\n${body.join('\n')}\n`
}
function industryDir(cfg, theme) { return join(cfg.vaultDir, '行业', theme) }
function themePath(cfg, theme) { return join(industryDir(cfg, theme), THEME_FILE) }
function sectorPath(cfg, theme, sector) { return join(industryDir(cfg, theme), `${sector}.md`) }

async function readSectorSummaries(cfg, theme) {
  let files = []
  try { files = await readdir(industryDir(cfg, theme)) } catch { return [] }
  const out = []
  for (const file of files.filter((f) => /\.md$/i.test(f) && f !== THEME_FILE)) {
    try {
      const parsed = parseSectorBoard(await readFile(join(industryDir(cfg, theme), file), 'utf8'))
      out.push({
        file,
        name: parsed.fm.name || file.replace(/\.md$/i, ''),
        views: parsed.views,
        viewCount: parsed.views.length,
      })
    } catch { /* skip unreadable */ }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

async function scanIndustry(cfg) {
  const themes = []
  const legacy = []
  const warnings = []
  const base = join(cfg.vaultDir, '行业')
  let entries = []
  try { entries = await readdir(base, { withFileTypes: true }) } catch { return { themes, legacy, warnings } }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const themeName = entry.name
      const dir = join(base, themeName)
      let files = []
      try { files = await readdir(dir) } catch { continue }
      let themeData = { fm: {}, scope: '', views: [], archived: [] }
      if (files.includes(THEME_FILE)) {
        try { themeData = parseThemeBoard(await readFile(join(dir, THEME_FILE), 'utf8')) } catch (e) { warnings.push(`行业/${themeName}/_主题.md：${msg(e)}`) }
      } else {
        warnings.push(`行业/${themeName} 缺少 _主题.md（可手动补一个）`)
      }
      const sectors = []
      for (const file of files.filter((f) => /\.md$/i.test(f) && f !== THEME_FILE)) {
        try {
          const parsed = parseSectorBoard(await readFile(join(dir, file), 'utf8'))
          const name = parsed.fm.name || file.replace(/\.md$/i, '')
          sectors.push({
            id: `行业/${themeName}/${name}`,
            file, name, sector: parsed.fm.sector || '',
            scope: parsed.scope, updated: parsed.fm.updated || '',
            views: parsed.views, archived: parsed.archived,
          })
        } catch (e) { warnings.push(`行业/${themeName}/${file}：${msg(e)}`) }
      }
      sectors.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
      themes.push({
        id: `行业/${themeName}/_主题`,
        dir: themeName,
        name: themeData.fm.name || themeName,
        scope: themeData.scope,
        updated: themeData.fm.updated || '',
        views: themeData.views,
        archived: themeData.archived,
        sectors,
      })
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      // Legacy flat industry entry written by v1; kept so existing data still shows.
      try {
        const slug = entry.name.replace(/\.md$/i, '')
        const file = await readEntryFile(cfg, 'industry', slug)
        const meta = toMeta(file.fm, 'industry', slug, file.sections, cfg)
        meta.legacy = true
        legacy.push(meta)
      } catch (e) { warnings.push(`行业/${entry.name}：${msg(e)}`) }
    }
  }
  themes.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  return { themes, legacy, warnings }
}

async function scanVault(cfg) {
  const entries = []
  const reviews = []
  const warnings = []
  // Project entries only; industry is scanned separately as theme/sector boards.
  for (const type of ['project']) {
    const def = TYPES[type]
    const dir = join(cfg.vaultDir, def.dir)
    let names = []
    try { names = await readdir(dir) } catch { continue }
    for (const fileName of names) {
      if (!/\.md$/i.test(fileName)) continue
      const slug = fileName.replace(/\.md$/i, '')
      try {
        const file = await readEntryFile(cfg, type, slug)
        const meta = toMeta(file.fm, type, slug, file.sections, cfg)
        entries.push(meta)
        for (const date of reviewDatesOf(file.sections)) reviews.push({ id: meta.id, name: meta.name, type, date })
      } catch (e) {
        warnings.push(`${def.dir}/${fileName}: ${msg(e)}`)
      }
    }
  }
  entries.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1
    if (a.due && b.due) return (a.dueInDays ?? 0) - (b.dueInDays ?? 0)
    return String(b.updated || '').localeCompare(String(a.updated || ''))
  })
  let digests = []
  try {
    digests = (await readdir(join(cfg.vaultDir, DIGEST_DIR)))
      .filter((n) => /\.md$/i.test(n))
      .map((n) => ({ file: `${DIGEST_DIR}/${n}`, name: n.replace(/\.md$/i, ''), date: '', period: '' }))
    for (const d of digests) {
      try {
        const text = await readFile(join(cfg.vaultDir, DIGEST_DIR, d.file.split('/').pop()), 'utf8')
        const title = /^#\s+(.+)$/m.exec(text)
        d.period = d.name
        if (title) d.name = title[1].trim()
      } catch { /* keep file stem */ }
    }
    digests.sort((a, b) => b.file.localeCompare(a.file))
  } catch { /* no digest folder yet */ }
  const industry = await scanIndustry(cfg)
  entries.push(...industry.legacy)
  warnings.push(...industry.warnings)
  return { entries, reviews, digests, warnings, themes: industry.themes, legacyIndustry: industry.legacy }
}

async function refresh(state) {
  if (state.refreshing) return state.refreshing
  state.refreshing = (async () => {
    const scan = await scanVault(state.cfg)
    state.entries = scan.entries
    state.reviews = scan.reviews
    state.digests = scan.digests
    state.themes = scan.themes || []
    state.legacyIndustry = scan.legacyIndustry || []
    state.warnings = scan.warnings
    state.scannedAt = Date.now()
    if (state.cfg.git.enabled) await refreshGit(state)
  })()
    .catch((e) => { state.warnings = [...(state.warnings || []), `扫描失败：${msg(e)}`] })
    .finally(() => { state.refreshing = null })
  return state.refreshing
}

function vaultInfo(state) {
  const cfg = state.cfg
  const dir = cfg.vaultDir
  const exists = existsSync(dir)
  let fileCount = 0
  for (const def of Object.values(TYPES)) {
    try { fileCount += readdirSyncCount(join(dir, def.dir)) } catch { /* ignore */ }
  }
  return {
    dir,
    exists,
    writable: state.writable !== false,
    isOneDrive: isUnderOneDrive(dir),
    isGit: existsSync(join(dir, '.git')),
    fileCount,
  }
}
function readdirSyncCount(dir) {
  try {
    // sync read of a small vault; keeps vaultInfo synchronous for prompts
    return readdirSync(dir).filter((n) => /\.md$/i.test(n)).length
  } catch { return 0 }
}

// ── git sync ───────────────────────────────────────────────────────────

function runGit(cwd, args, timeout = 30000) {
  return new Promise((resolveP) => {
    execFile('git', args, {
      cwd, timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    }, (error, stdout, stderr) => {
      resolveP({ ok: !error, stdout: String(stdout || ''), stderr: String(stderr || ''), error })
    })
  })
}

async function refreshGit(state) {
  if (!state.cfg.git.enabled) { state.gitInfo = { available: null, dirty: null, checkedAt: Date.now() }; return }
  const inside = await runGit(state.cfg.vaultDir, ['rev-parse', '--is-inside-work-tree'], 8000)
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    state.gitInfo = { available: false, dirty: null, checkedAt: Date.now(), reason: truncate((inside.stderr || inside.stdout || 'vault 不是 Git 仓库').trim(), 160) }
    return
  }
  const status = await runGit(state.cfg.vaultDir, ['status', '--porcelain'], 8000)
  state.gitInfo = { available: true, dirty: status.ok && status.stdout.trim() !== '', checkedAt: Date.now() }
}

async function syncVault(state, action, manual = false) {
  const cfg = state.cfg
  const now = new Date()
  const oneDrive = isUnderOneDrive(cfg.vaultDir)
  if (!cfg.git.enabled) {
    // Default sync is the synced folder itself (OneDrive when available).
    // Git stays available as an opt-in config; if the vault happens to be a
    // Git repository we mention it instead of silently ignoring that fact.
    const gitRepo = existsSync(join(cfg.vaultDir, '.git'))
    const base = oneDrive
      ? `vault 位于 OneDrive 文件夹（${cfg.vaultDir}），同步由 OneDrive 客户端完成；不需要额外操作。`
      : `vault 位于普通文件夹（${cfg.vaultDir}）。把它放进 OneDrive/iCloud/Dropbox 即可多设备同步。`
    const result = {
      ok: true,
      mode: oneDrive ? 'onedrive' : 'folder',
      output: gitRepo
        ? `${base}\n检测到这是 Git 仓库，但 Git 同步未启用（默认不配置 Git）。需要时在 profile 补丁层给 vc-memory 行加 git.enabled: true。`
        : base,
      last: { at: now.toISOString(), ok: true, message: 'folder sync' },
    }
    state.lastSync = result.last
    return result
  }
  const cwd = cfg.vaultDir
  const inside = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    const result = {
      ok: false,
      mode: 'git',
      output: `vault 不是 Git 仓库。先执行：\n  cd "${cwd}"\n  git init\n  git remote add origin <你的仓库地址>\n然后在 cordis.patch.yml 中把 vc-memory 的 git.enabled 设为 true。\n\n${truncate((inside.stderr || '').trim(), 300)}`,
      last: { at: now.toISOString(), ok: false, message: 'not a git repository' },
    }
    state.lastSync = result.last
    return result
  }
  const log = []
  if (action !== 'status') {
    const add = await runGit(cwd, ['add', '-A'])
    if (!add.ok) log.push(`git add 失败：${truncate(add.stderr.trim(), 200)}`)
    const dirty = await runGit(cwd, ['status', '--porcelain'])
    if (dirty.ok && dirty.stdout.trim()) {
      const commit = await runGit(cwd, ['commit', '-m', `vc-memory: ${today()} ${fmtTime(now)} sync`])
      log.push(commit.ok ? '已提交本地变更' : `git commit 失败：${truncate((commit.stderr || commit.stdout).trim(), 200)}`)
    } else {
      log.push('没有待提交的变更')
    }
    if (action === 'push' || cfg.git.autoPush) {
      const args = ['push']
      if (cfg.git.remote) args.push(cfg.git.remote)
      if (cfg.git.branch) args.push(cfg.git.branch)
      const push = await runGit(cwd, args)
      log.push(push.ok ? '已推送到远程' : `git push 失败：${truncate(push.stderr.trim(), 300)}`)
      if (!push.ok && /no upstream|set-upstream/i.test(push.stderr)) {
        log.push(`提示：git push -u ${cfg.git.remote} <branch> 设置上游分支后即可自动推送。`)
      }
    }
  } else {
    const status = await runGit(cwd, ['status', '--short', '--branch'])
    log.push(status.stdout.trim() || '工作区干净')
  }
  const ok = !log.some((l) => l.includes('失败'))
  const result = {
    ok,
    mode: 'git',
    output: log.join('\n'),
    last: { at: now.toISOString(), ok, message: truncate(log.join(' · '), 200) },
  }
  state.lastSync = result.last
  await refreshGit(state)
  if (manual) {
    await appendLog(state, '同步', 'Git',
      ok ? (action === 'push' ? '提交并推送完成' : action === 'commit' ? '提交完成' : '查看状态') : `失败：${truncate(result.output, 120)}`)
  }
  return result
}

// ── core operations (one implementation, used by tool and HTTP API) ────

async function upsertEntry(state, payload) {
  const cfg = state.cfg
  const p = payload && typeof payload === 'object' ? payload : {}
  // locate an existing entry
  let type = p.type === 'industry' ? 'industry' : p.type === 'project' ? 'project' : null
  let slug = null
  if (p.id) {
    const parts = idParts(p.id)
    if (!parts) throw new Error(`无效 id：${p.id}（应形如 项目/aurora-ai 或 行业/ai-infra）`)
    type = TYPE_BY_DIR[parts.dir]
    slug = parts.slug
  } else {
    const name = String(p.name ?? '').trim()
    if (!name) throw new Error('新建条目需要 name')
    if (!type) type = 'project'
    const hit = state.entries.find((e) => e.type === type && (
      e.name.toLowerCase() === name.toLowerCase() ||
      e.aliases.some((a) => String(a).toLowerCase() === name.toLowerCase())
    ))
    if (hit) {
      const parts = idParts(hit.id)
      slug = parts.slug
    }
  }
  if (!type) throw new Error('无法确定条目类型（project 或 industry）')
  if (!slug) slug = slugify(p.name || 'entry')

  let file = null
  try {
    file = await readEntryFile(cfg, type, slug)
  } catch { /* new entry */ }

  const fm = file ? { ...file.fm } : {}
  const sections = file ? file.sections : new Map()
  let preamble = file ? file.preamble : ''
  const now = today()
  const isNew = !file
  const oldName = fm.name ? String(fm.name) : ''
  // Snapshot before mutation, so the change log can say what actually changed.
  const before = file ? {
    name: fm.name,
    verdict: fm.verdict,
    confidence: fm.confidence,
    nextReview: fm.next_review,
    sections: new Map(sections.entries()),
  } : null

  if (isNew) {
    fm.type = type
    fm.created = now
    fm.review_cycle_days = clampInt(p.reviewCycleDays, 1, 3650, cfg.reviewCycleDays)
    fm.next_review = addDays(now, fm.review_cycle_days)
    if (p.example === true) fm.example = true
  }
  // scalar fields: only overwrite what the caller provided
  const assign = (key, value) => { if (value !== undefined && value !== null && value !== '') fm[key] = value }
  assign('name', typeof p.name === 'string' ? p.name.trim() : undefined)
  assign('sector', typeof p.sector === 'string' ? p.sector.trim() : undefined)
  assign('stage', typeof p.stage === 'string' ? p.stage.trim() : undefined)
  if (p.verdict !== undefined && p.verdict !== null) {
    if (!VERDICTS.includes(p.verdict)) throw new Error(`无效判断：${p.verdict}（可选 ${VERDICTS.join('/')}）`)
    fm.verdict = p.verdict
  }
  if (p.confidence !== undefined && p.confidence !== null) fm.confidence = clampInt(p.confidence, 1, 5, fm.confidence ?? 3)
  if (Array.isArray(p.tags)) fm.tags = asArray(p.tags)
  if (Array.isArray(p.aliases)) fm.aliases = asArray(p.aliases)
  if (Array.isArray(p.links)) fm.links = asArray(p.links)
  if (p.reviewCycleDays !== undefined && p.reviewCycleDays !== null) {
    fm.review_cycle_days = clampInt(p.reviewCycleDays, 1, 3650, cfg.reviewCycleDays)
    fm.next_review = addDays(fm.last_reviewed || now, fm.review_cycle_days)
  }
  if (!fm.name) fm.name = String(p.name || slug)
  fm.updated = now
  fm.id = `${TYPES[type].dir}/${slug}`

  // preamble: keep hand-written intro, but keep the H1 in sync with name
  if (!preamble) preamble = `# ${fm.name}`
  else if (oldName && String(fm.name) !== oldName) preamble = preamble.replace(/^#\s+.*$/m, `# ${fm.name}`)

  // sections
  const setSection = (title, text) => {
    if (typeof text !== 'string') return
    sections.set(title, text.trim() === '' ? '' : text.trim())
  }
  setSection('一句话判断', p.summary)
  setSection('判断依据', p.thesis)
  setSection('关键假设', p.assumptions)
  setSection('风险与反证', p.risks)
  if (typeof p.evidence === 'string' && p.evidence.trim()) {
    const prev = (sections.get('证据与时间线') || '').trim()
    const looksLikeList = /^[-*]\s/m.test(p.evidence)
    const line = looksLikeList ? p.evidence.trim() : `- ${now} · ${p.evidence.trim()}`
    sections.set('证据与时间线', prev ? `${prev}\n${line}` : line)
  }
  for (const title of KNOWN_TITLES) if (!sections.has(title)) sections.set(title, '')
  const body = rebuildBody(preamble, sections)
  const text = serializeFrontmatter(fm) + '\n' + body
  await writeFile(absOf(cfg, type, slug), text, 'utf8')
  const after = await readEntryFile(cfg, type, slug)
  await refresh(state)
  const changes = []
  if (!isNew && before) {
    if (String(before.name ?? '') !== String(fm.name ?? '')) changes.push(`名称 ${before.name || '—'}→${fm.name}`)
    if (String(before.verdict ?? '') !== String(fm.verdict ?? '')) changes.push(`判断 ${before.verdict || '—'}→${fm.verdict || '—'}`)
    if (String(before.confidence ?? '') !== String(fm.confidence ?? '')) changes.push(`置信度 ${before.confidence ?? '—'}→${fm.confidence ?? '—'}`)
    if (String(before.nextReview ?? '') !== String(fm.next_review ?? '')) changes.push(`下次复盘 ${before.nextReview || '—'}→${fm.next_review || '—'}`)
    const changedSections = KNOWN_TITLES.filter((title) => String(before.sections.get(title) ?? '') !== String(sections.get(title) ?? ''))
    if (changedSections.length) changes.push(`正文 ${changedSections.join('、')}`)
  }
  await appendLog(state, isNew ? '新建' : '更新', `${TYPES[type].dir}/${slug}`,
    isNew
      ? `${fm.verdict || '未判断'}${fm.confidence ? `（置信度 ${fm.confidence}）` : ''}${fm.sector ? ` · ${fm.sector}` : ''}`
      : (changes.join('；') || '内容更新'))
  if (cfg.git.enabled && cfg.git.autoCommit) { try { await syncVault(state, cfg.git.autoPush ? 'push' : 'commit') } catch { /* recorded in lastSync */ } }
  return { created: isNew, entry: toMeta(after.fm, type, slug, after.sections, cfg), file: relOf(type, slug) }
}

async function reviewEntry(state, payload) {
  const cfg = state.cfg
  const p = payload && typeof payload === 'object' ? payload : {}
  if (!p.id) throw new Error('复盘需要 id')
  const parts = idParts(p.id)
  if (!parts) throw new Error(`无效 id：${p.id}`)
  const type = TYPE_BY_DIR[parts.dir]
  let file
  try { file = await readEntryFile(cfg, type, parts.slug) } catch { throw new Error(`找不到条目：${p.id}`) }
  const fm = { ...file.fm }
  const sections = file.sections
  const date = today()
  const lines = [`### ${date} · 复盘`]
  const add = (label, value) => {
    const v = String(value ?? '').trim()
    if (!v) return
    lines.push(`- ${label}：${v.replace(/\n/g, '\n  ')}`)
  }
  add('结论', p.outcome || '已复盘')
  add('进展/证据', p.progress)
  add('判断偏差', p.deviation)
  const nextVerdict = p.nextVerdict && VERDICTS.includes(p.nextVerdict) ? p.nextVerdict : (fm.verdict || '')
  const confidence = p.confidence !== undefined && p.confidence !== null
    ? clampInt(p.confidence, 1, 5, fm.confidence || 3)
    : (fm.confidence ? Number(fm.confidence) : undefined)
  if (p.nextVerdict && !VERDICTS.includes(p.nextVerdict)) throw new Error(`无效 nextVerdict：${p.nextVerdict}`)
  fm.last_reviewed = date
  if (p.nextVerdict) fm.verdict = p.nextVerdict
  if (p.confidence !== undefined && p.confidence !== null) fm.confidence = confidence
  const cycle = clampInt(fm.review_cycle_days, 1, 3650, cfg.reviewCycleDays)
  if (p.nextReview !== undefined && p.nextReview !== null && String(p.nextReview).trim() !== '' && !parseDay(p.nextReview)) {
    throw new Error(`nextReview 需要 YYYY-MM-DD，收到：${p.nextReview}`)
  }
  const nextReview = parseDay(p.nextReview) ? String(p.nextReview).trim() : addDays(date, cycle)
  fm.next_review = nextReview
  if (nextVerdict) lines.push(`- 更新判断：${nextVerdict}${confidence ? `（置信度 ${confidence}）` : ''}`)
  lines.push(`- 下次复盘：${nextReview}`)
  add('补充', p.notes)
  const prev = (sections.get('复盘记录') || '').trim()
  sections.set('复盘记录', prev ? `${prev}\n\n${lines.join('\n')}` : lines.join('\n'))
  fm.updated = date
  fm.id = p.id
  const preamble = file.preamble || `# ${fm.name || parts.slug}`
  const body = rebuildBody(preamble, sections)
  await writeFile(absOf(cfg, type, parts.slug), serializeFrontmatter(fm) + '\n' + body, 'utf8')
  const after = await readEntryFile(cfg, type, parts.slug)
  await refresh(state)
  await appendLog(state, '复盘', p.id,
    `结论：${p.outcome || '已复盘'}${fm.verdict ? ` · 判断：${fm.verdict}` : ''}${confidence ? `（置信度 ${confidence}）` : ''} · 下次：${nextReview}`)
  if (cfg.git.enabled && cfg.git.autoCommit) { try { await syncVault(state, cfg.git.autoPush ? 'push' : 'commit') } catch { /* ignore */ } }
  return { ok: true, entry: toMeta(after.fm, type, parts.slug, after.sections, cfg), markdown: after.text }
}

// ── industry operations: theme / sector / view ────────────────────────

function toLines(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  return []
}
function safeSegment(name) { return slugify(name) }
function findTheme(state, name) {
  const key = String(name || '').trim()
  return (state.themes || []).find((t) => t.name === key || t.dir === key || t.dir === safeSegment(key))
}
function findSector(theme, name) {
  const key = String(name || '').trim()
  return (theme?.sectors || []).find((s) => s.name === key || s.file === `${key}.md` || s.file === `${safeSegment(key)}.md`)
}
function isThemeSelector(sector) {
  const s = String(sector || '').trim()
  return s === '' || s === '_主题' || s === '主题' || s === '_theme'
}
function boardViewId(board, view) {
  const base = board.sector
    ? `行业/${board.theme.dir}/${board.sector.file.replace(/\.md$/i, '')}`
    : `行业/${board.theme.dir}/_主题`
  return `${base}${view.id}`
}
async function resolveIndustryBoard(state, themeName, sectorName) {
  const theme = findTheme(state, themeName)
  if (!theme) throw new Error(`找不到主题：${themeName}`)
  const isTheme = isThemeSelector(sectorName)
  const sector = isTheme ? null : findSector(theme, sectorName)
  if (!isTheme && !sector) throw new Error(`主题「${theme.name}」下找不到细分赛道：${sectorName}`)
  const path = sector ? sectorPath(state.cfg, theme.dir, sector.file.replace(/\.md$/i, '')) : themePath(state.cfg, theme.dir)
  const text = await readFile(path, 'utf8')
  const parsed = sector ? parseSectorBoard(text) : parseThemeBoard(text)
  return { theme, sector, isTheme, path, parsed, dir: theme.dir }
}
async function writeSectorBoard(state, theme, fileBase, displayName, scope, views, archived, sectorLabel = '') {
  const updated = today()
  const text = serializeBoard({ kind: 'sector', name: displayName, sector: sectorLabel, scope, updated, views, archived })
  await writeFile(sectorPath(state.cfg, theme.dir, fileBase), text, 'utf8')
}
async function writeThemeBoard(state, theme, scope, views, archived) {
  const sectors = (theme.sectors || []).map((s) => ({ name: s.name, views: s.views, viewCount: s.views.length }))
  const text = serializeBoard({ kind: 'theme', name: theme.name, scope, updated: today(), views, archived, sectors })
  await writeFile(themePath(state.cfg, theme.dir), text, 'utf8')
}
async function rewriteThemeIndex(state, themeName) {
  const theme = findTheme(state, themeName)
  if (!theme) return
  const sectors = await readSectorSummaries(state.cfg, theme.dir)
  let parsed = { scope: theme.scope || '', views: [], archived: [] }
  try { parsed = parseThemeBoard(await readFile(themePath(state.cfg, theme.dir), 'utf8')) } catch { /* new theme */ }
  const text = serializeBoard({
    kind: 'theme', name: theme.name, scope: parsed.scope || theme.scope || '', updated: today(),
    views: parsed.views, archived: parsed.archived, sectors,
  })
  await writeFile(themePath(state.cfg, theme.dir), text, 'utf8')
}

async function createThemeOp(state, args) {
  const name = String(args?.name || args?.theme || '').trim()
  const scope = String(args?.scope || args?.themeScope || '').trim()
  if (!name) throw new Error('新建主题需要 name')
  if (!scope) throw new Error('新建主题需要 scope（一句话范围句）')
  const existing = findTheme(state, name)
  if (existing) throw new Error(`主题已存在：${existing.name}`)
  const dir = safeSegment(name)
  if (existsSync(themePath(state.cfg, dir))) throw new Error(`主题目录已存在：行业/${dir}`)
  if (args?.confirm !== true) {
    return { ok: true, proposed: true, kind: 'theme', name, dir, scope, path: `行业/${dir}/_主题.md`, message: '需要用户确认后创建' }
  }
  await mkdir(industryDir(state.cfg, dir), { recursive: true })
  await writeFile(themePath(state.cfg, dir), serializeBoard({ kind: 'theme', name, scope, updated: today(), views: [], archived: [], sectors: [] }), 'utf8')
  await refresh(state)
  await appendLog(state, '新建主题', `行业/${dir}/_主题`, `范围：${truncate(scope, 80)}`)
  return { ok: true, created: true, kind: 'theme', theme: { id: `行业/${dir}/_主题`, name, dir, scope, views: [], archived: [], sectors: [] } }
}

async function createSectorOp(state, args) {
  const themeName = String(args?.theme || '').trim()
  const name = String(args?.name || args?.sector || '').trim()
  const scope = String(args?.scope || '').trim()
  const conclusion = String(args?.conclusion || '').trim()
  if (!themeName) throw new Error('新建细分赛道需要 theme（所属主题）')
  if (!name) throw new Error('新建细分赛道需要 name')
  if (!scope) throw new Error('新建细分赛道需要 scope（一句话范围句）')
  if (!conclusion) throw new Error('新建细分赛道需要 conclusion（第一条观点）')
  const status = VIEW_STATUSES.includes(args?.status) ? args.status : '待验证'
  let theme = findTheme(state, themeName)
  if (!theme) {
    if (args?.confirm !== true) {
      return { ok: true, proposed: true, kind: 'sector', themeName, name, scope, conclusion, message: '主题不存在；确认后将一并创建主题和细分赛道' }
    }
    await createThemeOp(state, { name: themeName, scope: String(args?.themeScope || scope), confirm: true })
    await refresh(state)
    theme = findTheme(state, themeName)
  }
  if (findSector(theme, name)) throw new Error(`细分赛道已存在：${name}`)
  if (args?.confirm !== true) {
    return { ok: true, proposed: true, kind: 'sector', theme: theme.name, name, scope, conclusion, message: '需要用户确认后创建' }
  }
  const fileBase = safeSegment(name)
  if (existsSync(sectorPath(state.cfg, theme.dir, fileBase))) throw new Error(`细分赛道文件已存在：行业/${theme.dir}/${fileBase}.md`)
  const prefix = String(args?.viewPrefix || name).trim()
  const view = {
    id: nextViewId([], prefix), date: today(), conclusion, status,
    evidence: toLines(args?.evidence), counter: toLines(args?.counter), related: toLines(args?.related),
  }
  await mkdir(industryDir(state.cfg, theme.dir), { recursive: true })
  await writeFile(sectorPath(state.cfg, theme.dir, fileBase), serializeBoard({
    kind: 'sector', name, sector: String(args?.sectorLabel || ''), scope, updated: today(), views: [view], archived: [],
  }), 'utf8')
  await refresh(state)
  await rewriteThemeIndex(state, theme.name)
  await appendLog(state, '新建细分赛道', `行业/${theme.dir}/${fileBase}`, `范围：${truncate(scope, 80)}`)
  await appendLog(state, '新建观点', `行业/${theme.dir}/${fileBase}${view.id}`, `${truncate(conclusion, 80)}（${status}）`)
  return {
    ok: true, created: true, kind: 'sector',
    sector: { id: `行业/${theme.dir}/${fileBase}`, name, file: `${fileBase}.md`, scope, views: [view], archived: [] },
    view,
  }
}

async function viewOp(state, args) {
  const op = String(args?.op || args?.viewAction || 'add').toLowerCase()
  const board = await resolveIndustryBoard(state, args?.theme, args?.sector)
  const views = [...board.parsed.views]
  const archived = [...board.parsed.archived]
  const scope = board.parsed.scope || ''
  const fileBase = board.sector ? board.sector.file.replace(/\.md$/i, '') : null
  const displayName = board.sector ? board.sector.name : board.theme.name
  const prefix = String(args?.viewPrefix || displayName).trim()
  const write = async () => {
    if (board.isTheme) await writeThemeBoard(state, board.theme, scope, views, archived)
    else await writeSectorBoard(state, board.theme, fileBase, displayName, scope, views, archived, board.sector?.sector || '')
  }
  if (op === 'add') {
    const conclusion = String(args?.conclusion || '').trim()
    if (!conclusion) throw new Error('新增观点需要 conclusion')
    const view = {
      id: nextViewId(views, prefix), date: today(), conclusion,
      status: VIEW_STATUSES.includes(args?.status) ? args.status : '待验证',
      evidence: toLines(args?.evidence), counter: toLines(args?.counter), related: toLines(args?.related),
    }
    views.push(view)
    await write()
    await refresh(state)
    await appendLog(state, '新建观点', boardViewId({ ...board, sector: board.sector }, view), `${truncate(conclusion, 80)}（${view.status}）`)
    return { ok: true, op: 'add', view, boardId: board.isTheme ? `行业/${board.theme.dir}/_主题` : `行业/${board.theme.dir}/${fileBase}` }
  }
  const id = String(args?.id || '').trim()
  const wanted = id.startsWith('#') ? id : `#${id}`
  const index = views.findIndex((v) => v.id === wanted)
  if (index < 0) throw new Error(`找不到观点：${id}`)
  const view = views[index]
  if (op === 'revise') {
    const oldConclusion = view.conclusion
    const oldStatus = view.status
    if (typeof args?.conclusion === 'string' && args.conclusion.trim()) view.conclusion = args.conclusion.trim()
    if (VIEW_STATUSES.includes(args?.status)) view.status = args.status
    if (args?.evidence !== undefined) view.evidence = toLines(args.evidence)
    if (args?.counter !== undefined) view.counter = toLines(args.counter)
    if (args?.related !== undefined) view.related = toLines(args.related)
    if (typeof args?.reason === 'string' && args.reason.trim()) view.counter.push(args.reason.trim())
    view.date = today()
    await write()
    await refresh(state)
    await appendLog(state, '修正观点', boardViewId(board, view),
      `“${truncate(oldConclusion, 60)}”→“${truncate(view.conclusion, 60)}”（${oldStatus}→${view.status}）${args?.reason ? `；${truncate(args.reason, 60)}` : ''}`)
    return { ok: true, op, view, boardId: board.isTheme ? `行业/${board.theme.dir}/_主题` : `行业/${board.theme.dir}/${fileBase}` }
  }
  if (op === 'weaken' || op === 'falsify') {
    view.status = op === 'weaken' ? '被削弱' : '已证伪'
    view.date = today()
    if (typeof args?.reason === 'string' && args.reason.trim()) view.counter.push(args.reason.trim())
    await write()
    await refresh(state)
    await appendLog(state, op === 'weaken' ? '削弱观点' : '证伪观点', boardViewId(board, view), truncate(args?.reason || view.conclusion, 120))
    return { ok: true, op, view, boardId: board.isTheme ? `行业/${board.theme.dir}/_主题` : `行业/${board.theme.dir}/${fileBase}` }
  }
  if (op === 'archive') {
    views.splice(index, 1)
    archived.push({ id: view.id, status: '已归档', date: today(), conclusion: view.conclusion, reason: String(args?.reason || '') })
    await write()
    await refresh(state)
    await appendLog(state, '归档观点', boardViewId(board, view), `${truncate(view.conclusion, 80)}${args?.reason ? `；${truncate(args.reason, 60)}` : ''}`)
    return { ok: true, op, archived: view, boardId: board.isTheme ? `行业/${board.theme.dir}/_主题` : `行业/${board.theme.dir}/${fileBase}` }
  }
  throw new Error(`未知观点操作：${op}（add/revise/weaken/falsify/archive）`)
}

async function readIndustryByToolId(state, id) {
  const text = String(id || '').trim()
  const m = /^行业\/([^/]+)\/([^#/]+)(?:#(.+))?$/.exec(text)
  if (!m) return null
  const themeName = decodeURIComponent(m[1])
  const target = decodeURIComponent(m[2])
  const board = await resolveIndustryBoard(state, themeName, target === '_主题' ? '' : target)
  if (m[3]) {
    const wanted = m[3].startsWith('#') ? m[3] : `#${m[3]}`
    const view = [...board.parsed.views, ...board.parsed.archived].find((v) => v.id === wanted)
    if (!view) throw new Error(`找不到观点：${m[3]}`)
    return { board, view }
  }
  return { board }
}

function countByVerdict(entries) {
  const out = new Map()
  for (const e of entries) {
    const k = e.verdict || '未标注'
    out.set(k, (out.get(k) || 0) + 1)
  }
  return out
}

function maintenanceProposals(themes) {
  const proposals = []
  for (const theme of themes) {
    const sectors = theme.sectors || []
    for (const sector of sectors) {
      const views = sector.views || []
      const related = new Set(views.flatMap((v) => v.related || []))
      if (views.length >= 15) proposals.push({ kind: '拆分', target: `${theme.name} / ${sector.name}`, reason: `活跃观点 ${views.length} 条（>15），建议按环节/客户拆分` })
      else if (related.size >= 20) proposals.push({ kind: '拆分', target: `${theme.name} / ${sector.name}`, reason: `关联 ${related.size} 个项目/对象（>20），建议按可比公司集合拆分` })
    }
    for (let i = 0; i < sectors.length; i += 1) {
      for (let j = i + 1; j < sectors.length; j += 1) {
        const a = sectors[i]; const b = sectors[j]
        const sa = new Set((a.views || []).flatMap((v) => v.related || []))
        const sb = new Set((b.views || []).flatMap((v) => v.related || []))
        if (sa.size === 0 || sb.size === 0) continue
        const shared = [...sa].filter((x) => sb.has(x)).length
        const ratio = shared / Math.min(sa.size, sb.size)
        if (shared >= 3 && ratio >= 0.8) proposals.push({ kind: '合并', target: `${theme.name} / ${a.name} + ${b.name}`, reason: `关联对象重叠 ${shared} 个（${Math.round(ratio * 100)}%），可能属于同一可比集合` })
      }
    }
    if (sectors.length === 1 && (theme.views || []).length === 0) {
      proposals.push({ kind: '结构检查', target: theme.name, reason: '主题只有 1 个细分赛道且无跨赛道观点；可考虑并入其他主题或继续观察' })
    }
  }
  return proposals
}

async function buildDigest(state, period, save = true) {
  const cfg = state.cfg
  const now = new Date()
  const isMonth = period === 'month'
  const isDay = period === 'day'
  const from = isDay ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : isMonth ? startOfMonth(now) : startOfWeek(now)
  const start = fmtDate(from)
  const end = fmtDate(now)
  const scan = await scanVault(cfg)
  const entries = scan.entries
  const themes = scan.themes || []
  const sectorCount = themes.reduce((n, t) => n + (t.sectors?.length || 0), 0)
  const viewCount = themes.reduce((n, t) => n + (t.views?.length || 0) + (t.sectors || []).reduce((m, s) => m + (s.views?.length || 0), 0), 0)
  const inRange = (d) => !!d && d >= start && d <= end
  const logEntries = await readLogEntries(cfg)
  const industryActions = new Set(['新建主题', '新建细分赛道', '新建观点', '修正观点', '削弱观点', '证伪观点', '归档观点', '迁移观点', '拆分', '合并'])
  const industryEvents = logEntries.filter((e) => inRange(e.date) && industryActions.has(e.action))
  const created = entries.filter((e) => inRange(e.created))
  const reviewed = scan.reviews.filter((r) => inRange(r.date)).sort((a, b) => b.date.localeCompare(a.date))
  const updatedOnly = entries.filter((e) => inRange(e.updated) && !created.includes(e) && !reviewed.some((r) => r.id === e.id))
  const due = entries.filter((e) => e.due)
  const verdicts = countByVerdict(entries)
  const periodName = isDay ? fmtDate(now) : isMonth ? `${now.getFullYear()}-${pad2(now.getMonth() + 1)}` : isoWeekLabel(now)
  const title = isDay ? `${periodName} 投资记忆日报` : isMonth ? `${periodName} 投资记忆月报` : `${periodName} 投资记忆周报`
  const file = `${DIGEST_DIR}/${periodName}.md`
  const line = (e) => {
    const bits = [TYPES[e.type].label]
    if (e.sector) bits.push(e.sector)
    if (e.stage) bits.push(e.stage)
    if (e.verdict) bits.push(e.verdict)
    return `**${e.name}**（${bits.join(' · ')}）`
  }
  const out = []
  out.push(`# ${title}`)
  out.push('')
  out.push(`> 统计区间 ${start} ~ ${end} · 生成于 ${fmtDate(now)} ${fmtTime(now)}`)
  out.push('')
  out.push('## 概览')
  out.push('')
  out.push(`- 记录总数：项目 ${entries.filter((e) => e.type === 'project').length} · 主题 ${themes.length} · 细分赛道 ${sectorCount} · 行业观点 ${viewCount}`)
  out.push(`- 本期新增项目：${created.length} · 本期项目复盘：${reviewed.length} · 项目到期：${due.length}`)
  out.push('')
  if (created.length) {
    out.push('## 本期新增')
    out.push('')
    for (const e of created) out.push(`- ${line(e)}${e.summary ? ` — ${e.summary}` : ''}`)
    out.push('')
  }
  if (reviewed.length) {
    out.push('## 本期复盘')
    out.push('')
    for (const r of reviewed) {
      const meta = entries.find((e) => e.id === r.id)
      out.push(`- **${r.name}** · ${r.date}${meta && meta.verdict ? ` · 当前判断 ${meta.verdict}` : ''}`)
    }
    out.push('')
  }
  if (updatedOnly.length) {
    out.push('## 本期更新（未复盘）')
    out.push('')
    for (const e of updatedOnly) out.push(`- ${line(e)}${e.summary ? ` — ${e.summary}` : ''}`)
    out.push('')
  }
  if (due.length) {
    out.push('## 到期未复盘')
    out.push('')
    for (const e of due) {
      const overdue = typeof e.dueInDays === 'number' && e.dueInDays < 0 ? `逾期 ${Math.abs(e.dueInDays)} 天` : '今天到期'
      out.push(`- ${line(e)} · ${overdue}（下次复盘 ${e.nextReview || '未设置'}）`)
    }
    out.push('')
  }
  out.push('## 行业观点变化（按主题）')
  out.push('')
  if (industryEvents.length) {
    const byTheme = new Map()
    for (const event of industryEvents) {
      const m = /^行业\/([^/]+)\//.exec(event.id)
      const theme = m ? m[1] : '（未归属）'
      if (!byTheme.has(theme)) byTheme.set(theme, [])
      byTheme.get(theme).push(event)
    }
    for (const [theme, events] of byTheme) {
      out.push(`### ${theme}`)
      for (const event of events) out.push(`- ${event.action}：${event.id} · ${event.summary}`)
      out.push('')
    }
  } else {
    out.push('本期没有行业观点变化。')
    out.push('')
  }
  if (themes.length) {
    out.push('## 行业看板')
    out.push('')
    for (const theme of themes) {
      out.push(`- **${theme.name}**：${(theme.sectors || []).length} 赛道 · ${(theme.views || []).length} 跨赛道观点`)
      for (const sector of theme.sectors || []) {
        out.push(`  - ${sector.name}：${(sector.views || []).length} 条观点（${statusLine(sector.views || [])}）`)
      }
    }
    out.push('')
  }
  out.push('## 拆分/合并提议')
  out.push('')
  const proposals = maintenanceProposals(themes)
  if (proposals.length) {
    for (const p of proposals) out.push(`- [${p.kind}] ${p.target}：${p.reason}`)
  } else {
    out.push('暂无拆分/合并提议。')
  }
  out.push('')
  out.push('## 项目判断分布')
  out.push('')
  out.push('| 判断 | 数量 |')
  out.push('| --- | --- |')
  for (const v of [...VERDICTS, '未标注']) {
    const n = verdicts.get(v) || 0
    if (n) out.push(`| ${v} | ${n} |`)
  }
  out.push('')
  out.push('## 本轮要回答的问题')
  out.push('')
  if (due.length) for (const e of due) out.push(`- [ ] ${e.name}：上次判断的哪个关键假设被证据加强或削弱了？`)
  const open = entries.filter((e) => !e.due && e.type === 'project').slice(0, 3)
  for (const e of open) out.push(`- [ ] ${e.name}：本期的进展是否值得调整置信度？`)
  if (!due.length && !open.length) out.push('- [ ] 先记录第一个项目或行业判断。')
  out.push('')
  const markdown = out.join('\n')
  let saved = false
  if (save) {
    await mkdir(join(cfg.vaultDir, DIGEST_DIR), { recursive: true })
    await writeFile(join(cfg.vaultDir, DIGEST_DIR, `${periodName}.md`), markdown, 'utf8')
    saved = true
    await refresh(state)
    await appendLog(state, '简报', file, `新增 ${created.length} / 项目复盘 ${reviewed.length} / 行业变化 ${industryEvents.length} / 到期 ${due.length}`)
  }
  return { ok: true, period: isDay ? 'day' : isMonth ? 'month' : 'week', title, file, markdown, saved }
}

async function searchEntries(state, q) {
  const query = String(q ?? '').trim()
  if (!query) return []
  const lower = query.toLowerCase()
  const matches = []
  for (const e of state.entries) {
    if ([e.name, e.sector, e.stage, e.summary, ...e.tags, ...e.aliases].some((v) => String(v ?? '').toLowerCase().includes(lower))) {
      matches.push({ entry: e, snippet: e.summary || e.sector || '' })
      continue
    }
    try {
      const parts = idParts(e.id)
      const file = await readEntryFile(state.cfg, TYPE_BY_DIR[parts.dir], parts.slug)
      const idx = file.text.toLowerCase().indexOf(lower)
      if (idx >= 0) {
        const from = Math.max(0, idx - 40)
        matches.push({ entry: e, snippet: '…' + file.text.slice(from, idx + query.length + 60).replace(/\s+/g, ' ') + '…' })
      }
    } catch { /* skip unreadable */ }
  }
  // Industry boards: theme name/scope + every view conclusion/evidence/counter.
  for (const theme of state.themes || []) {
    const boards = [{ name: '主题', id: `行业/${theme.dir}/_主题`, views: theme.views || [] }]
    for (const sector of theme.sectors || []) {
      boards.push({ name: sector.name, id: `行业/${theme.dir}/${sector.file.replace(/\.md$/i, '')}`, views: sector.views || [] })
    }
    for (const board of boards) {
      for (const view of board.views) {
        const haystack = [view.conclusion, ...(view.evidence || []), ...(view.counter || []), ...(view.related || []), theme.name, board.name].join(' ').toLowerCase()
        if (haystack.includes(lower)) {
          matches.push({
            entry: { id: `${board.id}${view.id}`, type: 'industry', name: `${theme.name} / ${board.name} ${view.id}`, sector: theme.name, summary: view.conclusion, due: false },
            snippet: `${view.status} · ${view.date} · ${truncate(view.conclusion, 120)}`,
          })
        }
      }
    }
  }
  return matches
}

// ── digest scheduler ───────────────────────────────────────────────────

function digestDue(cfg, now = new Date()) {
  if (cfg.autoDigest === 'off') return null
  const period = cfg.autoDigest === 'monthly' ? 'month' : cfg.autoDigest === 'daily' ? 'day' : 'week'
  const name = period === 'month'
    ? `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
    : period === 'week' ? isoWeekLabel(now) : fmtDate(now)
  const fileName = `${name}.md`
  if (existsSync(join(cfg.vaultDir, DIGEST_DIR, fileName))) return null
  let scheduled
  if (period === 'month') {
    const day = Math.min(cfg.digestWeekday, 28)
    scheduled = new Date(now.getFullYear(), now.getMonth(), day, cfg.digestHour, 0, 0, 0)
  } else if (period === 'week') {
    // digestWeekday is an ISO weekday (1 = Monday … 7 = Sunday) for weekly digests.
    const monday = startOfWeek(now)
    const offset = (Math.max(1, Math.min(7, cfg.digestWeekday)) - 1)
    scheduled = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset, cfg.digestHour, 0, 0, 0)
  } else {
    scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cfg.digestHour, 0, 0, 0)
  }
  if (now.getTime() < scheduled.getTime()) return null
  return { period, name: fileName }
}
async function autoDigestTick(state) {
  const due = digestDue(state.cfg)
  if (!due) return
  try {
    const result = await buildDigest(state, due.period, true)
    state.lastDigest = { at: new Date().toISOString(), file: result.file }
    logInfo(state, `自动生成简报：${result.file}`)
  } catch (e) {
    state.warnings = [...(state.warnings || []), `自动简报失败：${msg(e)}`]
  }
}

// ── prompt section ─────────────────────────────────────────────────────

function buildPromptText(state) {
  const cfg = state.cfg
  const entries = state.entries || []
  const due = entries.filter((e) => e.due)
  const themes = state.themes || []
  const sectorCount = themes.reduce((n, t) => n + (t.sectors?.length || 0), 0)
  const viewCount = themes.reduce((n, t) => n + (t.views?.length || 0) + (t.sectors || []).reduce((m, s) => m + (s.views?.length || 0), 0), 0)
  const head = `## 投资记忆（vc-memory）
vault: ${cfg.vaultDir}（Markdown，可由 OneDrive/Git 同步；项目 ${entries.filter((e) => e.type === 'project').length} · 主题 ${themes.length} · 细分赛道 ${sectorCount} · 行业观点 ${viewCount}）`
  const rules = `- 用户谈到具体项目/公司/行业时，先 vc_memory(search) 或 vc_memory(read) 回忆已有判断，再结合新信息回答；记忆里没有就直说"记忆中没有"。
- 项目判断用 vc_memory(upsert)（不要重复建条目）；行业观点用 vc_memory(view) 的 add/revise/weaken/falsify/archive 操作，观点格式是「时间戳 + 当前结论 + 状态」，修正时原地更新并让日志记录旧→新。
- 主题/细分赛道是文件结构：默认只在用户确认后创建；只有用户明确说"记一下这个行业/赛道"且没有对应板时，才可以用 vc_memory(theme/sector, confirm:true) 直接建一个主题 + 一个细分赛道（必须写范围句、初始观点）。不要凭模型判断新建结构。
- 复盘/周报：项目用 vc_memory(review)，总结用 vc_memory(digest)；行业观点不设下次复盘日期，按事件修正。
- 只记录投资判断与证据，不记录闲聊；证据注明来源与日期，不编造。`
  if (!entries.length && !themes.length) return `${head}\n${rules}\n- 当前 vault 还没有记录；用户要记录项目用 upsert，行业用 theme/sector 建板后 view 添加观点。`
  const dueLine = due.length
    ? `\n项目到期复盘（${due.length}）：` + due.slice(0, 5).map((e) => `${e.name}${e.dueInDays < 0 ? `（逾期 ${Math.abs(e.dueInDays)} 天）` : ''}`).join('、') + (due.length > 5 ? ' 等' : '')
    : '\n当前没有项目到期复盘。'
  const themeLine = themes.length
    ? `\n行业主题：` + themes.slice(0, 6).map((t) => `${t.name}（${(t.sectors || []).length} 赛道 / ${(t.views || []).length} 跨赛道观点）`).join('、') + (themes.length > 6 ? ' 等' : '')
    : ''
  return `${head}${dueLine}${themeLine}\n${rules}`
}

// ── tool formatting ────────────────────────────────────────────────────

function fmtEntryLine(e) {
  const bits = [TYPES[e.type].label]
  if (e.sector) bits.push(e.sector)
  if (e.stage) bits.push(e.stage)
  if (e.verdict) bits.push(e.verdict)
  if (e.confidence) bits.push(`置信度 ${e.confidence}`)
  const due = e.due ? ` ⚠️ 到期${e.dueInDays < 0 ? `（逾期 ${Math.abs(e.dueInDays)} 天）` : ''}` : ''
  return `- ${e.name}（${bits.join(' · ')}）id: ${e.id}${due}`
}

function statusText(state) {
  const entries = state.entries || []
  const due = entries.filter((e) => e.due)
  const themes = state.themes || []
  const sectors = themes.reduce((n, t) => n + (t.sectors?.length || 0), 0)
  const views = themes.reduce((n, t) => n + (t.views?.length || 0) + (t.sectors || []).reduce((m, s) => m + (s.views?.length || 0), 0), 0)
  // Vault info is cheap and synchronous; recompute it so a .git folder added
  // after startup (or a newly-created vault) is reflected in the tool output.
  const v = { ...(state.vault || {}), ...vaultInfo(state) }
  const git = state.cfg.git
  const sync = git.enabled
    ? `Git ${state.gitInfo?.available === false ? '（vault 不是 Git 仓库）' : state.gitInfo?.dirty ? '（有未提交变更）' : '（工作区干净）'}`
    : v.isOneDrive
      ? `OneDrive 文件夹同步${v.isGit ? '（vault 同时是 Git 仓库，Git 同步未启用）' : ''}`
      : v.isGit ? '普通文件夹 + Git 仓库（Git 同步未启用）' : '普通文件夹（可移入 OneDrive；或显式启用 Git 同步）'
  const lines = [
    `# 投资记忆状态`,
    `- vault：${v.dir}`,
    `- 项目：${entries.filter((e) => e.type === 'project').length}（到期 ${due.length}）`,
    `- 行业：主题 ${themes.length} · 细分赛道 ${sectors} · 观点 ${views}`,
    `- 自动简报：${state.cfg.autoDigest}${state.cfg.autoDigest !== 'off' ? `（${state.cfg.digestWeekday} / ${state.cfg.digestHour}:00）` : ''}`,
    `- 同步：${sync}`,
  ]
  if (themes.length) {
    lines.push('', '## 主题')
    for (const t of themes) lines.push(`- ${t.name}（${(t.sectors || []).length} 赛道 · ${(t.views || []).length} 跨赛道观点）id: ${t.id}`)
  }
  if (due.length) {
    lines.push('', '## 项目到期复盘')
    for (const e of due.slice(0, 10)) lines.push(fmtEntryLine(e))
  }
  if (state.legacyIndustry?.length) {
    lines.push('', '## 旧格式行业条目（建议迁移到主题/赛道结构）')
    for (const e of state.legacyIndustry.slice(0, 10)) lines.push(fmtEntryLine(e))
  }
  if (state.warnings?.length) {
    lines.push('', '## 注意')
    for (const w of state.warnings.slice(0, 5)) lines.push(`- ${w}`)
  }
  return lines.join('\n')
}

function listTextView(state, type) {
  const themes = state.themes || []
  const entries = (state.entries || []).filter((e) => !type || e.type === type)
  const lines = []
  if (type !== 'project' && (themes.length || state.legacyIndustry?.length)) {
    lines.push(`# 行业（主题 ${themes.length}）`)
    for (const t of themes) {
      lines.push(`- ${t.name}（${(t.sectors || []).length} 赛道 · ${(t.views || []).length} 跨赛道观点）id: ${t.id}`)
      for (const s of t.sectors || []) {
        lines.push(`  - ${s.name}（${(s.views || []).length} 条观点）id: 行业/${t.dir}/${s.file.replace(/\.md$/i, '')}`)
        for (const v of sortViews(s.views || [])) lines.push(`    - ${v.id} · ${v.status} · ${v.date} · ${truncate(stripMarkdown(v.conclusion), 50)}`)
      }
    }
    if (state.legacyIndustry?.length) {
      lines.push('', `旧格式行业条目（${state.legacyIndustry.length}）：`)
      for (const e of state.legacyIndustry) lines.push(fmtEntryLine(e))
    }
  }
  if (type !== 'industry') {
    if (lines.length) lines.push('')
    lines.push(`# 项目（${entries.filter((e) => e.type === 'project').length}）`)
    const projects = entries.filter((e) => e.type === 'project')
    if (!projects.length) lines.push('（无）')
    for (const e of projects) lines.push(fmtEntryLine(e))
  }
  return lines.join('\n')
}

function listText(state, type) { return listTextView(state, type) }

function readText(state, entry, markdown) {
  const bits = [TYPES[entry.type].label]
  if (entry.sector) bits.push(entry.sector)
  if (entry.stage) bits.push(entry.stage)
  const meta = [
    `# ${entry.name}`,
    `- id：${entry.id}`,
    `- 类型：${bits.join(' · ')}`,
    entry.verdict ? `- 判断：${entry.verdict}${entry.confidence ? `（置信度 ${entry.confidence}）` : ''}` : null,
    entry.lastReviewed ? `- 最近复盘：${entry.lastReviewed}` : null,
    entry.nextReview ? `- 下次复盘：${entry.nextReview}${entry.due ? '（已到期）' : ''}` : null,
    entry.tags.length ? `- 标签：${entry.tags.join('、')}` : null,
    '',
    '---',
    '',
    truncate(markdown, 8000),
  ].filter((x) => x !== null)
  return meta.join('\n')
}

async function runAction(state, args) {
  const action = String(args?.action || 'status')
  switch (action) {
    case 'status':
      await refresh(state)
      return statusText(state)
    case 'list':
      await refresh(state)
      return listText(state, args?.type)
    case 'search': {
      await refresh(state)
      const query = args?.query || args?.q
      if (!query) throw new Error('search 需要 query')
      const matches = await searchEntries(state, query)
      if (!matches.length) return `没有找到与「${query}」相关的记录。`
      return [`找到 ${matches.length} 条与「${query}」相关的记录：`, '', ...matches.map((m) => `${fmtEntryLine(m.entry)}${m.snippet ? `\n  ${truncate(m.snippet, 160)}` : ''}`)].join('\n')
    }
    case 'read': {
      await refresh(state)
      if (!args?.id) throw new Error('read 需要 id')
      if (args.id.startsWith('行业/')) {
        const found = await readIndustryByToolId(state, args.id)
        if (found) {
          const board = found.board
          if (found.view) {
            return `# ${found.view.id} · ${found.view.status}\n- 日期：${found.view.date}\n- 结论：${found.view.conclusion}\n${found.view.evidence.map((e) => `- 依据：${e}`).join('\n')}${found.view.counter.map((c) => `\n- 反证：${c}`).join('')}`
          }
          return found.board.parsed ? truncate(await readFile(found.board.path, 'utf8'), 8000) : ''
        }
      }
      const parts = idParts(args.id)
      if (!parts) throw new Error(`无效 id：${args.id}`)
      const type = TYPE_BY_DIR[parts.dir]
      let file
      try { file = await readEntryFile(state.cfg, type, parts.slug) } catch { throw new Error(`找不到条目：${args.id}`) }
      const entry = toMeta(file.fm, type, parts.slug, file.sections, state.cfg)
      return readText(state, entry, file.text)
    }
    case 'upsert': {
      if (args?.type === 'industry') throw new Error('行业请用 action:"sector" 建板、action:"view" 添加/修正观点；旧格式行业条目仍可读取')
      const result = await upsertEntry(state, args || {})
      return `${result.created ? '已创建' : '已更新'}：${result.entry.name}（${result.entry.id}）\n文件：${result.file}`
    }
    case 'theme': {
      await refresh(state)
      const op = String(args?.op || 'list')
      if (op === 'create') {
        const result = await createThemeOp(state, args)
        return result.proposed
          ? `未创建（需确认）：主题「${result.name}」\n范围：${result.scope}\n路径：${result.path}\n用户确认后以 confirm:true 再调用。`
          : `已创建主题：${result.theme.name}（${result.theme.id}）`
      }
      if (op === 'read') {
        const theme = findTheme(state, args?.theme || args?.name)
        if (!theme) throw new Error(`找不到主题：${args?.theme || args?.name}`)
        return truncate(await readFile(themePath(state.cfg, theme.dir), 'utf8'), 8000)
      }
      return listTextView(state, 'industry')
    }
    case 'sector': {
      await refresh(state)
      const op = String(args?.op || 'list')
      if (op === 'create') {
        const result = await createSectorOp(state, args)
        return result.proposed
          ? `未创建（需确认）：${result.themeName || result.theme} / ${result.name}\n范围：${result.scope}\n确认后以 confirm:true 再调用。`
          : `已创建细分赛道：${result.sector.name}（id: ${result.sector.id}）\n首条观点：${result.view.id} · ${result.view.status} · ${result.view.conclusion}`
      }
      if (op === 'read') {
        const theme = findTheme(state, args?.theme)
        const sector = theme ? findSector(theme, args?.name || args?.sector) : null
        if (!sector) throw new Error(`找不到细分赛道：${args?.theme} / ${args?.name || args?.sector}`)
        return truncate(await readFile(sectorPath(state.cfg, theme.dir, sector.file.replace(/\.md$/i, '')), 'utf8'), 8000)
      }
      return listTextView(state, 'industry')
    }
    case 'view': {
      await refresh(state)
      const result = await viewOp(state, args || {})
      if (result.op === 'add') return `已新增观点：${result.view.id} · ${result.view.status}\n${result.view.conclusion}\n看板：${result.boardId}`
      if (result.op === 'archive') return `已归档观点：${result.archived.id} · ${result.archived.conclusion}`
      return `已更新观点：${result.view.id} · ${result.view.status}\n${result.view.conclusion}`
    }
    case 'review': {
      const result = await reviewEntry(state, args || {})
      return `已记录复盘：${result.entry.name}（${result.entry.id}）· 下次复盘 ${result.entry.nextReview}\n当前判断：${result.entry.verdict || '未标注'}${result.entry.confidence ? `（置信度 ${result.entry.confidence}）` : ''}`
    }
    case 'digest': {
      const result = await buildDigest(state, args?.period === 'month' ? 'month' : 'week', true)
      return `${result.file}\n\n${result.markdown}`
    }
    case 'sync': {
      const result = await syncVault(state, state.cfg.git.autoPush ? 'push' : 'commit', true)
      return `${result.ok ? '✅' : '⚠️'} 同步（${result.mode}）\n${result.output}`
    }
    default:
      throw new Error(`未知 action：${action}`)
  }
}

const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['status', 'list', 'search', 'read', 'upsert', 'review', 'digest', 'sync', 'theme', 'sector', 'view'], description: '操作：status/list/search/read/upsert(项目)/review(项目复盘)/digest/sync，或 theme/sector/view（行业结构与观点）' },
    op: { type: 'string', enum: ['create', 'list', 'read', 'add', 'revise', 'weaken', 'falsify', 'archive'], description: 'theme/sector：create/list/read；view：add/revise/weaken/falsify/archive' },
    confirm: { type: 'boolean', description: 'theme/sector 创建必须为 true 才落盘（用户明确要求时）；否则只返回提案' },
    theme: { type: 'string', description: '主题名（行业结构）' },
    sector: { type: 'string', description: '细分赛道名（view 操作用；theme 板传 _主题）' },
    scope: { type: 'string', description: '范围句（新建主题/细分赛道必填）' },
    themeScope: { type: 'string', description: '主题不存在时，随细分赛道一起创建主题用的范围句' },
    sectorLabel: { type: 'string', description: '细分赛道 frontmatter 里的 sector 描述，如 机器人 / 仓储自动化' },
    viewPrefix: { type: 'string', description: '观点 id 前缀，如 仓储 → #仓储-001；默认用赛道名' },
    conclusion: { type: 'string', description: '观点的一句话结论（view add 必填）' },
    status: { type: 'string', enum: VIEW_STATUSES, description: '观点状态（view 操作）' },
    counter: { type: 'string', description: '观点反证（可多行）' },
    related: { type: 'string', description: '观点关联，如 项目/aurora-ai 或 行业/机器人/仓储机器人#仓储-001（可多行）' },
    reason: { type: 'string', description: '修正/削弱/证伪/归档的原因' },
    id: { type: 'string', description: '条目/观点 id；项目如 项目/aurora-ai；行业观点如 行业/机器人/仓储机器人#仓储-001' },
    type: { type: 'string', enum: ['project', 'industry'], description: 'project=项目/公司；行业请改用 theme/sector/view 操作' },
    name: { type: 'string', description: '项目/公司名，或主题/细分赛道名' },
    stage: { type: 'string', description: '轮次，如 天使轮/A 轮/B 轮' },
    verdict: { type: 'string', enum: VERDICTS, description: '项目判断结论' },
    confidence: { type: 'integer', minimum: 1, maximum: 5, description: '项目置信度 1-5' },
    tags: { type: 'array', items: { type: 'string' }, description: '项目标签' },
    aliases: { type: 'array', items: { type: 'string' }, description: '项目别名' },
    links: { type: 'array', items: { type: 'string' }, description: '项目来源链接' },
    summary: { type: 'string', description: '项目一句话判断' },
    thesis: { type: 'string', description: '项目判断依据（Markdown）' },
    assumptions: { type: 'string', description: '项目关键假设（Markdown，可用 - [ ] 复选框）' },
    risks: { type: 'string', description: '项目风险与反证（Markdown）' },
    evidence: { type: 'string', description: '项目新证据（追加到证据与时间线）；行业观点依据也用它' },
    reviewCycleDays: { type: 'integer', minimum: 1, maximum: 3650, description: '复盘周期（天）' },
    outcome: { type: 'string', description: '复盘结论：符合判断/偏离/证伪/持续跟踪' },
    progress: { type: 'string', description: '复盘：进展与证据' },
    deviation: { type: 'string', description: '复盘：判断偏差与原因' },
    nextVerdict: { type: 'string', enum: VERDICTS, description: '复盘：更新后的判断' },
    nextReview: { type: 'string', description: '复盘：下次复盘日期 YYYY-MM-DD' },
    notes: { type: 'string', description: '复盘：其他补充' },
    period: { type: 'string', enum: ['week', 'month'], description: 'digest 的周期' },
    query: { type: 'string', description: 'search 的搜索词' },
  },
  required: ['action'],
  additionalProperties: false,
}

const TOOL_DESCRIPTION = `VC 投资记忆（Markdown 知识库，支持项目判断、行业主题/细分赛道观点、复盘、简报、云同步）。
当用户谈到具体项目/公司/行业判断、要求复盘/总结/更新判断时使用。先用 search/read 回忆已有判断（引用其关键假设），再回答问题。
- 项目判断用 upsert（不要重复建条目）；项目复盘用 review；周报/总结用 digest；多设备同步用 sync。
- 行业用 theme（主题）→ sector（细分赛道）→ view（观点）：观点格式是「时间戳 + 当前结论 + 状态（有效/待验证/被削弱/已证伪）」；修正观点用 view/revise，削弱/证伪/归档也有对应 op。
- 主题/细分赛道是文件结构：默认只在用户确认后创建；只有用户明确说“记一下这个行业/赛道”且没有对应板时，才可用 theme/sector 的 confirm:true 直接建一个主题 + 一个细分赛道（必须写范围句、初始观点）。不要凭模型判断新建结构。
- 行业 id 形如 行业/<主题>/<细分赛道>#<观点id>；证据注明来源与日期，不要编造。`

// ── HTTP helpers ───────────────────────────────────────────────────────

function sendJson(res, status, payload) {
  res.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}
function sameOrigin(req) {
  const host = req.headers.host
  if (host !== undefined) {
    const lower = host.toLowerCase()
    const name = lower.startsWith('[') ? lower.slice(0, lower.indexOf(']') + 1) : lower.split(':')[0]
    const loopback = name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
    if (!loopback) return false
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === host } catch { return false }
}
async function readJsonBody(req, maxBytes = 256 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > maxBytes) throw new Error('请求体过大（上限 256KB）')
    chunks.push(buf)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function statePayload(state) {
  const entries = state.entries || []
  const themes = state.themes || []
  const sectors = themes.reduce((n, t) => n + (t.sectors?.length || 0), 0)
  const views = themes.reduce((n, t) => n + (t.views?.length || 0) + (t.sectors || []).reduce((m, s) => m + (s.views?.length || 0), 0), 0)
  const projects = entries.filter((e) => e.type === 'project')
  const counts = {
    project: projects.length,
    industry: (state.legacyIndustry || []).length,
    themes,
    sectors,
    views,
    due: projects.filter((e) => e.due).length,
    total: projects.length + (state.legacyIndustry || []).length,
  }
  const v = state.vault
  const git = state.cfg.git
  const mode = git.enabled ? 'git' : v.isOneDrive ? 'onedrive' : 'folder'
  return {
    ok: true,
    vault: v,
    config: {
      vaultDir: state.cfg.vaultDir,
      reviewCycleDays: state.cfg.reviewCycleDays,
      autoDigest: state.cfg.autoDigest,
      digestWeekday: state.cfg.digestWeekday,
      digestHour: state.cfg.digestHour,
      injectPrompt: state.cfg.injectPrompt,
      git: { ...git },
      settingsPath: state.settingsPath,
    },
    counts,
    entries,
    themes,
    legacyIndustry: state.legacyIndustry || [],
    digests: state.digests || [],
    recentLog: readLogLines(state.cfg, 20),
    logFile: LOG_FILE,
    sync: {
      mode,
      label: mode === 'git' ? 'Git 同步' : mode === 'onedrive' ? 'OneDrive 同步' : '本地文件夹',
      gitAvailable: git.enabled ? state.gitInfo?.available !== false : null,
      dirty: git.enabled ? state.gitInfo?.dirty ?? null : null,
      last: state.lastSync || null,
    },
    warnings: [...(state.warnings || []), ...(state.problems || [])],
    serverTime: new Date().toISOString(),
  }
}

// ── plugin entry ───────────────────────────────────────────────────────

function logInfo(state, message) {
  try { state.ctx?.logger?.info?.(`[vc-memory] ${message}`) } catch { /* logging is best-effort */ }
}

export async function apply(ctx, rawConfig) {
  const baseRaw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {}
  const userSettings = readUserSettings()
  const cfg = effectiveConfig(userSettings.vaultDir ? { ...baseRaw, vaultDir: userSettings.vaultDir } : baseRaw)
  const state = {
    ctx, cfg, writable: true, entries: [], reviews: [], digests: [], themes: [], legacyIndustry: [], warnings: [], problems: [],
    rawConfig: baseRaw, settingsPath: userSettingsFile(),
    gitInfo: null, lastSync: null, lastDigest: null, refreshing: null, vault: null,
    async init() {
      try {
        await ensureVault(cfg)
        state.vault = vaultInfo(state)
      } catch (e) {
        state.writable = false
        state.problems.push(`无法初始化 vault 目录 ${cfg.vaultDir}：${msg(e)}`)
        state.vault = { dir: cfg.vaultDir, exists: existsSync(cfg.vaultDir), writable: false, isOneDrive: isUnderOneDrive(cfg.vaultDir), isGit: false, fileCount: 0 }
      }
      await refresh(state)
      state.vault = { ...state.vault, ...vaultInfo(state) }
    },
  }
  await state.init()
  logInfo(state, `vault ${cfg.vaultDir}，${state.entries.length} 条记录`)

  // rescan loop: picks up edits and files synced from other devices
  ctx.effect(() => {
    const id = setInterval(() => {
      refresh(state).then(() => { state.vault = { ...state.vault, ...vaultInfo(state) } }).catch(() => {})
    }, 60 * 1000)
    return () => clearInterval(id)
  }, 'vc-memory: vault rescan')

  // digest scheduler: writes the period's digest after the configured time
  ctx.effect(() => {
    const id = setInterval(() => { autoDigestTick(state).catch(() => {}) }, 5 * 60 * 1000)
    const warm = setTimeout(() => { autoDigestTick(state).catch(() => {}) }, 20 * 1000)
    return () => { clearInterval(id); clearTimeout(warm) }
  }, 'vc-memory: digest scheduler')

  // agent tool
  ctx.effect(() => ctx.tools.register({
    name: 'vc_memory',
    description: TOOL_DESCRIPTION,
    parameters: TOOL_PARAMETERS,
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
    },
    async execute(args) {
      try {
        return await runAction(state, args && typeof args === 'object' ? args : {})
      } catch (e) {
        return `❌ vc_memory 失败：${msg(e)}`
      }
    },
  }), 'vc-memory: tool')

  // dynamic prompt section: the "automatic" trigger
  if (cfg.injectPrompt) {
    ctx.effect(() => ctx.systemPrompt.section({
      name: 'vc-memory',
      order: 860,
      text: () => buildPromptText(state),
    }), 'vc-memory: prompt section')
  }

  // same-origin JSON API for the panel UI
  const handler = async (req, res) => {
    try {
      const method = req.method || 'GET'
      if (method !== 'GET' && method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      if (method === 'POST' && !sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'untrusted origin' })
      const url = new URL(req.url || '/', 'http://dsh.local')
      const path = url.pathname.slice(API_PREFIX.length) || '/'
      await refresh(state)
      state.vault = { ...state.vault, ...vaultInfo(state) }

      if (method === 'GET' && path === '/state') return sendJson(res, 200, statePayload(state))
      if (method === 'GET' && path === '/config') {
        return sendJson(res, 200, {
          ok: true,
          vaultDir: state.cfg.vaultDir,
          defaultDir: effectiveConfig(state.rawConfig).vaultDir,
          settingsPath: state.settingsPath,
        })
      }
      if (method === 'GET' && path === '/entry') {
        const id = url.searchParams.get('id') || ''
        const parts = idParts(id)
        if (!parts) return sendJson(res, 400, { ok: false, error: `无效 id：${id}` })
        const type = TYPE_BY_DIR[parts.dir]
        let file
        try { file = await readEntryFile(state.cfg, type, parts.slug) } catch { return sendJson(res, 404, { ok: false, error: `找不到条目：${id}` }) }
        const entry = toMeta(file.fm, type, parts.slug, file.sections, state.cfg)
        const sections = [...file.sections.entries()].map(([title, body]) => ({ title, body }))
        return sendJson(res, 200, { ok: true, entry, markdown: file.text, frontmatter: file.fm, sections })
      }
      if (method === 'GET' && path === '/industry') {
        const id = url.searchParams.get('id') || ''
        const found = await readIndustryByToolId(state, id)
        if (!found) return sendJson(res, 404, { ok: false, error: `找不到行业对象：${id}` })
        const markdown = await readFile(found.board.path, 'utf8')
        return sendJson(res, 200, {
          ok: true,
          board: found.board.isTheme ? 'theme' : 'sector',
          id,
          markdown,
          theme: found.board.theme.name,
          sector: found.board.sector ? found.board.sector.name : null,
          view: found.view || null,
          views: found.board.parsed.views,
          archived: found.board.parsed.archived,
        })
      }
      if (method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      const body = await readJsonBody(req)
      if (path === '/config') {
        if (body?.reset === true) {
          await rm(state.settingsPath, { force: true })
          const fallback = effectiveConfig(state.rawConfig).vaultDir
          await switchVault(state, fallback)
          return sendJson(res, 200, { ok: true, vaultDir: state.cfg.vaultDir, reset: true })
        }
        const target = String(body?.vaultDir || '').trim()
        if (!target || !isAbsolute(target)) return sendJson(res, 400, { ok: false, error: '请提供绝对路径' })
        await switchVault(state, target)
        await writeUserSettings({ vaultDir: state.cfg.vaultDir })
        return sendJson(res, 200, { ok: true, vaultDir: state.cfg.vaultDir, settingsPath: state.settingsPath })
      }
      if (path === '/upsert') {
        if (body?.type === 'industry') return sendJson(res, 400, { ok: false, error: '行业请使用 /sector 建板、/view 添加/修正观点' })
        const result = await upsertEntry(state, body)
        return sendJson(res, 200, { ok: true, created: result.created, entry: result.entry, file: result.file })
      }
      if (path === '/theme') {
        const result = await createThemeOp(state, { ...body, confirm: body?.confirm !== false })
        return sendJson(res, 200, { ok: true, ...result, themes: state.themes })
      }
      if (path === '/sector') {
        const result = await createSectorOp(state, { ...body, confirm: body?.confirm !== false })
        return sendJson(res, 200, { ok: true, ...result, themes: state.themes })
      }
      if (path === '/view') {
        const result = await viewOp(state, body || {})
        return sendJson(res, 200, { ok: true, ...result })
      }
      if (path === '/review') {
        const result = await reviewEntry(state, body)
        return sendJson(res, 200, result)
      }
      if (path === '/digest') {
        const result = await buildDigest(state, body?.period === 'month' ? 'month' : 'week', body?.save !== false)
        return sendJson(res, 200, result)
      }
      if (path === '/sync') {
        const result = await syncVault(state, body?.action === 'status' ? 'status' : body?.action === 'push' ? 'push' : 'commit', true)
        return sendJson(res, 200, result)
      }
      if (path === '/search') {
        const matches = await searchEntries(state, body?.q ?? body?.query)
        return sendJson(res, 200, { ok: true, matches })
      }
      if (path === '/seed') {
        const created = await seedSamples(state)
        return sendJson(res, 200, { ok: true, created })
      }
      return sendJson(res, 404, { ok: false, error: `未知接口：${path}` })
    } catch (e) {
      sendJson(res, 400, { ok: false, error: msg(e) })
    }
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler }), 'vc-memory: api')

  logInfo(state, 'ready')
}

async function seedSamples(state) {
  const cfg = state.cfg
  let names = []
  try { names = await readdir(SAMPLE_DIR) } catch { throw new Error('插件包内没有 samples 目录') }
  const created = []
  for (const fileName of names.filter((n) => /\.md$/i.test(n))) {
    const type = /^industry-/i.test(fileName) ? 'industry' : 'project'
    const slug = fileName.replace(/\.md$/i, '').replace(/^(project|industry)-/i, '')
    const target = absOf(cfg, type, slug)
    if (existsSync(target)) continue
    const text = await readFile(join(SAMPLE_DIR, fileName), 'utf8')
    await mkdir(join(cfg.vaultDir, TYPES[type].dir), { recursive: true })
    await writeFile(target, text, 'utf8')
    created.push(relOf(type, slug))
  }
  await refresh(state)
  if (created.length) await appendLog(state, '示例', 'samples', `写入 ${created.length} 篇示例`)
  return created
}
