import React from 'react';

export default function StatCard({ title, value, icon: Icon, description, color = 'indigo' }) {
  const colorStyles = {
    indigo: 'from-indigo-500/20 to-purple-500/10 text-indigo-400 border-indigo-500/30',
    emerald: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
    amber: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
    rose: 'from-rose-500/20 to-pink-500/10 text-rose-400 border-rose-500/30'
  };

  return (
    <div className="glass-card p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorStyles[color]} border flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div>
        <div className="text-3xl font-extrabold text-white tracking-tight">{value}</div>
        {description && (
          <p className="text-xs text-gray-400 mt-1 font-medium">{description}</p>
        )}
      </div>
    </div>
  );
}
