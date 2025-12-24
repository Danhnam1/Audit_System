// API client configuration
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

// Get base URL from environment variable or use default
// URL should be: https://moca.mom/api (NO port 80 for HTTPS)
const getBaseURL = () => {
  let url = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api';
  
  // If URL is relative (starts with /), convert to absolute
  // Browser will resolve relative URLs based on current page URL, which may include port 80
  if (url.startsWith('/')) {
    // Force absolute URL for production
    url = 'https://moca.mom/api';
  }
  
  // Remove port 80 from HTTPS URLs (HTTPS uses port 443 by default, not 80)
  if (url.startsWith('https://') && url.includes(':80')) {
    url = url.replace(':80', '');
  }
  
  // Ensure URL is absolute (starts with http:// or https://)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://moca.mom/api';
  }
  
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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Normalize URL: remove port 80 from HTTPS URLs
    if (config.baseURL) {
      if (config.baseURL.startsWith('https://') && config.baseURL.includes(':80')) {
        config.baseURL = config.baseURL.replace(':80', '');
      }
    }
    
    // Normalize request.url if it's absolute
    if (config.url && (config.url.startsWith('http://') || config.url.startsWith('https://'))) {
      if (config.url.startsWith('https://') && config.url.includes(':80')) {
        config.url = config.url.replace(':80', '');
      }
    }
    
    // Log full URL for debugging
    if (config.baseURL && config.url) {
      const fullUrl = config.url.startsWith('http') ? config.url : config.baseURL + config.url;
     
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
