import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function PublicWaterMap() {
  const [devices, setDevices] = useState([]);
  const [activeNode, setActiveNode] = useState(null);
  const [activeNodeData, setActiveNodeData] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    try {
      const res = await api.getDevices();
      setDevices(res.devices || []);
    } catch (e) {
      console.error('Failed to load public devices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleNodeClick = async (device) => {
    if (activeNode === device.device_id) {
      setActiveNode(null);
      setActiveNodeData(null);
      setReadings([]);
      return;
    }

    setActiveNode(device.device_id);
    setActiveNodeData(device);
    
    try {
      const telemetry = await api.getDeviceData(device.device_id, 24);
      setReadings(telemetry.readings || []);
    } catch (e) {
      console.error('Failed to load telemetry for active node:', e);
    }
  };

  const latestReading = readings.length > 0 ? readings[0] : null;

  return (
    <div className="relative h-screen w-full bg-surface-bright text-on-background font-body-md overflow-hidden">
      {/* Main Map Canvas */}
      <main className="relative h-full w-full">
        {/* Mock Leaflet Map Container */}
        <div className="absolute inset-0 z-0 bg-surface-container overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70"></div>
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
            </div>
          )}

          {/* Map Markers */}
          {devices.map((device, idx) => {
            // Plot nodes dynamically
            const x = 20 + (idx * 23) % 65;
            const y = 25 + (idx * 17) % 60;
            
            const isOnline = device.status === 'online';
            const pinColor = !isOnline 
              ? 'bg-status-critical' 
              : 'bg-status-nominal';

            return (
              <button 
                key={device.device_id}
                className="absolute group z-10 focus:outline-none" 
                style={{ top: `${y}%`, left: `${x}%` }}
                onClick={() => handleNodeClick(device)}
              >
                <div className="relative flex items-center justify-center">
                  <div className={`absolute w-8 h-8 ${pinColor}/30 rounded-full pulse-marker`}></div>
                  <div className={`relative w-4 h-4 ${pinColor} border-2 border-surface-container-lowest rounded-full shadow-lg transition-transform group-hover:scale-125`}></div>
                  <div className="absolute top-6 whitespace-nowrap bg-on-primary-fixed text-on-primary px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="font-label-sm text-label-sm">{device.device_id}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Top Navigation Overlay */}
        <header className="absolute top-0 left-0 right-0 z-20 px-gutter pt-gutter pointer-events-none">
          <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-surface-container-lowest shadow-sm px-4 py-2 rounded-xl border border-border-subtle">
                <span className="font-headline-md text-headline-md text-on-surface font-black uppercase tracking-tighter cursor-pointer">HYDRONIX</span>
                <div className="h-4 w-px bg-border-subtle mx-2"></div>
                <span className="font-title-md text-title-md text-primary opacity-80 cursor-pointer">Public Explorer</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                to="/login"
                className="bg-primary text-on-primary shadow-sm px-6 py-2 rounded-xl border border-transparent font-bold text-label-sm hover:opacity-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">login</span> Operator Log In
              </Link>
            </div>
          </div>
        </header>

        {/* Legend Overlay */}
        <div className="absolute bottom-gutter right-gutter z-20 bg-surface-container-lowest/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-border-subtle w-64">
          <h4 className="font-title-md text-title-md mb-4 text-on-surface">Quality Index</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between group cursor-help transition-opacity hover:opacity-100 opacity-90">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-status-nominal"></span>
                <span className="text-body-md opacity-80">Excellent</span>
              </div>
              <span className="text-label-sm font-bold">90-100</span>
            </div>
            <div className="flex items-center justify-between group cursor-help transition-opacity hover:opacity-100 opacity-90">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-status-warning"></span>
                <span className="text-body-md opacity-80">Moderate</span>
              </div>
              <span className="text-label-sm font-bold">70-89</span>
            </div>
            <div className="flex items-center justify-between group cursor-help transition-opacity hover:opacity-100 opacity-90">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-status-critical"></span>
                <span className="text-body-md opacity-80">Critical</span>
              </div>
              <span className="text-label-sm font-bold">&lt; 70</span>
            </div>
          </div>
        </div>

        {/* Right Side Panel (Slide-out) */}
        <aside className={`slide-panel fixed top-0 right-0 h-full w-[400px] bg-surface-container-lowest shadow-2xl z-50 border-l border-border-subtle flex flex-col ${activeNode ? 'active' : ''}`}>
          <div className="px-gutter pt-8 pb-4 flex justify-between items-start">
            {activeNodeData && (
              <div>
                <h2 className="font-headline-md text-headline-md text-primary">{activeNodeData.device_id}</h2>
                <p className="text-body-md text-outline">{activeNodeData.location}</p>
              </div>
            )}
            <button className="p-2 hover:bg-surface-container rounded-full transition-colors text-outline" onClick={() => { setActiveNode(null); setActiveNodeData(null); }}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-gutter pb-8 space-y-8 custom-scrollbar">
            {/* Main Score Card */}
            {latestReading && (
              <div className="bg-surface-container-low rounded-2xl p-6 border border-border-subtle relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${latestReading.quality_score >= 80 ? 'bg-status-nominal' : 'bg-status-warning'}`}></div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">Current WQI Score</span>
                    <div className="flex items-baseline gap-2">
                      <h1 className="text-[72px] font-black text-primary leading-tight">{latestReading.quality_score}</h1>
                      <span className="text-primary font-title-md">/ 100</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-4 py-1.5 rounded-full font-bold text-label-sm mb-2 ${
                      latestReading.quality_score >= 80 ? 'bg-status-nominal/10 text-status-nominal' : 'bg-status-warning/10 text-status-warning'
                    }`}>
                      {latestReading.quality_score >= 80 ? 'SAFE' : 'ATTN'}
                    </span>
                    <span className="text-label-sm text-outline">Live Telemetry</span>
                  </div>
                </div>
              </div>
            )}

            {/* Secondary Metrics */}
            {latestReading ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-subtle">
                  <span className="material-symbols-outlined text-primary mb-2">thermostat</span>
                  <div className="text-outline text-label-sm">Temperature</div>
                  <div className="text-title-md">{latestReading.temperature.toFixed(1)}°C</div>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-subtle">
                  <span className="material-symbols-outlined text-primary mb-2">opacity</span>
                  <div className="text-outline text-label-sm">pH Level</div>
                  <div className="text-title-md">{latestReading.ph.toFixed(2)} pH</div>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-subtle">
                  <span className="material-symbols-outlined text-primary mb-2">blur_on</span>
                  <div className="text-outline text-label-sm">Turbidity</div>
                  <div className="text-title-md">{latestReading.turbidity.toFixed(2)} NTU</div>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-subtle">
                  <span className="material-symbols-outlined text-primary mb-2">bolt</span>
                  <div className="text-outline text-label-sm">TDS (Solids)</div>
                  <div className="text-title-md">{latestReading.tds.toFixed(0)} ppm</div>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-outline py-6">No telemetry logs received from this device yet.</p>
            )}

            {/* Historical Data */}
            {readings.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-title-md text-title-md">WQI Trend History</h3>
                <div className="h-32 bg-surface-container rounded-xl flex items-end justify-between p-4 gap-1">
                  {[...readings].reverse().map((r, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 rounded-t-sm ${r.quality_score >= 80 ? 'bg-status-nominal/35' : 'bg-status-warning/35'}`} 
                      style={{ height: `${r.quality_score}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
