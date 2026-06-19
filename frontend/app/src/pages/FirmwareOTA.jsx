import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function FirmwareOTA() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [file, setFile] = useState(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await api.getDevices();
        setDevices(res.devices || []);
        if (res.devices && res.devices.length > 0) {
          setSelectedDevice(res.devices[0].device_id);
        }
      } catch (e) {
        console.error('Failed to load devices:', e);
      }
    };
    fetchDevices();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDevice || !version || !file) {
      setErrorMsg('Please select a device, enter a version, and drop a binary file.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setStatusMsg('');
    setProgress(20);

    const formData = new FormData();
    formData.append('device_id', selectedDevice);
    formData.append('version', version);
    formData.append('release_notes', releaseNotes);
    formData.append('file', file);

    try {
      setProgress(50);
      const res = await api.uploadFirmware(formData);
      setProgress(100);
      setStatusMsg(`Firmware version ${res.version} successfully registered! Binary uploaded to MinIO.`);
      setVersion('');
      setReleaseNotes('');
      setFile(null);
    } catch (err) {
      setErrorMsg(err.message || 'Firmware upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">Firmware OTA Management</h2>
        <p className="text-on-surface-variant text-sm">Upload and deploy firmware updates to ESP32 devices over-the-air</p>
      </div>

      {errorMsg && (
        <div className="bg-status-critical/10 border border-status-critical/30 p-4 text-sm text-status-critical">
          {errorMsg}
        </div>
      )}

      {statusMsg && (
        <div className="bg-status-nominal/10 border border-status-nominal/30 p-4 text-sm text-status-nominal">
          {statusMsg}
        </div>
      )}

      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Target Node</label>
              <select 
                className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                required
              >
                {devices.map(d => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.name} ({d.device_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Firmware Version</label>
              <input 
                className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="e.g. 2.5.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Release Notes</label>
            <textarea 
              className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none h-24 resize-none"
              placeholder="Provide a short description of updates..."
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
            />
          </div>

          {/* Drag & Drop Zone */}
          <div 
            className={`bg-surface-container-lowest border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer relative ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border-subtle hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              accept=".bin,.hex"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="space-y-2">
                <span className="material-symbols-outlined text-[48px] text-primary">description</span>
                <p className="font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-outline">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready to upload</p>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-[48px] text-outline mb-2">cloud_upload</span>
                <p className="font-title-md text-title-md text-on-surface">Drag firmware binary here</p>
                <p className="text-label-sm text-outline mt-1">or click to browse • Supports .bin, .hex files up to 4MB</p>
              </>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{width: `${progress}%`}}></div>
              </div>
              <p className="text-xs text-outline text-center">Uploading to MinIO... {progress}%</p>
            </div>
          )}

          <button 
            type="submit" 
            className={`w-full py-4 font-title-md primary-action-btn flex items-center justify-center gap-2 text-on-primary ${
              uploading ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary'
            }`}
            disabled={uploading}
          >
            <span className="material-symbols-outlined">{uploading ? 'sync' : 'publish'}</span>
            {uploading ? 'Uploading Firmware...' : 'Publish OTA Update'}
          </button>
        </form>
      </div>
    </div>
  );
}
