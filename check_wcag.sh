#!/bin/bash
# ==============================================================================
# WCAG アクセシビリティ自動監査 ＆ レポート自動表示スクリプト
# ==============================================================================

# エラーが起きたらスクリプトを停止する
set -e

# スクリプトが存在するディレクトリ（wcagフォルダ）に移動
cd "$(dirname "$0")"

echo "==================================================="
echo "🔨 1. コンテナ環境のビルド（最新化）を確認しています..."
echo "==================================================="
docker compose build

echo ""
echo "==================================================="
echo "🚀 2. アクセシビリティ監査を実行しています..."
echo "==================================================="
docker compose run --rm pa11y

echo ""
echo "==================================================="
echo "🌐 3. レポート用サーバーの確認とURL表示..."
echo "==================================================="

PORT_FILE="/tmp/wcag_checker_port"
CURRENT_PORT=""

# python3 が利用可能かまず確認
if command -v python3 > /dev/null 2>&1; then
    # 記録されているポートがあるか確認し、そのポートでサーバーが動いているかチェック
    if [ -f "$PORT_FILE" ]; then
        SAVED_PORT=$(cat "$PORT_FILE")
        if pgrep -f "python3 -m http.server $SAVED_PORT" > /dev/null; then
            CURRENT_PORT=$SAVED_PORT
        fi
    fi

    if [ -z "$CURRENT_PORT" ]; then
        # 8000番から順に空きポートを探す
        SEARCH_PORT=8000
        while [ $SEARCH_PORT -lt 8100 ]; do
            if ! ss -tuln | grep -q ":$SEARCH_PORT "; then
                CURRENT_PORT=$SEARCH_PORT
                break
            fi
            SEARCH_PORT=$((SEARCH_PORT + 1))
        done

        if [ -n "$CURRENT_PORT" ]; then
            echo "レポート表示用サーバー (Port: $CURRENT_PORT) を起動しています..."
            python3 -m http.server "$CURRENT_PORT" --directory reports > /dev/null 2>&1 &
            echo "$CURRENT_PORT" > "$PORT_FILE"
            sleep 2
        else
            echo "⚠️ 空きポートが見つかりませんでした（8000-8099）。"
        fi
    else
        echo "レポート表示用サーバーは既に起動しています (Port: $CURRENT_PORT)。"
    fi
else
    echo "⚠️ python3 が見つかりません。HTTPサーバーを起動・管理できませんでした。"
fi

# 最新のレポートを探す
REPORT_PATH=$(find reports -name "summary_*.html" -mmin -1 | head -n 1)
if [ -z "$REPORT_PATH" ]; then
    REPORT_PATH=$(find reports -name "report_*.html" -mmin -1 | head -n 1)
fi

if [ -n "$REPORT_PATH" ]; then
    FILENAME=$(basename "$REPORT_PATH")
    if [ -n "$CURRENT_PORT" ]; then
        echo "---------------------------------------------------"
        echo "✅ 以下のURLをブラウザで開いてください:"
        echo "http://localhost:$CURRENT_PORT/$FILENAME"
        echo "---------------------------------------------------"
    else
        # サーバーが起動できなかった場合のフォールバック（元の挙動に合わせて open を実行）
        if command -v open > /dev/null 2>&1; then
            open "$REPORT_PATH"
            echo "✅ ブラウザでレポート（$REPORT_PATH）を開きました！"
        else
            echo "✅ レポートが生成されました: $REPORT_PATH"
            echo "手動で reports ディレクトリ内の $FILENAME を開いてください。"
        fi
    fi
else
    echo "⚠️ 最新のレポートファイルが見つかりませんでした。"
fi
