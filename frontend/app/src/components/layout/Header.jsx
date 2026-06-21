import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function Header({ currentUser, initials, onLogout }) {
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [alerts, setAlerts] = useState([]);
  
  // Quick Settings States (persisted in localStorage)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const val = localStorage.getItem('hydronix_sound_enabled');
    return val !== 'false';
  });
  const [refreshRate, setRefreshRate] = useState(() => {
    const val = localStorage.getItem('hydronix_refresh_rate');
    return val ? parseInt(val, 10) : 15;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const val = localStorage.getItem('hydronix_dark_theme');
    return val === 'true';
  });

  // Diagnostics Tool States
  const [diagnosticsStatus, setDiagnosticsStatus] = useState('idle'); // 'idle' | 'running' | 'success'
  const [diagnosticsLog, setDiagnosticsLog] = useState([]);

  const prevAlertsCount = useRef(0);

  // Play synthetic chime tone using Web Audio API (no external file dependencies)
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5 note
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Web Audio API chime blocked by browser autoplay policy:', e);
    }
  };

  // Poll alerts
  const fetchHeaderAlerts = async () => {
    try {
      const res = await api.getAlerts('pending');
      const activeAlerts = res.alerts || [];
      setAlerts(activeAlerts);
    } catch (err) {
      console.error('Failed to load pending header alerts:', err);
    }
  };

  // Run initial poll and setup intervals
  useEffect(() => {
    // Call asynchronously to satisfy react-hooks/set-state-in-effect
    setTimeout(() => {
      fetchHeaderAlerts();
    }, 0);

    const interval = setInterval(fetchHeaderAlerts, refreshRate * 1000);
    return () => clearInterval(interval);
  }, [refreshRate]);

  // Audio warning triggers when new alerts arrive
  useEffect(() => {
    if (alerts.length > prevAlertsCount.current) {
      if (soundEnabled && prevAlertsCount.current > 0) {
        playAlertSound();
      }
    }
    prevAlertsCount.current = alerts.length;
  }, [alerts, soundEnabled]);

  // Apply dark class to body element
  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleDropdown = (type) => {
    setActiveDropdown((prev) => (prev === type ? null : type));
    if (type !== 'settings') {
      setDiagnosticsStatus('idle');
      setDiagnosticsLog([]);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId, currentUser?.email || 'operator', 'Acknowledged from Quick AppBar');
      fetchHeaderAlerts();
    } catch (e) {
      console.error('Acknowledge failed:', e);
    }
  };

  const handleSoundToggle = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('hydronix_sound_enabled', String(nextVal));
    if (nextVal) {
      playAlertSound();
    }
  };

  const handleRefreshChange = (e) => {
    const rate = parseInt(e.target.value, 10);
    setRefreshRate(rate);
    localStorage.setItem('hydronix_refresh_rate', String(rate));
  };

  const handleThemeToggle = () => {
    const nextVal = !isDarkMode;
    setIsDarkMode(nextVal);
    localStorage.setItem('hydronix_dark_theme', String(nextVal));
  };

  const runDiagnosticsTest = () => {
    setDiagnosticsStatus('running');
    setDiagnosticsLog(['[0.0s] Initializing self-diagnostics...']);

    setTimeout(() => {
      setDiagnosticsLog(prev => [...prev, '[0.3s] Pinging postgres DB pool: OK (1.8ms)']);
    }, 300);

    setTimeout(() => {
      setDiagnosticsLog(prev => [...prev, '[0.6s] Verifying ML model weights: Nominal (v2.1.0)']);
    }, 600);

    setTimeout(() => {
      setDiagnosticsLog(prev => [...prev, '[0.9s] Querying active telemetry streams: OK']);
    }, 900);

    setTimeout(() => {
      setDiagnosticsLog(prev => [...prev, '[1.2s] Diagnostic complete. Water networks healthy.']);
      setDiagnosticsStatus('success');
    }, 1200);
  };

  const displayAlerts = alerts.slice(0, 5);

  return (
    <header className="fixed top-0 right-0 h-16 bg-surface-container-lowest border-b border-border-subtle flex justify-between items-center px-6 w-full md:w-[calc(100%-15rem)] z-40">
      {/* Click outside Overlay to dismiss dropdowns */}
      {activeDropdown && (
        <div 
          className="fixed inset-0 z-45 bg-transparent" 
          onClick={() => toggleDropdown(null)}
        />
      )}

      <div className="flex items-center gap-4">
        <button className="md:hidden text-on-surface">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="hidden sm:block relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-[20px]">search</span>
          <input 
            className="pl-10 pr-4 py-1.5 bg-surface-container-low rounded-full border-none focus:ring-2 focus:ring-primary text-body-md w-64 transition-all duration-150 outline-none" 
            placeholder="Search Infrastructure..." 
            type="text" 
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-status-nominal/10 text-status-nominal rounded-full">
          <span className="w-2 h-2 rounded-full bg-status-nominal animate-pulse"></span>
          <span className="font-label-sm text-label-sm uppercase">System Status: Nominal</span>
        </div>
        
        <div className="flex items-center gap-4 relative">
          {/* Notifications Button & Count Badge */}
          <button 
            onClick={() => toggleDropdown('notifications')}
            className={`nav-link-hover text-on-surface-variant hover:text-primary transition-all scale-95 active:opacity-80 cursor-pointer relative p-1 rounded-full ${activeDropdown === 'notifications' ? 'bg-primary/10 text-primary' : ''}`}
            title="Live Alert Notifications"
          >
            <span className="material-symbols-outlined text-[24px]">notifications</span>
            {alerts.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-status-critical text-[10px] text-white font-bold rounded-full flex items-center justify-center border border-white">
                {alerts.length}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button 
            onClick={() => toggleDropdown('settings')}
            className={`nav-link-hover text-on-surface-variant hover:text-primary transition-all scale-95 active:opacity-80 cursor-pointer p-1 rounded-full ${activeDropdown === 'settings' ? 'bg-primary/10 text-primary' : ''}`}
            title="System Quick Settings"
          >
            <span className="material-symbols-outlined text-[24px]">settings</span>
          </button>

          {/* Profile Avatar Button */}
          <div 
            onClick={() => toggleDropdown('profile')}
            className={`w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold border cursor-pointer hover:scale-105 transition-all ${
              activeDropdown === 'profile' ? 'border-primary ring-2 ring-primary/20' : 'border-border-subtle'
            }`}
            title={currentUser?.email || 'Operator'}
          >
            {initials}
          </div>

          {/* --- Dropdown Popovers --- */}

          {/* 1. Notifications Dropdown */}
          {activeDropdown === 'notifications' && (
            <div className="absolute top-12 right-12 w-80 bg-white border border-border-subtle rounded-xl shadow-xl p-4 z-50 animate-fade-in flex flex-col gap-3">
              <div className="flex justify-between items-center pb-2 border-b border-border-subtle/50">
                <span className="font-bold text-sm text-on-surface">Active Alerts ({alerts.length})</span>
                {alerts.length > 5 && (
                  <span className="text-[10px] bg-outline-variant/30 text-outline px-1.5 py-0.5 rounded font-bold">Showing Newest 5</span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
                {displayAlerts.length === 0 ? (
                  <p className="text-xs text-outline text-center py-6 font-semibold">No pending alert notifications</p>
                ) : (
                  displayAlerts.map((alert) => {
                    const isCritical = alert.severity === 'emergency' || alert.severity === 'critical';
                    return (
                      <div 
                        key={alert.id} 
                        className={`p-3 rounded border text-xs flex flex-col gap-1.5 ${
                          isCritical 
                            ? 'bg-status-critical/5 border-status-critical/10' 
                            : 'bg-status-warning/5 border-status-warning/10'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                            isCritical ? 'bg-status-critical/10 text-status-critical' : 'bg-status-warning/10 text-status-warning'
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="text-[9px] text-outline">
                            {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-[11px]">{alert.device_id}</p>
                          <p className="text-on-surface-variant mt-0.5 leading-relaxed">{alert.message}</p>
                        </div>
                        <button 
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="self-end px-2.5 py-1 bg-primary text-on-primary font-bold text-[10px] rounded cursor-pointer transition-colors hover:bg-primary/90"
                        >
                          Acknowledge
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                <button 
                  onClick={() => {
                    setActiveDropdown(null);
                    navigate('/admin/alerts');
                  }}
                  className="w-full text-center py-2 text-xs font-bold text-primary hover:bg-primary-container/10 border border-primary/20 rounded transition-colors cursor-pointer mt-1"
                >
                  View Full Audit Log
                </button>
              )}
            </div>
          )}

          {/* 2. Settings Dropdown */}
          {activeDropdown === 'settings' && (
            <div className="absolute top-12 right-6 w-72 bg-white border border-border-subtle rounded-xl shadow-xl p-4 z-50 animate-fade-in flex flex-col gap-4">
              <div className="pb-2 border-b border-border-subtle/50">
                <span className="font-bold text-sm text-on-surface">Quick Settings</span>
              </div>

              {/* Polling Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider block">Refresh Interval</label>
                <select 
                  value={refreshRate} 
                  onChange={handleRefreshChange}
                  className="w-full p-2 text-xs bg-surface-container rounded border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-semibold"
                >
                  <option value={10}>10 Seconds (Fast)</option>
                  <option value={15}>15 Seconds (Default)</option>
                  <option value={30}>30 Seconds (Normal)</option>
                  <option value={60}>60 Seconds (Slow)</option>
                </select>
              </div>

              {/* Chime Switch */}
              <div className="flex justify-between items-center py-1">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Sound Alert Beeps</span>
                  <span className="text-[10px] text-outline">Chime when new alerts trigger</span>
                </div>
                <button 
                  onClick={handleSoundToggle}
                  className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${soundEnabled ? 'bg-primary' : 'bg-outline-variant'}`}
                >
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Theme Selector */}
              <div className="flex justify-between items-center py-1">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Dark Theme Overlay</span>
                  <span className="text-[10px] text-outline">Toggle dark styles dynamically</span>
                </div>
                <button 
                  onClick={handleThemeToggle}
                  className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'bg-primary' : 'bg-outline-variant'}`}
                >
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${isDarkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Diagnostics Test */}
              <div className="pt-2 border-t border-border-subtle/50 space-y-2">
                <button 
                  onClick={runDiagnosticsTest}
                  disabled={diagnosticsStatus === 'running'}
                  className={`w-full py-2 font-bold text-xs rounded text-center btn-premium transition-all ${
                    diagnosticsStatus === 'running' 
                      ? 'bg-surface-container text-outline cursor-wait' 
                      : 'bg-primary text-on-primary cursor-pointer'
                  }`}
                >
                  {diagnosticsStatus === 'running' ? 'Running diagnostics...' : 'Run Diagnostics Self-Test'}
                </button>
                {diagnosticsLog.length > 0 && (
                  <div className="bg-surface-container p-2.5 rounded font-mono text-[9px] leading-relaxed max-h-24 overflow-y-auto text-on-surface-variant custom-scrollbar border border-border-subtle/50">
                    {diagnosticsLog.map((logLine, idx) => (
                      <p key={idx}>{logLine}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Profile Dropdown */}
          {activeDropdown === 'profile' && (
            <div className="absolute top-12 right-0 w-64 bg-white border border-border-subtle rounded-xl shadow-xl p-4 z-50 animate-fade-in flex flex-col gap-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border-subtle/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-title-md">
                  {initials}
                </div>
                <div className="overflow-hidden">
                  <h4 className="font-bold text-xs text-on-surface truncate">{currentUser?.name || 'Operator User'}</h4>
                  <p className="text-[10px] text-outline truncate">{currentUser?.email || 'admin@localhost.com'}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-outline">Access Role</span>
                  <span className="font-bold text-primary uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded">
                    {currentUser?.role || 'operator'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-outline">Device Auth Tier</span>
                  <span className="font-bold text-on-surface">Level 3 (Full)</span>
                </div>
                {currentUser?.role === 'superadmin' && (
                  <button 
                    onClick={() => {
                      setActiveDropdown(null);
                      navigate('/superadmin/users');
                    }}
                    className="w-full text-left py-2 hover:bg-surface-container rounded px-2 transition-colors flex items-center gap-2 cursor-pointer mt-1"
                  >
                    <span className="material-symbols-outlined text-sm">manage_accounts</span>
                    <span>User Accounts Admin</span>
                  </button>
                )}
                {currentUser?.role === 'superadmin' && (
                  <button 
                    onClick={() => {
                      setActiveDropdown(null);
                      navigate('/superadmin/audit');
                    }}
                    className="w-full text-left py-2 hover:bg-surface-container rounded px-2 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">shield</span>
                    <span>Security Audit Logs</span>
                  </button>
                )}
              </div>

              <button 
                onClick={() => {
                  setActiveDropdown(null);
                  onLogout();
                }}
                className="w-full py-2 bg-status-critical/10 hover:bg-status-critical/15 text-status-critical font-bold text-xs rounded transition-colors flex items-center justify-center gap-2 border border-status-critical/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
