interface ImportMetaEnv {
  /** Set to `off` to run the dev server against a real backend instead of MSW. */
  readonly VITE_API_MOCKING?: 'on' | 'off'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
