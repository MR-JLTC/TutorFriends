import axios from 'axios';
import { getActiveToken, getRoleForContext, clearRoleAuth } from '../utils/authRole';

// The base URL for your NestJS backend
// Priority: VITE_BACKEND_URL (production) > VITE_BACKEND_LAPTOP_IP (local/ngrok) > localhost
// const BACKEND_URL = import.meta.env.VITE_BACKEND_URL 
//   || import.meta.env.VITE_BACKEND_LAPTOP_IP 
//   || 'localhost'

const BACKEND_URL = import.meta.env.VITE_BACKEND_SERVER_URL;

// Check if BACKEND_URL is already a full URL or just a hostname
const isFullUrl = BACKEND_URL.startsWith('http://') || BACKEND_URL.startsWith('https://');
const backendBase = isFullUrl
  ? BACKEND_URL
  : `http://${BACKEND_URL}:3000`;
const API_BASE_URL = `${backendBase}/api`;
const API_ORIGIN = API_BASE_URL.replace(/\/?api$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 second timeout
  // Do not set a global Content-Type header so multipart/form-data requests
  // can let the browser/axios set the correct boundary automatically.
  headers: {},
  validateStatus: function (status) {
    // Reject 4xx and 5xx status codes (client and server errors) so they go to the error handler
    // Only treat 2xx and 3xx as successful responses
    return status >= 200 && status < 400;
  }
});

// Add a request interceptor to include the token in every request
apiClient.interceptors.request.use(
  (config) => {
    const token = getActiveToken();
    const requestUrl = config.url || '';

    // Check if this is an auth endpoint (login, register, password reset, etc.)
    const isAuthEndpoint = requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/login-tutor-tutee') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    // Check if this is a public endpoint that doesn't require authentication
    // Public endpoints: landing stats, and GET /universities (list all universities)
    const normalizedUrl = requestUrl.split('?')[0]; // Remove query params for comparison
    const isPublicEndpoint = normalizedUrl.includes('/landing/stats') ||
      normalizedUrl === '/universities' ||
      normalizedUrl.endsWith('/universities'); // Only GET /universities list, not nested routes

    if (token) {
      // Always add token if available
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Removed aggressive redirect to login from request interceptor to prevent race conditions during app boot.
    // Redirection is handled by ProtectedRoute component.
    // If no token but it's an auth or public endpoint, allow the request to proceed
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add logging for the request payload and response
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', {
      method: config.method,
      url: config.url,
      data: config.data,
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      method: response.config.method,
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Response Error:', {
      method: error.config?.method,
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and network issues
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses for debugging
    console.log(`API Response [${response.config.method?.toUpperCase()}] ${response.config.url}:`, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Network error (no response from server)
    if (!error.response) {
      console.error('Network Error:', error.message, 'Code:', error.code);
      // Preserve the original error code (like ERR_CONNECTION_TIMED_OUT)
      const errorCode = error.code || error.message?.match(/ERR_\w+/)?.[0];
      return Promise.reject({
        ...error, // Preserve original error properties including code
        code: error.code || errorCode, // Ensure code is preserved
        response: {
          data: {
            message: 'Unable to connect to the server. Please check your internet connection.'
          },
          status: undefined // Mark as network error by not having a status
        },
        isNetworkError: true // Flag to identify network errors
      });
    }

    // Log error responses for debugging
    console.error(`API Error [${error.config?.method?.toUpperCase()}] ${error.config?.url}:`, {
      status: error.response?.status,
      data: error.response?.data,
      error: error.message
    });

    const status = error?.response?.status;
    const rawMessage: any = error?.response?.data?.message;
    const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;

    // Skip Toast messages for authentication endpoints and tutor ID lookup - let the pages handle their own error display
    const reqUrl: string | undefined = error?.config?.url;
    // Check both the relative URL and full URL to ensure we catch auth endpoints correctly
    const fullUrl = error?.config?.baseURL ? `${error.config.baseURL}${reqUrl || ''}` : reqUrl || '';
    const urlToCheck = (reqUrl || '') + ' ' + fullUrl;
    const isAuthEndpoint = urlToCheck.includes('/auth/login') ||
      urlToCheck.includes('/auth/register') ||
      urlToCheck.includes('/auth/login-tutor-tutee') ||
      urlToCheck.includes('/auth/forgot-password') ||
      urlToCheck.includes('/auth/reset-password') ||
      urlToCheck.includes('/auth/email-verification');
    const isTutorIdEndpoint = reqUrl?.includes('/tutors/by-user/') && reqUrl?.includes('/tutor-id');
    const isCoursesEndpoint = reqUrl?.includes('/courses');

    const suppressByMessage = typeof rawMessage === 'string' && rawMessage.toLowerCase().includes('tutor not found');
    if (notify && !isAuthEndpoint && !isTutorIdEndpoint && !isCoursesEndpoint && !suppressByMessage) {
      let display = Array.isArray(rawMessage) ? rawMessage.join(', ') : (rawMessage as string | undefined);
      if (typeof display === 'string' && display.toLowerCase().includes('email already registered')) {
        display = 'Email already registered';
      }
      if (!display) {
        display = status === 401 ? 'You are not authorized.' : 'Something went wrong. Please try again.';
      }
      notify(display, 'error');
    }

    if (status === 401) {
      // Never redirect on auth endpoint errors - let the login pages handle the error display
      // Also don't redirect if we're already on a login page or public page to prevent navigation loops
      const currentPath = window.location.pathname.toLowerCase();
      const isOnLoginPage = currentPath === '/login' ||
        currentPath === '/admin-login' ||
        currentPath.includes('/password-reset');
      const isOnPublicPage = currentPath.includes('/landingpage') ||
        currentPath.includes('/tuteeregistrationpage') ||
        currentPath.includes('/tutorregistrationpage');

      if (!isAuthEndpoint && !isOnLoginPage && !isOnPublicPage) {
        const role = getRoleForContext();
        if (role) {
          clearRoleAuth(role);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Let the application state (AuthContext) handle the logout and redirection
        // instead of a hard browser redirect which causes page reloads and lost state.
        console.warn('API 401 Unauthorized - user logged out, dispatching event');

        // Dispatch custom event so AuthContext can sync state immediately
        window.dispatchEvent(new Event('auth:unauthorized'));
      } else {
        console.warn('API 401 received but no logout triggered:', { isAuthEndpoint, isOnLoginPage, isOnPublicPage });
      }
      // For auth endpoints or when already on a login/public page, do not redirect
      // The error will be caught and displayed by the login page component
    }
    // Forward the error so it can be handled by the calling component
    return Promise.reject(error);
  }
);


export default apiClient;

export const getFileUrl = (path: string | undefined | null): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  // Profile images are served directly at /user_profile_images/ without /api prefix
  if (path.startsWith('/user_profile_images/') || path.startsWith('user_profile_images/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }

  // Admin QR images are served directly at /admin_qr/ without /api prefix
  if (path.startsWith('/admin_qr/') || path.startsWith('admin_qr/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }

  // Files are served directly at /tutor_documents/ without /api prefix
  if (path.startsWith('/tutor_documents/') || path.startsWith('tutor_documents/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }

  // For other files, use the standard path
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalized}`;
};
