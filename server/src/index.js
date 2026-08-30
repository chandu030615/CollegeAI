const app = require('./app');
const env = require('./config/env');

const PORT = env.port;

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CollegeAI RAG Backend Server Running on Port ${PORT}`);
  console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
