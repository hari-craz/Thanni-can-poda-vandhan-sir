import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function SuperAdminOverview() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getSystemStatus();
      setStatus(data);
    } catch (e) {
      console.error('Error fetching system status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Nodes', value: status?.total_devices || 0, unit: 'nodes', icon: 'hub', trend: 'Registered fleet' },
    { label: 'Active Nodes', value: status?.active_devices || 0, unit: 'online', icon: 'sensors', trend: 'Receiving signals' },
    { label: 'System Uptime', value: status?.uptime_seconds ? `${Math.floor(status.uptime_seconds / 3600)}h` : '—', unit: '', icon: 'schedule', trend: 'Uptime count' },
    { label: 'Security Transport', value: 'TLS 1.3', unit: '', icon: 'vpn_lock', trend: 'HTTPS (Cloudflare Tunnel)' },
  ];

  const services = [
    { name: 'PostgreSQL Database Server', status: status?.database_status || 'unknown', port: '5432' },
    { name: 'Redis Key-Value Cache', status: status?.cache_status || 'unknown', port: '6379' },
    { name: 'FastAPI Core Gateway', status: status?.backend_status || 'unknown', port: '8000' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Super Admin Overview</h2>
          <p className="text-on-surface-variant text-sm">Infrastructure health and system administration dashboard</p>
        </div>
        <button 
          className="px-6 py-2 bg-surface-container-lowest border border-border-subtle text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-surface-container transition-all"
          onClick={fetchStatus}
        >
          <span className="material-symbols-outlined text-sm">refresh</span> Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-surface-container-lowest border border-border-subtle p-6 rounded-lg shadow-sm flex flex-col gap-3 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-[64px]">{kpi.icon}</span>
            </div>
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">{kpi.label}</span>
            <h2 className="text-primary font-display-lg text-display-lg">
              {kpi.value} {kpi.unit && <small className="text-title-md font-normal text-on-surface-variant">{kpi.unit}</small>}
            </h2>
            <span className="text-label-sm text-outline">{kpi.trend}</span>
          </div>
        ))}
      </div>

      {/* System Services */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-subtle bg-surface-container">
          <h3 className="font-title-md text-title-md">System Services</h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {services.map((svc, i) => {
            const isUp = svc.status === 'healthy' || svc.status === 'connected';
            return (
              <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-status-nominal animate-pulse' : 'bg-status-critical'}`}></span>
                  <span className="font-bold text-sm">{svc.name}</span>
                </div>
                <div className="flex items-center gap-8 text-label-sm">
                  <span className={`font-bold ${isUp ? 'text-status-nominal' : 'text-status-critical'}`}>
                    {svc.status.toUpperCase()}
                  </span>
                  <span className="text-outline">Port {svc.port}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
