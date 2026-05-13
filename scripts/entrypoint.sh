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
    else
        echo "❌ エラーが発生したため、${TARGET_URL} のレポート生成をスキップしました。"
    fi
done

echo "==================================================="
echo "🎉 全ての監査が完了しました！"
echo "==================================================="
