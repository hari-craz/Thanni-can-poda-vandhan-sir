import React, { useState } from 'react';
import { api } from '../services/api';

export default function HardwareProvisioning() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ id: '', name: '', location: '', latitude: '', longitude: '' });
  const [provData, setProvData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.provisionDevice(
        formData.id, 
        formData.name, 
        formData.location,
        formData.latitude,
        formData.longitude
      );
      setProvData(data);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Provisioning failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto space-y-6">
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">Hardware Provisioning</h2>
        <p className="text-on-surface-variant text-sm">Register a new ESP32 device to the Hydronix network</p>
      </div>

      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-8">
        {error && (
          <div className="mb-6 bg-status-critical/10 border border-status-critical/30 p-4 text-sm text-status-critical">
            {error}
          </div>
        )}

        {!submitted ? (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Device ID</label>
              <input 
                className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="e.g. HYDRO_015"
                value={formData.id}
                onChange={(e) => setFormData({...formData, id: e.target.value.toUpperCase()})}
                required
              />
              <p className="text-[10px] text-outline mt-1">Must match pattern: HYDRO_000 (HYDRO_ followed by 3 digits)</p>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Device Name</label>
              <input 
                className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="e.g. Chennai East Sensor"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Location</label>
              <input 
                className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="e.g. 13.0827° N, 80.2707° E"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Latitude</label>
                <input 
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="e.g. 13.0827"
                  value={formData.latitude}
                  onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Longitude</label>
                <input 
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="e.g. 80.2707"
                  value={formData.longitude}
                  onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  required
                />
              </div>
            </div>
            <button 
              type="submit" 
              className={`w-full text-on-primary py-4 font-title-md primary-action-btn flex items-center justify-center gap-2 ${loading ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary'}`}
              disabled={loading}
            >
              <span className="material-symbols-outlined">{loading ? 'sync' : 'add_circle'}</span> 
              {loading ? 'Provisioning Device...' : 'Provision Device'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <span className="material-symbols-outlined text-[64px] text-status-nominal">check_circle</span>
            <h3 className="font-title-md text-title-md text-on-surface">Device Provisioned Successfully!</h3>
            <p className="text-on-surface-variant text-sm">Your new device has been registered. Use the API key below to configure your ESP32 firmware.</p>
            
            <div className="text-left space-y-4">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">API Key</label>
                <code className="block bg-surface-container p-4 text-sm font-mono break-all border border-border-subtle rounded">
                  {provData?.api_key}
                </code>
              </div>

              {provData?.setup_url && (
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Setup URL</label>
                  <code className="block bg-surface-container p-4 text-sm font-mono break-all border border-border-subtle rounded">
                    {provData.setup_url}
                  </code>
                </div>
              )}
            </div>

            <div className="bg-status-warning/10 border border-status-warning/30 p-4 rounded text-sm text-left">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-status-warning mt-0.5">warning</span>
                <p className="text-on-surface-variant"><strong>Important:</strong> This API key will only be shown once. Store it securely in your firmware configuration.</p>
              </div>
            </div>
            <button 
              className="px-6 py-3 border border-border-subtle text-label-sm font-bold hover:bg-surface-container transition-all" 
              onClick={() => { setSubmitted(false); setFormData({ id: '', name: '', location: '', latitude: '', longitude: '' }); setProvData(null); }}
            >
              Provision Another Device
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
