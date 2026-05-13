const fs = require('fs');

/**
 * Pa11y JSON出力 → 日本語アコーディオン付きHTMLレポート変換スクリプト
 */

// エラーの翻訳とタイトル生成
function getTranslation(code, originalMessage) {
    return { 
        title: code || 'Issue', 
        desc: originalMessage,
        translated: '' 
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// エラーコードやランナーに応じたヘルプリンクを生成する関数
function getHelpLink(issue) {
    const helpUrl = issue.runnerExtras?.helpUrl || '';
    
    // 1. 外部ヘルプURL（axeなど）が既に存在する場合
    if (helpUrl) {
        if (helpUrl.includes('dequeuniversity')) {
            return { url: helpUrl, text: 'axe-core解説ページ (Deque) ↗' };
        }
        return { url: helpUrl, text: 'エラー解説ページ ↗' };
    }
    
    // 2. ヘルプURLが存在せず、WCAGのエラーコードからGoogle検索URLを生成する場合
    if (issue.code.startsWith('WCAG2AA')) {
        const match = issue.code.match(/Guideline\d+_\d+\.(\d+_\d+_\d+(?:_\d+)?)/);
        if (match) {
            const scDot = match[1].replace(/_/g, '.');
            return {
                url: `https://www.google.com/search?q=` + encodeURIComponent(`WCAG 2.2 ${scDot}`),
                text: `「WCAG 2.2 ${scDot}」でGoogle検索 ↗`
            };
        }
    }
    
    // 3. どちらにも該当しない場合
    return { url: '', text: '' };
}

function groupIssues(issues) {
    const groups = { error: {}, warning: {}, notice: {} };

    issues.forEach(issue => {
        const trans = getTranslation(issue.code, issue.message);
        // グループ化のキーをタイトルベースにする
        const key = trans.title + '_' + issue.code;

        if (!groups[issue.type][key]) {
            const helpLink = getHelpLink(issue);

            groups[issue.type][key] = {
                type: issue.type,
                code: issue.code,
                title: trans.title,
                desc: trans.desc,
                translatedDesc: trans.translated,
                originalMessage: issue.message,
                runner: issue.runner,
                helpUrl: helpLink.url,
                linkText: helpLink.text,
                instances: []
            };
        }
        groups[issue.type][key].instances.push({
            context: issue.context,
            selector: issue.selector,
            originalMessage: issue.message // 個別のエラー文も残しておく（htmlcsの数値違いなどに対応）
        });
    });

    return groups;
}

function generateHtml(issues, url) {
    const grouped = groupIssues(issues);
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const totalErrors = Object.values(grouped.error).reduce((sum, g) => sum + g.instances.length, 0);
    const totalWarnings = Object.values(grouped.warning).reduce((sum, g) => sum + g.instances.length, 0);
    const totalNotices = Object.values(grouped.notice).reduce((sum, g) => sum + g.instances.length, 0);
    const totalIssues = totalErrors + totalWarnings + totalNotices;

    const renderGroup = (group) => {
        return `
        <div class="issue ${group.type}" data-type="${group.type}">
            <div class="issue-header">
                <div class="issue-top">
                    <span class="badge ${group.type}">${group.type === 'error' ? 'エラー' : group.type === 'warning' ? '警告' : '通知'}</span>
                    <span class="runner-tag">${group.runner}</span>
                </div>
                <div class="issue-title" style="word-break: break-all;">${escapeHtml(group.title)}</div>
                <div class="issue-msg">${escapeHtml(group.desc)}</div>
                ${group.helpUrl ? `<a href="${group.helpUrl}" target="_blank" class="help-link">${escapeHtml(group.linkText || 'Official Document ↗')}</a>` : ''}
            </div>
            <details class="issue-details">
                <summary>該当箇所を見る (${group.instances.length}件)</summary>
                <div class="instances-list">
                    ${group.instances.map(instance => `
                        <div class="instance">
                            ${instance.originalMessage && instance.originalMessage !== group.desc ? `<div class="detail-label">詳細メッセージ</div><div class="original-msg">${escapeHtml(instance.originalMessage)}</div>` : ''}
                            <div class="detail-label">対象のソースコード</div>
                            <pre><code>${escapeHtml(instance.context || 'N/A')}</code></pre>
                            <div class="detail-label" style="margin-top:8px;">セレクタ</div>
                            <div class="selector-text">${escapeHtml(instance.selector || 'N/A')}</div>
                        </div>
                    `).join('')}
                </div>
            </details>
        </div>`;
    };

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>アクセシビリティ診断レポート</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --c-error:#dc2626;--c-error-bg:#fef2f2;--c-error-border:#fecaca;
  --c-warn:#d97706;--c-warn-bg:#fffbeb;--c-warn-border:#fde68a;
  --c-notice:#2563eb;--c-notice-bg:#eff6ff;--c-notice-border:#bfdbfe;
  --bg:#f8fafc;--card:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;
  --radius:12px;
}
body{font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;background:var(--bg);color:var(--text);line-height:1.7}
.container{max-width:1080px;margin:0 auto;padding:32px 20px}

/* ヘッダー */
.report-header{text-align:center;margin-bottom:48px}
.report-header h1{font-size:1.8rem;font-weight:800;margin-bottom:8px}
.report-header .meta{color:var(--muted);font-size:.9rem}
.url-badge{display:inline-block;background:#e2e8f0;padding:6px 18px;border-radius:999px;font-size:.85rem;color:#475569;margin-top:12px;word-break:break-all;max-width:100%}

/* サマリーカード */
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px}
@media(max-width:640px){.summary{grid-template-columns:repeat(2,1fr)}}
.s-card{background:var(--card);border-radius:var(--radius);padding:24px 16px;text-align:center;box-shadow:0 1px 3px rgb(0 0 0/.06);border-bottom:4px solid var(--border)}
.s-card.error{border-color:var(--c-error)}.s-card.warning{border-color:var(--c-warn)}.s-card.notice{border-color:var(--c-notice)}.s-card.total{border-color:#6366f1}
.s-card .num{font-size:2.4rem;font-weight:800;display:block}
.s-card.error .num{color:var(--c-error)}.s-card.warning .num{color:var(--c-warn)}.s-card.notice .num{color:var(--c-notice)}.s-card.total .num{color:#6366f1}
.s-card .lbl{font-size:.85rem;color:var(--muted);font-weight:600}

/* タブ */
.tab-bar{display:flex;gap:8px;margin-bottom:24px;border-bottom:2px solid var(--border);padding-bottom:12px;position:sticky;top:0;background:var(--bg);z-index:10;flex-wrap:wrap}
.tab{padding:8px 20px;border:none;border-radius:8px;background:#e2e8f0;color:#475569;font-weight:600;cursor:pointer;font-size:.9rem;transition:all .15s}
.tab:hover{background:#cbd5e1}
.tab.active{color:#fff}
.tab.active[data-type="all"]{background:#6366f1}
.tab.active[data-type="error"]{background:var(--c-error)}
.tab.active[data-type="warning"]{background:var(--c-warn)}
.tab.active[data-type="notice"]{background:var(--c-notice)}

/* カード */
.issue{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgb(0 0 0/.06);border-left:5px solid var(--border);transition:transform .15s,box-shadow .15s}
.issue:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgb(0 0 0/.08)}
.issue.error{border-left-color:var(--c-error)}.issue.warning{border-left-color:var(--c-warn)}.issue.notice{border-left-color:var(--c-notice)}

.issue-top{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.badge{padding:3px 10px;border-radius:6px;font-size:.75rem;font-weight:700}
.badge.error{background:var(--c-error-bg);color:var(--c-error)}
.badge.warning{background:var(--c-warn-bg);color:var(--c-warn)}
.badge.notice{background:var(--c-notice-bg);color:var(--c-notice)}
.runner-tag{font-size:.72rem;color:var(--muted);margin-left:auto;background:#f1f5f9;padding:2px 8px;border-radius:4px;}

.issue-title{font-size:1.15rem;font-weight:700;color:var(--text);margin-bottom:4px;}
.issue-code{font-family:'Fira Code',monospace;font-size:.8rem;color:var(--muted);margin-bottom:12px}
.issue-msg{font-size:0.95rem;font-weight:500;margin-bottom:12px;line-height:1.6;color:#334155;}
.help-link{display:inline-block;font-size:.85rem;color:#2563eb;text-decoration:none;margin-bottom:16px;font-weight:600;}
.help-link:hover{text-decoration:underline;}

/* アコーディオン */
details.issue-details {
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid var(--border);
    overflow: hidden;
}
details.issue-details summary {
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    color: #334155;
    background: #f1f5f9;
    list-style: none; /* remove default triangle in some browsers */
    display: flex;
    align-items: center;
}
details.issue-details summary::-webkit-details-marker {
    display: none;
}
details.issue-details summary::before {
    content: '▶';
    font-size: 0.8rem;
    margin-right: 8px;
    transition: transform 0.2s ease;
    color: var(--muted);
}
details.issue-details[open] summary::before {
    transform: rotate(90deg);
}

.instances-list {
    padding: 16px;
    border-top: 1px solid var(--border);
    background: #fff;
}
.instance {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px dashed var(--border);
}
.instance:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.detail-label{display:block;font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.original-msg{font-size:0.85rem;color:#b91c1c;background:#fef2f2;padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid #fecaca;}
pre{margin:0;white-space:pre-wrap;word-break:break-all;font-family:'Fira Code','Courier New',monospace;font-size:.85rem;color:#334155;line-height:1.5;background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;}
.selector-text{font-family:monospace;font-size:.82rem;color:#6366f1;word-break:break-all;background:#f0fdf4;padding:8px 12px;border-radius:6px;border:1px solid #bbf7d0;}

.hidden{display:none}
.no-results{text-align:center;padding:60px 20px;color:var(--muted)}
.no-results .emoji{font-size:3rem;display:block;margin-bottom:12px}

footer{text-align:center;margin-top:60px;padding:20px;color:var(--muted);font-size:.8rem;border-top:1px solid var(--border)}
</style>
</head>
<body>
<div class="container">
  <div class="report-header">
    <h1>♿ アクセシビリティ診断レポート</h1>
    <p class="meta">WCAG 2.2 AA 準拠チェック ｜ 生成日時: ${now}</p>
    <div class="url-badge">${escapeHtml(url)}</div>
  </div>

  <div class="summary">
    <div class="s-card total"><span class="num">${totalIssues}</span><span class="lbl">総件数</span></div>
    <div class="s-card error"><span class="num">${totalErrors}</span><span class="lbl">エラー</span></div>
    <div class="s-card warning"><span class="num">${totalWarnings}</span><span class="lbl">警告</span></div>
    <div class="s-card notice"><span class="num">${totalNotices}</span><span class="lbl">通知</span></div>
  </div>

  <div class="tab-bar">
    <button class="tab active" data-type="all" onclick="filter('all',this)">すべて (${Object.keys(grouped.error).length + Object.keys(grouped.warning).length + Object.keys(grouped.notice).length}種類)</button>
    <button class="tab" data-type="error" onclick="filter('error',this)">エラー (${Object.keys(grouped.error).length}種類)</button>
    <button class="tab" data-type="warning" onclick="filter('warning',this)">警告 (${Object.keys(grouped.warning).length}種類)</button>
    <button class="tab" data-type="notice" onclick="filter('notice',this)">通知 (${Object.keys(grouped.notice).length}種類)</button>
  </div>

  <div id="list">
    ${totalIssues === 0 ? `
    <div class="no-results">
      <span class="emoji">🎉</span>
      <p>問題は検出されませんでした！</p>
    </div>
    ` : `
    ${Object.values(grouped.error).map(renderGroup).join('')}
    ${Object.values(grouped.warning).map(renderGroup).join('')}
    ${Object.values(grouped.notice).map(renderGroup).join('')}
    `}
  </div>
</div>

<footer>
  Pa11y アクセシビリティ診断レポート ｜ エンジン: htmlcs + axe ｜ 基準: WCAG 2.2 AA
</footer>

<script>
function filter(type, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const items = document.querySelectorAll('.issue');
  items.forEach(el => {
    if (type === 'all' || el.dataset.type === type) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}
</script>
</body>
</html>`;
}

// ===== メイン処理 =====
let inputData = '';
const targetUrl = process.argv[2] || 'file:///app/src/index.html'; // フォールバックとしてソースのパスを記載

process.stdin.on('data', chunk => { inputData += chunk; });
process.stdin.on('end', () => {
    try {
        const parsed = JSON.parse(inputData);
        const issues = Array.isArray(parsed) ? parsed : (parsed.issues || []);
        const url = parsed.documentTitle || parsed.pageUrl || targetUrl;
        process.stdout.write(generateHtml(issues, url));
    } catch (e) {
        process.stderr.write('エラー: JSONの解析に失敗しました。\n');
        process.exit(1);
    }
});
