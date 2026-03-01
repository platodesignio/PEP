# Plato Event Proof Lab

ニューロモルフィックが必要になるイベント設計原理を証明可能な形で定義し、その性能を保証するデータを安全に蓄積し、公開後の運用まで破綻なく回る基盤。

## プライバシー設計原則

生データ（音声録音・映像録画・入力内容）はデフォルトで一切保存しない。
保存するのは低次特徴量系列（RMSエネルギー・動き量・入力リズム分散など）とイベントメタデータと介入評価のみ。
全フレーム解析・全録画・全録音は設計上禁止されている。
ユーザーが明示的に有効化した場合のみ最小限のスニペットを保存できるが、デフォルトは保存しない。

## 技術スタック

Next.js 14.2.14 / App Router / TypeScript 5.4 / PostgreSQL 16 / Prisma 5.15 / Vercel

## ローカル開発手順

```bash
# 1. 依存関係インストール
npm ci

# 2. PostgreSQL起動 (Docker)
docker compose up -d

# 3. 環境変数設定
cp .env.example .env
# .envを編集してDATABASE_URL等を設定

# 4. DBマイグレーション実行 (開発環境)
npm run db:migrate:dev

# 5. 管理者ユーザー作成
npm run db:seed

# 6. 開発サーバー起動
npm run dev
```

## 本番デプロイ手順 (Vercel)

```bash
# 1. Vercel CLIインストール
npm install -g vercel

# 2. Vercelプロジェクト初期化
vercel link

# 3. 環境変数設定 (Vercel Dashboard または CLI)
vercel env add DATABASE_URL        # Neon/Supabase等のPostgreSQL接続URL
vercel env add SESSION_SECRET      # openssl rand -base64 32 で生成
vercel env add ENCRYPTION_KEY      # openssl rand -base64 32 で生成 (32バイト必須)
vercel env add ADMIN_BOOTSTRAP_EMAIL  # 管理者メールアドレス
vercel env add APP_URL             # https://your-app.vercel.app
vercel env add RATE_LIMIT_WINDOW   # 60000 (ミリ秒)
vercel env add RATE_LIMIT_MAX      # 100

# 4. ビルドとデプロイ
vercel --prod

# 5. DBマイグレーション実行 (本番)
# prisma migrate deploy は prisma migrate dev と異なり開発用マイグレーションを作成しない
# 本番では必ず migrate deploy を使用する
DATABASE_URL="本番接続URL" npx prisma migrate deploy

# 6. 管理者ユーザー作成
DATABASE_URL="本番接続URL" ADMIN_BOOTSTRAP_EMAIL="admin@example.com" npm run db:seed
# 出力されるパスワードを安全な場所に保管し、初回ログイン後すぐに変更すること
```

## 環境変数詳細

| 変数名 | 必須 | 説明 |
|--------|------|------|
| DATABASE_URL | 必須 | PostgreSQL接続URL (sslmode=require推奨) |
| SESSION_SECRET | 必須 | JWT署名用秘密鍵 (32文字以上) |
| ENCRYPTION_KEY | 必須 | APIキー暗号化用鍵 (base64エンコードの32バイト) |
| ADMIN_BOOTSTRAP_EMAIL | 必須 | 初回管理者メールアドレス |
| APP_URL | 必須 | アプリURL (CSRF保護に使用) |
| RATE_LIMIT_WINDOW | 省略可 | レート制限ウィンドウ (ms) デフォルト60000 |
| RATE_LIMIT_MAX | 省略可 | ウィンドウ内最大リクエスト数 デフォルト100 |
| OPENAI_API_BASE | 省略可 | AI API ベースURL デフォルト未使用 |

ENCRYPTION_KEY生成コマンド:
```bash
openssl rand -base64 32
```

SESSION_SECRET生成コマンド:
```bash
openssl rand -base64 32
```

## DBマイグレーション運用

開発環境では `prisma migrate dev` を使用する。これは新しいマイグレーションファイルを生成する。

本番環境では `prisma migrate deploy` を使用する。これは既存のマイグレーションファイルのみを適用し、新しいファイルは生成しない。

マイグレーション失敗時の対処:
1. データベースの状態を確認: `npx prisma migrate status`
2. 失敗したマイグレーションを特定し、手動でロールバックまたは修正する
3. 修正後に `prisma migrate deploy` を再実行する

## バックアップ方針

Vercel PostgreSQL (Neon/Supabase等) はプラットフォーム側でバックアップを管理する。
アプリ側ではユーザーがエクスポートページから自分のデータをJSON/CSVでダウンロードできる。
エクスポートファイルにはeventSchemaVersionとdetectionConfigVersionが含まれ、第三者による検証が可能な形式で出力される。
運用者は定期的にエクスポートジョブを実行してバックアップとしてダウンロードすることを推奨する。

## ログ閲覧

管理者は `/admin` ページから以下を確認できる:
- ユーザー数・セッション数・イベント数・エラー数・フィードバック数
- 直近のエラーレポート (runId付き)
- 直近のフィードバック (runId付き)
- 監査ログ (認証・セッション作成・設定変更・エクスポート・削除)

管理者はユーザーの生データや入力内容にアクセスできない設計になっている。
不正利用対応のための最小限のメタ情報のみ閲覧可能。

## 運用上の失敗ケースと対処

**getUserMedia拒否・権限未許可**
マイクやカメラへのアクセスを拒否した場合、アプリは動作し続けるが取得できなかった特徴量はスキップされる。
セッション画面の「センサー状態」に現在の取得状況が常時表示される。
対処: ブラウザのサイト設定からマイク・カメラのアクセスを許可して再読み込みする。

**HTTPS未満での動作**
getUserMediaはHTTPS必須。HTTP環境ではマイク・カメラが取得できない。
対処: 必ずHTTPS環境にデプロイする。Vercelは自動でHTTPSを提供する。

**Safari制約**
Safariでは一部のWeb Audio APIが制限される場合がある。
AudioContextの初期化がユーザーインタラクション後に限られる場合がある。
対処: セッション開始ボタンクリック後に初期化するよう設計済み。取得できない場合はスキップ。

**音声デバイスなし・カメラなし**
デバイスが存在しない場合はgeMicrophone/cameraがunavailableと表示される。
入力行動特徴量のみでイベント判定を継続する。

**Web Worker無効**
一部のプライベートブラウジングモードでWorkerが使えない場合がある。
Worker初期化エラーはサーバーへエラーレポートとして送信される。
対処: プライベートブラウジングを解除するか、通常のブラウザウィンドウで使用する。

**オフライン**
セッション中にオフラインになった場合、イベントと介入データはクライアント側キューに保持される。
オンライン復帰時に自動で再送される。
セッション画面にオフライン状態が明示される。

**DB接続断**
Prismaの接続プールが枯渇またはDBが停止した場合、APIは500エラーを返す。
Vercel + Neon/Supabaseの場合は接続プールを適切に設定する (例: Neon serverless adapter使用)。
対処: DATABASE_URLのコネクションプール設定を確認し、必要に応じてPgBouncerを前段に配置する。

**Prisma migration失敗**
本番で `prisma migrate deploy` が失敗した場合、デプロイを中断してDBの状態を確認する。
`prisma migrate status` で適用状況を確認し、問題のあるマイグレーションを手動で修正する。
絶対に本番で `prisma migrate dev` を実行しない。

**SESSION_SECRET変更でセッション無効**
SESSION_SECRETを変更すると既存のセッションクッキーが全て無効になりユーザーは再ログインが必要になる。
計画的なシークレットローテーションを行う場合はメンテナンス時間に実施する。

**ENCRYPTION_KEY不一致でキー復号不能**
ENCRYPTION_KEYを変更すると既存の暗号化されたAPIキーが復号できなくなる。
キーを変更する場合はユーザーに事前通知しAPIキーの再登録を促す。
絶対にキーを紛失しないよう安全な場所に保管する (Vercel環境変数が推奨)。

**レート制限発火**
IP単位またはユーザーID単位でレート制限に達した場合、APIは429エラーを返す。
管理者はadminページでレート制限発火数を確認できる。
設定値はRATE_LIMIT_WINDOWとRATE_LIMIT_MAXで調整可能。

**エクスポート期限切れ**
エクスポートのダウンロードリンクは発行から1時間で期限切れになる。
期限切れの場合はエクスポートページから新しいエクスポートを作成する。

## テスト実行

```bash
# ユニットテスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト (ローカルサーバーが必要)
npm run dev &
npm run test:e2e
```

## CI

GitHub Actionsで以下が自動実行される:
- TypeScriptの型チェック
- ESLintによるlint
- ユニットテスト・統合テスト
- E2Eテスト (PostgreSQL serviceコンテナ使用)

## データエクスポート形式

JSONエクスポートにはユーザー・セッション・イベント・特徴量系列・介入・注釈・評価・A/B割り当てが含まれる。
CSVエクスポートはイベントのみで、runId・eventSchemaVersion・detectionConfigVersionが各行に含まれる。
これにより同じ特徴量系列に対して別の閾値を適用して検証する再計算が可能。

## セキュリティ

パスワードはbcrypt (cost=12) でハッシュ化。
APIキーはAES-256-GCMで暗号化してDBに保存。
セッションはHS256署名のJWTをhttpOnly/Secure/SameSite=StrictのCookieで管理。
CSRF保護はSameSite=StrictクッキーとOriginヘッダー検証の二重防御。
CSPヘッダーで外部スクリプトの読み込みを制限。
レート制限はIPベースとユーザーIDベースを併用。
入力はZodで検証しSQLiとXSSを防御。
全ての監査操作はAuditLogテーブルに記録。
