import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AlertsManagement() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    critical: 0,
    warning: 0,
    unacknowledged: 0,
  });

  const fetchAlerts = async () => {
    try {
      const res = await api.getAlerts();
      const list = res.alerts || [];
      setAlerts(list);

      const critical = list.filter(a => (a.severity === 'critical' || a.severity === 'emergency')).length;
      const warning = list.filter(a => a.severity === 'warning').length;
      const unacknowledged = list.filter(a => !a.acknowledged_at).length;

      setStats({ critical, warning, unacknowledged });
    } catch (e) {
      console.error('Error fetching alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (alertId) => {
    const user = api.getCurrentUser();
    try {
      await api.acknowledgeAlert(alertId, user?.email || 'operator', 'Acknowledged via Alerts Management panel');
      fetchAlerts();
    } catch (e) {
      alert(`Acknowledgement failed: ${e.message}`);
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
      </div>
    );
  }

  const metrics = [
    { label: 'Critical Alerts', value: stats.critical, trend: 'Action Req', trendColor: 'text-status-critical', icon: 'error', iconColor: 'text-status-critical', barColor: 'bg-status-critical' },
    { label: 'Warnings', value: stats.warning, trend: 'Active', trendColor: 'text-status-warning', icon: 'warning', iconColor: 'text-status-warning', barColor: 'bg-status-warning' },
    { label: 'Unacknowledged', value: stats.unacknowledged, trend: 'Needs Check', trendColor: 'text-outline', icon: 'mark_chat_unread', iconColor: 'text-outline', barColor: 'bg-outline' },
    { label: 'Compliance SLA', value: '98%', trend: 'Nominal', trendColor: 'text-status-nominal', icon: 'schedule', iconColor: 'text-primary', barColor: 'bg-primary' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-[36px] font-bold text-on-surface tracking-tight">Incident Management</h2>
          <p className="text-outline mt-2 text-sm max-w-xl">Real-time environmental triggers and system-wide alert monitoring for the national node network.</p>
        </div>
        <button 
          className="px-6 py-2 bg-surface-container-lowest border border-border-subtle text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-surface-container transition-all"
          onClick={fetchAlerts}
        >
          <span className="material-symbols-outlined text-sm">refresh</span> Refresh Incidents
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-surface-container-lowest border border-border-subtle p-6 flex flex-col justify-between h-32 relative group">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${m.barColor}`}></div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">{m.label}</span>
              <span className={`material-symbols-outlined ${m.iconColor}`}>{m.icon}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black">{m.value}</span>
              <span className={`text-[10px] font-bold ${m.trendColor}`}>{m.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Incident Log Table */}
      <div className="bg-surface-container-lowest border border-border-subtle overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-surface-container">
          <h3 className="font-bold text-sm uppercase tracking-widest">Active Incident Log</h3>
          <div className="text-[10px] font-bold uppercase text-outline">Live Updates Enabled</div>
        </div>
        <div className="overflow-x-auto">
          {alerts.length === 0 ? (
            <div className="p-12 text-center text-outline">
              <span className="material-symbols-outlined text-[48px] mb-2 opacity-30">notifications_off</span>
              <p className="font-bold">No incidents recorded</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-widest text-on-primary bg-on-surface">
                  <th className="px-6 py-4">Alert ID</th>
                  <th className="px-6 py-4">Source Device</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Message</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {alerts.map((inc) => {
                  const isAck = !!inc.acknowledged_at;
                  const severityColor = inc.severity === 'emergency' || inc.severity === 'critical' ? 'status-critical' : 'status-warning';

                  return (
                    <tr key={inc.id} className={`border-b border-border-subtle hover:bg-surface-container-low ${isAck ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-5 font-bold">#INC-{inc.id}</td>
                      <td className="px-6 py-5">
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">hub</span> {inc.device_id}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-block px-2 py-0.5 border border-${severityColor} text-${severityColor} text-[9px] font-bold uppercase`}>{inc.severity}</span>
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant">{inc.message}</td>
                      <td className="px-6 py-5 text-outline font-medium">
                        {new Date(inc.triggered_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {isAck ? (
                          <button className="px-4 py-1.5 border border-outline-variant text-outline-variant text-[10px] font-bold uppercase cursor-not-allowed" disabled>
                            Acknowledged
                          </button>
                        ) : (
                          <button 
                            className="px-4 py-1.5 border border-on-surface text-[10px] font-bold uppercase hover:bg-on-surface hover:text-on-primary transition-all"
                            onClick={() => handleAcknowledge(inc.id)}
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
