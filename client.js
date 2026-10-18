// vc-memory client half — the browser half of the VC investment memory plugin.
//
// The Host half registers a same-origin JSON API under /vc-memory/api (see
// docs/API.md) and nothing client-side. This file contributes the two browser
// surfaces through the host's own slot system:
//
//   * sidebar.panellist id "vc-memory" — the sidebar entry with a small inline
//     SVG mark (a memory card with an upward trend line).
//   * main key "vc-memory"           — the full page: vault header, tabs and
//     search, the entry list on the left, the entry detail on the right, the
//     create/edit/review/digest modals and the empty state.
//
// Everything is plain ES2022: no JSX, no build step, React only through
// require('react') (aliased to h), no @deepseek-ai/* client imports. The one
// owned stylesheet is inserted once into document.head and tagged
// data-plugin/data-plugin-css so the module loader can claim and clean it, the
// same ownership pattern the shipped dsh-thoughtdag client uses. All colours
// come from --dsw-alias-* theme tokens so light and dark both work.

window.__ModuleLoader__.load({
  id: '@local/vc-memory',
  factory: (require) => {
    const module = { exports: {} }

    // The host's React: the only reason this half exists. A host that lends no
    // React also has no slots to fill; the module then loads inert.
    let React = null
    try { React = require('react') } catch { React = null }

    // The stylesheet lives at factory scope: one string, inserted once by
    // apply(), reused by a later apply after a hot reload.
    const NS = 'vc-memory'
    const API = '/vc-memory/api'
    const CSS_ID = '@local/vc-memory/client.css'

    const CSS = `
.vc-root{position:relative;display:flex;flex:1 1 auto;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:13px/1.5 Inter,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;overflow:hidden}
html[data-platform="darwin"] .vc-root{padding-top:var(--dsh-frame-top-clearance,0px)}
.vc-root *{box-sizing:border-box}
.vc-root button,.vc-root input,.vc-root select,.vc-root textarea{font-family:inherit;font-size:inherit;color:inherit}
.vc-root button{cursor:pointer}
.vc-root :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.vc-head{flex:none;display:flex;flex-direction:column;gap:7px;padding:13px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.vc-head-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
.vc-title{display:flex;align-items:center;gap:8px;min-width:0;margin:0}
.vc-title h1{margin:0;font-size:15px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
.vc-title-mark{display:flex;color:var(--dsw-alias-brand-primary);flex:none}
.vc-vault{display:inline-flex;align-items:center;max-width:46ch;min-width:0;padding:2px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font:11.5px/1.6 ui-monospace,"Cascadia Mono",Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vc-vault-label{color:var(--dsw-alias-label-secondary);font-family:Inter,"PingFang SC",system-ui,sans-serif;font-size:11px;flex:none;margin-right:5px}
.vc-counts{display:flex;align-items:center;gap:11px;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
.vc-count b{margin-right:3px;color:var(--dsw-alias-label-primary);font-weight:600}
.vc-count-due b{color:var(--dsw-alias-state-warn-primary)}
.vc-sync{display:inline-flex;align-items:center;gap:7px;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11.5px;white-space:nowrap}
.vc-sync-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}
.vc-sync-dot.warn{background:var(--dsw-alias-state-warn-primary)}
.vc-sync-dot.bad{background:var(--dsw-alias-state-error-primary)}
.vc-actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.vc-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;padding:0 11px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;font-weight:500;line-height:1;white-space:nowrap;transition:background .12s ease,border-color .12s ease,opacity .12s ease}
.vc-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l3)}
.vc-btn:disabled{opacity:.55;cursor:default}
.vc-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary));border-color:transparent;color:var(--dsw-alias-bg-base)}
.vc-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary));border-color:transparent;opacity:.9}
.vc-btn-ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.vc-btn-ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:transparent;color:var(--dsw-alias-label-primary)}
.vc-count-badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:600}
.vc-warn{flex:none;display:flex;flex-direction:column;gap:2px;margin:9px 18px 0;padding:7px 10px;border:1px solid var(--dsw-alias-state-warn-tertiary);border-radius:8px;background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-primary);font-size:11.5px}
.vc-toolbar{flex:none;display:flex;align-items:center;gap:8px;padding:5px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.vc-tabs{display:flex;gap:2px;min-width:0;overflow-x:auto;scrollbar-width:none}
.vc-tab{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12.5px;font-weight:500;white-space:nowrap}
.vc-tab:hover{color:var(--dsw-alias-label-primary)}
.vc-tab.on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.vc-tab .vc-count-badge{background:var(--dsw-alias-bg-layer-3)}
.vc-tab.on .vc-count-badge{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary)}
.vc-search-wrap{margin-left:auto;display:flex;align-items:center;padding-bottom:5px}
.vc-search{width:190px;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px}
.vc-search::placeholder{color:var(--dsw-alias-label-secondary)}
.vc-search:focus{border-color:var(--dsw-alias-brand-primary)}
.vc-body{flex:1;display:flex;min-height:0;overflow:hidden}
.vc-list{width:320px;flex:none;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.vc-list-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px 4px;color:var(--dsw-alias-label-tertiary);font-size:11px}
.vc-list-scroll{flex:1;min-height:0;overflow-y:auto;padding:2px 8px 14px;scrollbar-width:thin}
.vc-row{display:flex;flex-direction:column;gap:4px;width:100%;margin:0 0 3px;padding:8px 9px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;text-align:left;font:inherit}
.vc-row:hover{background:var(--dsw-alias-bg-layer-2)}
.vc-row.on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.vc-row-top{display:flex;align-items:center;gap:6px;min-width:0}
.vc-row-name{flex:1;min-width:0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vc-type{flex:none;padding:0 5px;border-radius:4px;font-size:10.5px;line-height:16px;font-weight:500;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}
.vc-type-project{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-2)}
.vc-row-mid{display:flex;align-items:center;gap:6px;min-width:0}
.vc-row-sector{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11.5px}
.vc-row-bot{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.vc-due{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.vc-due-over{color:var(--dsw-alias-state-error-primary);font-weight:600}
.vc-due-today{color:var(--dsw-alias-state-warn-primary);font-weight:600}
.vc-due-soon{color:var(--dsw-alias-state-warn-primary)}
.vc-pill{display:inline-flex;align-items:center;flex:none;height:18px;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:600;line-height:1;white-space:nowrap}
.vc-pill-success{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent)}
.vc-pill-idle{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-3)}
.vc-pill-error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent)}
.vc-pill-brand{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.vc-pill-neutral{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-3)}
.vc-pill-none{color:var(--dsw-alias-label-secondary);background:transparent;border:1px dashed var(--dsw-alias-border-l3)}
.vc-detail{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-base)}
.vc-detail-head{flex:none;display:flex;flex-direction:column;gap:6px;padding:12px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.vc-detail-titleline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.vc-detail-title{margin:0;font-size:16px;font-weight:600;letter-spacing:.01em;word-break:break-word}
.vc-detail-sub{color:var(--dsw-alias-label-tertiary);font-size:12px}
.vc-detail-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px}
.vc-detail-scroll{flex:1;min-height:0;overflow-y:auto;padding:14px 20px 30px;scrollbar-width:thin}
.vc-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 16px;margin:0 0 16px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.vc-field{min-width:0}
.vc-field-label{margin-bottom:2px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;letter-spacing:.02em}
.vc-field-value{font-size:12.5px;color:var(--dsw-alias-label-primary);word-break:break-word}
.vc-file{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:4px}
.vc-tags{display:flex;flex-wrap:wrap;gap:4px}
.vc-tag{display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10.5px}
.vc-sec{margin:0 0 16px}
.vc-sec-title{display:flex;align-items:center;gap:7px;margin:0 0 7px;color:var(--dsw-alias-label-secondary);font-size:12.5px;font-weight:600}
.vc-sec-title:before{content:"";width:3px;height:12px;border-radius:2px;background:var(--dsw-alias-brand-primary);flex:none;opacity:.85}
.vc-md{font-size:12.5px;line-height:1.68;color:var(--dsw-alias-label-primary);word-break:break-word}
.vc-md p{margin:0 0 8px}
.vc-md p:last-child{margin-bottom:0}
.vc-md h1,.vc-md h2,.vc-md h3{margin:10px 0 6px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.vc-md h1{font-size:15px}
.vc-md h2{font-size:13.5px}
.vc-md h3{font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.vc-md ul,.vc-md ol{margin:0 0 8px;padding-left:20px}
.vc-md li{margin:2px 0}
.vc-md li::marker{color:var(--dsw-alias-label-tertiary)}
.vc-md .vc-md-task{display:flex;align-items:flex-start;gap:7px;margin-left:-20px;list-style:none}
.vc-md-check{margin:4px 0 0;flex:none;accent-color:var(--dsw-alias-brand-primary)}
.vc-md-task-text{min-width:0;word-break:break-word}
.vc-md-done{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}
.vc-md code{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:11.5px;background:var(--dsw-alias-bg-layer-2);padding:1px 4px;border-radius:4px}
.vc-md a{color:var(--dsw-alias-link);text-decoration:none;word-break:break-all}
.vc-md a:hover{text-decoration:underline}
.vc-md blockquote{margin:0 0 8px;padding:6px 10px;border-left:3px solid var(--dsw-alias-border-l3);border-radius:0 6px 6px 0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.vc-md hr{margin:10px 0;border:0;border-top:1px solid var(--dsw-alias-border-l1)}
.vc-md table{border-collapse:collapse;margin:0 0 8px;font-size:12px}
.vc-md th,.vc-md td{padding:4px 10px;border:1px solid var(--dsw-alias-border-l1);text-align:left;vertical-align:top}
.vc-md th{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-weight:600}
.vc-hint{padding:10px 2px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.vc-detail-error{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:12px}
.vc-raw{margin-top:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.vc-raw>summary{cursor:pointer;padding:8px 12px;color:var(--dsw-alias-label-secondary);font-size:12px;user-select:none}
.vc-raw>summary:hover{background:var(--dsw-alias-bg-layer-2)}
.vc-raw-ta{display:block;width:100%;min-height:140px;padding:10px 12px;border:0;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:11.5px/1.6 ui-monospace,"Cascadia Mono",Consolas,monospace;resize:vertical;white-space:pre}
.vc-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 24px;color:var(--dsw-alias-label-secondary);text-align:center}
.vc-error-title{margin:0;color:var(--dsw-alias-state-error-primary);font-size:14px;font-weight:600}
.vc-error-text{max-width:54ch;margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;word-break:break-word}
.vc-spinner{width:18px;height:18px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:vc-spin .8s linear infinite}
@keyframes vc-spin{to{transform:rotate(360deg)}}
.vc-empty{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 24px 48px;text-align:center;scrollbar-width:thin}
.vc-empty-mark{display:flex;color:var(--dsw-alias-brand-primary);opacity:.9}
.vc-empty-title{margin:0;font-size:16px;font-weight:600}
.vc-empty-text{max-width:58ch;margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.vc-empty-card{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(640px,100%);margin-top:6px;text-align:left}
.vc-empty-block{padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);min-width:0}
.vc-empty-label{margin-bottom:4px;color:var(--dsw-alias-label-tertiary);font-size:11px}
.vc-empty-path{display:block;margin:0 0 6px;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:11.5px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace;word-break:break-all}
.vc-empty-list{display:flex;flex-direction:column;gap:4px;margin:0;padding-left:16px;color:var(--dsw-alias-label-secondary);font-size:12px}
.vc-empty-list b{color:var(--dsw-alias-label-primary);font-weight:600}
.vc-mask{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 32%,transparent)}
.vc-modal{display:flex;flex-direction:column;width:min(560px,100%);max-height:100%;min-height:0;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 18px 44px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);overflow:hidden}
.vc-modal-wide{width:min(720px,100%)}
.vc-modal-head{flex:none;display:flex;align-items:flex-start;gap:10px;padding:14px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.vc-modal-headtext{flex:1;min-width:0}
.vc-modal-title{margin:0;font-size:14px;font-weight:600;word-break:break-word}
.vc-modal-sub{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;word-break:break-word}
.vc-icon-btn{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1}
.vc-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.vc-modal-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.vc-form{display:flex;flex:1;flex-direction:column;min-height:0}
.vc-form-scroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:14px 18px 18px;scrollbar-width:thin}
.vc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.vc-field-row{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.vc-field-name{display:flex;align-items:center;gap:2px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.vc-field-hint{color:var(--dsw-alias-label-tertiary);font-size:10.5px}
.vc-req{color:var(--dsw-alias-state-error-primary);font-style:normal}
.vc-input,.vc-textarea{width:100%;min-width:0;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:1.5}
.vc-input:focus,.vc-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.vc-textarea{min-height:56px;resize:vertical;font-family:inherit}
.vc-form-error{flex:none;margin:0;padding:7px 10px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px;word-break:break-word}
.vc-form-foot{flex:none;display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:10px 18px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.vc-foot-hint{margin-right:auto;color:var(--dsw-alias-label-tertiary);font-size:11px}
.vc-digest{flex:1;min-height:0;overflow-y:auto;padding:14px 20px 20px;scrollbar-width:thin}
.vc-digest-meta{margin-bottom:8px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;word-break:break-all}
.vc-digest-hint{margin:0 0 10px;padding:7px 10px;border:1px solid var(--dsw-alias-state-warn-tertiary);border-radius:8px;background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-primary);font-size:11.5px}
.vc-toast{position:absolute;left:50%;bottom:18px;z-index:60;display:flex;align-items:flex-start;gap:8px;max-width:min(560px,calc(100% - 32px));padding:8px 10px 8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);font-size:12px;white-space:pre-wrap;word-break:break-word;transform:translateX(-50%)}
.vc-toast-dot{width:6px;height:6px;margin-top:5px;border-radius:50%;flex:none;background:var(--dsw-alias-state-success-primary)}
.vc-toast-error .vc-toast-dot{background:var(--dsw-alias-state-error-primary)}
.vc-toast-text{min-width:0}
.vc-toast-x{flex:none;margin-left:2px;padding:0 2px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);opacity:.75;font-size:12px;line-height:1.4}
.vc-toast-x:hover{opacity:1;background:var(--dsw-alias-bg-layer-2)}
.vc-tree{display:flex;flex-direction:column;gap:1px}
.vc-tree-row{display:flex;align-items:center;gap:5px;width:100%;min-width:0;padding:5px 8px;border:0;border-radius:7px;background:transparent;color:inherit;text-align:left;font:inherit}
.vc-tree-row:hover{background:var(--dsw-alias-bg-layer-2)}
.vc-tree-row.on{background:var(--dsw-alias-bg-layer-2)}
.vc-tree-depth-1{padding-left:24px}
.vc-tree-depth-2{padding-left:42px}
.vc-tree-toggle{display:inline-flex;align-items:center;justify-content:center;flex:none;width:18px;height:18px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1}
.vc-tree-toggle:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}
.vc-tree-main{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;padding:1px 0;border:0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
.vc-tree-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:500}
.vc-theme-row .vc-tree-name{font-size:13px;font-weight:600}
.vc-tree-meta{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10.5px}
.vc-tree-meta .vc-pill{height:15px;padding:0 5px;font-size:9.5px;margin-right:4px}
.vc-tree-view{display:flex;align-items:center;gap:6px;width:100%;min-width:0;padding:4px 8px 4px 42px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);text-align:left;font:inherit;cursor:pointer}
.vc-tree-view:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.vc-tree-view.on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.vc-tree-view-id{flex:none;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:10px;color:var(--dsw-alias-label-secondary)}
.vc-tree-view-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.vc-list-group{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:8px 4px 4px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px}
.vc-list-group.first{margin-top:0;padding-top:0;border-top:0}
.vc-view-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;margin:0 0 10px}
.vc-view-card.sel{border-color:var(--dsw-alias-brand-primary)}
.vc-view-card.clickable{cursor:pointer}
.vc-view-card.clickable:hover{border-color:var(--dsw-alias-border-l3)}
.vc-view-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.vc-view-title{margin:0;font-size:12.8px;font-weight:600;line-height:1.5;word-break:break-word}
.vc-view-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 6px;color:var(--dsw-alias-label-tertiary);font-size:10.5px}
.vc-view-meta code{padding:0 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px}
.vc-view-list{display:flex;flex-direction:column;gap:3px;margin:0 0 6px;padding:0;list-style:none;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.vc-view-list li{min-width:0;word-break:break-word}
.vc-view-list b{margin-right:2px;color:var(--dsw-alias-label-primary);font-weight:600}
.vc-view-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}
.vc-btn-sm{height:24px;padding:0 8px;border-radius:6px;font-size:11px}
.vc-scope{margin:0 0 12px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.65;word-break:break-word}
.vc-scope b{margin-right:4px;color:var(--dsw-alias-label-primary);font-weight:600}
.vc-mainline{margin:0 0 12px;padding:9px 12px 9px 30px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.vc-mainline li{margin:2px 0}
.vc-subhead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 0 8px}
.vc-subhead-title{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.vc-crumbs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:11.5px}
.vc-crumb{padding:0;border:0;background:transparent;color:var(--dsw-alias-link);font-size:11.5px;text-decoration:none}
.vc-crumb:hover{text-decoration:underline}
.vc-index{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
.vc-index-row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:inherit;text-align:left;font:inherit;cursor:pointer}
.vc-index-row:hover{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}
.vc-index-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:600}
.vc-index-meta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10.5px;white-space:nowrap}
.vc-empty-industry{margin:4px 2px 8px;padding:12px;border:1px dashed var(--dsw-alias-border-l3);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.vc-empty-industry b{color:var(--dsw-alias-label-primary)}
.vc-empty-industry ul{margin:4px 0 0;padding-left:18px}
.vc-empty-industry .vc-btn{margin-top:8px}
.vc-tree-view .vc-pill{flex:none;height:16px;padding:0 5px;font-size:9.5px}
.vc-archived{margin:8px 0 0}
.vc-archived-list{display:flex;flex-direction:column;gap:4px;margin:4px 0 0;padding-left:16px;color:var(--dsw-alias-label-tertiary);font-size:11.5px}
.vc-archived-list li{word-break:break-word}
.vc-pill-warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent)}
.vc-settings-section{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.vc-settings-section:first-child{padding-top:2px}
.vc-settings-section:last-child{padding-bottom:0;border-bottom:0}
.vc-settings-title{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary)}
.vc-settings-hint{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.vc-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);align-self:flex-start;flex-wrap:wrap}
.vc-seg-btn{height:26px;padding:0 12px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}
.vc-seg-btn:hover{color:var(--dsw-alias-label-primary)}
.vc-seg-btn.on{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary));color:var(--dsw-alias-bg-base)}
.vc-setting-block{display:flex;flex-direction:column;gap:5px;min-width:0}
.vc-setting-label{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.vc-path{display:block;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:11.5px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace;word-break:break-all}
.vc-path-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.vc-path-row .vc-input{flex:1 1 220px;min-width:180px}
.vc-settings-warn{padding:7px 10px;border:1px solid var(--dsw-alias-state-warn-tertiary);border-radius:8px;background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-primary);font-size:11.5px;line-height:1.6}
.vc-settings-meta{display:flex;flex-direction:column;gap:3px;color:var(--dsw-alias-label-tertiary);font-size:11px;word-break:break-all}
.vc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (max-width:760px){.vc-list{width:250px}.vc-empty-card{grid-template-columns:1fr}.vc-grid2{grid-template-columns:1fr}.vc-search{width:130px}}
`

    // ── module shape ──────────────────────────────────────────────────────────
    module.exports.inject = ['slots', 'locale', 'theme', 'uiWorkspace']

    module.exports.apply = (ctx) => {
      if (React === null || typeof React.createElement !== 'function') {
        console.warn('[vc-memory] the host did not provide React; the panel stays unmounted')
        return
      }
      const h = React.createElement

      // The sheet is OWNED: the loader claims untagged <style> for whichever
      // plugin is materializing and removes it when that plugin is reloaded,
      // so tagging with data-plugin/data-plugin-css and reusing an existing,
      // identical tag is what keeps exactly one copy across hot reloads.
      try {
        let style = document.head.querySelector(`style[data-plugin-css="${CSS_ID}"]`)
        if (style === null) {
          style = document.createElement('style')
          style.setAttribute('data-plugin', '@local/vc-memory')
          style.setAttribute('data-plugin-css', CSS_ID)
          document.head.append(style)
        }
        if (style.textContent !== CSS) style.textContent = CSS
      } catch (error) {
        console.warn('[vc-memory] could not install styles:', error)
      }

      // Locale: the namespace belongs to this plugin; t is bound after the
      // dictionary is registered. A host without locale still gets the page,
      // with the Chinese strings hard-coded in the components.
      let t = (key) => key
      try {
        t = ctx.locale.bind(NS)
      } catch (error) {
        console.warn('[vc-memory] locale.bind unavailable:', error)
      }

      // ── plain data helpers (never throw on undefined API fields) ────────────
      function str(value) {
        if (typeof value === 'string') return value
        if (value === undefined || value === null) return ''
        return String(value)
      }

      function asArray(value) {
        return Array.isArray(value) ? value : []
      }

      function numOr(value, fallback) {
        const n = typeof value === 'number' ? value : Number(value)
        return Number.isFinite(n) ? n : fallback
      }

      function typeLabel(type) {
        if (type === 'project') return '项目'
        if (type === 'industry') return '行业'
        return '—'
      }

      function middleTruncate(value, max) {
        const text = str(value)
        if (text === '') return ''
        if (text.length <= max) return text
        const keep = Math.max(1, Math.floor((max - 1) / 2))
        return text.slice(0, keep) + '…' + text.slice(text.length - keep)
      }

      function truncateText(value, max) {
        const text = str(value).replace(/\s+/g, ' ').trim()
        if (text.length <= max) return text
        return text.slice(0, max - 1) + '…'
      }

      function joinPath(dir, file) {
        const base = str(dir).replace(/[\\/]+$/, '')
        const rest = str(file).replace(/^[\\/]+/, '')
        if (base === '') return rest
        if (rest === '') return base
        const sep = base.indexOf('\\') >= 0 && base.indexOf('/') < 0 ? '\\' : '/'
        return base + sep + rest.replace(/[\\/]/g, sep)
      }

      function parseTags(value) {
        return str(value).split(/[,，、;；\n]+/).map(function (item) { return item.trim() }).filter(function (item) { return item !== '' })
      }

      function safeHref(raw) {
        const href = str(raw).trim()
        if (href === '') return null
        if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
        return null
      }

      // ── industry board helpers (theme / sector / view) ──────────────────────
      // Mirrors the Host's sort: status priority first, then date descending.
      const VIEW_STATUSES = ['有效', '待验证', '被削弱', '已证伪']
      const VIEW_STATUS_RANK = { '有效': 0, '待验证': 1, '被削弱': 2, '已证伪': 3 }

      function sortViews(views) {
        return asArray(views).slice().sort(function (left, right) {
          const leftStatus = str(left && left.status)
          const rightStatus = str(right && right.status)
          const leftRank = VIEW_STATUS_RANK[leftStatus] === undefined ? 9 : VIEW_STATUS_RANK[leftStatus]
          const rightRank = VIEW_STATUS_RANK[rightStatus] === undefined ? 9 : VIEW_STATUS_RANK[rightStatus]
          if (leftRank !== rightRank) return leftRank - rightRank
          return str(right && right.date).localeCompare(str(left && left.date))
        })
      }

      function statusCounts(views) {
        const counts = { '有效': 0, '待验证': 0, '被削弱': 0, '已证伪': 0 }
        asArray(views).forEach(function (view) {
          const status = str(view && view.status)
          if (counts[status] !== undefined) counts[status] += 1
        })
        return counts
      }

      function statusSummaryCompact(views) {
        const counts = statusCounts(views)
        const parts = VIEW_STATUSES.filter(function (status) { return counts[status] > 0 }).map(function (status) {
          return status + ' ' + counts[status]
        })
        return parts.length > 0 ? parts.join(' · ') : '暂无观点'
      }

      function viewCountMeta(views) {
        const list = asArray(views)
        if (list.length === 0) return '暂无观点'
        return list.length + ' 观点 · ' + statusSummaryCompact(list)
      }

      function viewStatusClass(status) {
        if (status === '有效') return 'vc-pill-success'
        if (status === '待验证') return 'vc-pill-idle'
        if (status === '被削弱') return 'vc-pill-warn'
        if (status === '已证伪') return 'vc-pill-error'
        return 'vc-pill-neutral'
      }

      function themeViewCount(theme) {
        let total = asArray(theme && theme.views).length
        asArray(theme && theme.sectors).forEach(function (sector) {
          total += asArray(sector && sector.views).length
        })
        return total
      }

      function splitLines(value) {
        if (Array.isArray(value)) {
          return value.map(function (item) { return str(item).trim() }).filter(function (item) { return item !== '' })
        }
        return str(value).split(/\r?\n/).map(function (item) { return item.trim() }).filter(function (item) { return item !== '' })
      }

      function findThemeById(themes, themeId) {
        const key = str(themeId)
        const list = asArray(themes)
        for (let i = 0; i < list.length; i += 1) {
          if (list[i] && str(list[i].id) === key) return list[i]
        }
        for (let i = 0; i < list.length; i += 1) {
          if (list[i] && (str(list[i].dir) === key || str(list[i].name) === key)) return list[i]
        }
        return null
      }

      function findSectorByKey(theme, sectorKey) {
        const key = str(sectorKey)
        const sectors = asArray(theme && theme.sectors)
        for (let i = 0; i < sectors.length; i += 1) {
          const sector = sectors[i]
          if (!sector) continue
          if (str(sector.file) === key || str(sector.id) === key || str(sector.name) === key) return sector
        }
        return null
      }

      // Resolve a stored industry selection against the freshly scanned themes.
      // Falls back one level (view → sector → theme) when a board or view went
      // away, which is what happens after an archive or a hand edit.
      function resolveIndustrySelection(themes, selection) {
        if (selection === null || selection === undefined) return null
        if (selection.kind === 'legacy') return null
        const theme = findThemeById(themes, selection.themeId)
        if (theme === null) return null
        if (selection.kind === 'theme') return { theme, sector: null, view: null, level: 'theme' }
        const sector = findSectorByKey(theme, selection.sectorKey)
        if (selection.kind === 'sector') return { theme, sector, view: null, level: sector === null ? 'theme' : 'sector' }
        if (selection.kind === 'view') {
          if (selection.sectorKey === null || selection.sectorKey === undefined) {
            const themeView = asArray(theme.views).filter(function (view) { return view && str(view.id) === str(selection.viewId) })[0] || null
            return themeView !== null
              ? { theme, sector: null, view: themeView, level: 'view' }
              : { theme, sector: null, view: null, level: 'theme' }
          }
          const sectorView = sector === null ? null : asArray(sector.views).filter(function (view) { return view && str(view.id) === str(selection.viewId) })[0] || null
          return sectorView !== null
            ? { theme, sector, view: sectorView, level: 'view' }
            : { theme, sector, view: null, level: sector === null ? 'theme' : 'sector' }
        }
        return { theme, sector: null, view: null, level: 'theme' }
      }

      // The plain values the Host expects for one board, plus enough display
      // context for the modal / card that opened from it.
      function boardTargetOf(theme, sector) {
        return {
          themeId: str(theme && theme.id),
          themeDir: str(theme && theme.dir) || str(theme && theme.name),
          themeName: str(theme && theme.name),
          sectorKey: sector ? str(sector.file) : null,
          sectorName: sector ? str(sector.name) : null,
          boardSector: sector ? str(sector.name) : '_主题'
        }
      }

      function themeMatchesQuery(theme, needle) {
        if (needle === '') return true
        const parts = [str(theme && theme.name), str(theme && theme.scope)]
        asArray(theme && theme.views).forEach(function (view) {
          parts.push(str(view && view.id), str(view && view.conclusion))
          asArray(view && view.evidence).forEach(function (line) { parts.push(str(line)) })
          asArray(view && view.counter).forEach(function (line) { parts.push(str(line)) })
        })
        asArray(theme && theme.sectors).forEach(function (sector) {
          parts.push(str(sector && sector.name), str(sector && sector.scope))
          asArray(sector && sector.views).forEach(function (view) {
            parts.push(str(view && view.id), str(view && view.conclusion))
            asArray(view && view.evidence).forEach(function (line) { parts.push(str(line)) })
          })
        })
        return parts.join(' ').toLowerCase().indexOf(needle) >= 0
      }

      function legacyMatchesQuery(entry, needle) {
        if (!entry) return false
        if (needle === '') return true
        return [str(entry.name), str(entry.sector), str(entry.summary), asArray(entry.tags).map(str).join(' ')]
          .join(' ').toLowerCase().indexOf(needle) >= 0
      }

      async function copyText(value) {
        const text = str(value)
        if (text === '') return false
        try {
          // 127.0.0.1 / localhost is a secure context, so the async clipboard is
          // the only path used: nothing is appended to document.body from here.
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text)
            return true
          }
        } catch (error) {
          // permission or focus denial: the caller shows the toast and the user
          // can select the path/text manually
        }
        return false
      }

      // ── compact Markdown renderer (no external library) ─────────────────────
      function renderInline(value) {
        const text = str(value)
        if (text === '') return null
        const out = []
        const pattern = /\*\*([^*]+)\*\*|`([^`\n]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
        let last = 0
        let match = null
        let n = 0
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > last) out.push(text.slice(last, match.index))
          if (match[1] !== undefined) {
            out.push(h('strong', { key: 'b' + n }, match[1]))
          } else if (match[2] !== undefined) {
            out.push(h('code', { key: 'c' + n, className: 'vc-md-code' }, match[2]))
          } else {
            const href = safeHref(match[4])
            if (href === null) {
              out.push(match[3])
            } else {
              out.push(h('a', { key: 'a' + n, href, target: '_blank', rel: 'noreferrer noopener' }, match[3]))
            }
          }
          n += 1
          last = pattern.lastIndex
        }
        if (last < text.length) out.push(text.slice(last))
        return out.length > 0 ? out : null
      }

      // Block parser: headings h1-h3, bold, inline code, unordered and ordered
      // lists, - [ ] / - [x] task items, links, blockquotes, rules, paragraphs.
      function renderMarkdown(source) {
        try {
          const text = str(source).replace(/\r\n?/g, '\n')
          if (text.trim() === '') return null
          const lines = text.split('\n')
          const blocks = []
          let key = 0
          let i = 0
          while (i < lines.length) {
            const line = lines[i]
            if (line.trim() === '') { i += 1; continue }

            const heading = /^(#{1,6})\s+(.*)$/.exec(line)
            if (heading !== null) {
              const level = Math.min(3, heading[1].length)
              blocks.push(h('h' + level, { key: 'h' + (key += 1) }, renderInline(heading[2])))
              i += 1
              continue
            }

            if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
              blocks.push(h('hr', { key: 'hr' + (key += 1) }))
              i += 1
              continue
            }

            if (/^\s*>/.test(line)) {
              const quote = []
              while (i < lines.length && /^\s*>/.test(lines[i])) {
                quote.push(lines[i].replace(/^\s*>\s?/, ''))
                i += 1
              }
              blocks.push(h('blockquote', { key: 'q' + (key += 1) }, renderMarkdown(quote.join('\n'))))
              continue
            }

            if (/^\s*[-*+]\s+/.test(line)) {
              const items = []
              while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                const raw = lines[i].replace(/^\s*[-*+]\s+/, '')
                const task = /^\[( |x|X)\]\s*(.*)$/.exec(raw)
                if (task !== null) items.push({ text: task[2], checked: task[1].toLowerCase() === 'x' })
                else items.push({ text: raw, checked: null })
                i += 1
              }
              blocks.push(h('ul', { key: 'ul' + (key += 1) }, items.map(function (item, index) {
                if (item.checked === null) return h('li', { key: index }, renderInline(item.text))
                return h('li', { key: index, className: 'vc-md-task' },
                  h('input', { type: 'checkbox', className: 'vc-md-check', checked: item.checked, readOnly: true, tabIndex: -1, 'aria-label': str(item.text) }),
                  h('span', { className: item.checked ? 'vc-md-task-text vc-md-done' : 'vc-md-task-text' }, renderInline(item.text)))
              })))
              continue
            }

            if (/^\s*\d+[.)]\s+/.test(line)) {
              const items = []
              while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''))
                i += 1
              }
              blocks.push(h('ol', { key: 'ol' + (key += 1) }, items.map(function (item, index) {
                return h('li', { key: index }, renderInline(item))
              })))
              continue
            }

            if (/^\s*\|/.test(line)) {
              const rows = []
              while (i < lines.length && /^\s*\|/.test(lines[i])) {
                rows.push(lines[i])
                i += 1
              }
              const split = function (raw) {
                return raw.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (cell) { return cell.trim() })
              }
              const header = split(rows[0] || '')
              const separator = rows.length > 1 && /^[\s|:-]+$/.test(rows[1]) && rows[1].indexOf('-') >= 0
              const bodyRows = (separator ? rows.slice(2) : rows.slice(1)).map(split)
              blocks.push(h('table', { key: 'tb' + (key += 1), className: 'vc-md-table' },
                h('thead', { key: 'thead' }, h('tr', { key: 'head' }, header.map(function (cell, index) {
                  return h('th', { key: index }, renderInline(cell))
                }))),
                bodyRows.length > 0
                  ? h('tbody', { key: 'tbody' }, bodyRows.map(function (row, rowIndex) {
                    return h('tr', { key: rowIndex }, row.map(function (cell, cellIndex) {
                      return h('td', { key: cellIndex }, renderInline(cell))
                    }))
                  }))
                  : null))
              continue
            }

            const paragraph = []
            while (
              i < lines.length &&
              lines[i].trim() !== '' &&
              !/^(#{1,6})\s|^\s*>|^\s*[-*+]\s|^\s*\d+[.)]\s|^\s*\|/.test(lines[i])
            ) {
              paragraph.push(lines[i].trim())
              i += 1
            }
            if (paragraph.length === 0) { i += 1; continue }
            blocks.push(h('p', { key: 'p' + (key += 1) }, renderInline(paragraph.join(' '))))
          }
          return blocks.length > 0 ? blocks : null
        } catch (error) {
          console.warn('[vc-memory] markdown render failed:', error)
          return h('pre', { className: 'vc-hint' }, str(source))
        }
      }

      // ── HTTP contract (docs/API.md) ─────────────────────────────────────────
      async function request(path, body, options) {
        const allowNotOk = options !== undefined && options !== null && options.allowNotOk === true
        const init = { method: body === undefined ? 'GET' : 'POST', headers: { accept: 'application/json' } }
        if (body !== undefined) {
          init.headers['content-type'] = 'application/json'
          init.body = JSON.stringify(body)
        }
        let response = null
        try {
          response = await fetch(API + path, init)
        } catch (error) {
          throw new Error('网络请求失败：' + (str(error && error.message) || '无法连接 Host'))
        }
        let payload = null
        try {
          payload = await response.json()
        } catch (error) {
          payload = null
        }
        if (!response.ok || payload === null || (payload.ok !== true && allowNotOk !== true)) {
          let message = payload !== null && typeof payload.error === 'string' && payload.error !== ''
            ? payload.error
            : '请求失败（HTTP ' + response.status + '）'
          if (response.status === 404) message += '（Host 半边接口未就绪）'
          throw new Error(message)
        }
        return payload
      }

      const api = {
        state: function () { return request('/state') },
        entry: function (id) { return request('/entry?id=' + encodeURIComponent(str(id))) },
        upsert: function (payload) { return request('/upsert', payload) },
        review: function (payload) { return request('/review', payload) },
        // industry two-level boards: theme header + per-sub-sector view boards
        theme: function (payload) { return request('/theme', payload) },
        sector: function (payload) { return request('/sector', payload) },
        view: function (payload) { return request('/view', payload) },
        // { period:'week', save:true } writes 简报/, save:false only previews
        digest: function (period, save) { return request('/digest', { period: period === 'month' ? 'month' : 'week', save: save === true }) },
        // Empty body: the Host performs commit when Git is enabled. A vault
        // that is Git-enabled but not a repository answers HTTP 200 with
        // ok:false plus the fix-it instructions in output, so this one call
        // passes allowNotOk and lets the UI show that guidance.
        sync: function () { return request('/sync', {}, { allowNotOk: true }) },
        seed: function () { return request('/seed', {}) },
        // vault location: GET /config returns the effective + default dirs; the
        // POST switches the live vault and persists the choice outside the vault.
        config: function () { return request('/config') },
        setVault: function (vaultDir) { return request('/config', { vaultDir: str(vaultDir) }) },
        resetVault: function () { return request('/config', { reset: true }) }
      }

      // ── shared components ───────────────────────────────────────────────────
      const Boundary = (function () {
        if (typeof React.Component !== 'function') return null
        class Guard extends React.Component {
          constructor(props) {
            super(props)
            this.state = { failed: false }
          }
          static getDerivedStateFromError() {
            return { failed: true }
          }
          componentDidCatch(error) {
            console.warn('[vc-memory] a panel component crashed:', error)
          }
          render() {
            if (this.state.failed) {
              return h('div', { className: 'vc-center' },
                h('div', { className: 'vc-error-title' }, '这一块内容出错了'),
                h('div', { className: 'vc-error-text' }, '其余界面仍然可用。可以刷新面板或检查 Host 日志。'),
                h('button', { type: 'button', className: 'vc-btn', onClick: () => this.setState({ failed: false }) }, '重试'))
            }
            return this.props.children
          }
        }
        return Guard
      })()

      function guard(label, element) {
        if (Boundary === null) return element
        return h(Boundary, { key: label }, element)
      }

      const Icon = function Icon(props) {
        const size = typeof props.size === 'number' && props.size > 0 ? props.size : 16
        const active = props.active === true
        return h('svg', {
          width: size,
          height: size,
          viewBox: '0 0 20 20',
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' }
        },
          h('rect', {
            x: 2.8, y: 3.6, width: 14.4, height: 12.8, rx: 3,
            stroke: 'currentColor', strokeWidth: active ? 1.7 : 1.4, opacity: 0.95
          }),
          h('path', {
            d: 'M5.8 12.4 L8.3 9.8 L10.6 11.5 L14.4 7.3',
            stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round'
          }),
          h('circle', { cx: 14.4, cy: 7.3, r: 1.05, fill: 'currentColor' }),
          h('path', { d: 'M5.8 14.8 H9.8', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', opacity: 0.6 })
        )
      }

      const Btn = function Btn(props) {
        return h('button', {
          type: props.type === 'submit' ? 'submit' : 'button',
          className: 'vc-btn' + (props.variant ? ' vc-btn-' + props.variant : ''),
          onClick: typeof props.onClick === 'function' ? props.onClick : undefined,
          disabled: props.disabled === true,
          title: props.title,
          'aria-label': props.ariaLabel
        }, props.children)
      }

      const verdictClass = {
        '看好': 'vc-pill-success',
        '观望': 'vc-pill-idle',
        '回避': 'vc-pill-error',
        '已投': 'vc-pill-brand',
        '已退出': 'vc-pill-neutral'
      }

      const VerdictPill = function VerdictPill(props) {
        const verdict = str(props.verdict).trim()
        if (verdict === '') return h('span', { className: 'vc-pill vc-pill-none', title: '尚未给出判断' }, '未判断')
        return h('span', { className: 'vc-pill ' + (verdictClass[verdict] || 'vc-pill-idle'), title: '判断：' + verdict }, verdict)
      }

      const DueLabel = function DueLabel(props) {
        const entry = props.entry || {}
        const next = str(entry.nextReview)
        const dueInDays = typeof entry.dueInDays === 'number' && Number.isFinite(entry.dueInDays) ? entry.dueInDays : null
        if (dueInDays === null) {
          return h('span', { className: 'vc-due' }, next !== '' ? next : '未安排复盘')
        }
        if (dueInDays < 0) {
          const overdue = Math.abs(Math.round(dueInDays))
          return h('span', { className: 'vc-due vc-due-over', title: '已逾期 ' + overdue + ' 天' },
            (next !== '' ? next + ' · ' : '') + '逾期 ' + overdue + ' 天')
        }
        if (dueInDays === 0) {
          return h('span', { className: 'vc-due vc-due-today' }, (next !== '' ? next + ' · ' : '') + '今天到期')
        }
        const label = dueInDays <= 7 ? ' · ' + dueInDays + ' 天后到期' : ' · ' + dueInDays + ' 天后'
        return h('span', { className: 'vc-due' + (dueInDays <= 7 ? ' vc-due-soon' : '') }, (next !== '' ? next : '') + label)
      }

      const GridField = function GridField(props) {
        return h('div', { className: 'vc-field' },
          h('div', { className: 'vc-field-label' }, props.label),
          h('div', { className: 'vc-field-value' }, props.children))
      }

      function FieldsGrid(props) {
        const entry = props.entry || {}
        const tags = asArray(entry.tags)
        const confidence = typeof entry.confidence === 'number' ? entry.confidence : null
        return h('div', { className: 'vc-fields' },
          h(GridField, { label: '类型' }, typeLabel(entry.type)),
          h(GridField, { label: '领域' }, str(entry.sector) || '—'),
          h(GridField, { label: '轮次' }, str(entry.stage) || '—'),
          h(GridField, { label: '判断' }, h(VerdictPill, { verdict: entry.verdict })),
          h(GridField, { label: '置信度' }, confidence === null ? '—' : String(confidence) + ' / 5'),
          h(GridField, { label: '标签' }, tags.length > 0
            ? h('div', { className: 'vc-tags' }, tags.map(function (tag, index) {
              return h('span', { key: index, className: 'vc-tag' }, str(tag))
            }))
            : '—'),
          h(GridField, { label: '创建' }, str(entry.created) || '—'),
          h(GridField, { label: '最近复盘' }, str(entry.lastReviewed) || '—'),
          h(GridField, { label: '下次复盘' }, h(DueLabel, { entry })),
          h(GridField, { label: '文件' }, h('code', { className: 'vc-file' }, str(entry.file) || '—')))
      }

      // ── modal shell: overlay inside the panel, Escape closes, focus visible ─
      function ModalFrame(props) {
        const onClose = props.onClose
        React.useEffect(function () {
          const onKey = function (event) {
            if (event.key === 'Escape' && event.defaultPrevented !== true) {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }
          }
          window.addEventListener('keydown', onKey, true)
          return function () { window.removeEventListener('keydown', onKey, true) }
        }, [onClose])
        return h('div', {
          className: 'vc-mask',
          onMouseDown: function (event) { if (event.target === event.currentTarget) onClose() }
        },
          h('div', {
            className: 'vc-modal' + (props.wide === true ? ' vc-modal-wide' : ''),
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': props.title,
            onMouseDown: function (event) { event.stopPropagation() }
          },
            h('div', { className: 'vc-modal-head' },
              h('div', { className: 'vc-modal-headtext' },
                h('div', { className: 'vc-modal-title' }, props.title),
                props.subtitle !== undefined ? h('div', { className: 'vc-modal-sub' }, props.subtitle) : null),
              h('button', { type: 'button', className: 'vc-icon-btn', 'aria-label': '关闭对话框', onClick: onClose }, h('span', { 'aria-hidden': 'true' }, '✕'))),
            h('div', { className: 'vc-modal-body' }, props.children)))
      }

      const FormField = function FormField(props) {
        return h('label', { className: 'vc-field-row' },
          h('span', { className: 'vc-field-name' },
            props.label,
            props.required === true ? h('i', { className: 'vc-req', 'aria-hidden': 'true' }, '*') : null),
          props.children,
          props.hint !== undefined ? h('span', { className: 'vc-field-hint' }, props.hint) : null)
      }

      // ── 新建 / 编辑 form modal ──────────────────────────────────────────────
      function sectionBody(detail, title) {
        const sections = asArray(detail && detail.sections)
        let found = null
        for (let i = 0; i < sections.length; i += 1) {
          if (str(sections[i] && sections[i].title).trim() === title) { found = sections[i]; break }
        }
        if (found === null) {
          for (let i = 0; i < sections.length; i += 1) {
            if (str(sections[i] && sections[i].title).indexOf(title) >= 0) { found = sections[i]; break }
          }
        }
        return found === null ? '' : str(found.body).trim()
      }

      function EntryFormModal(props) {
        const mode = props.mode === 'edit' ? 'edit' : 'create'
        const entry = props.entry || {}
        const detail = props.detail || null
        const cycle = numOr(entry.reviewCycleDays, numOr(props.defaultCycle, 30))
        const [form, setForm] = React.useState(function () {
          return {
            type: entry.type === 'industry' ? 'industry' : 'project',
            name: str(entry.name),
            sector: str(entry.sector),
            stage: str(entry.stage),
            verdict: str(entry.verdict),
            confidence: typeof entry.confidence === 'number' ? String(entry.confidence) : '',
            tags: asArray(entry.tags).map(str).join(', '),
            summary: sectionBody(detail, '一句话判断') || str(entry.summary),
            thesis: sectionBody(detail, '判断依据'),
            assumptions: sectionBody(detail, '关键假设'),
            risks: sectionBody(detail, '风险与反证'),
            evidence: '',
            reviewCycleDays: String(cycle > 0 ? cycle : 30)
          }
        })
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState(null)

        const setField = function (name, value) {
          setForm(function (prev) {
            const next = Object.assign({}, prev)
            next[name] = value
            return next
          })
        }
        // Shared controlled-field props; textarea callers ask for the textarea
        // class so the coarse multi-line styling (resize, min-height) applies.
        const input = function (name, kind) {
          return {
            value: form[name],
            className: kind === 'textarea' ? 'vc-textarea' : 'vc-input',
            onChange: function (event) { setField(name, event.target.value) }
          }
        }

        const submit = async function (event) {
          event.preventDefault()
          if (saving) return
          const name = form.name.trim()
          if (name === '') { setError('请填写项目名称。'); return }
          if (mode === 'create' && form.type !== 'project' && form.type !== 'industry') { setError('请选择类型。'); return }
          const payload = {
            type: form.type,
            name,
            sector: form.sector.trim(),
            stage: form.stage.trim(),
            tags: parseTags(form.tags),
            summary: form.summary,
            thesis: form.thesis,
            assumptions: form.assumptions,
            risks: form.risks
          }
          // The Host rejects any verdict that is not one of the five, including
          // the empty string; "暂不判断" therefore omits the key (= keep as is).
          if (form.verdict !== '') payload.verdict = form.verdict
          if (form.confidence !== '') payload.confidence = Number(form.confidence)
          const cycleDays = Number(form.reviewCycleDays)
          if (Number.isFinite(cycleDays) && cycleDays > 0) payload.reviewCycleDays = Math.round(cycleDays)
          if (form.evidence.trim() !== '') payload.evidence = form.evidence
          if (mode === 'edit' && str(entry.id) !== '') {
            payload.id = str(entry.id)
            // keep existing aliases on update: they are not in the form, and an
            // omitted list would be indistinguishable from "clear" to the Host
            if (asArray(entry.aliases).length > 0) payload.aliases = asArray(entry.aliases)
          }
          setSaving(true)
          setError(null)
          try {
            const result = await api.upsert(payload)
            setSaving(false)
            if (typeof props.onSaved === 'function') props.onSaved(result, mode)
          } catch (failure) {
            setSaving(false)
            setError(str(failure && failure.message) || '保存失败')
          }
        }

        return h(ModalFrame, {
          title: mode === 'edit' ? '编辑记录' : '新建项目记录',
          subtitle: mode === 'edit'
            ? (str(entry.name) || '') + (str(entry.id) !== '' ? ' · ' + str(entry.id) : '')
            : '项目判断写入 项目/ 目录；行业请到「行业」标签页用 主题 / 细分赛道 / 观点 记录。',
          wide: true,
          onClose: props.onClose
        },
          h('form', { className: 'vc-form', onSubmit: submit },
            h('div', { className: 'vc-form-scroll' },
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '类型', required: true },
                  h('select', { className: 'vc-input', disabled: true, value: form.type, 'aria-label': '类型', onChange: function (event) { setField('type', event.target.value) } },
                    h('option', { value: 'project' }, '项目'),
                    form.type === 'industry' ? h('option', { value: 'industry' }, '行业（旧格式）') : null)),
                h(FormField, { label: '名称', required: true },
                  h('input', Object.assign({ type: 'text', placeholder: '例如：星弧智能', autoFocus: true, 'aria-label': '名称' }, input('name'))))),
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '领域' },
                  h('input', Object.assign({ type: 'text', placeholder: '细分方向，例如 AI Infra', 'aria-label': '领域' }, input('sector')))),
                h(FormField, { label: '轮次' },
                  h('input', Object.assign({ type: 'text', placeholder: '例如 A 轮', 'aria-label': '轮次' }, input('stage'))))),
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '判断' },
                  h('select', { className: 'vc-input', value: form.verdict, 'aria-label': '判断', onChange: function (event) { setField('verdict', event.target.value) } },
                    h('option', { value: '' }, '暂不判断'),
                    h('option', { value: '看好' }, '看好'),
                    h('option', { value: '观望' }, '观望'),
                    h('option', { value: '回避' }, '回避'),
                    h('option', { value: '已投' }, '已投'),
                    h('option', { value: '已退出' }, '已退出'),
                    // a hand-edited file may carry a custom verdict; keep it
                    // selectable so edited forms round-trip instead of failing
                    form.verdict !== '' && ['看好', '观望', '回避', '已投', '已退出'].indexOf(form.verdict) < 0
                      ? h('option', { value: form.verdict }, form.verdict)
                      : null)),
                h(FormField, { label: '置信度' },
                  h('select', { className: 'vc-input', value: form.confidence, 'aria-label': '置信度', onChange: function (event) { setField('confidence', event.target.value) } },
                    h('option', { value: '' }, '未设置'),
                    h('option', { value: '1' }, '1 / 5'),
                    h('option', { value: '2' }, '2 / 5'),
                    h('option', { value: '3' }, '3 / 5'),
                    h('option', { value: '4' }, '4 / 5'),
                    h('option', { value: '5' }, '5 / 5')))),
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '标签', hint: '用逗号分隔，例如：推理, 国产替代' },
                  h('input', Object.assign({ type: 'text', placeholder: '推理, 国产替代', 'aria-label': '标签（逗号分隔）' }, input('tags')))),
                h(FormField, { label: '复盘周期（天）' },
                  h('input', { value: form.reviewCycleDays, className: 'vc-input', type: 'number', min: 1, max: 3650, 'aria-label': '复盘周期（天）', onChange: function (event) { setField('reviewCycleDays', event.target.value) } }))),
              h(FormField, { label: '一句话判断' },
                h('textarea', Object.assign({ rows: 2, placeholder: '一句话说清看好的理由与关键变量。', 'aria-label': '一句话判断' }, input('summary', 'textarea')))),
              h(FormField, { label: '判断依据' },
                h('textarea', Object.assign({ rows: 5, placeholder: '支持这个判断的逻辑、数据与关键推理（支持 Markdown）。', 'aria-label': '判断依据' }, input('thesis', 'textarea')))),
              h(FormField, { label: '关键假设', hint: '用 - [ ] 写成可验证的假设，复盘时逐条勾选。' },
                h('textarea', Object.assign({ rows: 4, placeholder: '- [ ] 假设一\n- [ ] 假设二', 'aria-label': '关键假设' }, input('assumptions', 'textarea')))),
              h(FormField, { label: '风险与反证' },
                h('textarea', Object.assign({ rows: 4, placeholder: '可能证伪什么？有哪些反面证据？', 'aria-label': '风险与反证' }, input('risks', 'textarea')))),
              h(FormField, { label: '证据与时间线', hint: mode === 'edit' ? '追加到「证据与时间线」；留空则不追加。' : '写成「日期 · 来源与事实」，会追加到时间线。' },
                h('textarea', Object.assign({ rows: 2, placeholder: '2026-10-17 · 与团队交流，确认流片节点', 'aria-label': '证据与时间线' }, input('evidence', 'textarea'))))),
            error !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, error) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Enter 保存 · Esc 取消'),
              h(Btn, { onClick: props.onClose, disabled: saving }, '取消'),
              h(Btn, { type: 'submit', variant: 'primary', disabled: saving }, saving ? '保存中…' : (mode === 'edit' ? '保存修改' : '创建记录')))))
      }

      // ── 复盘 form modal ─────────────────────────────────────────────────────
      function ReviewFormModal(props) {
        const entry = props.entry || {}
        const [form, setForm] = React.useState({
          outcome: '本轮进展符合判断',
          progress: '',
          deviation: '',
          nextVerdict: '',
          confidence: '',
          nextReview: '',
          notes: ''
        })
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState(null)
        const setField = function (name, value) {
          setForm(function (prev) {
            const next = Object.assign({}, prev)
            next[name] = value
            return next
          })
        }
        const submit = async function (event) {
          event.preventDefault()
          if (saving) return
          const payload = { id: str(entry.id), outcome: form.outcome, progress: form.progress, deviation: form.deviation }
          if (form.nextVerdict !== '') payload.nextVerdict = form.nextVerdict
          if (form.confidence !== '') payload.confidence = Number(form.confidence)
          if (form.nextReview !== '') payload.nextReview = form.nextReview
          if (form.notes.trim() !== '') payload.notes = form.notes
          setSaving(true)
          setError(null)
          try {
            const result = await api.review(payload)
            setSaving(false)
            if (typeof props.onSaved === 'function') props.onSaved(result)
          } catch (failure) {
            setSaving(false)
            setError(str(failure && failure.message) || '复盘提交失败')
          }
        }
        return h(ModalFrame, {
          title: '复盘',
          subtitle: (str(entry.name) || '当前记录') + ' · 追加一条带日期的复盘并推进复盘时钟',
          wide: false,
          onClose: props.onClose
        },
          h('form', { className: 'vc-form', onSubmit: submit },
            h('div', { className: 'vc-form-scroll' },
              h(FormField, { label: '本轮结论', required: true },
                h('select', { className: 'vc-input', value: form.outcome, 'aria-label': '本轮结论', onChange: function (event) { setField('outcome', event.target.value) } },
                  h('option', { value: '本轮进展符合判断' }, '本轮进展符合判断'),
                  h('option', { value: '偏离' }, '偏离'),
                  h('option', { value: '证伪' }, '证伪'),
                  h('option', { value: '暂无进展' }, '暂无进展'))),
              h(FormField, { label: '事实与进展', hint: '数据、里程碑与对方给出的关键信息（支持 Markdown）。' },
                h('textarea', { className: 'vc-textarea', rows: 4, autoFocus: true, value: form.progress, 'aria-label': '事实与进展', onChange: function (event) { setField('progress', event.target.value) } })),
              h(FormField, { label: '判断偏差与原因' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.deviation, 'aria-label': '判断偏差与原因', onChange: function (event) { setField('deviation', event.target.value) } })),
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '更新判断' },
                  h('select', { className: 'vc-input', value: form.nextVerdict, 'aria-label': '更新判断', onChange: function (event) { setField('nextVerdict', event.target.value) } },
                    h('option', { value: '' }, '不改变'),
                    h('option', { value: '看好' }, '看好'),
                    h('option', { value: '观望' }, '观望'),
                    h('option', { value: '回避' }, '回避'),
                    h('option', { value: '已投' }, '已投'),
                    h('option', { value: '已退出' }, '已退出'))),
                h(FormField, { label: '更新置信度' },
                  h('select', { className: 'vc-input', value: form.confidence, 'aria-label': '更新置信度', onChange: function (event) { setField('confidence', event.target.value) } },
                    h('option', { value: '' }, '不改变'),
                    h('option', { value: '1' }, '1 / 5'),
                    h('option', { value: '2' }, '2 / 5'),
                    h('option', { value: '3' }, '3 / 5'),
                    h('option', { value: '4' }, '4 / 5'),
                    h('option', { value: '5' }, '5 / 5')))),
              h(FormField, { label: '下次复盘', hint: '留空 = 最近复盘日 + 复盘周期。' },
                h('input', { className: 'vc-input', type: 'date', value: form.nextReview, 'aria-label': '下次复盘日期', onChange: function (event) { setField('nextReview', event.target.value) } })),
              h(FormField, { label: '其他补充' },
                h('textarea', { className: 'vc-textarea', rows: 2, value: form.notes, 'aria-label': '其他补充', onChange: function (event) { setField('notes', event.target.value) } }))),
            error !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, error) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Enter 保存 · Esc 取消'),
              h(Btn, { onClick: props.onClose, disabled: saving }, '取消'),
              h(Btn, { type: 'submit', variant: 'primary', disabled: saving }, saving ? '记录中…' : '保存复盘'))))
      }

      // ── 本周简报 modal ──────────────────────────────────────────────────────
      function DigestModal(props) {
        const [result, setResult] = React.useState(null)
        const [saved, setSaved] = React.useState(false)
        const [loading, setLoading] = React.useState(true)
        const [error, setError] = React.useState(null)
        const started = React.useRef(false)

        const run = async function (save) {
          setLoading(true)
          setError(null)
          try {
            const payload = await api.digest('week', save)
            setResult(payload)
            setSaved(payload.saved === true)
            setLoading(false)
            if (save === true && typeof props.onToast === 'function') {
              props.onToast('success', '本周简报已生成' + (str(payload.file) !== '' ? '：' + str(payload.file) : ''))
            }
          } catch (failure) {
            setLoading(false)
            setError(str(failure && failure.message) || '生成失败')
          }
        }

        React.useEffect(function () {
          // The button that opens this dialog means "produce this week's
          // brief": the primary call saves it. The ref keeps StrictMode's
          // double effect from writing the digest twice.
          if (started.current === true) return
          started.current = true
          void run(true)
        }, [])

        const copy = async function () {
          if (result === null) return
          const ok = await copyText(result.markdown)
          if (typeof props.onToast === 'function') {
            props.onToast(ok ? 'success' : 'error', ok ? '简报内容已复制' : '复制失败（请手动选择文本）')
          }
        }

        return h(ModalFrame, {
          title: str(result && result.title) || '投资记忆周报',
          subtitle: result !== null && str(result.file) !== '' ? '已写入：' + str(result.file) : '回顾本周新增、复盘、判断变化与仍然悬而未决的问题',
          wide: true,
          onClose: props.onClose
        },
          h('div', { className: 'vc-digest', 'aria-busy': loading ? 'true' : 'false' },
            loading ? h('div', { className: 'vc-center', style: { minHeight: '180px', padding: '24px' } },
              h('div', { className: 'vc-spinner', 'aria-hidden': 'true' }),
              h('div', { className: 'vc-hint' }, '正在生成本周简报…')) : null,
            error !== null ? h('div', { className: 'vc-center', style: { minHeight: '140px' } },
              h('div', { className: 'vc-error-title' }, '简报生成失败'),
              h('div', { className: 'vc-error-text' }, error),
              h(Btn, { onClick: function () { void run(true) } }, '重试')) : null,
            !loading && error === null && result !== null ? h('div', null,
              saved ? null : h('div', { className: 'vc-digest-hint' }, '这是预览，尚未写入「简报」目录。'),
              str(result.file) !== '' ? h('div', { className: 'vc-digest-meta' }, '文件：' + str(result.file)) : null,
              h('div', { className: 'vc-md' }, renderMarkdown(result.markdown))) : null),
          h('div', { className: 'vc-form-foot' },
            h('span', { className: 'vc-foot-hint' }, 'Esc 关闭'),
            h(Btn, { onClick: copy, disabled: result === null || loading, variant: 'primary' }, '复制'),
            saved ? h(Btn, { onClick: function () { void run(false) }, disabled: loading }, '预览不保存') : h(Btn, { onClick: function () { void run(true) }, disabled: loading }, '保存本周简报'),
            h(Btn, { onClick: props.onClose }, '关闭')))
      }

      // ── empty state ─────────────────────────────────────────────────────────
      function EmptyState(props) {
        const state = props.state || {}
        const vault = state.vault || {}
        const config = state.config || {}
        const dir = str(vault.dir) || str(config.vaultDir)
        return h('div', { className: 'vc-empty' },
          h('div', { className: 'vc-empty-mark' }, h(Icon, { size: 34, active: false })),
          h('h2', { className: 'vc-empty-title' }, '投资记忆还是空的'),
          h('p', { className: 'vc-empty-text' },
            '这里用来存放你对项目与行业的判断：一篇记录一个 Markdown 文件，复盘、简报和云同步都会围绕它生长。可以先写入几条示例，看看格式。'),
          h('div', { className: 'vc-empty-card' },
            h('div', { className: 'vc-empty-block' },
              h('div', { className: 'vc-empty-label' }, '知识库目录'),
              h('code', { className: 'vc-empty-path' }, dir !== '' ? dir : '（尚未确定，由 Host 自动选择）'),
              h('ul', { className: 'vc-empty-list' },
                h('li', null, vault.exists === false ? '目录还不存在：写入第一条记录时会自动创建。' : '所有内容都是普通 Markdown，可被 Obsidian、Typora、VS Code 直接编辑。'),
                h('li', null, '项目放在 项目/，行业按「主题 → 细分赛道 → 观点」放在 行业/，周报写在 简报/。'),
                h('li', null, '行业记忆在「行业」标签页：先建主题，再建细分赛道，再记录可修正的观点。'),
                h('li', null, '想改目录：点右上角「设置」选择知识库位置。'))),
            h('div', { className: 'vc-empty-block' },
              h('div', { className: 'vc-empty-label' }, '同步方式'),
              h('ul', { className: 'vc-empty-list' },
                h('li', null, h('b', null, 'OneDrive / iCloud / 坚果云：'), '把知识库放进同步文件夹即可，插件不保存隐藏状态，多设备之间由网盘同步。'),
                h('li', null, h('b', null, 'Git / GitHub：'), '在知识库目录 git init 并配置远程仓库，打开配置里的 git.enabled 与 autoCommit / autoPush 后，可在面板里直接同步。'),
                h('li', null, h('b', null, '或者直接对我说：'), '「把这次尽调记到投资记忆里」，由 vc_memory 工具写入同一批文件。')))),
          props.error !== null ? h('div', { className: 'vc-form-error', role: 'alert', style: { maxWidth: '620px' } }, props.error) : null,
          h(Btn, { variant: 'primary', onClick: props.onSeed, disabled: props.seeding === true }, props.seeding === true ? '写入中…' : '写入示例记录'),
          props.seeding === true ? h('div', { className: 'vc-hint' }, '正在把内置示例复制进知识库…') : null)
      }

      // ── list row ────────────────────────────────────────────────────────────
      function ListRow(props) {
        const entry = props.entry || {}
        const id = str(entry.id)
        const active = props.active === true
        const legacy = entry.legacy === true
        const type = entry.type === 'industry' ? 'industry' : (entry.type === 'project' ? 'project' : 'other')
        const sector = str(entry.sector)
        const stage = str(entry.stage)
        const sectorLine = [sector, stage].filter(function (item) { return item !== '' }).join(' · ')
        return h('button', {
          type: 'button',
          className: 'vc-row' + (active ? ' on' : ''),
          'aria-pressed': active ? 'true' : 'false',
          onClick: function () { props.onSelect(id) }
        },
          h('div', { className: 'vc-row-top' },
            h('span', { className: 'vc-row-name', title: str(entry.name) || id }, str(entry.name) || '未命名记录'),
            h('span', { className: 'vc-type' + (type === 'project' ? ' vc-type-project' : '') }, legacy ? '旧格式' : typeLabel(type))),
          h('div', { className: 'vc-row-mid' },
            h(VerdictPill, { verdict: entry.verdict }),
            h('span', { className: 'vc-row-sector', title: sectorLine }, sectorLine !== '' ? sectorLine : (legacy ? '旧版扁平行业条目' : '未填写领域'))),
          h('div', { className: 'vc-row-bot' },
            h(DueLabel, { entry }),
            typeof entry.confidence === 'number' ? h('span', { className: 'vc-row-sector' }, '置信 ' + entry.confidence + '/5') : null))
      }

      // ── detail pane ─────────────────────────────────────────────────────────
      function DetailPane(props) {
        const meta = props.meta || null
        const rawDetail = props.detail || null
        const loading = props.loading === true
        const error = props.error
        if (meta === null) {
          return h('div', { className: 'vc-detail' },
            h('div', { className: 'vc-center' },
              h(Icon, { size: 28, active: false }),
              h('div', { className: 'vc-hint' }, '从左侧选择一条记录，查看判断、假设与复盘。')))
        }
        // Only trust a detail payload that belongs to the selected entry: for one
        // render after a selection change the previous entry's detail is still in
        // state, and showing it under the new title would be wrong.
        const detail = rawDetail !== null && rawDetail.entry !== undefined && rawDetail.entry !== null && str(rawDetail.entry.id) === str(meta.id)
          ? rawDetail
          : null
        const entry = (detail && detail.entry) || meta || {}
        // Legacy flat industry files predate the theme/sector boards and stay
        // readable here but are not editable through the panel.
        const readOnly = props.readOnly === true || entry.legacy === true
        const sections = asArray(detail && detail.sections)
        const markdown = str(detail && detail.markdown)
        return h('div', { className: 'vc-detail' },
          h('div', { className: 'vc-detail-head' },
            h('div', { className: 'vc-detail-titleline' },
              h('h2', { className: 'vc-detail-title' }, str(entry.name) || '未命名记录'),
              h(VerdictPill, { verdict: entry.verdict }),
              entry.legacy === true ? h('span', { className: 'vc-pill vc-pill-neutral', title: '旧版扁平行业条目，只读；请迁移到主题 / 细分赛道' }, '旧格式') : null,
              entry.example === true ? h('span', { className: 'vc-pill vc-pill-neutral', title: '内置示例记录，可自由修改或删除' }, '示例') : null),
            h('div', { className: 'vc-detail-sub' },
              [typeLabel(entry.type), str(entry.sector), str(entry.stage), entry.legacy === true ? '旧格式行业条目（只读）' : ''].filter(function (item) { return item !== '' && item !== '—' }).join(' · ')),
            h('div', { className: 'vc-detail-actions' },
              readOnly ? null : h(Btn, { variant: 'primary', onClick: props.onReview, title: '为这条记录写一次复盘' }, '复盘'),
              readOnly ? null : h(Btn, { onClick: props.onEdit, disabled: props.editReady !== true, title: props.editReady === true ? '编辑记录' : '正文读取中，稍后可编辑' }, '编辑'),
              h(Btn, { onClick: props.onCopyPath, title: '复制这篇记录的 Markdown 文件路径' }, '复制路径'))),
          h('div', { className: 'vc-detail-scroll' },
            h(FieldsGrid, { entry }),
            readOnly ? h('div', { className: 'vc-hint' }, '旧格式行业条目只读：请到「行业」标签页用 主题 / 细分赛道 / 观点 重建。') : null,
            loading && detail === null ? h('div', { className: 'vc-hint' }, '正在读取正文…') : null,
            error !== null
              ? h('div', { className: 'vc-detail-error' },
                h('span', null, '读取正文失败：' + error),
                h(Btn, { onClick: props.onRetryDetail }, '重试'))
              : null,
            error === null && sections.length > 0
              ? sections.map(function (section, index) {
                return h('section', { key: index, className: 'vc-sec' },
                  h('h3', { className: 'vc-sec-title' }, str(section && section.title) || '正文'),
                  h('div', { className: 'vc-md' }, renderMarkdown(section && section.body)))
              })
              : null,
            error === null && !loading && sections.length === 0 && markdown !== ''
              ? h('div', { className: 'vc-hint' }, '没有可按段落展示的正文，展开下方原文查看。')
              : null,
            markdown !== '' || (detail !== null && detail.markdown !== undefined)
              ? h('details', { className: 'vc-raw' },
                h('summary', null, 'Markdown 原文'),
                h('textarea', {
                  className: 'vc-raw-ta',
                  value: markdown,
                  readOnly: true,
                  spellCheck: false,
                  rows: 12,
                  'aria-label': 'Markdown 原文'
                }))
              : null))
      }

      // ── industry: tree, detail panes, view cards, modals ────────────────────
      const ViewStatusPill = function ViewStatusPill(props) {
        const status = str(props.status).trim()
        if (status === '') return h('span', { className: 'vc-pill vc-pill-neutral' }, '未标注')
        return h('span', { className: 'vc-pill ' + viewStatusClass(status) }, status)
      }

      function ArchivedViews(props) {
        const archived = asArray(props.archived)
        if (archived.length === 0) return null
        return h('details', { className: 'vc-raw vc-archived' },
          h('summary', null, '已归档观点（' + archived.length + '）'),
          h('ul', { className: 'vc-archived-list' }, archived.map(function (item, index) {
            const record = item || {}
            const note = str(record.reason) !== '' ? ' → ' + str(record.reason) : ''
            return h('li', { key: index },
              h('code', null, str(record.id) || '#'), ' · ', str(record.status) || '已归档', ' · ', str(record.date), ' · ', str(record.conclusion), note)
          })))
      }

      function ViewCard(props) {
        const view = props.view || {}
        const target = props.target || {}
        const selectable = typeof props.onSelect === 'function'
        const act = function (op) {
          if (typeof props.onAction === 'function') props.onAction(op, target, view)
        }
        const stop = function (event) { event.stopPropagation() }
        const related = asArray(view.related).map(str).filter(function (item) { return item !== '' })
        const evidence = asArray(view.evidence).map(str).filter(function (item) { return item !== '' })
        const counter = asArray(view.counter).map(str).filter(function (item) { return item !== '' })
        const id = str(view.id)
        const cardProps = {
          className: 'vc-view-card' + (props.selected === true ? ' sel' : '') + (selectable ? ' clickable' : '')
        }
        if (selectable) {
          cardProps.onClick = function () { props.onSelect(target, view) }
          cardProps.onKeyDown = function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              props.onSelect(target, view)
            }
          }
          cardProps.tabIndex = 0
          cardProps.role = 'button'
          cardProps['aria-label'] = '查看观点 ' + id
        }
        return h('div', cardProps,
          h('div', { className: 'vc-view-head' },
            h('h3', { className: 'vc-view-title' }, str(view.date) !== '' ? str(view.date) + ' · ' + str(view.conclusion) : (str(view.conclusion) || '（暂无结论）')),
            h(ViewStatusPill, { status: view.status })),
          h('div', { className: 'vc-view-meta' },
            id !== '' ? h('code', null, id) : null,
            related.length > 0 ? h('span', { title: related.join('、') }, '关联：' + truncateText(related.join('、'), 80)) : null),
          evidence.length > 0
            ? h('ul', { className: 'vc-view-list' }, evidence.map(function (line, index) {
              return h('li', { key: index }, h('b', null, '依据：'), line)
            }))
            : null,
          counter.length > 0
            ? h('ul', { className: 'vc-view-list' }, counter.map(function (line, index) {
              return h('li', { key: index }, h('b', null, '反证：'), line)
            }))
            : null,
          evidence.length === 0 && counter.length === 0 ? h('div', { className: 'vc-hint' }, '这条观点还没有依据与反证。') : null,
          h('div', { className: 'vc-view-actions', onClick: stop },
            h('button', { type: 'button', className: 'vc-btn vc-btn-sm', onClick: function (event) { event.stopPropagation(); act('revise') } }, '修正'),
            h('button', { type: 'button', className: 'vc-btn vc-btn-sm', onClick: function (event) { event.stopPropagation(); act('weaken') } }, '削弱'),
            h('button', { type: 'button', className: 'vc-btn vc-btn-sm', onClick: function (event) { event.stopPropagation(); act('falsify') } }, '证伪'),
            h('button', { type: 'button', className: 'vc-btn vc-btn-sm', onClick: function (event) { event.stopPropagation(); act('archive') } }, '归档')))
      }

      function IndustryEmpty(props) {
        return h('div', { className: 'vc-empty-industry' },
          h('div', null, h('b', null, '还没有行业主题。'), ' 行业记忆是两层结构：'),
          h('ul', null,
            h('li', null, '主题 = 一个方向的目录 + 范围句（例：机器人）'),
            h('li', null, '细分赛道 = 主题下的观点板（例：仓储机器人）'),
            h('li', null, '观点 = 带状态、依据、反证、可原地修正的结论')),
          h('div', { className: 'vc-hint', style: { padding: '4px 0' } }, '建议保持 3–8 个主题；同一批客户 / 竞品 / 证据才值得拆成一个赛道。'),
          h(Btn, { variant: 'primary', onClick: props.onCreateTheme }, '新建主题'))
      }

      function IndustryTree(props) {
        const themes = asArray(props.themes)
        const legacy = asArray(props.legacy)
        const selection = props.selection || null
        const expandedThemes = props.expandedThemes || {}
        const expandedSectors = props.expandedSectors || {}
        const rows = []

        const selectedThemeId = selection !== null && (selection.kind === 'theme' || selection.kind === 'sector' || selection.kind === 'view')
          ? str(selection.themeId)
          : ''

        if (props.totalThemes === 0) {
          rows.push(h(IndustryEmpty, { key: 'empty-industry', onCreateTheme: props.onCreateTheme }))
        } else if (themes.length === 0) {
          rows.push(h('div', { key: 'no-match', className: 'vc-hint' }, '没有匹配「' + str(props.query).trim() + '」的主题 / 赛道 / 观点。'))
        }

        themes.forEach(function (theme) {
          if (!theme) return
          const themeId = str(theme.id)
          const sectors = asArray(theme.sectors)
          const expanded = expandedThemes[themeId] === true
          rows.push(h('div', { key: 'theme-' + themeId, className: 'vc-tree-row vc-theme-row' + (selectedThemeId === themeId ? ' on' : '') },
            h('button', {
              type: 'button',
              className: 'vc-tree-toggle',
              'aria-label': (expanded ? '收起主题 ' : '展开主题 ') + str(theme.name),
              'aria-expanded': expanded ? 'true' : 'false',
              onClick: function () { props.onToggleTheme(themeId) }
            }, expanded ? '▾' : '▸'),
            h('button', { type: 'button', className: 'vc-tree-main', onClick: function () { props.onSelectTheme(theme) } },
              h('span', { className: 'vc-tree-name' }, str(theme.name) || '未命名主题'),
              h('span', { className: 'vc-tree-meta' }, String(sectors.length) + ' 赛道 · ' + String(themeViewCount(theme)) + ' 观点' + (str(theme.updated) !== '' ? ' · ' + str(theme.updated) : '')))))
          if (!expanded) return
          if (sectors.length === 0) {
            rows.push(h('div', { key: 'no-sector-' + themeId, className: 'vc-hint', style: { paddingLeft: '40px' } }, '还没有细分赛道'))
            return
          }
          sectors.forEach(function (sector) {
            if (!sector) return
            const sectorKey = themeId + '|' + str(sector.file)
            const views = sortViews(sector.views)
            const sectorExpanded = expandedSectors[sectorKey] === true
            const sectorSelected = selection !== null && selection.themeId === themeId && selection.kind === 'sector' && str(selection.sectorKey) === str(sector.file)
            rows.push(h('div', { key: 'sector-' + sectorKey, className: 'vc-tree-row vc-tree-depth-1' + (sectorSelected ? ' on' : '') },
              h('button', {
                type: 'button',
                className: 'vc-tree-toggle',
                'aria-label': (sectorExpanded ? '收起赛道 ' : '展开赛道 ') + str(sector.name),
                'aria-expanded': sectorExpanded ? 'true' : 'false',
                onClick: function () { props.onToggleSector(sectorKey) }
              }, sectorExpanded ? '▾' : '▸'),
              h('button', { type: 'button', className: 'vc-tree-main', onClick: function () { props.onSelectSector(theme, sector) } },
                h('span', { className: 'vc-tree-name' }, str(sector.name) || '未命名赛道'),
                h('span', { className: 'vc-tree-meta' }, viewCountMeta(views)))))
            if (!sectorExpanded) return
            if (views.length === 0) {
              rows.push(h('div', { key: 'no-view-' + sectorKey, className: 'vc-hint', style: { paddingLeft: '58px' } }, '这个赛道还没有观点'))
              return
            }
            views.forEach(function (view) {
              if (!view) return
              const viewId = str(view.id)
              const viewSelected = selection !== null && selection.kind === 'view' && selection.themeId === themeId && str(selection.sectorKey) === str(sector.file) && str(selection.viewId) === viewId
              rows.push(h('button', {
                key: 'view-' + sectorKey + '-' + viewId,
                type: 'button',
                className: 'vc-tree-view' + (viewSelected ? ' on' : ''),
                title: str(view.conclusion),
                onClick: function () { props.onSelectView(boardTargetOf(theme, sector), view) }
              },
                h('span', { className: 'vc-tree-view-id' }, viewId),
                h(ViewStatusPill, { status: view.status }),
                h('span', { className: 'vc-tree-view-text' }, (str(view.date) !== '' ? str(view.date) + ' · ' : '') + truncateText(view.conclusion, 46))))
            })
          })
        })

        if (legacy.length > 0) {
          rows.push(h('div', { key: 'legacy-head', className: 'vc-list-group' + (props.totalThemes === 0 ? ' first' : '') },
            h('span', null, '旧格式行业条目（待迁移）'),
            h('span', null, String(props.totalLegacy) + ' 条')))
          legacy.forEach(function (entry) {
            if (!entry) return
            rows.push(h(ListRow, {
              key: 'legacy-' + str(entry.id),
              entry,
              active: selection !== null && selection.kind === 'legacy' && str(selection.entryId) === str(entry.id),
              onSelect: function () { props.onSelectLegacy(entry) }
            }))
          })
        }

        return h('div', { className: 'vc-tree' }, rows)
      }

      function IndustryPane(props) {
        const resolved = props.resolved || null
        if (resolved === null) {
          return h('div', { className: 'vc-detail' },
            h('div', { className: 'vc-center' },
              h(Icon, { size: 28, active: false }),
              h('div', { className: 'vc-hint' }, '行业记忆按 主题 → 细分赛道 → 观点 组织。'),
              h(Btn, { variant: 'primary', onClick: props.onCreateTheme }, '新建主题')))
        }
        const theme = resolved.theme
        const sector = resolved.sector
        const view = resolved.view
        const level = resolved.level
        const target = boardTargetOf(theme, sector)
        const onSelectView = function (targetValue, viewValue) {
          if (typeof props.onSelectView === 'function') props.onSelectView(targetValue, viewValue)
        }
        const onAction = function (op, targetValue, viewValue) {
          if (typeof props.onViewAction === 'function') props.onViewAction(op, targetValue, viewValue)
        }
        const crumbs = [
          h('button', { key: 'theme', type: 'button', className: 'vc-crumb', onClick: function () { props.onSelectTheme(theme) } }, str(theme.name) || '主题')
        ]
        if (sector !== null) {
          crumbs.push(h('span', { key: 'sep-sector' }, '/'))
          crumbs.push(h('button', { key: 'sector', type: 'button', className: 'vc-crumb', onClick: function () { props.onSelectSector(theme, sector) } }, str(sector.name) || '细分赛道'))
        }
        if (level === 'view') {
          crumbs.push(h('span', { key: 'sep-view' }, '/'))
          crumbs.push(h('span', { key: 'view' }, str(view && view.id) || '观点'))
        }
        const title = level === 'theme'
          ? (str(theme.name) || '主题')
          : level === 'sector' ? (str(sector.name) || '细分赛道') : (str(view && view.id) || '观点')
        const subtitle = level === 'theme'
          ? ['主题板', str(theme.updated) !== '' ? '更新 ' + str(theme.updated) : '']
          : level === 'sector'
            ? ['细分赛道', str(sector.updated) !== '' ? '更新 ' + str(sector.updated) : '']
            : [str(view && view.date), sector !== null ? str(sector.name) : '主题级观点']
        const headerActions = []
        if (level === 'theme') {
          headerActions.push(h(Btn, { variant: 'primary', onClick: function () { props.onCreateSector(theme) } }, '新建细分赛道'))
          headerActions.push(h(Btn, { onClick: function () { props.onCreateView(theme, null) } }, '新建跨赛道观点'))
        } else if (level === 'sector') {
          headerActions.push(h(Btn, { variant: 'primary', onClick: function () { props.onCreateView(theme, sector) } }, '新建观点'))
        }
        const content = []
        if (level === 'theme' || level === 'sector') {
          const scope = level === 'theme' ? str(theme.scope) : str(sector.scope)
          content.push(h('div', { key: 'scope', className: 'vc-scope' },
            h('b', null, '范围'),
            scope !== '' ? scope : '未填写范围句'))
        }
        if (level === 'sector') {
          const mainline = sortViews(sector.views).slice(0, 3).map(function (item) {
            return truncateText(item && item.conclusion, 90)
          }).filter(function (item) { return item !== '' })
          content.push(h('div', { key: 'mainline-head', className: 'vc-subhead' },
            h('span', { className: 'vc-subhead-title' }, '当前主线')))
          content.push(mainline.length > 0
            ? h('ol', { key: 'mainline', className: 'vc-mainline' }, mainline.map(function (line, index) {
              return h('li', { key: index }, line)
            }))
            : h('div', { key: 'mainline-empty', className: 'vc-hint' }, '还没有可提炼的当前主线，先添加一条观点。'))
        }
        if (level === 'theme') {
          const sectors = asArray(theme.sectors)
          content.push(h('div', { key: 'sectors-head', className: 'vc-subhead' },
            h('span', { className: 'vc-subhead-title' }, '细分赛道（' + sectors.length + '）')))
          if (sectors.length === 0) {
            content.push(h('div', { key: 'sectors-empty', className: 'vc-hint' }, '还没有细分赛道。主题可以先只有范围与跨赛道观点。'))
          } else {
            content.push(h('div', { key: 'sectors', className: 'vc-index' }, sectors.map(function (item) {
              const views = asArray(item && item.views)
              return h('button', {
                key: str(item && item.file),
                type: 'button',
                className: 'vc-index-row',
                onClick: function () { props.onSelectSector(theme, item) }
              },
                h('span', { className: 'vc-index-name' }, str(item && item.name) || '未命名赛道'),
                h('span', { className: 'vc-index-meta' }, viewCountMeta(views) + (str(item && item.updated) !== '' ? ' · ' + str(item.updated) : '')))
            })))
          }
        }
        if (level !== 'view') {
          const boardViews = level === 'theme' ? asArray(theme.views) : asArray(sector && sector.views)
          content.push(h('div', { key: 'views-head', className: 'vc-subhead' },
            h('span', { className: 'vc-subhead-title' }, (level === 'theme' ? '跨赛道观点' : '观点') + '（' + boardViews.length + '）')))
          if (boardViews.length === 0) {
            content.push(h('div', { key: 'views-empty', className: 'vc-hint' }, level === 'theme' ? '还没有跨赛道观点。' : '还没有观点。'))
          } else {
            content.push(h('div', { key: 'views', className: 'vc-views' }, sortViews(boardViews).map(function (item, index) {
              return h(ViewCard, {
                key: str(item && item.id) || 'view' + index,
                view: item,
                target,
                selected: false,
                onSelect: onSelectView,
                onAction: onAction
              })
            })))
          }
          content.push(h(ArchivedViews, { key: 'archived', archived: level === 'theme' ? theme.archived : (sector && sector.archived) }))
        } else {
          content.push(h(ViewCard, { key: 'view-card', view, target, selected: true, onAction: onAction }))
          content.push(h(ArchivedViews, { key: 'archived', archived: sector !== null ? sector.archived : theme.archived }))
        }
        return h('div', { className: 'vc-detail' },
          h('div', { className: 'vc-detail-head' },
            h('div', { className: 'vc-detail-titleline' },
              h('h2', { className: 'vc-detail-title' }, title),
              level === 'view' ? h(ViewStatusPill, { status: view && view.status }) : null,
              level === 'theme' ? h('span', { className: 'vc-pill vc-pill-neutral' }, '主题') : null,
              level === 'sector' ? h('span', { className: 'vc-pill vc-pill-neutral' }, '细分赛道') : null),
            h('div', { className: 'vc-crumbs' }, crumbs),
            h('div', { className: 'vc-detail-sub' }, subtitle.filter(function (part) { return part !== '' }).join(' · ')),
            headerActions.length > 0 ? h('div', { className: 'vc-detail-actions' }, headerActions) : null),
          h('div', { className: 'vc-detail-scroll' }, content))
      }

      function ThemeModal(props) {
        const [form, setForm] = React.useState({ name: '', scope: '' })
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState(null)
        const setField = function (name, value) {
          setForm(function (prev) {
            const next = Object.assign({}, prev)
            next[name] = value
            return next
          })
        }
        const submit = async function (event) {
          event.preventDefault()
          if (saving) return
          const name = form.name.trim()
          const scope = form.scope.trim()
          if (name === '') { setError('请填写主题名称。'); return }
          if (scope === '') { setError('请填写范围句（这个主题包含什么、不包含什么）。'); return }
          setSaving(true)
          setError(null)
          try {
            const result = await api.theme({ name, scope, confirm: true })
            setSaving(false)
            if (typeof props.onSaved === 'function') props.onSaved(result)
          } catch (failure) {
            setSaving(false)
            setError(str(failure && failure.message) || '创建主题失败')
          }
        }
        return h(ModalFrame, {
          title: '新建主题',
          subtitle: '主题 = 目录 + 范围句 + 跨赛道观点；本身不是投资判断。',
          onClose: props.onClose
        },
          h('form', { className: 'vc-form', onSubmit: submit },
            h('div', { className: 'vc-form-scroll' },
              h(FormField, { label: '主题名称', required: true },
                h('input', { className: 'vc-input', value: form.name, autoFocus: true, placeholder: '例如：机器人', 'aria-label': '主题名称', onChange: function (event) { setField('name', event.target.value) } })),
              h(FormField, { label: '范围句', required: true, hint: '一句话写清包含什么、不包含什么；之后新建赛道时也会用到。' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.scope, placeholder: '例如：工业 / 仓储 / 人形机器人整机与核心部件；不含纯软件与上游通用芯片。', 'aria-label': '范围句', onChange: function (event) { setField('scope', event.target.value) } }))),
            error !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, error) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Enter 保存 · Esc 取消'),
              h(Btn, { onClick: props.onClose, disabled: saving }, '取消'),
              h(Btn, { type: 'submit', variant: 'primary', disabled: saving }, saving ? '创建中…' : '创建主题'))))
      }

      function SectorModal(props) {
        const presetTheme = str(props.presetThemeName)
        const [form, setForm] = React.useState({
          theme: presetTheme,
          name: '',
          scope: '',
          sectorLabel: '',
          viewPrefix: '',
          conclusion: '',
          evidence: '',
          counter: '',
          related: '',
          status: '待验证'
        })
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState(null)
        const setField = function (name, value) {
          setForm(function (prev) {
            const next = Object.assign({}, prev)
            next[name] = value
            return next
          })
        }
        const submit = async function (event) {
          event.preventDefault()
          if (saving) return
          const theme = form.theme.trim()
          const name = form.name.trim()
          const scope = form.scope.trim()
          const conclusion = form.conclusion.trim()
          if (theme === '') { setError('请填写所属主题。'); return }
          if (name === '') { setError('请填写细分赛道名称。'); return }
          if (scope === '') { setError('请填写赛道范围句。'); return }
          if (conclusion === '') { setError('请填写第一条观点。'); return }
          setSaving(true)
          setError(null)
          try {
            const result = await api.sector({
              theme,
              name,
              scope,
              // when the theme does not exist yet the Host creates it with this
              themeScope: scope,
              sectorLabel: form.sectorLabel.trim(),
              viewPrefix: form.viewPrefix.trim(),
              conclusion,
              status: form.status,
              evidence: splitLines(form.evidence),
              counter: splitLines(form.counter),
              related: parseTags(form.related),
              confirm: true
            })
            setSaving(false)
            if (typeof props.onSaved === 'function') props.onSaved(result)
          } catch (failure) {
            setSaving(false)
            setError(str(failure && failure.message) || '创建细分赛道失败')
          }
        }
        return h(ModalFrame, {
          title: '新建细分赛道',
          subtitle: presetTheme !== '' ? '在主题「' + presetTheme + '」下创建观点板；主题不存在时会一并创建。' : '主题不存在时会一并创建；必须包含范围句与第一条观点。',
          wide: true,
          onClose: props.onClose
        },
          h('form', { className: 'vc-form', onSubmit: submit },
            h('div', { className: 'vc-form-scroll' },
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '所属主题', required: true },
                  h('input', { className: 'vc-input', value: form.theme, placeholder: '例如：机器人', 'aria-label': '所属主题', onChange: function (event) { setField('theme', event.target.value) } })),
                h(FormField, { label: '细分赛道名称', required: true },
                  h('input', { className: 'vc-input', value: form.name, autoFocus: true, placeholder: '例如：仓储机器人', 'aria-label': '细分赛道名称', onChange: function (event) { setField('name', event.target.value) } }))),
              h(FormField, { label: '赛道范围句', required: true, hint: '什么是“这个赛道”的边界？同一个客户 / 竞品集合才值得成为一个赛道。' },
                h('textarea', { className: 'vc-textarea', rows: 2, value: form.scope, placeholder: '例如：移动机器人整机与拣选方案，含本体与调度软件；不含上游激光雷达。', 'aria-label': '赛道范围句', onChange: function (event) { setField('scope', event.target.value) } })),
              h('div', { className: 'vc-grid2' },
                h(FormField, { label: '行业标签', hint: '显示在细分赛道板的 sector 字段，例如 机器人 / 仓储自动化。' },
                  h('input', { className: 'vc-input', value: form.sectorLabel, placeholder: '机器人 / 仓储自动化', 'aria-label': '行业标签', onChange: function (event) { setField('sectorLabel', event.target.value) } })),
                h(FormField, { label: '观点 id 前缀', hint: '留空则用赛道名，例如 仓储 → #仓储-001。' },
                  h('input', { className: 'vc-input', value: form.viewPrefix, placeholder: '仓储', 'aria-label': '观点 id 前缀', onChange: function (event) { setField('viewPrefix', event.target.value) } }))),
              h(FormField, { label: '第一条观点', required: true, hint: '可证伪的当前结论，标题会以日期 + 结论呈现。' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.conclusion, placeholder: '例如：仓储会先于通用人形跑通单工位 ROI，时间点在 2027–2028。', 'aria-label': '第一条观点', onChange: function (event) { setField('conclusion', event.target.value) } })),
              h('FormField', { label: '观点状态' },
                h('select', { className: 'vc-input', value: form.status, 'aria-label': '观点状态', onChange: function (event) { setField('status', event.target.value) } },
                  h('option', { value: '待验证' }, '待验证'),
                  h('option', { value: '有效' }, '有效'))),
              h('FormField', { label: '依据', hint: '每行一条，会渲染成观点卡的「依据」列表。' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.evidence, 'aria-label': '依据', onChange: function (event) { setField('evidence', event.target.value) } })),
              h('FormField', { label: '反证', hint: '每行一条：什么证据会推翻这条观点？' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.counter, 'aria-label': '反证', onChange: function (event) { setField('counter', event.target.value) } })),
              h(FormField, { label: '关联', hint: '项目 id 或观点 id，用逗号分隔，例如 项目/aurora-ai。' },
                h('input', { className: 'vc-input', value: form.related, placeholder: '项目/aurora-ai', 'aria-label': '关联', onChange: function (event) { setField('related', event.target.value) } }))),
            error !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, error) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Enter 保存 · Esc 取消'),
              h(Btn, { onClick: props.onClose, disabled: saving }, '取消'),
              h(Btn, { type: 'submit', variant: 'primary', disabled: saving }, saving ? '创建中…' : '创建细分赛道'))))
      }

      function IndustryViewModal(props) {
        const mode = props.mode === 'revise' ? 'revise' : 'add'
        const target = props.target || {}
        const view = props.view || {}
        const [form, setForm] = React.useState(function () {
          if (mode === 'revise') {
            return {
              conclusion: str(view.conclusion),
              status: str(view.status) || '待验证',
              evidence: asArray(view.evidence).map(str).join('\n'),
              counter: asArray(view.counter).map(str).join('\n'),
              related: asArray(view.related).map(str).join(', '),
              reason: ''
            }
          }
          return { conclusion: '', status: '待验证', evidence: '', counter: '', related: '', reason: '' }
        })
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState(null)
        const setField = function (name, value) {
          setForm(function (prev) {
            const next = Object.assign({}, prev)
            next[name] = value
            return next
          })
        }
        const submit = async function (event) {
          event.preventDefault()
          if (saving) return
          const conclusion = form.conclusion.trim()
          if (conclusion === '') { setError('请填写观点结论。'); return }
          const payload = {
            op: mode,
            theme: str(target.themeDir) || str(target.themeName),
            sector: str(target.boardSector) || '_主题',
            conclusion,
            status: form.status,
            evidence: splitLines(form.evidence),
            counter: splitLines(form.counter),
            related: parseTags(form.related)
          }
          if (mode === 'revise') {
            payload.id = str(view.id)
            if (form.reason.trim() !== '') payload.reason = form.reason.trim()
          }
          setSaving(true)
          setError(null)
          try {
            const result = await api.view(payload)
            setSaving(false)
            if (typeof props.onSaved === 'function') props.onSaved(result, { mode, target })
          } catch (failure) {
            setSaving(false)
            setError(str(failure && failure.message) || '保存观点失败')
          }
        }
        const boardLabel = str(target.themeName) + (str(target.sectorName) !== '' ? ' / ' + str(target.sectorName) : ' / 主题级（跨赛道）')
        const statusOptions = mode === 'revise' ? VIEW_STATUSES : ['待验证', '有效']
        return h(ModalFrame, {
          title: mode === 'revise' ? '修正观点' : '新建观点',
          subtitle: boardLabel + (mode === 'revise' && str(view.id) !== '' ? ' · ' + str(view.id) : ''),
          wide: true,
          onClose: props.onClose
        },
          h('form', { className: 'vc-form', onSubmit: submit },
            h('div', { className: 'vc-form-scroll' },
              h(FormField, { label: '结论', required: true, hint: '当前最重要的判断；标题会以“日期 + 结论”呈现。' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.conclusion, autoFocus: true, 'aria-label': '结论', onChange: function (event) { setField('conclusion', event.target.value) } })),
              h(FormField, { label: '状态' },
                h('select', { className: 'vc-input', value: form.status, 'aria-label': '状态', onChange: function (event) { setField('status', event.target.value) } },
                  statusOptions.map(function (status) {
                    return h('option', { key: status, value: status }, status)
                  }))),
              h(FormField, { label: '依据', hint: '每行一条。' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.evidence, 'aria-label': '依据', onChange: function (event) { setField('evidence', event.target.value) } })),
              h(FormField, { label: '反证', hint: '每行一条：什么证据会推翻它？' },
                h('textarea', { className: 'vc-textarea', rows: 3, value: form.counter, 'aria-label': '反证', onChange: function (event) { setField('counter', event.target.value) } })),
              h(FormField, { label: '关联', hint: '项目 id 或观点 id，用逗号分隔。' },
                h('input', { className: 'vc-input', value: form.related, placeholder: '项目/aurora-ai', 'aria-label': '关联', onChange: function (event) { setField('related', event.target.value) } })),
              mode === 'revise'
                ? h(FormField, { label: '修正原因', hint: '会追加到反证并写入日志（旧→新摘要）。' },
                  h('textarea', { className: 'vc-textarea', rows: 2, value: form.reason, 'aria-label': '修正原因', onChange: function (event) { setField('reason', event.target.value) } }))
                : null),
            error !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, error) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Enter 保存 · Esc 取消'),
              h(Btn, { onClick: props.onClose, disabled: saving }, '取消'),
              h(Btn, { type: 'submit', variant: 'primary', disabled: saving }, saving ? '保存中…' : (mode === 'revise' ? '保存修正' : '添加观点')))))
      }

      function ReasonModal(props) {
        const op = str(props.op)
        const target = props.target || {}
        const view = props.view || {}
        const [reason, setReason] = React.useState('')
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState(null)
        const titles = { weaken: '削弱观点', falsify: '证伪观点', archive: '归档观点' }
        const title = titles[op] || '更新观点'
        const hint = op === 'archive'
          ? '归档不删除内容：观点会移入「已归档观点」，保留教训。'
          : op === 'falsify' ? '证伪会把状态改为「已证伪」，原因会记入反证。' : '削弱会把状态改为「被削弱」，原因会记入反证。'
        const submit = async function (event) {
          event.preventDefault()
          if (saving) return
          setSaving(true)
          setError(null)
          try {
            const result = await api.view({
              op,
              theme: str(target.themeDir) || str(target.themeName),
              sector: str(target.boardSector) || '_主题',
              id: str(view.id),
              reason
            })
            setSaving(false)
            if (typeof props.onSaved === 'function') props.onSaved(result, { op, target, view })
          } catch (failure) {
            setSaving(false)
            setError(str(failure && failure.message) || '操作失败')
          }
        }
        return h(ModalFrame, {
          title,
          subtitle: str(view.id) + (str(view.conclusion) !== '' ? ' · ' + truncateText(view.conclusion, 60) : ''),
          onClose: props.onClose
        },
          h('form', { className: 'vc-form', onSubmit: submit },
            h('div', { className: 'vc-form-scroll' },
              h(FormField, { label: '原因', hint },
                h('textarea', { className: 'vc-textarea', rows: 3, value: reason, autoFocus: true, placeholder: op === 'archive' ? '为什么不再作为当前判断？' : '新证据是什么？', 'aria-label': '原因', onChange: function (event) { setReason(event.target.value) } }))),
            error !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, error) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Enter 确认 · Esc 取消'),
              h(Btn, { onClick: props.onClose, disabled: saving }, '取消'),
              h(Btn, { type: 'submit', variant: 'primary', disabled: saving }, saving ? '处理中…' : title))))
      }

      // ── settings: global appearance + vault location ────────────────────────
      function SettingsModal(props) {
        const themeApi = ctx && ctx.theme && typeof ctx.theme.getTheme === 'function' && typeof ctx.theme.setTheme === 'function'
          ? ctx.theme
          : null
        const workspaceApi = ctx && ctx.uiWorkspace && typeof ctx.uiWorkspace.pickDirectory === 'function'
          ? ctx.uiWorkspace
          : null
        const currentFromState = str(props.state && props.state.config && props.state.config.vaultDir)
          || str(props.state && props.state.vault && props.state.vault.dir)

        const readThemePreference = function () {
          if (themeApi === null) return 'system'
          try {
            const snapshot = themeApi.getTheme()
            const preference = str(snapshot && snapshot.preference)
            if (preference === 'light' || preference === 'dark' || preference === 'system') return preference
            const scheme = str(snapshot && snapshot.active && snapshot.active.colorScheme)
            if (scheme === 'light' || scheme === 'dark') return scheme
          } catch (error) {
            console.warn('[vc-memory] could not read the theme preference:', error)
          }
          return 'system'
        }

        const [preference, setPreference] = React.useState(readThemePreference)

        React.useEffect(function () {
          if (themeApi === null) return undefined
          setPreference(readThemePreference())
          if (!ctx || typeof ctx.on !== 'function') return undefined
          let dispose = null
          try {
            dispose = ctx.on('theme/change', function (snapshot) {
              const next = str(snapshot && snapshot.preference)
              if (next === 'light' || next === 'dark' || next === 'system') setPreference(next)
              else setPreference(readThemePreference())
            })
          } catch (error) {
            console.warn('[vc-memory] theme subscription failed:', error)
          }
          return function () {
            if (typeof dispose === 'function') {
              try { dispose() } catch (error) { /* already disposed */ }
            }
          }
        }, [])

        const choosePreference = function (id) {
          if (themeApi === null) return
          try {
            themeApi.setTheme(id)
            setPreference(id)
          } catch (error) {
            if (typeof props.onToast === 'function') props.onToast('error', '切换外观失败：' + (str(error && error.message) || '未知错误'))
          }
        }

        const [remoteConfig, setRemoteConfig] = React.useState(null)
        const [configLoading, setConfigLoading] = React.useState(true)
        const [configError, setConfigError] = React.useState(null)
        const [currentDir, setCurrentDir] = React.useState(currentFromState)
        const [vaultInput, setVaultInput] = React.useState(currentFromState)
        const [picking, setPicking] = React.useState(false)
        const [savingVault, setSavingVault] = React.useState(false)
        const [resettingVault, setResettingVault] = React.useState(false)
        const [actionError, setActionError] = React.useState(null)
        const editedVaultRef = React.useRef(false)

        React.useEffect(function () {
          let alive = true
          api.config().then(function (payload) {
            if (alive !== true) return
            setRemoteConfig(payload)
            setConfigLoading(false)
            setConfigError(null)
            const dir = str(payload && payload.vaultDir)
            if (dir !== '') {
              setCurrentDir(dir)
              if (editedVaultRef.current !== true) setVaultInput(dir)
            }
          }).catch(function (failure) {
            if (alive !== true) return
            setConfigLoading(false)
            setConfigError(str(failure && failure.message) || '读取失败')
          })
          return function () { alive = false }
        }, [])

        const applyVaultResult = function (result, fallbackDir, message) {
          const dir = str(result && result.vaultDir) || fallbackDir || ''
          setCurrentDir(dir)
          setVaultInput(dir)
          editedVaultRef.current = false
          const settingsPath = str(result && result.settingsPath)
          if (settingsPath !== '') {
            setRemoteConfig(function (previous) { return Object.assign({}, previous || {}, { settingsPath: settingsPath }) })
          }
          if (typeof props.onVaultChanged === 'function') props.onVaultChanged(result, message)
        }

        const pickFolder = async function () {
          if (workspaceApi === null) {
            if (typeof props.onToast === 'function') props.onToast('error', '当前环境没有文件夹选择器，请直接填写绝对路径。')
            return
          }
          setPicking(true)
          setActionError(null)
          try {
            const picked = await workspaceApi.pickDirectory()
            if (typeof picked === 'string' && picked.trim() !== '') {
              editedVaultRef.current = true
              setVaultInput(picked.trim())
            }
          } catch (failure) {
            if (typeof props.onToast === 'function') props.onToast('error', '选择文件夹失败：' + (str(failure && failure.message) || '未知错误'))
          } finally {
            setPicking(false)
          }
        }

        const saveVault = async function (event) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault()
          if (savingVault || resettingVault) return
          const target = vaultInput.trim()
          if (target === '') { setActionError('请填写知识库的绝对路径。'); return }
          setSavingVault(true)
          setActionError(null)
          try {
            const result = await api.setVault(target)
            setSavingVault(false)
            applyVaultResult(result, target, '知识库位置已更新：' + (str(result && result.vaultDir) || target))
          } catch (failure) {
            setSavingVault(false)
            setActionError(str(failure && failure.message) || '保存知识库位置失败')
          }
        }

        const resetVault = async function () {
          if (savingVault || resettingVault) return
          setResettingVault(true)
          setActionError(null)
          try {
            const result = await api.resetVault()
            setResettingVault(false)
            const dir = str(result && result.vaultDir) || str(remoteConfig && remoteConfig.defaultDir)
            applyVaultResult(result, dir, '已恢复默认知识库位置：' + dir)
          } catch (failure) {
            setResettingVault(false)
            setActionError(str(failure && failure.message) || '恢复默认位置失败')
          }
        }

        const busy = savingVault || resettingVault
        const themeSection = themeApi === null ? null : h('div', { className: 'vc-settings-section' },
          h('div', { className: 'vc-settings-title' }, '外观（全局）'),
          h('div', { className: 'vc-settings-hint' }, '外观是 Harness 的全局偏好，切换后整个应用一起变化。'),
          h('div', { className: 'vc-seg', role: 'group', 'aria-label': '外观' },
            [['system', '跟随系统'], ['light', '亮色'], ['dark', '暗色']].map(function (item) {
              const on = preference === item[0]
              return h('button', {
                key: item[0],
                type: 'button',
                className: 'vc-seg-btn' + (on ? ' on' : ''),
                'aria-pressed': on ? 'true' : 'false',
                onClick: function () { choosePreference(item[0]) }
              }, item[1])
            })))

        const remoteDefault = str(remoteConfig && remoteConfig.defaultDir)
        const settingsPath = str(remoteConfig && remoteConfig.settingsPath)
        const vaultSection = h('div', { className: 'vc-settings-section' },
          h('div', { className: 'vc-settings-title' }, '知识库位置'),
          h('div', { className: 'vc-settings-hint' }, '面板、vc_memory 工具、简报与云同步都指向这个目录；把它放在 OneDrive / Git 同步的文件夹里即可多设备共用。'),
          h('div', { className: 'vc-setting-block' },
            h('div', { className: 'vc-setting-label' }, '当前目录'),
            h('code', { className: 'vc-path' }, currentDir !== '' ? currentDir : '（尚未确定，由 Host 自动选择）')),
          configLoading ? h('div', { className: 'vc-hint' }, '正在读取目录配置…') : null,
          configError !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, '读取目录配置失败：' + configError) : null,
          remoteDefault !== '' || settingsPath !== ''
            ? h('div', { className: 'vc-settings-meta' },
              remoteDefault !== '' ? h('span', null, '默认位置：' + remoteDefault) : null,
              settingsPath !== '' ? h('span', null, '覆盖配置：' + settingsPath) : null)
            : null,
          h('div', { className: 'vc-setting-block' },
            h('div', { className: 'vc-setting-label' }, '绝对路径'),
            h('div', { className: 'vc-path-row' },
              h('input', {
                className: 'vc-input',
                type: 'text',
                value: vaultInput,
                placeholder: '例如 C:/Users/you/OneDrive/VC-Memory',
                'aria-label': '知识库绝对路径',
                onChange: function (event) {
                  editedVaultRef.current = true
                  setVaultInput(event.target.value)
                  setActionError(null)
                }
              }),
              h(Btn, {
                onClick: function () { void pickFolder() },
                disabled: picking || busy,
                title: workspaceApi === null ? '当前环境没有文件夹选择器，请手动填写路径' : '打开文件夹选择器'
              }, picking ? '选择中…' : '选择文件夹…'))),
          h('div', { className: 'vc-path-row' },
            h(Btn, { type: 'submit', variant: 'primary', disabled: busy }, savingVault ? '保存中…' : '保存位置'),
            h(Btn, { onClick: function () { void resetVault() }, disabled: busy }, resettingVault ? '恢复中…' : '恢复默认')),
          h('div', { className: 'vc-settings-warn' }, '切换位置只改变插件指向的目录，不会移动或删除旧文件；旧知识库仍留在原磁盘位置。'),
          workspaceApi === null ? h('div', { className: 'vc-settings-hint' }, '当前环境没有文件夹选择器，请直接填写绝对路径。') : null)

        return h(ModalFrame, { title: '设置', subtitle: '外观与知识库位置；保存后立即生效。', wide: true, onClose: props.onClose },
          h('form', { className: 'vc-form', onSubmit: saveVault },
            h('div', { className: 'vc-form-scroll' }, themeSection, vaultSection),
            actionError !== null ? h('div', { className: 'vc-form-error', role: 'alert' }, actionError) : null,
            h('div', { className: 'vc-form-foot' },
              h('span', { className: 'vc-foot-hint' }, 'Esc 关闭'),
              h(Btn, { onClick: props.onClose }, '关闭'))))
      }

      // ── the page ────────────────────────────────────────────────────────────
      function Panel() {
        const [state, setState] = React.useState(null)
        const [loading, setLoading] = React.useState(true)
        const [loadError, setLoadError] = React.useState(null)
        const [selectedId, setSelectedId] = React.useState(null)
        const [detail, setDetail] = React.useState(null)
        const [detailLoading, setDetailLoading] = React.useState(false)
        const [detailError, setDetailError] = React.useState(null)
        const [detailTick, setDetailTick] = React.useState(0)
        const [tab, setTab] = React.useState('all')
        const [query, setQuery] = React.useState('')
        const [modal, setModal] = React.useState(null)
        const [toast, setToast] = React.useState(null)
        const [busy, setBusy] = React.useState(null)
        // Industry tree selection: theme / sector / view, or a legacy flat entry.
        const [industrySel, setIndustrySel] = React.useState(null)
        const [expandedThemes, setExpandedThemes] = React.useState({})
        const [expandedSectors, setExpandedSectors] = React.useState({})

        const mountedRef = React.useRef(true)
        const lastLoadRef = React.useRef(0)
        const lastSilentToastRef = React.useRef(0)
        const detailIdRef = React.useRef(null)

        const showToast = React.useCallback(function (kind, text) {
          setToast({ kind: kind === 'error' ? 'error' : 'success', text: str(text), id: Date.now() })
        }, [])

        React.useEffect(function () {
          if (toast === null) return undefined
          const timer = window.setTimeout(function () { setToast(null) }, toast.kind === 'error' ? 6000 : 3500)
          return function () { window.clearTimeout(timer) }
        }, [toast])

        const loadState = React.useCallback(async function (options) {
          const opts = options || {}
          if (opts.silent !== true) setLoading(true)
          try {
            const next = await api.state()
            if (mountedRef.current !== true) return null
            lastLoadRef.current = Date.now()
            setState(next)
            setLoadError(null)
            setLoading(false)
            const entries = asArray(next.entries)
            const legacy = asArray(next.legacyIndustry)
            setSelectedId(function (previous) {
              if (previous !== null && (entries.some(function (entry) { return entry && entry.id === previous })
                || legacy.some(function (entry) { return entry && entry.id === previous }))) return previous
              if (entries.length > 0 && entries[0] && typeof entries[0].id === 'string') return entries[0].id
              return legacy.length > 0 && legacy[0] && typeof legacy[0].id === 'string' ? legacy[0].id : null
            })
            return next
          } catch (failure) {
            if (mountedRef.current !== true) return null
            setLoading(false)
            const message = str(failure && failure.message) || '加载失败'
            setLoadError(message)
            if (opts.silent === true) {
              const now = Date.now()
              // A dead Host must not produce a toast every 30s; at most once a
              // minute. lastLoadRef is non-zero once a load has ever succeeded,
              // so the very first failure still surfaces through the full-page
              // error state rather than a toast.
              if (lastLoadRef.current !== 0 && now - lastSilentToastRef.current > 60000) {
                lastSilentToastRef.current = now
                showToast('error', '刷新失败：' + message)
              }
            }
            return null
          }
        }, [showToast])

        React.useEffect(function () {
          mountedRef.current = true
          void loadState({ silent: false })
          const onFocus = function () {
            if (document.visibilityState === 'hidden') return
            if (Date.now() - lastLoadRef.current < 3000) return
            void loadState({ silent: true })
          }
          const onTick = function () {
            if (document.visibilityState === 'hidden') return
            void loadState({ silent: true })
          }
          window.addEventListener('focus', onFocus)
          const timer = window.setInterval(onTick, 30000)
          return function () {
            mountedRef.current = false
            window.removeEventListener('focus', onFocus)
            window.clearInterval(timer)
          }
        }, [loadState])

        React.useEffect(function () {
          if (selectedId === null || selectedId === '') {
            setDetail(null)
            setDetailError(null)
            setDetailLoading(false)
            detailIdRef.current = null
            return undefined
          }
          let alive = true
          if (detailIdRef.current !== selectedId) {
            detailIdRef.current = selectedId
            setDetail(null)
          }
          setDetailLoading(true)
          setDetailError(null)
          api.entry(selectedId).then(function (payload) {
            if (alive !== true) return
            setDetail(payload)
            setDetailLoading(false)
          }).catch(function (failure) {
            if (alive !== true) return
            setDetailError(str(failure && failure.message) || '读取失败')
            setDetailLoading(false)
          })
          return function () { alive = false }
        }, [selectedId, detailTick])

        const entries = asArray(state && state.entries)          // project records
        const legacy = asArray(state && state.legacyIndustry)    // old flat industry files
        const themes = asArray(state && state.themes)            // industry two-level boards
        const dueProjects = React.useMemo(function () {
          return entries.filter(function (entry) { return entry && entry.due === true })
        }, [entries])
        const sectorsTotal = themes.reduce(function (total, theme) {
          return total + asArray(theme && theme.sectors).length
        }, 0)
        const viewsTotal = themes.reduce(function (total, theme) {
          return total + asArray(theme && theme.views).length + asArray(theme && theme.sectors).reduce(function (count, sector) {
            return count + asArray(sector && sector.views).length
          }, 0)
        }, 0)
        const counts = {
          project: numOr(state && state.counts && state.counts.project, entries.length),
          industry: numOr(state && state.counts && state.counts.industry, legacy.length),
          themes: numOr(state && state.counts && state.counts.themes, themes.length),
          sectors: numOr(state && state.counts && state.counts.sectors, sectorsTotal),
          views: numOr(state && state.counts && state.counts.views, viewsTotal),
          due: numOr(state && state.counts && state.counts.due, dueProjects.length),
          total: numOr(state && state.counts && state.counts.total, entries.length + legacy.length)
        }
        const vaultEmpty = counts.total === 0 && themes.length === 0
        const vaultDir = str(state && state.vault && state.vault.dir) || str(state && state.config && state.config.vaultDir)
        const sync = (state && state.sync) || {}
        const warnings = asArray(state && state.warnings)
        const defaultCycle = numOr(state && state.config && state.config.reviewCycleDays, 30)

        const flatAll = React.useMemo(function () {
          return entries.concat(legacy).slice().sort(function (left, right) {
            const leftDue = left && left.due === true ? 1 : 0
            const rightDue = right && right.due === true ? 1 : 0
            if (leftDue !== rightDue) return rightDue - leftDue
            return str(right && right.updated).localeCompare(str(left && left.updated))
          })
        }, [entries, legacy])

        const filtered = React.useMemo(function () {
          const needle = query.trim().toLowerCase()
          const source = tab === 'project' ? entries : tab === 'due' ? dueProjects : flatAll
          return source.filter(function (entry) {
            if (!entry) return false
            if (needle === '') return true
            return [
              str(entry.name),
              str(entry.sector),
              str(entry.stage),
              str(entry.summary),
              asArray(entry.tags).map(str).join(' '),
              asArray(entry.aliases).map(str).join(' ')
            ].join(' ').toLowerCase().indexOf(needle) >= 0
          })
        }, [entries, dueProjects, flatAll, tab, query])

        const selectedMeta = React.useMemo(function () {
          if (selectedId === null) return null
          for (let i = 0; i < flatAll.length; i += 1) {
            if (flatAll[i] && flatAll[i].id === selectedId) return flatAll[i]
          }
          return null
        }, [flatAll, selectedId])

        const visibleThemes = React.useMemo(function () {
          const needle = query.trim().toLowerCase()
          return themes.filter(function (theme) { return themeMatchesQuery(theme, needle) })
        }, [themes, query])

        const visibleLegacy = React.useMemo(function () {
          const needle = query.trim().toLowerCase()
          return legacy.filter(function (entry) { return legacyMatchesQuery(entry, needle) })
        }, [legacy, query])

        const industryResolved = React.useMemo(function () {
          return resolveIndustrySelection(themes, industrySel)
        }, [themes, industrySel])

        const industryLegacySelected = industrySel !== null && industrySel.kind === 'legacy'

        const editReady = detail !== null && detail.entry !== undefined && detail.entry !== null && str(detail.entry.id) === str(selectedId)

        // Keep the industry selection valid against the latest scan and expand
        // its path. A view archived on another device falls back to its sector,
        // then to the theme.
        React.useEffect(function () {
          if (tab !== 'industry' || industrySel === null) return
          if (industrySel.kind === 'legacy') {
            const exists = legacy.some(function (entry) { return entry && entry.id === str(industrySel.entryId) })
            if (!exists) setIndustrySel(themes.length > 0 ? { kind: 'theme', themeId: themes[0].id } : null)
            return
          }
          if (resolveIndustrySelection(themes, industrySel) !== null) return
          if (themes.length > 0) {
            setIndustrySel({ kind: 'theme', themeId: themes[0].id })
          } else if (legacy.length > 0 && legacy[0] && legacy[0].id) {
            setSelectedId(str(legacy[0].id))
            setIndustrySel({ kind: 'legacy', entryId: str(legacy[0].id) })
          } else {
            setIndustrySel(null)
          }
        }, [tab, themes, legacy, industrySel])

        React.useEffect(function () {
          if (tab !== 'industry' || industrySel !== null) return
          if (themes.length > 0) {
            setIndustrySel({ kind: 'theme', themeId: themes[0].id })
            return
          }
          if (legacy.length > 0 && legacy[0] && legacy[0].id) {
            setSelectedId(str(legacy[0].id))
            setIndustrySel({ kind: 'legacy', entryId: str(legacy[0].id) })
          }
        }, [tab, themes, legacy, industrySel])

        React.useEffect(function () {
          if (industrySel === null || industrySel.kind === 'legacy') return
          const resolved = resolveIndustrySelection(themes, industrySel)
          if (resolved === null) return
          const themeId = str(resolved.theme.id)
          setExpandedThemes(function (previous) {
            if (previous[themeId] === true) return previous
            const next = Object.assign({}, previous)
            next[themeId] = true
            return next
          })
          if (resolved.sector !== null) {
            const sectorKey = themeId + '|' + str(resolved.sector.file)
            setExpandedSectors(function (previous) {
              if (previous[sectorKey] === true) return previous
              const next = Object.assign({}, previous)
              next[sectorKey] = true
              return next
            })
          }
        }, [industrySel])

        React.useEffect(function () {
          if (modal === null) return
          if (modal.kind === 'digest') return
          // "new entry" needs no selection; review and edit do. A selection that
          // vanished (deleted on disk) closes those dialogs instead of leaving
          // them pointed at nothing.
          if (modal.kind === 'review' || modal.mode === 'edit') {
            if (selectedMeta === null) setModal(null)
          }
        }, [modal, selectedMeta])

        const closeModal = function () { setModal(null) }

        const afterMutation = React.useCallback(async function (entryId, message) {
          setModal(null)
          showToast('success', message)
          await loadState({ silent: true })
          if (entryId !== null && entryId !== '') {
            setSelectedId(entryId)
            setDetailTick(function (value) { return value + 1 })
          }
        }, [loadState, showToast])

        const handleEntrySaved = function (result, mode) {
          const entry = result && result.entry ? result.entry : null
          const name = str(entry && entry.name) || '记录'
          const created = result !== null && result !== undefined && result.created === true
          const message = (created ? '已创建：' : mode === 'edit' ? '已更新：' : '已保存：') + name
          void afterMutation(entry !== null ? str(entry.id) : null, message)
        }

        const handleReviewSaved = function (result) {
          const entry = result && result.entry ? result.entry : null
          void afterMutation(entry !== null ? str(entry.id) : null, '已记录复盘：' + (str(entry && entry.name) || str(selectedMeta && selectedMeta.name) || '当前记录'))
        }

        // ── industry selection / mutations ─────────────────────────────────
        const selectTheme = function (theme) {
          if (theme === null || theme === undefined) return
          setTab('industry')
          setIndustrySel({ kind: 'theme', themeId: str(theme.id) })
        }
        const selectSector = function (theme, sector) {
          if (theme === null || theme === undefined || sector === null || sector === undefined) return
          setTab('industry')
          setIndustrySel({ kind: 'sector', themeId: str(theme.id), sectorKey: str(sector.file) })
        }
        const selectView = function (target, view) {
          if (target === null || target === undefined || view === null || view === undefined) return
          setTab('industry')
          setIndustrySel({
            kind: 'view',
            themeId: str(target.themeId),
            sectorKey: target.sectorKey === null || target.sectorKey === undefined ? null : str(target.sectorKey),
            viewId: str(view.id)
          })
        }
        const selectLegacy = function (entry) {
          if (entry === null || entry === undefined) return
          setTab('industry')
          setSelectedId(str(entry.id))
          setIndustrySel({ kind: 'legacy', entryId: str(entry.id) })
        }
        const toggleTheme = function (themeId) {
          setExpandedThemes(function (previous) {
            const next = Object.assign({}, previous)
            next[themeId] = previous[themeId] !== true
            return next
          })
        }
        const toggleSector = function (sectorKey) {
          setExpandedSectors(function (previous) {
            const next = Object.assign({}, previous)
            next[sectorKey] = previous[sectorKey] !== true
            return next
          })
        }
        const openCreateTheme = function () { setModal({ kind: 'theme' }) }
        const openCreateSector = function (theme) {
          setModal({ kind: 'sector', themeName: theme ? str(theme.name) : '' })
        }
        const openCreateView = function (theme, sector) {
          setModal({ kind: 'view', op: 'add', target: boardTargetOf(theme, sector) })
        }
        const handleViewAction = function (op, target, view) {
          if (op === 'revise') {
            setModal({ kind: 'view', op: 'revise', target, view })
            return
          }
          setModal({ kind: 'reason', op, target, view })
        }
        const selectBoardTarget = function (target) {
          if (!target || str(target.themeId) === '') return
          setTab('industry')
          if (target.sectorKey !== null && target.sectorKey !== undefined && str(target.sectorKey) !== '') {
            setIndustrySel({ kind: 'sector', themeId: str(target.themeId), sectorKey: str(target.sectorKey) })
          } else {
            setIndustrySel({ kind: 'theme', themeId: str(target.themeId) })
          }
        }

        const handleThemeSaved = async function (result) {
          setModal(null)
          const themeName = str(result && result.theme && result.theme.name) || '新主题'
          showToast('success', '已创建主题：' + themeName)
          const next = await loadState({ silent: true })
          const nextThemes = asArray(next && next.themes)
          let theme = null
          if (result && result.theme) {
            theme = findThemeById(nextThemes, result.theme.id) || findThemeById(nextThemes, result.theme.dir) || null
          }
          if (theme === null) {
            theme = nextThemes.filter(function (item) { return str(item.name) === themeName })[0] || null
          }
          if (theme !== null) {
            setTab('industry')
            setIndustrySel({ kind: 'theme', themeId: str(theme.id) })
            setExpandedThemes(function (previous) {
              const nextExpanded = Object.assign({}, previous)
              nextExpanded[str(theme.id)] = true
              return nextExpanded
            })
          }
        }

        const handleSectorSaved = async function (result) {
          setModal(null)
          const sectorName = str(result && result.sector && result.sector.name) || '新细分赛道'
          showToast('success', '已创建细分赛道：' + sectorName)
          const next = await loadState({ silent: true })
          const nextThemes = asArray(next && next.themes)
          const wantedFile = str(result && result.sector && result.sector.file)
          let theme = null
          let sector = null
          for (let i = 0; i < nextThemes.length; i += 1) {
            const candidate = nextThemes[i]
            const found = asArray(candidate && candidate.sectors).filter(function (item) {
              if (!item) return false
              if (wantedFile !== '' && str(item.file) === wantedFile) return true
              return str(item.name) === sectorName
            })[0]
            if (found) { theme = candidate; sector = found; break }
          }
          if (theme !== null && sector !== null) {
            setTab('industry')
            setIndustrySel({ kind: 'sector', themeId: str(theme.id), sectorKey: str(sector.file) })
            setExpandedThemes(function (previous) {
              const nextExpanded = Object.assign({}, previous)
              nextExpanded[str(theme.id)] = true
              return nextExpanded
            })
            setExpandedSectors(function (previous) {
              const key = str(theme.id) + '|' + str(sector.file)
              const nextExpanded = Object.assign({}, previous)
              nextExpanded[key] = true
              return nextExpanded
            })
          } else if (nextThemes.length > 0) {
            setTab('industry')
            setIndustrySel({ kind: 'theme', themeId: str(nextThemes[0].id) })
          }
        }

        const handleViewSaved = async function (result, info) {
          setModal(null)
          const mode = str(info && info.mode)
          const target = (info && info.target) || {}
          const view = result && result.view ? result.view : null
          if (mode === 'revise') {
            showToast('success', '已修正观点：' + (str(view && view.id) || ''))
            await loadState({ silent: true })
            return
          }
          showToast('success', '已添加观点：' + (str(view && view.id) || ''))
          await loadState({ silent: true })
          selectBoardTarget(target)
          if (str(target.themeId) !== '' && target.sectorKey) {
            setExpandedThemes(function (previous) {
              const nextExpanded = Object.assign({}, previous)
              nextExpanded[str(target.themeId)] = true
              return nextExpanded
            })
            setExpandedSectors(function (previous) {
              const key = str(target.themeId) + '|' + str(target.sectorKey)
              const nextExpanded = Object.assign({}, previous)
              nextExpanded[key] = true
              return nextExpanded
            })
          }
        }

        const handleViewReason = async function (result, info) {
          setModal(null)
          const op = str(info && info.op)
          const target = (info && info.target) || {}
          const labels = { weaken: '已削弱观点', falsify: '已证伪观点', archive: '已归档观点' }
          showToast('success', labels[op] || '已更新观点')
          await loadState({ silent: true })
          if (op === 'archive') selectBoardTarget(target)
        }

        // A vault switch changes every id underneath the panel: drop the old
        // industry selection, rescan /state (which re-picks a project) and force
        // the open entry to reload from the new directory.
        const handleVaultChanged = async function (result, message) {
          const dir = str(result && result.vaultDir)
          showToast('success', message || ('知识库位置已更新：' + (dir || '')))
          setIndustrySel(null)
          setExpandedThemes({})
          setExpandedSectors({})
          await loadState({ silent: true })
          setDetailTick(function (value) { return value + 1 })
        }

        const doSync = async function () {
          if (busy !== null) return
          setBusy('sync')
          try {
            const result = await api.sync()
            const mode = str(result && result.mode)
            const output = truncateText(result && result.output, 200)
            const ok = result === null || result.ok !== false
            showToast(ok ? 'success' : 'error',
              (ok ? '同步完成' : '同步未完成') + (mode !== '' ? '（' + mode + '）' : '') + (output !== '' ? '：' + output : ''))
            await loadState({ silent: true })
          } catch (failure) {
            showToast('error', '同步失败：' + (str(failure && failure.message) || '未知错误'))
          } finally {
            setBusy(null)
          }
        }

        const doSeed = async function () {
          if (busy !== null) return
          setBusy('seed')
          try {
            const result = await api.seed()
            const created = asArray(result && result.created).length
            showToast('success', '已写入 ' + created + ' 条示例记录，开始建立你的判断库吧。')
            await loadState({ silent: true })
          } catch (failure) {
            showToast('error', '写入示例失败：' + (str(failure && failure.message) || '未知错误'))
          } finally {
            setBusy(null)
          }
        }

        const doRefresh = async function () {
          if (busy !== null) return
          setBusy('refresh')
          await loadState({ silent: false })
          setBusy(null)
        }

        const copyPath = async function () {
          if (selectedMeta === null) return
          const relative = str(selectedMeta.file) || (str(selectedMeta.id) !== '' ? str(selectedMeta.id) + '.md' : '')
          const full = joinPath(vaultDir, relative)
          if (full === '') { showToast('error', '没有可复制的文件路径'); return }
          const ok = await copyText(full)
          showToast(ok ? 'success' : 'error', ok ? '已复制路径：' + full : '复制失败（请手动选择文本）：' + full)
        }

        const toastEl = toast !== null
          ? h('div', { className: 'vc-toast' + (toast.kind === 'error' ? ' vc-toast-error' : ''), role: toast.kind === 'error' ? 'alert' : 'status', 'aria-live': 'polite' },
            h('span', { className: 'vc-toast-dot', 'aria-hidden': 'true' }),
            h('span', { className: 'vc-toast-text' }, toast.text),
            h('button', { type: 'button', className: 'vc-toast-x', 'aria-label': '关闭提示', onClick: function () { setToast(null) } }, '✕'))
          : null

        let modalEl = null
        if (modal !== null && modal.kind === 'digest') {
          modalEl = guard('digest-modal', h(DigestModal, { key: 'digest', onClose: closeModal, onToast: showToast }))
        } else if (modal !== null && modal.kind === 'review' && selectedMeta !== null) {
          modalEl = guard('review-modal', h(ReviewFormModal, { key: 'review', entry: selectedMeta, onClose: closeModal, onSaved: handleReviewSaved }))
        } else if (modal !== null && modal.kind === 'entry') {
          modalEl = guard('entry-modal', h(EntryFormModal, {
            key: 'entry',
            mode: modal.mode === 'edit' ? 'edit' : 'create',
            entry: modal.mode === 'edit' ? selectedMeta : null,
            detail: modal.mode === 'edit' ? detail : null,
            defaultCycle,
            onClose: closeModal,
            onSaved: handleEntrySaved
          }))
        } else if (modal !== null && modal.kind === 'theme') {
          modalEl = guard('theme-modal', h(ThemeModal, { key: 'theme', onClose: closeModal, onSaved: handleThemeSaved }))
        } else if (modal !== null && modal.kind === 'sector') {
          modalEl = guard('sector-modal', h(SectorModal, {
            key: 'sector',
            presetThemeName: str(modal.themeName),
            onClose: closeModal,
            onSaved: handleSectorSaved
          }))
        } else if (modal !== null && modal.kind === 'view') {
          modalEl = guard('view-modal', h(IndustryViewModal, {
            key: 'view',
            mode: modal.op === 'revise' ? 'revise' : 'add',
            target: modal.target || {},
            view: modal.view || null,
            onClose: closeModal,
            onSaved: handleViewSaved
          }))
        } else if (modal !== null && modal.kind === 'reason') {
          modalEl = guard('reason-modal', h(ReasonModal, {
            key: 'reason',
            op: modal.op,
            target: modal.target || {},
            view: modal.view || null,
            onClose: closeModal,
            onSaved: handleViewReason
          }))
        } else if (modal !== null && modal.kind === 'settings') {
          modalEl = guard('settings-modal', h(SettingsModal, {
            key: 'settings',
            state,
            onClose: closeModal,
            onToast: showToast,
            onVaultChanged: handleVaultChanged
          }))
        }

        const titleText = (function () {
          const value = t('title')
          return typeof value === 'string' && value !== '' && value !== 'title' ? value : '投资记忆'
        })()

        const tabs = [
          { id: 'all', label: '全部', count: counts.total },
          { id: 'project', label: '项目', count: counts.project },
          { id: 'industry', label: '行业', count: counts.themes },
          { id: 'due', label: '到期', count: counts.due }
        ]

        const syncLabel = str(sync.label) || (sync.mode === 'git' ? 'Git 同步' : sync.mode === 'onedrive' ? 'OneDrive 自动同步' : '本地文件夹')
        const syncBad = sync.dirty === true || (sync.last !== null && sync.last !== undefined && sync.last.ok === false)
        const syncTitle = sync.last !== null && sync.last !== undefined && str(sync.last.message) !== ''
          ? '上次同步：' + str(sync.last.at) + ' · ' + str(sync.last.message)
          : sync.dirty === true ? '有未提交或未推送的改动' : syncLabel

        if (state === null && loading === true) {
          return h('section', { className: 'vc-root', 'aria-label': titleText },
            h('div', { className: 'vc-center' },
              h('div', { className: 'vc-spinner', 'aria-hidden': 'true' }),
              h('div', { className: 'vc-hint' }, '正在读取投资记忆…')))
        }
        if (state === null && loadError !== null) {
          return h('section', { className: 'vc-root', 'aria-label': titleText },
            h('div', { className: 'vc-center' },
              h('div', { className: 'vc-error-title' }, '无法读取投资记忆'),
              h('div', { className: 'vc-error-text' }, loadError),
              h('div', { className: 'vc-hint' }, '确认 Host 半边已加载，且 /vc-memory/api/state 可访问。'),
              h(Btn, { variant: 'primary', onClick: function () { void loadState({ silent: false }) } }, '重试')))
        }

        return h('section', { className: 'vc-root', 'aria-label': titleText },
          h('header', { className: 'vc-head' },
            h('div', { className: 'vc-head-row' },
              h('div', { className: 'vc-title' },
                h('span', { className: 'vc-title-mark' }, h(Icon, { size: 18, active: false })),
                h('h1', null, titleText)),
              h('span', { className: 'vc-vault', title: vaultDir !== '' ? vaultDir : '尚未确定知识库目录' },
                h('span', { className: 'vc-vault-label' }, '知识库'),
                middleTruncate(vaultDir, 44) || '未配置'),
              h('div', { className: 'vc-counts' },
                h('span', { className: 'vc-count' }, h('b', null, String(counts.project)), '项目'),
                h('span', { className: 'vc-count' }, h('b', null, String(counts.themes)), '主题'),
                h('span', { className: 'vc-count' }, h('b', null, String(counts.sectors)), '赛道'),
                h('span', { className: 'vc-count' }, h('b', null, String(counts.views)), '观点'),
                h('span', { className: 'vc-count' + (counts.due > 0 ? ' vc-count-due' : '') }, h('b', null, String(counts.due)), '到期')),
              h('div', { className: 'vc-actions' },
                h(Btn, { variant: 'primary', onClick: function () { setModal({ kind: 'entry', mode: 'create' }) } }, '＋ 新建'),
                h(Btn, { onClick: function () { setModal({ kind: 'digest' }) } }, '本周简报'),
                h(Btn, { onClick: function () { void doSync() }, disabled: busy !== null, title: '按 Host 配置提交/推送 Git，或说明网盘同步状态' }, busy === 'sync' ? '同步中…' : '同步'),
                h(Btn, { onClick: function () { void doRefresh() }, disabled: busy !== null, 'aria-label': '刷新投资记忆数据' }, busy === 'refresh' ? '刷新中…' : '刷新'),
                h(Btn, { variant: 'ghost', onClick: function () { setModal({ kind: 'settings' }) }, title: '外观与知识库位置', 'aria-label': '打开设置' }, '⚙ 设置'))),
            h('div', { className: 'vc-head-row' },
              h('div', { className: 'vc-sync', title: syncTitle },
                h('span', { className: 'vc-sync-dot' + (syncBad ? ' warn' : '') }),
                h('span', null, syncLabel),
                sync.dirty === true ? h('span', null, ' · 有未提交改动') : null,
                sync.last !== null && sync.last !== undefined && sync.last.ok === false ? h('span', null, ' · 上次失败') : null),
              sync.gitAvailable === false && sync.mode === 'git' ? h('span', { className: 'vc-sync' }, '（未检测到 git）') : null,
              h('span', { className: 'vc-sync', style: { marginLeft: 'auto' } },
                '项目 ', String(counts.project), ' · 行业观点 ', String(counts.views), ' · 30 秒自动刷新'))),
          warnings.length > 0
            ? h('div', { className: 'vc-warn', role: 'status' },
              warnings.slice(0, 4).map(function (warning, index) {
                return h('div', { key: index }, '· ' + str(warning))
              }))
            : null,
          h('div', { className: 'vc-toolbar' },
            h('div', { className: 'vc-tabs', role: 'tablist', 'aria-label': '记录筛选' },
              tabs.map(function (item) {
                const on = tab === item.id
                return h('button', {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': on ? 'true' : 'false',
                  className: 'vc-tab' + (on ? ' on' : ''),
                  onClick: function () { setTab(item.id) }
                        }, item.label, h('span', { className: 'vc-count-badge' }, String(item.count)))
              })),
            tab === 'industry'
              ? h('button', {
                type: 'button',
                className: 'vc-btn vc-btn-ghost',
                onClick: openCreateTheme
              }, '+ 新建主题')
              : null,
            h('div', { className: 'vc-search-wrap' },
              h('input', {
                className: 'vc-search',
                type: 'search',
                value: query,
                placeholder: '搜索名称 / 领域 / 标签 / 观点',
                'aria-label': '搜索记录',
                onChange: function (event) { setQuery(event.target.value) }
              }))),
          vaultEmpty
            ? h(EmptyState, {
              state,
              seeding: busy === 'seed',
              error: loadError,
              onSeed: function () { void doSeed() }
            })
            : h('div', { className: 'vc-body' },
              h('div', { className: 'vc-list' },
                tab === 'industry'
                  ? h('div', { className: 'vc-list-head' },
                    h('span', null, visibleThemes.length + ' 个主题' + (visibleLegacy.length > 0 ? ' · ' + visibleLegacy.length + ' 条旧格式' : '')),
                    h('span', null, '主题 → 赛道 → 观点'))
                  : h('div', { className: 'vc-list-head' },
                    h('span', null, filtered.length + ' 条' + (query.trim() !== '' || tab !== 'all' ? '匹配' : '')),
                    h('span', null, '按到期优先')),
                h('div', { className: 'vc-list-scroll' },
                  tab === 'industry'
                    ? h(IndustryTree, {
                      themes: visibleThemes,
                      totalThemes: themes.length,
                      legacy: visibleLegacy,
                      totalLegacy: legacy.length,
                      query,
                      selection: industrySel,
                      expandedThemes,
                      expandedSectors,
                      onToggleTheme: toggleTheme,
                      onToggleSector: toggleSector,
                      onSelectTheme: selectTheme,
                      onSelectSector: selectSector,
                      onSelectView: selectView,
                      onSelectLegacy: selectLegacy,
                      onCreateTheme: openCreateTheme
                    })
                    : filtered.length === 0
                      ? h('div', { className: 'vc-hint' },
                        query.trim() !== ''
                          ? '没有匹配「' + query.trim() + '」的记录。'
                          : tab === 'due' ? '没有到期的复盘，节奏很好。' : tab === 'project' ? '还没有项目记录。' : '还没有记录。')
                      : filtered.map(function (entry, index) {
                        return h(ListRow, {
                          key: str(entry && entry.id) || 'row' + index,
                          entry,
                          active: entry && entry.id === selectedId,
                          onSelect: function (id) { if (id !== '') setSelectedId(id) }
                        })
                      }))),
              guard('detail', tab === 'industry'
                ? (industryLegacySelected
                  ? h(DetailPane, {
                    meta: selectedMeta,
                    detail,
                    loading: detailLoading,
                    error: detailError,
                    editReady: false,
                    readOnly: true,
                    onReview: function () {},
                    onEdit: function () {},
                    onCopyPath: function () { void copyPath() },
                    onRetryDetail: function () { setDetailTick(function (value) { return value + 1 }) }
                  })
                  : h(IndustryPane, {
                    resolved: industryResolved,
                    onCreateTheme: openCreateTheme,
                    onCreateSector: openCreateSector,
                    onCreateView: openCreateView,
                    onSelectTheme: selectTheme,
                    onSelectSector: selectSector,
                    onSelectView: selectView,
                    onViewAction: handleViewAction
                  }))
                : h(DetailPane, {
                  meta: selectedMeta,
                  detail,
                  loading: detailLoading,
                  error: detailError,
                  editReady,
                  readOnly: selectedMeta !== null && selectedMeta.legacy === true,
                  onReview: function () { if (selectedMeta !== null && selectedMeta.legacy !== true) setModal({ kind: 'review' }) },
                  onEdit: function () { if (selectedMeta !== null && selectedMeta.legacy !== true) setModal({ kind: 'entry', mode: 'edit' }) },
                  onCopyPath: function () { void copyPath() },
                  onRetryDetail: function () { setDetailTick(function (value) { return value + 1 }) }
                }))),
          modalEl,
          toastEl)
      }

      // ── registration ────────────────────────────────────────────────────────
      // Dictionaries first: the sidebar label is a thunk, so it can be
      // registered before the dictionary lands; keeping the effect first means
      // the first label resolution already sees the namespaced strings.
      try {
        if (ctx.locale && typeof ctx.locale.register === 'function') {
          const registerDictionaries = function () {
            return ctx.locale.register(NS, {
              zh: {
                panel: '投资记忆',
                title: '投资记忆'
              },
              en: {
                panel: 'VC Memory',
                title: 'VC Memory'
              }
            })
          }
          // ctx.effect scopes the registration to this plugin's lifetime; a host
          // without effect still gets the dictionary registered directly.
          if (typeof ctx.effect === 'function') ctx.effect(registerDictionaries, 'vc-memory: dictionaries')
          else registerDictionaries()
        }
      } catch (error) {
        console.warn('[vc-memory] locale registration failed:', error)
      }
      try {
        t = ctx.locale.bind(NS)
      } catch (error) {
        console.warn('[vc-memory] locale.bind failed:', error)
      }

      const slots = ctx.slots
      if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
        console.warn('[vc-memory] the host has no slot registry; the panel is not mounted')
        return
      }

      // Sidebar entry: order 20 puts it after the host's own entries that sit
      // at 0-10 and before lower-priority plugins, matching the panel-order
      // convention the shipped plugins use.
      try {
        slots.inject('sidebar.panellist', function () {
          return slots.register({
            name: 'sidebar.panellist',
            id: NS,
            order: 20,
            locale: NS,
            label: function () { return t('panel') }
          }, Icon)
        })
      } catch (error) {
        console.warn('[vc-memory] could not register the sidebar entry:', error)
      }

      // The page itself: the host renders the selected `main` panel key inside
      // its centre column; the page keeps its own frame and scrolls internally.
      try {
        slots.inject('main', function () {
          return slots.register({
            name: 'main',
            key: NS,
            locale: NS,
            inject: function () { return {} }
          }, Panel)
        })
      } catch (error) {
        console.warn('[vc-memory] could not register the main page:', error)
      }
    }

    return module.exports
  },
})
