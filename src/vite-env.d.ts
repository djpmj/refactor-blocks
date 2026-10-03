/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AI講評のプロキシ(Cloudflare Workers)のURL。未設定なら講評は呼び出せずエラーになる。 */
  readonly VITE_CRITIQUE_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
