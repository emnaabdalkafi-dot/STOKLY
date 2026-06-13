/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_REVERB_HOST: string;
  readonly VITE_REVERB_PORT: string;
  readonly VITE_REVERB_SCHEME: string;
  readonly VITE_REVERB_APP_KEY: string;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}