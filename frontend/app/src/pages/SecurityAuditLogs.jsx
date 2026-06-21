import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function SecurityAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const limit = 10;

  const formatToIST = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getActionClass = (action) => {
    if (!action) return 'border-primary text-primary';
    const upper = action.toUpperCase();
    if (upper.includes('DELETE') || upper.includes('CLOSE') || upper.includes('CRITICAL') || upper.includes('ANOMALY') || upper.includes('REMOVE')) {
      return 'border-status-critical text-status-critical';
    }
    if (upper.includes('CREATE') || upper.includes('ACKNOWLEDGE') || upper.includes('LOGIN') || upper.includes('OPEN') || upper.includes('SUCCESS') || upper.includes('NOMINAL')) {
      return 'border-status-nominal text-status-nominal';
    }
    return 'border-primary text-primary';
  };

  const getResourceText = (log) => {
    if (log.resource_type && log.resource_id) {
      return `${log.resource_type} (${log.resource_id})`;
    }
    return log.resource_id || log.resource_type || '—';
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const skip = (currentPage - 1) * limit;
      const res = await api.getAuditLogs(skip, limit);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
      setError(e.message || 'Failed to load security audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage]);

  const handleExportLogs = async () => {
    try {
      setExporting(true);
      // Fetch up to 1000 logs for export
      const res = await api.getAuditLogs(0, 1000);
      const allLogs = res.logs || [];
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `security_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error("Export logs failed", e);
      alert("Failed to export logs: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const renderPagination = () => {
    const pages = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    return (
      <div className="flex items-center gap-1">
        <button 
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          className={`px-2 h-8 border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center bg-surface-container-lowest transition-colors ${
            currentPage === 1 
              ? 'border-border-subtle text-outline-variant cursor-not-allowed opacity-50' 
              : 'border-border-subtle hover:border-on-surface text-on-surface'
          }`}
        >
          Prev
        </button>

        {startPage > 1 && (
          <>
            <button 
              onClick={() => setCurrentPage(1)}
              className={`w-8 h-8 border text-[10px] font-bold flex items-center justify-center transition-colors ${
                currentPage === 1 
                  ? 'border-on-surface bg-on-surface text-surface-container-lowest' 
                  : 'border-border-subtle bg-surface-container-lowest hover:border-on-surface text-on-surface'
              }`}
            >
              1
            </button>
            {startPage > 2 && <span className="px-1 text-[10px] font-bold text-outline">...</span>}
          </>
        )}

        {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
          const page = startPage + i;
          return (
            <button 
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 border text-[10px] font-bold flex items-center justify-center transition-colors ${
                currentPage === page 
                  ? 'border-on-surface bg-on-surface text-surface-container-lowest' 
                  : 'border-border-subtle bg-surface-container-lowest hover:border-on-surface text-on-surface'
              }`}
            >
              {page}
            </button>
          );
        })}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-1 text-[10px] font-bold text-outline">...</span>}
            <button 
              onClick={() => setCurrentPage(totalPages)}
              className={`w-8 h-8 border text-[10px] font-bold flex items-center justify-center transition-colors ${
                currentPage === totalPages 
                  ? 'border-on-surface bg-on-surface text-surface-container-lowest' 
                  : 'border-border-subtle bg-surface-container-lowest hover:border-on-surface text-on-surface'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button 
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage(currentPage + 1)}
          className={`px-2 h-8 border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center bg-surface-container-lowest transition-colors ${
            currentPage === totalPages || totalPages === 0
              ? 'border-border-subtle text-outline-variant cursor-not-allowed opacity-50' 
              : 'border-border-subtle hover:border-on-surface text-on-surface'
          }`}
        >
          Next
        </button>
      </div>
    );
  };

  const startRecord = (currentPage - 1) * limit + 1;
  const endRecord = Math.min(currentPage * limit, total);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Security Audit Logs</h2>
          <p className="text-on-surface-variant text-sm">Immutable, read-only record of all system actions and events</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 border border-border-subtle bg-surface-container-lowest text-label-sm font-bold hover:bg-surface-container transition-all flex items-center gap-2"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span> Refresh
          </button>
          <button 
            onClick={handleExportLogs}
            disabled={exporting}
            className="px-6 py-2 border border-border-subtle bg-surface-container-lowest text-label-sm font-bold hover:bg-surface-container transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">{exporting ? 'sync' : 'download'}</span> Export Logs
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-status-critical/10 border border-status-critical/30 p-4 text-sm text-status-critical rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
          <h3 className="font-bold text-sm uppercase tracking-widest">Event Log</h3>
          <span className="text-[10px] font-bold text-outline uppercase">
            {loading ? 'Loading...' : `Total • ${total} events`}
          </span>
        </div>
        <div className="overflow-x-auto">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-outline">
              <span className="material-symbols-outlined text-[48px] mb-2 opacity-30">history_toggle_off</span>
              <p className="font-bold">No security events found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-widest text-on-primary bg-on-surface">
                  <th className="px-6 py-4">Timestamp (IST)</th>
                  <th className="px-6 py-4">Actor</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Resource</th>
                  <th className="px-6 py-4">Source IP</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-3 text-outline">{formatToIST(log.created_at)}</td>
                    <td className="px-6 py-3">{log.user_id || 'system'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded ${getActionClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-on-surface-variant">{getResourceText(log)}</td>
                    <td className="px-6 py-3 text-outline">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && total > 0 && (
          <div className="p-4 bg-surface-container flex justify-between items-center text-[10px] font-bold text-outline border-t border-border-subtle">
            <p className="uppercase tracking-widest">
              Showing {startRecord}-{endRecord} of {total} events
            </p>
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
}
