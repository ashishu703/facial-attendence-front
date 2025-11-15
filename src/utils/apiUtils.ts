import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';

// Create axios instance with default config
export const createApiClient = (token: string): AxiosInstance => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// Common error handler
export const handleApiError = (error: any, defaultMessage: string = 'Operation failed'): string => {
  return error.response?.data?.message || error.message || defaultMessage;
};

