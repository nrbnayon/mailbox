// src\lib\env.ts
export const env = {
  apiUrl: import.meta.env.VITE_API_URL,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
} as const;

// Type checking for required environment variables
const requiredEnvVars = ['VITE_API_URL', 'VITE_GOOGLE_CLIENT_ID', 'VITE_MICROSOFT_CLIENT_ID'];

requiredEnvVars.forEach(envVar => {
  if (!import.meta.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});