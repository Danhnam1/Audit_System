// Application configuration
const getApiUrl = () => {
  let url = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api';
  
  // If URL is relative (starts with /), convert to absolute
  if (url.startsWith('/')) {
    url = 'https://moca.mom/api';
    console.warn('[config] Detected relative URL, converted to absolute:', url);
  }
  
  // Remove port 80 from HTTPS URLs
  if (url.startsWith('https://') && url.includes(':80')) {
    url = url.replace(':80', '');
    console.warn('[config] Removed :80 from baseURL, normalized to:', url);
  }
  
  // Ensure URL is absolute
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://moca.mom/api';
    console.warn('[config] URL is not absolute, using default:', url);
  }
  
  console.log('[config] API URL:', url);
  return url;
};

export const config = {
  appName: 'AMS Web',
  apiUrl: getApiUrl(),
  environment: import.meta.env.MODE || 'development',
};

export default config;
