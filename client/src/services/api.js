import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('collegeai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Extract Data or Error
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorResponse = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Unable to connect to CollegeAI backend server.'
    };
    return Promise.reject(errorResponse);
  }
);

// Auth Services
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me')
};

// Chat Services
export const chatApi = {
  sendMessage: (message, conversationId) => api.post('/chat', { message, conversationId }),
  getHistory: () => api.get('/chat/history'),
  getConversation: (id) => api.get(`/chat/${id}`),
  deleteConversation: (id) => api.delete(`/chat/${id}`)
};

// Document Services (Admin)
export const documentApi = {
  uploadDocument: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getDocuments: (category) => api.get('/documents', { params: { category } }),
  getDocumentById: (id) => api.get(`/documents/${id}`),
  deleteDocument: (id) => api.delete(`/documents/${id}`),
  processDocument: (id) => api.post(`/documents/${id}/process`)
};

// Admin Services
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: () => api.get('/admin/users'),
  getAnalytics: () => api.get('/admin/analytics')
};

export default api;
