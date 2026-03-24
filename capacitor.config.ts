import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hftransportes.app',
  appName: 'HF Transportes',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
