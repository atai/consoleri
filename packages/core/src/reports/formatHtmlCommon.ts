import type { HttpStatusTone } from './httpStatusColor'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function statusCssClass(status: string): string {
  switch (status) {
    case 'ok':
      return 'status-ok'
    case 'fail':
      return 'status-fail'
    case 'skipped':
      return 'status-skipped'
    default:
      return ''
  }
}

export function httpStatusCssClass(tone: HttpStatusTone): string {
  switch (tone) {
    case 'success':
      return 'status-ok'
    case 'error':
      return 'status-fail'
    case 'warning':
      return 'status-skipped'
    default:
      return 'status-muted'
  }
}

export function htmlPreBlock(text: string): string {
  return `<pre class="log-block">${escapeHtml(text)}</pre>`
}

export function htmlSection(title: string, content: string): string {
  return `<section class="detail-section"><h3>${escapeHtml(title)}</h3>${content}</section>`
}

const REPORT_HTML_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 1.5rem;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #e6edf3;
    background: #0f1117;
  }
  h1 { margin: 0 0 0.25rem; font-size: 1.25rem; font-weight: 600; }
  h2 { margin: 1.5rem 0 0.75rem; font-size: 1rem; font-weight: 600; color: #e6edf3; }
  h3 { margin: 1rem 0 0.5rem; font-size: 0.875rem; font-weight: 600; color: #e6edf3; }
  .meta { margin: 0 0 1.25rem; font-size: 0.75rem; color: #8b949e; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  th, td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #30363d;
    text-align: left;
    vertical-align: top;
  }
  th {
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #8b949e;
  }
  td.host { color: #e6edf3; }
  td.muted { color: #8b949e; }
  .status-ok { color: #4ade80; }
  .status-fail { color: #f87171; }
  .status-skipped { color: #facc15; }
  .status-muted { color: #8b949e; }
  .detail-section { margin-top: 1rem; }
  .log-block {
    margin: 0.5rem 0 0;
    padding: 0.75rem;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #c9d1d9;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .summary {
    margin-top: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid #30363d;
    font-size: 0.8125rem;
    color: #8b949e;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
  }
`

export function wrapReportHtml(title: string, meta: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_HTML_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${meta}</p>
  ${body}
</body>
</html>`
}
