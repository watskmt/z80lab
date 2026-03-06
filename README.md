# Z80 LAB - Z80 Emulator and Learning Tool

Z80命令の実行、メモリマップドIO、標準IOをシミュレートできる学習用エミュレータです。

## 主な機能
- **Z80エミュレーション**: 主要な命令セットをサポート。
- **I/Oパネル**: 
  - 出力ランプ (Port 0 / 0x8000)
  - 入力スイッチ (Port 1 / 0x8001)
  - MMIOとStandard IOの表示切り替え。
- **AIサンプル生成**: ChatGPT (OpenAI API) を使用して、やりたいことからZ80アセンブリコードを自動生成。

## AIサンプル生成の使い方
1. エディタ下の「AI Sample Generator」パネルにある歯車アイコンをクリック。
2. OpenAIのAPIキーを入力（ブラウザのlocalStorageに保存されます）。
3. テキストボックスに「スイッチの状態をランプにコピーするループ」などのやりたい内容を入力。
4. 「GENERATE & LOAD」ボタンを押すと、コードが生成され、エミュレータにロードされます。

## 開発環境のセットアップ (Docker)

バックエンドの開発環境を Docker を使用して起動できます。

### 1. 準備
`backend/` ディレクトリ内に `.env` ファイルを作成し、必要な設定（OpenAI API キーなど）を行ってください。
```bash
cp backend/.env.example backend/.env
```

### 2. 起動
プロジェクトのルートディレクトリで以下のコマンドを実行します。
```bash
docker-compose up -d
```

### 3. 初期設定
コンテナ内で依存関係のインストールやデータベースのマイグレーションを行います。
```bash
docker-compose exec backend composer install
docker-compose exec backend php artisan key:generate
docker-compose exec backend touch database/database.sqlite
docker-compose exec backend php artisan migrate
```

バックエンド API は `http://localhost:8000` で起動します。
フロントエンドの AI Generator 設定でこの URL を指定してください。

## デバッグ方法

### VS Code
VS Code を使用してフロントエンドとバックエンドをデバッグするための設定が含まれています。

1. **フロントエンドの起動**: `npm run dev` で開発サーバーを起動します (http://localhost:5173)。
2. **バックエンドの起動**: `docker-compose up -d` でバックエンドを起動します (http://localhost:8000)。
3. **デバッグの開始**: VS Code の「実行とデバッグ」パネルから「Launch Chrome against localhost」を選択してデバッグを開始します。

### IntelliJ IDEA
IntelliJ IDEA 用の実行構成（Run Configurations）が `.run` ディレクトリに含まれています。

1. **Backend (Docker Compose)**: バックエンドのコンテナを起動します。
2. **Frontend (Vite)**: フロントエンドの開発サーバーを起動します。
3. **Debug Frontend (Chrome)**: フロントエンドの開発サーバーを起動し、ブラウザデバッガをアタッチします。

## フロントエンドの起動
フロントエンドはローカルの Node.js 環境で起動します。
```bash
npm install
npm run dev
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
