const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Parse a comma-separated list of frontend origins from CLIENT_URL / FRONTEND_URL.
 * Always includes http://localhost:3000 so local dev works without extra config.
 */
function parseAllowedOrigins() {
  const raw = process.env.CLIENT_URL || process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Ensure localhost is always present for local development
  if (!origins.includes('http://localhost:3000')) {
    origins.push('http://localhost:3000');
  }
  return origins;
}

const allowedOrigins = parseAllowedOrigins();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Array of allowed frontend origins for CORS
  allowedOrigins,
  // Legacy single-value clientUrl kept for backward compatibility
  clientUrl: allowedOrigins[0] || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'collegeai-dev-jwt-secret-key-2026',
  llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
  embeddingApiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  vectorTable: process.env.VECTOR_TABLE || 'document_chunks',
  topK: parseInt(process.env.TOP_K || '5', 10),
  chunkSize: parseInt(process.env.CHUNK_SIZE || '800', 10),
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '150', 10),
  relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD || '0.1')
};
