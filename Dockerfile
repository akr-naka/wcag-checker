FROM node:20-slim

# Chromium ヘッドレスモードに必要な依存パッケージをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Chromium のパスを環境変数に設定
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Pa11y と HTMLレポーター をグローバルインストール
RUN npm install -g pa11y pa11y-reporter-html

# 設定ファイルとレポーターをコピー
COPY config/pa11y-config.json /app/config/pa11y-config.json
COPY scripts/reporter.js /app/scripts/reporter.js

# レポート出力ディレクトリ
RUN mkdir -p /app/reports

COPY scripts/entrypoint.sh /app/scripts/entrypoint.sh
RUN chmod +x /app/scripts/entrypoint.sh

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
