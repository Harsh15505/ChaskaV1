import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Unique app identifier — used as Android package name
  appId: "com.chaska.pos",
  appName: "Chaska Punjabi",
  // Next.js static export goes into out/
  webDir: "out",
  android: {
    // Allow cleartext (HTTP) traffic on LAN if needed for dev
    allowMixedContent: true,
  },
  server: {
    // On Android, the app uses the bundled static files
    // Remove this block before building production APK
    // (it's here only to help during local dev if needed)
    androidScheme: "https",
  },
};

export default config;
