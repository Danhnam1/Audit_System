// API client configuration
import axios from 'axios';

// Get base URL from environment variable or use default
// URL should be: https://moca.mom/api (NO port 80 for HTTPS)
const getBaseURL = () => {
  let url = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api';
  
  // If URL is relative (starts with /), convert to absolute
  // Browser will resolve relative URLs based on current page URL, which may include port 80
  if (url.startsWith('/')) {
    // Force absolute URL for production
    url = 'https://moca.mom/api';
    console.warn('[apiClient] Detected relative URL, converted to absolute:', url);
  }
  
  // Remove port 80 from HTTPS URLs (HTTPS uses port 443 by default, not 80)
  if (url.startsWith('https://') && url.includes(':80')) {
    url = url.replace(':80', '');
    console.warn('[apiClient] Removed :80 from baseURL, normalized to:', url);
  }
  
  // Ensure URL is absolute (starts with http:// or https://)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://moca.mom/api';
    console.warn('[apiClient] URL is not absolute, using default:', url);
  }
  
  console.log('[apiClient] Base URL:', url);
  return url;
};

const apiClient = axios.create({
  // Support both VITE_API_URL and legacy VITE_API_BASE_URL environment keys
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Normalize URL: remove port 80 from HTTPS URLs
    if (config.baseURL) {
      if (config.baseURL.startsWith('https://') && config.baseURL.includes(':80')) {
        config.baseURL = config.baseURL.replace(':80', '');
        console.log('[apiClient] Removed :80 from baseURL:', config.baseURL);
      }
    }
    
    // Normalize request.url if it's absolute
    if (config.url && (config.url.startsWith('http://') || config.url.startsWith('https://'))) {
      if (config.url.startsWith('https://') && config.url.includes(':80')) {
        config.url = config.url.replace(':80', '');
        console.log('[apiClient] Removed :80 from url:', config.url);
      }
    }
    
    // Log full URL for debugging
    if (config.baseURL && config.url) {
      const fullUrl = config.url.startsWith('http') ? config.url : config.baseURL + config.url;
      console.log('[apiClient] Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullUrl: fullUrl,
      });
      if (fullUrl.includes(':80')) {
        console.warn('[apiClient] WARNING: Full URL still contains :80:', fullUrl);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors globally
    return Promise.reject(error);
  }
);

export default apiClient;
