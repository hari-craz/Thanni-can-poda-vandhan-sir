import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function FleetMap() {
  const [devices, setDevices] = useState([]);
  const [criticalEvents, setCriticalEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFleetData = async () => {
    try {
      const res = await api.getDevices();
      const devList = res.devices || [];

      // Fetch telemetry data for each device to show stats
      const devListWithData = await Promise.all(
        devList.map(async (d) => {
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
          } catch (e) {}

          return {
            ...d,
            wqi,
            temp,
            flow,
          };
        })
      );

      setDevices(devListWithData);

      // Fetch active alerts for sidebar
      const alertsRes = await api.getAlerts();
      const alerts = alertsRes.alerts || [];
      setCriticalEvents(alerts.slice(0, 10)); // take latest 10
    } catch (e) {
      console.error('Error fetching fleet data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(fetchFleetData, 20000);
    return () => clearInterval(interval);
  }, []);

  const totalCount = devices.length;
  const onlineCount = devices.filter(d => d.status === 'online').count || devices.filter(d => d.status === 'online').length;
  const warningCount = devices.filter(d => d.status === 'online' && d.wqi < 80 && d.wqi >= 50).length;
  const criticalCount = devices.filter(d => d.status === 'offline' || d.wqi < 50).length;

  const uptimePct = totalCount > 0 ? ((onlineCount / totalCount) * 100).toFixed(2) : '100.00';

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
      </div>
    );
  }

  return (
    <div className="-mx-6 -mt-24 md:-ml-[15rem] h-screen flex flex-col overflow-hidden">
      <div className="pt-16 md:ml-[15rem] p-gutter flex-1 flex flex-col gap-gutter overflow-hidden">
        {/* Dashboard Header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface tracking-tight">Fleet Command Center</h2>
            <p className="text-on-surface-variant">Real-time geospatial visualization of active hydrometric nodes.</p>
          </div>
          <button 
            className="btn-premium flex items-center gap-2 px-4 py-2 border border-border-subtle rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all"
            onClick={fetchFleetData}
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span className="font-label-sm">Refresh Command</span>
          </button>
        </div>

        {/* Bento Grid Layout */}
        <div className="flex-1 grid grid-cols-12 gap-gutter min-h-0">
          {/* Main Map Section */}
          <section className="col-span-12 lg:col-span-9 bg-surface-container-lowest rounded-xl border border-border-subtle shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-white z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-nominal"></span><span className="text-label-sm text-on-surface-variant">Nominal ({onlineCount - warningCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-warning"></span><span className="text-label-sm text-on-surface-variant">Warning ({warningCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-critical"></span><span className="text-label-sm text-on-surface-variant">Critical/Offline ({criticalCount})</span></div>
              </div>
            </div>

            {/* Map Interface */}
            <div className="flex-1 relative bg-surface-container overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70"></div>
              
              {devices.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-outline">
                  <span className="material-symbols-outlined text-[64px] opacity-35">map</span>
                  <p className="font-bold mt-2">No nodes registered</p>
                </div>
              ) : (
                devices.map((device, idx) => {
                  // Determine deterministic positions on screen for rendering
                  const x = 15 + (idx * 23) % 70;
                  const y = 20 + (idx * 17) % 65;

                  const isOnline = device.status === 'online';
                  const pinColor = !isOnline 
                    ? 'bg-status-critical' 
                    : (device.wqi >= 80 ? 'bg-status-nominal' : 'bg-status-warning');

                  return (
                    <div 
                      key={device.device_id} 
                      className="absolute cursor-pointer group/pin" 
                      style={{ top: `${y}%`, left: `${x}%` }}
                    >
                      <div className={`absolute inset-0 ${pinColor} rounded-full pulse-marker`}></div>
                      <div className={`w-4 h-4 ${pinColor} rounded-full border-2 border-white shadow-lg relative z-10 transition-transform group-hover/pin:scale-150`}></div>
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 bg-surface-container-lowest rounded-xl shadow-xl border border-border-subtle p-4 opacity-0 group-hover/pin:opacity-100 transition-all scale-95 group-hover/pin:scale-100 origin-bottom z-20 pointer-events-none group-hover/pin:pointer-events-auto">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-on-surface text-title-md">{device.device_id}</h4>
                            <p className="text-label-sm text-on-surface-variant">{device.location}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            !isOnline ? 'bg-status-critical/10 text-status-critical' :
                            device.wqi >= 80 ? 'bg-status-nominal/10 text-status-nominal' :
                            'bg-status-warning/10 text-status-warning'
                          }`}>
                            {!isOnline ? 'Offline' : (device.wqi >= 80 ? 'Nominal' : 'Warning')}
                          </span>
                        </div>
                        {isOnline && (
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-surface-container p-2 rounded">
                              <p className="text-[10px] text-outline uppercase font-bold">WQI Score</p>
                              <p className="text-[14px] font-bold">{device.wqi}</p>
                            </div>
                            <div className="bg-surface-container p-2 rounded">
                              <p className="text-[10px] text-outline uppercase font-bold">Temp</p>
                              <p className="text-[14px] font-bold">{device.temp}</p>
                            </div>
                          </div>
                        )}
                        <Link to={`/admin/device/${device.device_id}/telemetry`} className="btn-premium block w-full py-2 bg-primary text-on-primary text-center rounded font-bold text-label-sm">
                          Go to Telemetry
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Sidebar Feed */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-gutter min-h-0">
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-border-subtle shadow-sm">
              <h3 className="font-title-md text-on-surface mb-4">Fleet Health</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-label-sm mb-1.5">
                    <span className="text-on-surface-variant font-semibold">Network Active Ratio</span>
                    <span className="text-primary font-bold">{uptimePct}%</span>
                  </div>
                  <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{width: `${uptimePct}%`}}></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-background p-3 rounded-lg border border-border-subtle/50 hover:border-primary/20 transition-colors">
                    <span className="text-[10px] uppercase font-black text-outline">Total Fleet</span>
                    <p className="text-title-md font-bold text-on-surface">{totalCount}</p>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border-subtle/50 hover:border-primary/20 transition-colors">
                    <span className="text-[10px] uppercase font-black text-outline">Active Nodes</span>
                    <p className="text-title-md font-bold text-on-surface">{onlineCount}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest flex-1 rounded-xl border border-border-subtle shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-surface-container-low">
                <h3 className="font-title-md text-on-surface">Critical Events</h3>
                <span className="bg-error-container text-on-error-container px-2 py-0.5 rounded text-[10px] font-black">{criticalEvents.length} LIVE</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {criticalEvents.length === 0 ? (
                  <p className="text-sm text-outline text-center py-8">No live incidents recorded.</p>
                ) : (
                  criticalEvents.map((event) => {
                    const sevColor = event.severity === 'emergency' || event.severity === 'critical' ? 'status-critical' : 'status-warning';
                    return (
                      <div key={event.id} className={`p-3 border-l-4 border-${sevColor} bg-${sevColor}/5 rounded-r hover:bg-${sevColor}/10 transition-all cursor-pointer`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] font-black text-${sevColor} uppercase`}>{event.severity}</span>
                          <span className="text-[10px] text-outline">
                            {new Date(event.triggered_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-body-md font-bold text-on-surface leading-tight">{event.device_id}</p>
                        <p className="text-label-sm text-on-surface-variant">{event.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
              <Link to="/admin/alerts" className="p-4 bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-bold text-label-sm text-center transition-all">
                View Full History
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
