import axios from 'axios';
import Cookies from 'js-cookie';

// 1. Instantiate our isolated, structured API configuration tunnel
export const api = axios.create({
  // Point to our Express backend engine port
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 15000, // Timeout requests after 15 seconds to prevent frozen UI states during heavy RAG operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Attach the Global Request Interceptor Guard
api.interceptors.request.use(
  (config) => {
    // Look up our stateless application session token out of the secure cookie vault
    const token = Cookies.get('ai_job_matcher_token');

    // If a token exists, smoothly bind the official standard Bearer authorization protocol header
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // Gracefully route request intercept line errors directly down to global UI promise catchers
    return Promise.reject(error);
  }
);
