// Application configuration
const getApiUrl = () => {
  let url = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api';
  
  // If URL is relative (starts with /), convert to absolute
  if (url.startsWith('/')) {
    url = 'https://moca.mom/api';
  }
  
  // Remove port 80 from HTTPS URLs
  if (url.startsWith('https://') && url.includes(':80')) {
    url = url.replace(':80', '');
  }
  
  // Ensure URL is absolute
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://moca.mom/api';
  }
  
  return url;
};

export const config = {
  appName: 'AMS Web',
  apiUrl: getApiUrl(),
  environment: import.meta.env.MODE || 'development',
};

export default config;
