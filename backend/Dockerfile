FROM php:8.4-fpm

# システムの依存関係をインストール
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libsqlite3-dev

# キャッシュをクリア
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# PHP 拡張機能をインストール
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd pdo_sqlite

# 最新の Composer を取得
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 作業ディレクトリを設定
WORKDIR /var/www

# コンテナ起動時に実行するコマンド（デフォルトは php-fpm）
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
