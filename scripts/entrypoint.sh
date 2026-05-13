#!/bin/sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 引数が指定されていればそれを優先し、なければ環境変数 TARGET_FILES を使用
if [ "$#" -gt 0 ]; then
    INPUTS="$*"
else
    INPUTS="${TARGET_FILES:-index.html}"
fi

# カンマをスペースに変換し、前後の不要な空白を削除してループ処理できるようにする
INPUTS=$(echo "$INPUTS" | tr ',' ' ' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

echo "==================================================="
echo "🚀 アクセシビリティ監査を開始します"
echo "==================================================="

# 複数ファイル指定に対応するループ処理
SUMMARY_LINKS=""
for INPUT in $INPUTS; do
    # 空文字の場合はスキップ
    if [ -z "$INPUT" ]; then
        continue
    fi

    # 入力が http://, https://, file:// で始まらない場合は、/app/src/ 配下のローカルファイルとみなす
    case "$INPUT" in
        http://*|https://*|file://*)
            TARGET_URL="$INPUT"
            ;;
        *)
            # 先頭のスラッシュを取り除いて結合（例: /about.html -> about.html）
            CLEAN_INPUT=$(echo "$INPUT" | sed 's|^/||')
            TARGET_URL="file:///app/src/${CLEAN_INPUT}"
            ;;
    esac

    # パスに含まれる特殊文字をファイル名用に置換（外部URLの場合など）
    FILENAME_SAFE=$(echo "$TARGET_URL" | sed 's|https\?://||;s|file:///app/src/||;s|/|_|g;s|_$||;s|\.html||')
    if [ "$FILENAME_SAFE" = "" ] || [ "$FILENAME_SAFE" = "index" ]; then
        REPORT_NAME="report_${TIMESTAMP}.html"
    else
        REPORT_NAME="report_${FILENAME_SAFE}_${TIMESTAMP}.html"
    fi

    echo "---------------------------------------------------"
    case "$TARGET_URL" in
        file://*)
            echo "🔎 ローカルファイルの監査を開始: $TARGET_URL"
            ;;
        *)
            echo "🔎 外部URLの監査を開始: $TARGET_URL"
            ;;
    esac

    # pa11yを実行し、JSONをカスタムレポーター（reporter.js）にパイプしてHTMLを生成
    HTML_OUTPUT=$(pa11y --config /app/config/pa11y-config.json --reporter json "$TARGET_URL" | node /app/scripts/reporter.js "$TARGET_URL")

    if [ $? -eq 0 ] && [ -n "$HTML_OUTPUT" ]; then
        echo "$HTML_OUTPUT" > "/app/reports/${REPORT_NAME}"
        echo "✅ レポートを出力しました: reports/${REPORT_NAME}"
        SUMMARY_LINKS="${SUMMARY_LINKS}<li><a href=\"${REPORT_NAME}\">${TARGET_URL}</a></li>"
    else
        echo "❌ エラーが発生したため、${TARGET_URL} のレポート生成をスキップしました。"
    fi
done

echo "==================================================="
echo "🎉 全ての監査が完了しました！"

INPUT_COUNT=$(echo "$INPUTS" | wc -w | tr -d ' ')
if [ -n "$SUMMARY_LINKS" ] && [ "$INPUT_COUNT" -gt 1 ]; then
    SUMMARY_FILE="summary_${TIMESTAMP}.html"
    cat <<EOF > "/app/reports/${SUMMARY_FILE}"
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>アクセシビリティ監査レポート一覧</title>
<style>
body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px; margin: 0; }
.container { max-width: 800px; margin: 0 auto; }
h1 { font-size: 1.8rem; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
.card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
ul { list-style: none; padding: 0; margin: 0; }
li { padding: 16px; border-bottom: 1px solid #e2e8f0; }
li:last-child { border-bottom: none; }
a { color: #2563eb; text-decoration: none; font-weight: bold; font-size: 1.1rem; }
a:hover { text-decoration: underline; }
.url { display: block; font-size: 0.85rem; color: #64748b; margin-top: 4px; word-break: break-all; }
</style>
</head>
<body>
<div class="container">
  <h1>📋 監査レポート一覧 (${TIMESTAMP})</h1>
  <div class="card">
    <ul>
      ${SUMMARY_LINKS}
    </ul>
  </div>
</div>
</body>
</html>
EOF
    echo "📂 一覧ページを出力しました: reports/${SUMMARY_FILE}"
fi

echo "==================================================="
