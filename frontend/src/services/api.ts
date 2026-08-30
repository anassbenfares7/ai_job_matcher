import axios from 'axios';
import Cookies from 'js-cookie';

// 1. Instantiate our isolated, structured API configuration tunnel
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  // 🚀 INCREASE THIS BOUND: Raise to 30 seconds to allow comprehensive AI generation streams to finish
  timeout: 30000, 
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
