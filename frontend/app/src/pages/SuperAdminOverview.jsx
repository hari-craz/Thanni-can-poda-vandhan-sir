import { useState, useEffect } from 'react';
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();
    // Poll every 5 seconds for instantaneous live user and metric updates
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (seconds === undefined || seconds === null) return '—';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const formatLastActive = (timestamp) => {
    if (!timestamp) return 'unknown';
    // eslint-disable-next-line react-hooks/purity
    const diffSec = Math.floor(Date.now() / 1000 - timestamp);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return '1h+ ago';
  };

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
    { label: 'System Uptime', value: formatUptime(status?.uptime_seconds), unit: '', icon: 'schedule', trend: 'Uptime count' },
    { label: 'Security Transport', value: 'TLS 1.3', unit: '', icon: 'vpn_lock', trend: 'HTTPS (Cloudflare Tunnel)' },
  ];

  const services = [
    { name: 'PostgreSQL Database Server', status: status?.database_status || 'unknown', port: '5432' },
    { name: 'Redis Key-Value Cache', status: status?.cache_status || 'unknown', port: '6379' },
    { name: 'FastAPI Core Gateway', status: status?.backend_status || 'unknown', port: '8000' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
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

      {/* KPI Stats Cards */}
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

      {/* Services and Resource Monitor Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* System Services Card */}
        <div className="lg:col-span-6 bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border-subtle bg-surface-container">
            <h3 className="font-title-md text-title-md">System Services</h3>
          </div>
          <div className="divide-y divide-border-subtle flex-1">
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

        {/* Host Diagnostics Card */}
        <div className="lg:col-span-6 bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 flex flex-col justify-between gap-4">
          <div>
            <h3 className="font-title-md text-title-md border-b border-border-subtle pb-3 mb-4">Infrastructure Host Diagnostics</h3>
            <div className="space-y-4">
              {/* CPU */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2 font-bold"><span className="material-symbols-outlined text-sm">developer_board</span> CPU Usage</span>
                  <span className="text-primary font-bold">{status?.cpu_usage_pct || 0}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${status?.cpu_usage_pct || 0}%` }}></div>
                </div>
              </div>

              {/* Memory */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2 font-bold"><span className="material-symbols-outlined text-sm">memory</span> Memory Allocation</span>
                  <span className="text-primary font-bold">{status?.memory_usage_pct || 0}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div className="bg-status-nominal h-full rounded-full transition-all duration-500" style={{ width: `${status?.memory_usage_pct || 0}%` }}></div>
                </div>
              </div>

              {/* Database Connections */}
              <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-border-subtle mt-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-primary">database</span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">DB Connections</h4>
                    <p className="text-sm font-bold">{status?.db_connections || 0} active sessions</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-status-nominal/10 text-status-nominal rounded-full text-xs font-bold uppercase">Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Traffic & Live Users Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESP32 Bandwidth Meter */}
        <div className="lg:col-span-5 bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-title-md text-title-md border-b border-border-subtle pb-3 mb-4">ESP32 Fleet Traffic Meter</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Traffic In */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-border-subtle flex flex-col gap-2 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-outline">Incoming Traffic</span>
                  <span className="w-2.5 h-2.5 bg-status-nominal rounded-full animate-pulse"></span>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-display-md text-primary font-bold">{status?.traffic_in_mbps || 0.0}</span>
                  <span className="text-xs font-bold text-on-surface-variant">Mbps</span>
                </div>
                <div className="text-[10px] text-outline mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">download</span> Telemetry & Signals
                </div>
              </div>

              {/* Traffic Out */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-border-subtle flex flex-col gap-2 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-outline">Outgoing Traffic</span>
                  <span className="w-2.5 h-2.5 bg-secondary-container rounded-full"></span>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-display-md text-secondary font-bold">{status?.traffic_out_mbps || 0.0}</span>
                  <span className="text-xs font-bold text-on-surface-variant">Mbps</span>
                </div>
                <div className="text-[10px] text-outline mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">upload</span> OTA & Remote Control
                </div>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-outline mt-4 leading-relaxed">
            * Bandwidth metrics are calculated dynamically across all online ESP32 edge units in the telemetry grid.
          </div>
        </div>

        {/* Live Active User Sessions */}
        <div className="lg:col-span-7 bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
            <h3 className="font-title-md text-title-md">Live Active User Sessions</h3>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
              {status?.live_users?.length || 0} active
            </span>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-outline bg-surface-container-low border-b border-border-subtle">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Activity</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {status?.live_users?.map((usr, index) => {
                  const isSuper = usr.role === 'superadmin';
                  const avatarLetter = usr.name ? usr.name.charAt(0).toUpperCase() : (usr.email ? usr.email.charAt(0).toUpperCase() : 'U');
                  return (
                    <tr key={index} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {avatarLetter}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface">{usr.name || usr.email}</div>
                          <div className="text-xs text-outline leading-none mt-0.5">{usr.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isSuper 
                            ? 'bg-status-critical/10 text-status-critical border-status-critical/20' 
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {isSuper ? 'Super Admin' : 'Admin'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">
                        {formatLastActive(usr.last_active)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-status-nominal font-bold text-xs">
                          <span className="w-2.5 h-2.5 bg-status-nominal rounded-full animate-pulse"></span>
                          <span>Online</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


