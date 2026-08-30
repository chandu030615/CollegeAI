const app = require('./app');
const env = require('./config/env');

// Render (and most PaaS platforms) inject PORT via environment.
// Never hard-code port in production.
const PORT = process.env.PORT || env.port || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 CollegeAI RAG Backend Server Running`);
  console.log(`   Port     : ${PORT}`);
  console.log(`   Env      : ${env.nodeEnv}`);
  console.log(`   Health   : /api/health`);
  console.log(`   Auth     : POST /api/auth/register`);
  console.log(`   Auth     : POST /api/auth/login`);
  console.log(`   DB       : ${env.supabaseUrl ? 'Supabase configured' : 'In-memory fallback'}`);
  console.log('====================================================');
});

server.on('error', (err) => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
  // Do NOT exit — let individual promises fail gracefully
});
