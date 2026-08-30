const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');
const { sendSuccess } = require('./utils/response');

const env = require('./config/env');

const app = express();

// Production CORS Configuration
// Uses env.allowedOrigins which is parsed from CLIENT_URL (comma-separated).
// http://localhost:3000 is always included for local development.
const allowedOrigins = env.allowedOrigins;

console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g., server-to-server, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    // Check if the request origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Reject all other origins
    console.warn('[CORS] Blocked origin:', origin);
    return callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  return sendSuccess(res, {
    status: 'UP',
    message: 'CollegeAI RAG Backend Operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res, next) => {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.url}`
    }
  });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
