// frontend .env
export const env = {
  apiUrl: import.meta.env.VITE_API_URL,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
} as const;

// Type checking for required environment variables
const requiredEnvVars = [
  "VITE_API_URL",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_MICROSOFT_CLIENT_ID",
];

// Check for missing environment variables
for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

