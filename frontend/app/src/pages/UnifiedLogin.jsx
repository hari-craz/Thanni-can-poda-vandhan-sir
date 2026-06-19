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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-0 bg-background text-on-surface font-body-md">
      <main className="w-full md:w-[400px] animate-fade-in">
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
          <a className="nav-link-editorial hover:text-primary" href="#">Infrastructure Documentation</a>
          <a className="nav-link-editorial hover:text-primary" href="#">Request Access</a>
        </div>
      </main>
    </div>
  );
}
