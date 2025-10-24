// Application configuration
export const config = {
  appName: 'AMS Web',
  apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  environment: import.meta.env.MODE || 'development',
};

export default config;
