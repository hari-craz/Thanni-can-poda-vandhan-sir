import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function UnifiedLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cardOffset, setCardOffset] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();

  // Modals States
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'operators' | 'hardware' | 'security'

  // Request Access Form States
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqRole, setReqRole] = useState('operator');
  const [reqReason, setReqReason] = useState('');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSuccess, setReqSuccess] = useState('');
  const [reqError, setReqError] = useState('');

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      
      const moveX = (e.clientX - window.innerWidth / 2) / 150;
      const moveY = (e.clientY - window.innerHeight / 2) / 150;
      
      setCardOffset({ x: moveX, y: moveY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      const user = res?.user || api.getCurrentUser();
      if (user?.role === 'superadmin') {
        navigate('/superadmin/overview');
      } else if (user?.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setReqError('');
    setReqSuccess('');
    setReqLoading(true);
    try {
      const res = await api.requestAccess({
        name: reqName,
        email: reqEmail,
        role: reqRole,
        reason: reqReason,
      });
      setReqSuccess(res.message || 'Access request submitted successfully!');
      setReqName('');
      setReqEmail('');
      setReqReason('');
    } catch (err) {
      setReqError(err.message || 'Failed to submit request.');
    } finally {
      setReqLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-0 bg-background text-on-surface font-body-md relative overflow-hidden">
      <main className="w-full md:w-[400px] animate-fade-in relative z-10">
        <div 
          className="login-card bg-surface editorial-shadow rounded-none p-8 md:p-12 flex flex-col"
          style={{ transform: `translate(${cardOffset.x}px, ${cardOffset.y}px)` }}
        >
          {/* Logo Section */}
          <header className="mb-12 flex flex-col items-center text-center">
            <h1 className="font-fraunces text-[42px] leading-tight text-primary font-black tracking-tight mb-2">
              Hydronix
            </h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
              Mission Control
            </p>
          </header>

          {/* Login Form */}
          <form className="space-y-8" onSubmit={handleLogin}>
            {error && (
              <div className="bg-status-critical/10 border border-status-critical/30 p-4 text-sm text-status-critical">
                {error}
              </div>
            )}

            {/* Username */}
            <div className="relative group">
              <label className="font-label-sm text-label-sm text-on-surface-variant/70 block mb-1" htmlFor="username">
                Operator ID (Email)
              </label>
              <input 
                className="input-editorial w-full font-body-md text-body-md text-on-surface placeholder-outline-variant/50 focus:placeholder-transparent outline-none" 
                id="username" 
                name="username" 
                placeholder="e.g. admin@hydronix.local" 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="relative group">
              <div className="flex justify-between items-end mb-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant/70 block" htmlFor="password">
                  Authorization Key
                </label>
                <button className="nav-link-editorial text-[10px] uppercase font-bold text-primary hover:text-on-primary-container" type="button">
                  Forgot?
                </button>
              </div>
              <input 
                className="input-editorial w-full font-body-md text-body-md text-on-surface placeholder-outline-variant/50 focus:placeholder-transparent outline-none pr-8" 
                id="password" 
                name="password" 
                placeholder="••••••••" 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                className="absolute right-0 bottom-2 text-outline-variant hover:text-primary transition-colors" 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-3 py-2">
              <input 
                className="w-4 h-4 border-outline-variant text-primary focus:ring-primary rounded-none cursor-pointer" 
                id="remember" 
                type="checkbox"
              />
              <label className="font-body-md text-[14px] text-on-surface-variant cursor-pointer" htmlFor="remember">
                Persistent Session
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button 
                className={`btn-editorial-primary w-full text-on-primary font-fraunces text-title-md py-4 focus:ring-2 focus:ring-offset-2 focus:ring-primary ${loading ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary'}`} 
                type="submit"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Access Dashboard'}
              </button>
            </div>
          </form>

          {/* Footer Meta */}
          <footer className="mt-12 text-center">
            <div className="flex items-center justify-center space-x-2 mb-6">
              <span className="w-2 h-2 bg-status-nominal rounded-full"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant/60">System Status: Nominal</span>
            </div>
            <p className="font-body-md text-[13px] text-on-surface-variant/50">
              Proprietary Environmental Monitoring Network.<br/>
              Unauthorized access is strictly monitored.
            </p>
          </footer>
        </div>

        {/* External Links */}
        <div className="mt-6 flex justify-between px-2 text-[12px] font-label-sm uppercase tracking-widest text-on-surface-variant/40">
          <button 
            type="button" 
            className="nav-link-editorial hover:text-primary cursor-pointer text-left focus:outline-none" 
            onClick={() => setIsDocsOpen(true)}
          >
            Infrastructure Documentation
          </button>
          <button 
            type="button" 
            className="nav-link-editorial hover:text-primary cursor-pointer text-right focus:outline-none" 
            onClick={() => {
              setReqError('');
              setReqSuccess('');
              setIsRequestOpen(true);
            }}
          >
            Request Access
          </button>
        </div>
      </main>

      {/* ==================================================================== */}
      {/* MODAL 1: INFRASTRUCTURE DOCUMENTATION */}
      {/* ==================================================================== */}
      {isDocsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border-subtle max-w-4xl w-full h-[600px] flex flex-col relative shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border-subtle bg-surface-container">
              <h2 className="font-fraunces text-headline-sm text-primary font-bold">Infrastructure Documentation</h2>
              <button 
                type="button" 
                onClick={() => setIsDocsOpen(false)}
                className="text-outline-variant hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Split Content Pane */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-64 border-r border-border-subtle bg-surface-container flex flex-col p-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === 'overview' 
                      ? 'bg-primary text-on-primary border-l-2 border-on-primary' 
                      : 'hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  Overview & Architecture
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('operators')}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === 'operators' 
                      ? 'bg-primary text-on-primary border-l-2 border-on-primary' 
                      : 'hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  Operator Guide
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('hardware')}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === 'hardware' 
                      ? 'bg-primary text-on-primary border-l-2 border-on-primary' 
                      : 'hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  Hardware Wiring
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === 'security' 
                      ? 'bg-primary text-on-primary border-l-2 border-on-primary' 
                      : 'hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  API Security Specs
                </button>
              </div>

              {/* Scrollable Document Body */}
              <div className="flex-1 p-8 overflow-y-auto bg-surface-container-lowest">
                {activeTab === 'overview' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="font-fraunces text-headline-sm text-primary mb-4">System Overview</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                      The Hydronix platform is an automated, high-precision telemetry and pipeline safety control network. 
                      It processes high-frequency sensor readings across regional water junctions and provides real-time valve cutoff triggers.
                    </p>
                    <div className="bg-surface-container-low border border-border-subtle p-4 mb-4 font-mono text-[11px] leading-relaxed text-outline">
                      [Edge Nodes (ESP32)] --(HTTPS/HMAC)--> [FastAPI Relay] --(SQLAlchemy)--> [PostgreSQL DB]
                                                                    |
                                                             [Redis Cache] &lt;--&gt; [Rate Limiting]
                    </div>
                    <h4 className="font-bold text-sm mb-2 text-on-surface">Core Infrastructure Services:</h4>
                    <ul className="list-disc list-inside space-y-2 text-on-surface-variant text-xs">
                      <li><strong>Edge Telemetry:</strong> Flow, pH, TDS, Turbidity, and Temperature metrics.</li>
                      <li><strong>Anomaly Engine:</strong> Real-time rule-based validation and ML-inference anomaly detection.</li>
                      <li><strong>Solenoid Valves:</strong> Automated cutoff triggers when readings degrade below safety margins.</li>
                    </ul>
                  </div>
                )}

                {activeTab === 'operators' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="font-fraunces text-headline-sm text-primary mb-4">Pipeline Operator Guide</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                      As an authorized operator, you are responsible for monitoring real-time flow trends and acknowledging system alerts.
                    </p>
                    <h4 className="font-bold text-sm mb-2 text-on-surface">Standard Incident Escalation:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-on-surface-variant text-xs">
                      <li><strong>Monitor:</strong> Look out for warning (yellow) or critical (red) badges on the Incident panel.</li>
                      <li><strong>Inspect:</strong> Click on the source node to view the parameter drift chart.</li>
                      <li><strong>Override:</strong> If a valve triggers an automatic shutdown, coordinate with ground crews and issue an override request.</li>
                      <li><strong>Acknowledge:</strong> Log the incident resolution reason in the alert logs to clear the active alarm state.</li>
                    </ol>
                  </div>
                )}

                {activeTab === 'hardware' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="font-fraunces text-headline-sm text-primary mb-4">Hardware Config & Wiring</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                      ESP32 telemetry nodes are wired to the sensor suite via dedicated ADC interfaces and optocoupled relay modules.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-surface-container-low border border-border-subtle p-3">
                        <span className="font-bold text-primary block mb-2">Sensor Pinouts:</span>
                        <ul className="space-y-1 text-on-surface-variant font-mono text-[10px]">
                          <li>- pH Sensor: GPIO 36 (ADC1_0)</li>
                          <li>- Turbidity: GPIO 39 (ADC1_3)</li>
                          <li>- TDS Meter: GPIO 34 (ADC1_6)</li>
                          <li>- Temp (DS18B20): GPIO 25 (OneWire)</li>
                        </ul>
                      </div>
                      <div className="bg-surface-container-low border border-border-subtle p-3">
                        <span className="font-bold text-primary block mb-2">Valve Actuator:</span>
                        <ul className="space-y-1 text-on-surface-variant font-mono text-[10px]">
                          <li>- Cutoff Relay: GPIO 27 (Active Low)</li>
                          <li>- Feedback Sensor: GPIO 14 (Interrupt)</li>
                          <li>- Power Line: 12V DC External</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="font-fraunces text-headline-sm text-primary mb-4">API Security Specs</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                      The system enforces strict transport-layer encryption (HTTPS) and payload signing to prevent injection or packet manipulation.
                    </p>
                    <h4 className="font-bold text-sm mb-2 text-on-surface">HMAC Payload Validation:</h4>
                    <p className="text-on-surface-variant text-xs leading-relaxed mb-4">
                      Each edge telemetry packet is signed using SHA-256 HMAC. The header contains signature tokens calculated from:
                      <code className="block bg-surface-container-low p-2 mt-1 font-mono text-[10px] text-primary">HMAC_SHA256(SecretKey, Body + Timestamp + Nonce)</code>
                    </p>
                    <div className="bg-status-critical/10 border border-status-critical/30 p-3 text-xs text-status-critical">
                      <strong>Warning:</strong> Replay prevention holds a 5-minute sliding window tolerance. Nodes with drifting real-time clocks (RTC) will trigger authorization errors.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: REQUEST ACCESS */}
      {/* ==================================================================== */}
      {isRequestOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border-subtle max-w-md w-full flex flex-col relative shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border-subtle bg-surface-container">
              <h2 className="font-fraunces text-headline-sm text-primary font-bold">Request Access</h2>
              <button 
                type="button" 
                onClick={() => setIsRequestOpen(false)}
                className="text-outline-variant hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-6">
              {reqError && (
                <div className="bg-status-critical/10 border border-status-critical/30 p-3 text-xs text-status-critical">
                  {reqError}
                </div>
              )}

              {reqSuccess ? (
                <div className="text-center py-6 space-y-4">
                  <span className="material-symbols-outlined text-[48px] text-status-nominal">check_circle</span>
                  <h3 className="font-bold text-sm text-on-surface uppercase tracking-widest">Submission Received</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {reqSuccess}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsRequestOpen(false)}
                    className="btn-editorial-primary px-6 py-2 text-on-primary bg-primary"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant block" htmlFor="req-name">
                      Full Name
                    </label>
                    <input
                      id="req-name"
                      type="text"
                      className="input-editorial w-full font-body-md text-body-md focus:ring-1 focus:ring-primary outline-none"
                      placeholder="e.g. John Doe"
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant block" htmlFor="req-email">
                      Work Email
                    </label>
                    <input
                      id="req-email"
                      type="email"
                      className="input-editorial w-full font-body-md text-body-md focus:ring-1 focus:ring-primary outline-none"
                      placeholder="e.g. john@hydronix.local"
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      required
                    />
                  </div>

                  {/* Requested Role */}
                  <div className="space-y-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant block" htmlFor="req-role">
                      Requested Role
                    </label>
                    <select
                      id="req-role"
                      className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value)}
                    >
                      <option value="operator">Operator (Incident Monitoring & Manual Overrides)</option>
                      <option value="admin">Administrator (Node Provisioning & OTA Deployments)</option>
                    </select>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant block" htmlFor="req-reason">
                      Business Justification
                    </label>
                    <textarea
                      id="req-reason"
                      className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none h-20 resize-none"
                      placeholder="Describe why you need access to Mission Control..."
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      required
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRequestOpen(false)}
                      className="px-4 py-2 border border-border-subtle bg-surface-container-lowest hover:bg-surface-container text-xs font-bold uppercase transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reqLoading}
                      className="btn-editorial-primary px-6 py-2 text-on-primary bg-primary text-xs font-bold uppercase"
                    >
                      {reqLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
