import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const loadGoogleMapsScript = (callback) => {
  if (window.google && window.google.maps) {
    callback();
    return;
  }
  const existingScript = document.getElementById('googleMapsScript');
  if (existingScript) {
    existingScript.addEventListener('load', callback);
    return;
  }
  const script = document.createElement('script');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
  script.id = 'googleMapsScript';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  script.onload = () => {
    if (callback) callback();
  };
};

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1e1e24" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1e1e24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a93" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c1c1ca" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a93" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2d2d34" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e1e24" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a93" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3e3e46" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e1e24" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f172a" }],
  },
];

export default function FleetMap() {
  const [devices, setDevices] = useState([]);
  const [criticalEvents, setCriticalEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

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
          } catch (err) {
            console.warn(`Could not load telemetry for device ${d.device_id}:`, err);
          }

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
    // Call asynchronously to satisfy react-hooks/set-state-in-effect
    setTimeout(() => {
      fetchFleetData();
    }, 0);

    loadGoogleMapsScript(() => {
      setMapLoaded(true);
    });

    const interval = setInterval(fetchFleetData, 20000);
    return () => clearInterval(interval);
  }, []);

  // Setup Google Map Instance and Markers
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || devices.length === 0) return;

    // Filter devices with valid coordinates
    const validDevices = devices.filter(
      (d) => d.latitude !== null && d.longitude !== null
    );

    let center = { lat: 13.0827, lng: 80.2707 }; // Chennai default
    if (validDevices.length > 0) {
      const avgLat = validDevices.reduce((sum, d) => sum + d.latitude, 0) / validDevices.length;
      const avgLng = validDevices.reduce((sum, d) => sum + d.longitude, 0) / validDevices.length;
      center = { lat: avgLat, lng: avgLng };
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: 11,
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });
    }

    const map = mapInstanceRef.current;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Add new markers
    validDevices.forEach((device) => {
      const isOnline = device.status === 'online';
      const pinColor = !isOnline 
        ? '#EF4444' // red
        : (device.wqi >= 80 ? '#10B981' : '#F59E0B'); // green or orange

      const marker = new window.google.maps.Marker({
        position: { lat: device.latitude, lng: device.longitude },
        map: map,
        title: `${device.device_id}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: pinColor,
          fillOpacity: 0.9,
          scale: 9,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        setSelectedDeviceId(device.device_id);
      });

      markersRef.current.push(marker);
    });
  }, [mapLoaded, devices]);

  // Derived state: find the selected device directly from the devices list
  const selectedDevice = devices.find(d => d.device_id === selectedDeviceId);

  const totalCount = devices.length;
  const onlineCount = devices.filter(d => d.status === 'online').length;
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
            className="btn-premium flex items-center gap-2 px-4 py-2 border border-border-subtle rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all cursor-pointer"
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
              <div ref={mapRef} className="w-full h-full" />
              
              {(!mapLoaded || loading) && (
                <div className="absolute inset-0 bg-surface-container/60 backdrop-blur-sm z-10 flex items-center justify-center">
                  <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
                </div>
              )}

              {/* Floating Selected Device Overlay Card */}
              {selectedDevice && (
                <div className="absolute bottom-4 left-4 z-20 w-80 bg-surface-container-lowest/95 backdrop-blur-md rounded-xl shadow-xl border border-border-subtle p-5 animate-fade-in animate-duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-primary text-title-md">{selectedDevice.device_id}</h4>
                      <p className="text-label-sm text-on-surface-variant mt-0.5">{selectedDevice.location}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedDeviceId(null)}
                      className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                  
                  <div className="space-y-3.5">
                    <div className="flex justify-between text-xs py-1.5 border-b border-border-subtle/50">
                      <span className="text-on-surface-variant">Status</span>
                      <span className={`font-black uppercase tracking-wider ${
                        selectedDevice.status === 'online' ? 'text-status-nominal' : 'text-status-critical'
                      }`}>
                        {selectedDevice.status}
                      </span>
                    </div>
                    {selectedDevice.status === 'online' ? (
                      <>
                        <div className="flex justify-between text-xs py-1.5 border-b border-border-subtle/50">
                          <span className="text-on-surface-variant">WQI Score</span>
                          <span className={`font-bold ${selectedDevice.wqi >= 80 ? 'text-status-nominal' : 'text-status-warning'}`}>
                            {selectedDevice.wqi} / 100
                          </span>
                        </div>
                        <div className="flex justify-between text-xs py-1.5 border-b border-border-subtle/50">
                          <span className="text-on-surface-variant">Temperature</span>
                          <span className="font-bold text-on-surface">{selectedDevice.temp}</span>
                        </div>
                        <div className="flex justify-between text-xs py-1.5">
                          <span className="text-on-surface-variant">Flow Rate</span>
                          <span className="font-bold text-on-surface">{selectedDevice.flow}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-2 text-outline/65 text-xs">
                        Device offline. No real-time readings.
                      </div>
                    )}
                    
                    <Link 
                      to={`/admin/device/${selectedDevice.device_id}/telemetry`} 
                      className="btn-premium block w-full py-2 bg-primary text-on-primary text-center rounded font-bold text-label-sm text-sm"
                    >
                      Go to Telemetry
                    </Link>
                  </div>
                </div>
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
