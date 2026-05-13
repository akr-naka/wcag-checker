# WCAG 2.2 AA アクセシビリティ自動監査環境 (Pa11y + Docker)

Dockerコンテナ上で [Pa11y](https://pa11y.org/)（ヘッドレスChromiumブラウザ）を動かし、ローカルのHTMLファイルに対してWCAG 2.2 AA準拠のアクセシビリティ監査を行うツールです。

## 特徴
- **ヘッドレスChromiumによる正確な監査**: 単なるソースコードのテキスト解析ではなく、Chromiumブラウザをバックグラウンド（画面非表示）で立ち上げてDOMをレンダリングするため、JavaScript実行後の状態やCSS適用後のコントラスト比なども実機同様に正確にチェックします。
- **見やすいHTMLレポート**: エラー（Error）、警告（Warning）、通知（Notice）をタブやアコーディオンでスッキリ整理したカスタムHTMLレポートを出力します。
- **英語の原文エラー＋Google検索リンク**: 監査エンジン（axe / htmlcs）が出力する正確な英文エラーメッセージを維持しつつ、各エラーのWCAG達成基準（例: 1.4.3）についてワンクリックでGoogle検索できるリンクを自動生成し、公式ドキュメントや解説記事にアクセスしやすくしています。

## ファイル構成

```
wcag/
├── Dockerfile            # Pa11y + Chromium 実行環境イメージ定義
├── docker-compose.yml    # コンテナ・ボリュームマウントの設定
├── config/
│   └── pa11y-config.json # 監査基準（WCAG 2.2 AA等）やタイムアウトの設定
├── scripts/
│   ├── entrypoint.sh     # 実行コマンドを簡略化するスクリプト
│   └── reporter.js       # Pa11yのJSON出力をリッチなHTMLに変換する独自スクリプト
├── README.md             # このドキュメント
└── reports/              # 生成されたHTMLレポートの保存先
```

## セットアップ

初回実行時や、設定ファイルを変更した場合はDockerイメージをビルドします。

```bash
cd /Users/naka/Documents/wcag
docker compose build
```

## 設定 (.env ファイルの利用)
ルートディレクトリにある `.env.example` をコピーして `.env` ファイルを作成すると、監査対象のディレクトリや複数のファイルを一度に指定できます。

```bash
cp .env.example .env
```

**.env の例**
```env
# 監査対象のHTMLファイルが入っているローカルマシンのディレクトリパス
HTML_SOURCE_DIR=../source/seikatsu_test/html

# 監査したいファイル名（コンマまたはスペース区切りで複数指定可能）
TARGET_FILES=index.html, about.html, https://example.com
```

これにより、以下のコマンドを叩くだけで指定した**すべてのファイル**を一括で監査し、それぞれ個別のレポートを出力してくれます。

```bash
docker compose run --rm pa11y
```

## 基本的な使い方（コマンド引数を使う場合）

対象のHTMLファイル（デフォルトでは `../source/seikatsu_test/html` が `/app/src` にマウントされています）をスキャンし、タイムスタンプ付きのレポートを `reports/` ディレクトリに生成します。

```bash
docker compose run --rm pa11y
```
※ デフォルトで `index.html` が監査され、`reports/report_YYYYMMDD_HHMMSS.html` が出力されます。

**他のローカルファイルをチェックする場合**
ファイル名（またはサブディレクトリからの相対パス）をそのまま渡すだけでOKです。`file:///...` と打つ必要はありません。

```bash
# 例: ../source/seikatsu_test/html/about.html をチェックする場合
docker compose run --rm pa11y about.html

# 例: ../source/seikatsu_test/html/company/info.html をチェックする場合
docker compose run --rm pa11y company/info.html
```

## その他の使い方

### 1. 特定のURL（外部サイトなど）をチェックする
対象をローカルファイルではなく外部のURLにする場合は、以下のようにコマンドを変更します。
※ Basic認証がかかっている場合は `https://user:pass@example.com` のようにURLに含めて指定してください。

```bash
docker compose run --rm pa11y https://example.com
```
※ 自動的に `reports/report_example.com_YYYYMMDD_HHMMSS.html` という名前で出力されます。

### 2. レポートのHTML化を行わず、コンソールに出力する
詳細なHTMLレポートは不要で、ターミナル上でサクッと結果だけ見たい場合に使用します。

```bash
docker compose run --rm --entrypoint pa11y pa11y \
  --config /app/config/pa11y-config.json \
  file:///app/src/index.html
```

## よくある質問（FAQ）

### Q. エラーの該当箇所の「行数」が出力されないのはなぜですか？
**A.** Pa11yは裏側でChromiumブラウザを動かし、レンダリング結果（DOMツリー）に対して監査を行っています。テキストファイルとしてのHTMLソースコードを解析しているわけではないため、元ファイルの「何行目」という情報を持っていません。
代わりに、レポートに出力される **セレクタ（CSSセレクタ）** や **対象のソースコード（HTMLの断片）** の文字列をもとに、エディタで検索して該当箇所を特定してください。
