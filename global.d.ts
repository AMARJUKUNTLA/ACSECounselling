
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}

interface Window {
  XLSX: any;
  process: {
    env: {
      API_KEY: string;
    }
  }
}
