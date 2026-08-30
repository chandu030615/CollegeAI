// Log environment immediately on startup for Render deployment debugging
console.log('[Startup] process.env.PORT =', process.env.PORT);
console.log('[Startup] NODE_ENV =', process.env.NODE_ENV);

const app = require('./app');
console.log('[DEBUG] Loaded app from:', require.resolve('./app'));
console.log('[DEBUG] Health route registered:', !!app._router);
const env = require('./config/env');

// Render injects PORT as an environment variable.
// We must use process.env.PORT directly — do NOT fall back to 5000 on Render.
const PORT = process.env.PORT || 5000;

console.log('[Startup] Binding to port:', PORT);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`CollegeAI RAG Backend Server Running`);
  console.log(`   Port     : ${PORT}`);
  console.log(`   Env      : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health   : GET /api/health`);
  console.log(`   Register : POST /api/auth/register`);
  console.log(`   Login    : POST /api/auth/login`);
  console.log(`   Supabase : ${process.env.SUPABASE_URL ? 'configured' : 'not configured (using in-memory)'}`);
  console.log('====================================================');
});

server.on('error', (err) => {
  console.error('[Server] FATAL - Failed to start on port', PORT, ':', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received - shutting down gracefully');
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});
