/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUZZ_RELAY_WS?: string;
  readonly VITE_BUZZ_RELAY_AUTH_URL?: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
