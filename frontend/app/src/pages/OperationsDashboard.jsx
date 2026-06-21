import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function OperationsDashboard() {
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    avgWqi: 0,
    activeCount: 0,
    totalCount: 0,
    cacheStatus: 'unknown',
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch system status
      const statusData = await api.getSystemStatus();
      
      // 2. Fetch devices list
      const devicesRes = await api.getDevices();
      const devices = devicesRes.devices || [];

      // 3. For each device, fetch its latest reading to display in the node grid
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
        } catch (error) {
          console.error(`Could not fetch telemetry for ${d.device_id}:`, error);
        }

        const statusColor = d.status === 'online' 
          ? (wqi >= 80 ? 'status-nominal' : 'status-warning') 
          : 'outline';

        // Calculate dashoffset for the circular gauge (circumference = 251.2)
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

      // Calculate WQI average
      const onlineNodesWithData = nodeData.filter(n => n.status === 'Active');
      const avgWqi = onlineNodesWithData.length > 0
        ? Math.round(onlineNodesWithData.reduce((acc, curr) => acc + curr.wqi, 0) / onlineNodesWithData.length)
        : 100;

      setSummary({
        avgWqi,
        activeCount: statusData.active_devices || 0,
        totalCount: statusData.total_devices || 0,
        cacheStatus: statusData.cache_status || 'unknown',
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
    setTimeout(() => {
      fetchDashboardData();
    }, 0);
    const interval = setInterval(fetchDashboardData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (alertId) => {
    const user = api.getCurrentUser();
    try {
      await api.acknowledgeAlert(alertId, user?.email || 'operator', 'Acknowledged from dashboard');
      fetchDashboardData(); // Refresh data
    } catch (e) {
      alert(`Acknowledge failed: ${e.message}`);
    }
  };

  if (loading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Average Network WQI', value: summary.avgWqi, unit: '', icon: 'opacity', trend: 'trending_up', trendText: 'Water safety level', trendColor: 'status-nominal' },
    { label: 'Active Nodes', value: `${summary.activeCount}/${summary.totalCount}`, unit: 'online', icon: 'hub', trend: 'check_circle', trendText: `Cache status: ${summary.cacheStatus}`, trendColor: summary.cacheStatus === 'healthy' ? 'status-nominal' : 'status-warning' },
    { label: 'System Incidents', value: alerts.length, unit: 'pending', icon: 'notifications_active', trend: 'warning', trendText: 'Needs attention', trendColor: alerts.length > 0 ? 'status-critical' : 'status-nominal' },
  ];

  return (
    <>
      {/* Summary Stack */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {summaryCards.map((card, i) => (
          <div key={i} className="bg-surface-container-lowest border border-border-subtle p-6 rounded-lg shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-primary/30 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[64px]">{card.icon}</span>
            </div>
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">{card.label}</span>
            <h2 className="text-primary font-display-lg text-display-lg">{card.value} <small className="text-title-md font-normal text-on-surface-variant">{card.unit}</small></h2>
            <div className={`flex items-center gap-1 text-${card.trendColor}`}>
              <span className="material-symbols-outlined text-[16px]">{card.trend}</span>
              <span className="font-label-sm text-label-sm">{card.trendText}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout: Grid + Alert Feed */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Node Grid (70%) */}
        <div className="w-full lg:w-[70%] space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">Regional Node Network</h3>
            <button 
              className="nav-link-hover px-4 py-1.5 border border-border-subtle rounded text-label-sm hover:bg-surface-container-low transition-all flex items-center gap-2"
              onClick={fetchDashboardData}
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh Nodes
            </button>
          </div>

          {nodes.length === 0 ? (
            <div className="bg-surface-container-lowest border border-border-subtle rounded-lg p-12 text-center text-outline">
              <span className="material-symbols-outlined text-[48px] mb-2">hub</span>
              <p className="font-bold">No provisioned nodes found.</p>
              <p className="text-sm">Provision nodes from the Super Admin dashboard to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {nodes.map((node) => (
                <Link to={`/admin/device/${node.id}/telemetry`} key={node.id} className="bg-surface-container-lowest border border-border-subtle rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer">
                  <div className={`h-1 w-full bg-${node.statusColor === 'outline' ? 'outline-variant' : node.statusColor}`}></div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="font-title-md text-title-md text-on-surface">{node.id}</h4>
                        <p className="text-label-sm text-on-surface-variant">{node.location}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        node.status === 'Active' ? 'bg-status-nominal/10 text-status-nominal' : 'bg-outline-variant/20 text-outline'
                      }`}>{node.status}</span>
                    </div>
                    <div className="flex items-center justify-center py-4">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="50" cy="50" fill="transparent" r="40" stroke="#eff4f8" strokeWidth="8" />
                          <circle cx="50" cy="50" fill="transparent" r="40" stroke={node.statusColor === 'status-nominal' ? '#22c55e' : '#f59e0b'} strokeDasharray="251.2" strokeDashoffset={node.dashoffset} strokeLinecap="round" strokeWidth="8" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-headline-md font-black text-on-surface">{node.wqi}</span>
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant">WQI Index</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-on-surface-variant mb-1">Temp</p>
                        <p className="font-bold">{node.temp}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-on-surface-variant mb-1">Flow Rate</p>
                        <p className="font-bold">{node.flow}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Flow Analysis Chart */}
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-title-md text-title-md">Cumulative Flow Analysis</h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-primary rounded-full"></span>
                <span className="text-label-sm">Primary Channel</span>
              </div>
            </div>
            <div className="h-64 flex items-end justify-between gap-2 px-2">
              {[40, 55, 48, 62, 85, 75, 68, 50, 42, 58, 72, 80].map((h, i) => (
                <div key={i} className={`flex-1 rounded-t-sm transition-colors ${h === 85 ? 'bg-primary' : 'bg-surface-container hover:bg-primary/40'}`} style={{ height: `${h}%` }}></div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-label-sm text-on-surface-variant font-bold">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
            </div>
          </div>
        </div>

        {/* Right Side Alert Feed (30%) */}
        <div className="w-full lg:w-[30%] space-y-6">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm h-full flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-surface-container-low">
              <h3 className="font-title-md text-title-md">Live Alert Feed</h3>
              <span 
                className="material-symbols-outlined text-primary cursor-pointer hover:rotate-180 transition-transform duration-500"
                onClick={fetchDashboardData}
              >
                refresh
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 min-h-[300px]">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-outline">
                  <span className="material-symbols-outlined text-[36px] mb-2 opacity-50">check_circle</span>
                  <p className="text-sm">No active warnings or incidents.</p>
                </div>
              ) : (
                alerts.slice(0, 5).map((alert) => {
                  const severityColor = alert.severity === 'emergency' || alert.severity === 'critical' ? 'status-critical' : 'status-warning';
                  const severityIcon = alert.severity === 'emergency' || alert.severity === 'critical' ? 'error' : 'warning';
                  
                  return (
                    <div key={alert.id} className={`p-4 border-b border-border-subtle border-l-4 border-l-${severityColor} bg-${severityColor}/5 hover:bg-${severityColor}/10 transition-colors`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-${severityColor} font-bold text-label-sm flex items-center gap-1 uppercase`}>
                          <span className="material-symbols-outlined text-[14px]">{severityIcon}</span>
                          {alert.severity}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          {new Date(alert.triggered_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-body-md font-bold mb-1">{alert.device_id}</p>
                      <p className="text-label-sm text-on-surface-variant leading-relaxed mb-3">{alert.message}</p>
                      <div className="flex gap-2">
                        <button 
                          className="btn-premium text-[11px] font-bold py-1 px-3 bg-primary text-on-primary rounded shadow-sm"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 text-center border-t border-border-subtle bg-surface-container-low">
              <Link to="/admin/alerts" className="nav-link-hover text-primary font-bold text-label-sm hover:underline uppercase tracking-tight">View Full Audit Log</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
