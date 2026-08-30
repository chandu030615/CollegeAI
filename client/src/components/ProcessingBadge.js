import React from 'react';

export default function ProcessingBadge({ status }) {
  const styles = {
    UPLOADED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PROCESSING: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
    PROCESSED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  const labels = {
    UPLOADED: 'Uploaded',
    PROCESSING: 'Processing...',
    PROCESSED: 'Processed & Indexed',
    FAILED: 'Failed'
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.UPLOADED}`}>
      {labels[status] || status}
    </span>
  );
}
