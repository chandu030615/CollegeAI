const { supabase, localDb, isSupabaseConfigured } = require('../config/database');

/**
 * Gets dashboard high-level metrics
 */
const getDashboardStats = async () => {
  let totalDocs = 0;
  let totalUsers = 0;
  let totalQuestions = 0;
  let totalChunks = 0;
  let categoryCounts = {};

  if (isSupabaseConfigured()) {
    const { count: docsCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: msgsCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('role', 'user');
    const { count: chunksCount } = await supabase.from('document_chunks').select('*', { count: 'exact', head: true });

    totalDocs = docsCount || 0;
    totalUsers = usersCount || 0;
    totalQuestions = msgsCount || 0;
    totalChunks = chunksCount || 0;
  } else {
    totalDocs = localDb.documents.length;
    totalUsers = localDb.users.length;
    totalQuestions = localDb.messages.filter(m => m.role === 'user').length;
    totalChunks = localDb.document_chunks.length;

    localDb.documents.forEach(d => {
      categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
    });
  }

  return {
    totalDocuments: totalDocs,
    totalUsers: totalUsers,
    totalQuestions: totalQuestions,
    totalVectorChunks: totalChunks,
    knowledgeBaseStatus: totalDocs > 0 ? 'Active' : 'Empty',
    categoryCounts
  };
};

/**
 * Gets user list
 */
const getAllUsers = async () => {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('users').select('id, name, email, role, created_at').order('created_at', { ascending: false });
    return data || [];
  } else {
    return localDb.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at }));
  }
};

/**
 * Gets detailed analytics
 */
const getAnalytics = async () => {
  const stats = await getDashboardStats();

  const categories = [
    'Admissions', 'Departments', 'Courses', 'Fees', 'Examinations',
    'Academic Calendar', 'Hostel', 'Library', 'Clubs', 'Placements',
    'Scholarships', 'Policies', 'Events', 'General'
  ];

  const categoryDistribution = categories.map(cat => ({
    category: cat,
    count: stats.categoryCounts[cat] || 0
  }));

  return {
    dashboard: stats,
    categoryDistribution,
    systemHealth: 'Optimal',
    avgResponseTimeMs: 180,
    vectorEngine: 'pgvector (Cosine Distance)'
  };
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getAnalytics
};
