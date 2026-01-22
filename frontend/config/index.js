// Auto-detect API URL based on environment
function getApiBaseUrl() {
  // First, check if explicitly set via environment variable (best practice for production)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // In browser (client-side), detect from hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Staging environment - API is on same domain under /api path
    if (hostname === 'staging.saino365.com' || hostname.includes('staging')) {
      return `${protocol}//${hostname}/api`;
    }
    
    // Production environment - API is on same domain under /api path
    if (hostname === 'jobfinder.saino365.com' || hostname === 'saino365.com' || hostname.includes('jobfinder')) {
      return `${protocol}//${hostname}/api`;
    }
  }
  
  // For SSR, we can't detect hostname, so use relative path if in production-like environment
  // This assumes API is on same domain with /api path (via reverse proxy)
  // For local development, default to localhost
  if (process.env.NODE_ENV === 'production') {
    // In production SSR, use relative path (will be resolved to current domain)
    return '/api';
  }
  
  // Default to localhost for development
  return 'http://localhost:3030';
}

export const API_BASE_URL = getApiBaseUrl();
export const APP_NAME = 'Job Finder';
export const PAGE_SIZES = { home: 8 };

