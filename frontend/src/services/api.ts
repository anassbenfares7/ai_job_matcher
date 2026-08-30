import axios from 'axios';
import Cookies from 'js-cookie';

// 1. Instantiate an isolated, structured API configuration pipeline
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // Safe 30-second cap to give long-running AI processes room to stream
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Attach the Dynamic Global Request Interceptor Guard
api.interceptors.request.use(
  (config) => {
    // 🚀 DYNAMIC LOOKUP: Always fetch the live cookie payload directly inside the interception block execution pass
    const token = Cookies.get('ai_job_matcher_token');

    // If a token is active in the browser, explicitly overwrite the Authorization bearer header block
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
