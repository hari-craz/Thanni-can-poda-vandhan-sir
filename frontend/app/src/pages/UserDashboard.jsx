import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function UserDashboard() {
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    avgWqi: 0,
    activeCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch system status
      const statusData = await api.getSystemStatus();
      
      // 2. Fetch devices list
      const devicesRes = await api.getDevices();
      const devices = devicesRes.devices || [];

      // 3. Fetch latest telemetry for each active node
      const nodePromises = devices.map(async (d) => {
        let wqi = 100;
        let temp = '—';
        let flow = '—';
        try {
          const telemetry = await api.getDeviceData(d.device_id, 1);
          if (telemetry.readings && telemetry.readings.length > 0) {
            const latest = telemetry.readings[0];
            wqi = latest.quality_score;
            temp = `${latest.temperature.toFixed(1)}°C`;
            flow = `${latest.flow_rate.toFixed(1)} L/m`;
          }
        } catch (e) {
          console.error(`Could not fetch telemetry for ${d.device_id}`);
        }

        const statusColor = d.status === 'online' 
          ? (wqi >= 80 ? 'status-nominal' : 'status-warning') 
          : 'outline';

        // Calculate circular gauge dashoffset (circumference = 251.2)
        const dashoffset = 251.2 - (251.2 * wqi) / 100;

        return {
          id: d.device_id,
          location: d.location,
          wqi,
          status: d.status === 'online' ? 'Active' : 'Offline',
          statusColor,
          temp,
          flow,
          dashoffset,
        };
      });

      const nodeData = await Promise.all(nodePromises);
      setNodes(nodeData);

      const onlineNodesWithData = nodeData.filter(n => n.status === 'Active');
      const avgWqi = onlineNodesWithData.length > 0
        ? Math.round(onlineNodesWithData.reduce((acc, curr) => acc + curr.wqi, 0) / onlineNodesWithData.length)
        : 100;

      setSummary({
        avgWqi,
        activeCount: statusData.active_devices || 0,
        totalCount: statusData.total_devices || 0,
      });

      // 4. Fetch pending alerts
      const alertsRes = await api.getAlerts('pending');
      setAlerts(alertsRes.alerts || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 20000); // refresh every 20s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Editorial Header */}
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">Regional Water Quality Monitor</h2>
        <p className="text-on-surface-variant text-sm">Real-time consumer water quality index and status monitor (Read-only)</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <span className="animate-spin material-symbols-outlined text-[36px] text-primary">progress_activity</span>
        </div>
      ) : (
        <>
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* WQI Summary Gauge */}
            <div className="bg-surface-container-lowest border border-border-subtle rounded-lg p-6 flex items-center justify-between shadow-sm">
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-widest text-[10px] text-outline">Network Quality Index</h4>
                <p className="font-headline-lg text-headline-lg text-on-surface">{summary.avgWqi} WQI</p>
                <p className="text-xs text-outline">Average consumer quality score</p>
              </div>
              <div className="relative w-20 h-20">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="36" className="stroke-surface-container-low fill-none" strokeWidth="6" />
                  <circle 
                    cx="40" 
                    cy="40" 
                    r="36" 
                    className="stroke-primary fill-none transition-all duration-500 ease-out" 
                    strokeWidth="6"
                    strokeDasharray="226.2"
                    strokeDashoffset={226.2 - (226.2 * summary.avgWqi) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-xs">
                  {summary.avgWqi}%
                </div>
              </div>
            </div>

            {/* Active Nodes Summary */}
            <div className="bg-surface-container-lowest border border-border-subtle rounded-lg p-6 flex flex-col justify-between shadow-sm">
              <h4 className="font-bold uppercase tracking-widest text-[10px] text-outline">Active Monitors</h4>
              <div className="py-2 flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-on-surface">{summary.activeCount}</span>
                <span className="text-outline text-sm">/ {summary.totalCount} Online</span>
              </div>
              <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-status-nominal h-full rounded-full transition-all duration-300"
                  style={{ width: `${(summary.activeCount / (summary.totalCount || 1)) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Quality Summary */}
            <div className="bg-surface-container-lowest border border-border-subtle rounded-lg p-6 flex flex-col justify-between shadow-sm">
              <h4 className="font-bold uppercase tracking-widest text-[10px] text-outline">Active Alerts</h4>
              <div className="py-2 flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-status-critical">{alerts.length}</span>
                <span className="text-outline text-sm">Unresolved Warnings</span>
              </div>
              <p className="text-xs text-outline">Quality threshold violations in the region</p>
            </div>
          </div>

          {/* Regional Monitoring Nodes Grid */}
          <div className="space-y-4">
            <h3 className="font-headline-sm text-headline-sm text-on-surface border-b border-border-subtle pb-2">Active Monitoring Nodes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {nodes.map((node) => (
                <div 
                  key={node.id} 
                  className="bg-surface-container-lowest border border-border-subtle rounded-lg p-6 shadow-sm flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base text-on-surface mb-0.5">{node.location || 'Unknown Node'}</h4>
                      <p className="text-xs text-outline font-mono uppercase">{node.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                      node.status === 'Active' ? 'border-status-nominal text-status-nominal bg-status-nominal/5' : 'border-outline text-outline bg-surface-container-low'
                    }`}>
                      {node.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-6">
                    <span className="text-xs font-bold text-outline uppercase tracking-wider">Water Quality WQI</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-headline-md text-headline-md font-bold">{node.wqi}</span>
                      <span className="text-xs text-outline">/100</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-4 text-xs">
                    <div>
                      <p className="text-outline mb-0.5">Temperature</p>
                      <p className="font-bold text-on-surface">{node.temp}</p>
                    </div>
                    <div>
                      <p className="text-outline mb-0.5">Flow Rate</p>
                      <p className="font-bold text-on-surface">{node.flow}</p>
                    </div>
                  </div>
                </div>
              ))}
              {nodes.length === 0 && (
                <div className="col-span-full py-12 text-center text-outline text-sm italic">
                  No active monitoring nodes deployed in this region.
                </div>
              )}
            </div>
          </div>

          {/* Active Incidents & Alerts */}
          <div className="space-y-4">
            <h3 className="font-headline-sm text-headline-sm text-on-surface border-b border-border-subtle pb-2">Active Alerts & Incidents</h3>
            <div className="bg-surface-container-lowest border border-border-subtle rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-widest text-on-primary bg-on-surface">
                      <th className="px-6 py-4">Node ID</th>
                      <th className="px-6 py-4">Severity</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Triggered At</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {alerts.map((alert) => (
                      <tr key={alert.id} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-on-surface">{alert.device_id}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            alert.severity === 'emergency' ? 'bg-status-critical/10 text-status-critical' :
                            alert.severity === 'critical' ? 'bg-status-warning/10 text-status-warning' :
                            'bg-status-nominal/10 text-status-nominal'
                          }`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-on-surface">{alert.message}</td>
                        <td className="px-6 py-4 text-outline">
                          {new Date(alert.triggered_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {alerts.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-outline italic">
                          No active warnings or incidents logged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
