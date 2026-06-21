import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function NodeManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser] = useState(() => api.getCurrentUser());

  // Modal / Dropdown / Action State
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [rotateKeyModalOpen, setRotateKeyModalOpen] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
  const [deleteDeviceModalOpen, setDeleteDeviceModalOpen] = useState(false);
  const [clearDbModalOpen, setClearDbModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    latitude: '',
    longitude: '',
    is_active: true,
    firmware_channel: 'stable',
    calibration_interval_days: 30,
  });
  const [newApiKey, setNewApiKey] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const isSuperAdmin = currentUser?.role === 'superadmin';

  async function fetchDevices() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch device fleet.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await Promise.resolve();
      if (mounted) {
        fetchDevices();
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuIndex(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const handleEditOpen = (device) => {
    setSelectedDevice(device);
    setFormData({
      name: device.name || '',
      location: device.location || '',
      latitude: device.latitude !== null ? device.latitude : '',
      longitude: device.longitude !== null ? device.longitude : '',
      is_active: device.is_active !== undefined ? device.is_active : true,
      firmware_channel: device.firmware_channel || 'stable',
      calibration_interval_days: device.calibration_interval_days || 30,
    });
    setEditModalOpen(true);
    setActiveMenuIndex(null);
    setActionError(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.updateDevice(selectedDevice.device_id, {
        name: formData.name.trim(),
        location: formData.location.trim(),
        latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
        is_active: formData.is_active,
        firmware_channel: formData.firmware_channel,
        calibration_interval_days: parseInt(formData.calibration_interval_days, 10),
      });
      setEditModalOpen(false);
      fetchDevices();
    } catch (err) {
      setActionError(err.message || 'Failed to update device.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRotateKeyOpen = (device) => {
    setSelectedDevice(device);
    setNewApiKey('');
    setRotateKeyModalOpen(true);
    setActiveMenuIndex(null);
    setActionError(null);
  };

  const handleRotateKeyConfirm = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const data = await api.rotateDeviceKey(selectedDevice.device_id);
      setNewApiKey(data.new_key);
    } catch (err) {
      setActionError(err.message || 'Failed to rotate API key.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearDataOpen = (device) => {
    setSelectedDevice(device);
    setClearDataModalOpen(true);
    setActiveMenuIndex(null);
    setActionError(null);
  };

  const handleClearDataConfirm = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.clearDeviceData(selectedDevice.device_id);
      setClearDataModalOpen(false);
      alert(`All telemetry and events for ${selectedDevice.device_id} have been cleared.`);
      fetchDevices();
    } catch (err) {
      setActionError(err.message || 'Failed to clear device data.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDeviceOpen = (device) => {
    setSelectedDevice(device);
    setDeleteDeviceModalOpen(true);
    setActiveMenuIndex(null);
    setActionError(null);
  };

  const handleDeleteDeviceConfirm = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.deleteDevice(selectedDevice.device_id);
      setDeleteDeviceModalOpen(false);
      fetchDevices();
    } catch (err) {
      setActionError(err.message || 'Failed to delete device.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearDbOpen = () => {
    setConfirmText('');
    setClearDbModalOpen(true);
    setActionError(null);
  };

  const handleClearDbConfirm = async (e) => {
    e.preventDefault();
    if (confirmText !== 'CLEAR DATABASE') {
      setActionError('You must type CLEAR DATABASE exactly to confirm.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await api.clearFullDatabase();
      setClearDbModalOpen(false);
      alert('The database has been cleared successfully.');
      fetchDevices();
    } catch (err) {
      setActionError(err.message || 'Failed to reset database.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Node & Fleet Administration</h2>
          <p className="text-on-surface-variant text-sm">Manage ESP32 monitoring units, update coordinates, rotate API keys, and perform data audits.</p>
        </div>
        <button 
          onClick={fetchDevices}
          className="px-6 py-2 bg-surface-container-lowest border border-border-subtle text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined text-sm">refresh</span> Refresh Fleet
        </button>
      </div>

      {error && (
        <div className="p-4 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-sm">
          {error}
        </div>
      )}

      {/* Nodes Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <span className="animate-spin material-symbols-outlined text-[36px] text-primary">progress_activity</span>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[260px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-widest text-on-primary bg-on-surface">
                  <th className="px-6 py-4">Node ID</th>
                  <th className="px-6 py-4">Node Name</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Coordinates (Lat, Lng)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Seen</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-outline italic">
                      No nodes registered in the Hydronix system. Click "Add New Node" to provision a device.
                    </td>
                  </tr>
                ) : (
                  devices.map((device, index) => {
                    const isOnline = device.status === 'online';
                    return (
                      <tr key={device.device_id} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 font-bold">{device.device_id}</td>
                        <td className="px-6 py-4 font-semibold text-primary-fixed">{device.name || 'Unnamed Node'}</td>
                        <td className="px-6 py-4 text-on-surface-variant">{device.location || 'N/A'}</td>
                        <td className="px-6 py-4 text-outline font-mono">
                          {device.latitude !== null && device.longitude !== null
                            ? `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}`
                            : 'Not set'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded flex items-center gap-1.5 w-fit ${
                            isOnline 
                              ? 'border-status-nominal text-status-nominal bg-status-nominal/5' 
                              : 'border-outline/30 text-on-surface-variant/70 bg-surface-container'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-status-nominal animate-pulse' : 'bg-outline/50'}`}></span>
                            {device.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-outline">
                          {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-center relative">
                          <button 
                            className="p-1 hover:bg-surface-container rounded transition-colors" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuIndex(activeMenuIndex === index ? null : index);
                            }}
                          >
                            <span className="material-symbols-outlined">more_vert</span>
                          </button>
                          
                          {activeMenuIndex === index && (
                            <div className="absolute right-6 top-full mt-1 bg-surface-container-lowest border border-border-subtle shadow-lg rounded z-10 w-52 overflow-hidden">
                              <button 
                                className="w-full text-left px-4 py-3 text-sm hover:bg-surface-container transition-colors flex items-center gap-2" 
                                onClick={() => handleEditOpen(device)}
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span> Edit Profile
                              </button>
                              <button 
                                className="w-full text-left px-4 py-3 text-sm hover:bg-surface-container transition-colors flex items-center gap-2" 
                                onClick={() => handleRotateKeyOpen(device)}
                              >
                                <span className="material-symbols-outlined text-[18px]">key</span> Rotate API Key
                              </button>
                              
                              {isSuperAdmin && (
                                <button 
                                  className="w-full text-left px-4 py-3 text-sm hover:bg-status-warning/10 text-status-warning transition-colors flex items-center gap-2" 
                                  onClick={() => handleClearDataOpen(device)}
                                >
                                  <span className="material-symbols-outlined text-[18px]">cleaning_services</span> Clear Telemetry
                                </button>
                              )}
                              
                              <button 
                                className="w-full text-left px-4 py-3 text-sm hover:bg-status-critical/10 text-status-critical border-t border-border-subtle/50 transition-colors flex items-center gap-2" 
                                onClick={() => handleDeleteDeviceOpen(device)}
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span> Delete Node
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danger Zone: Clear Full Database (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="bg-surface-container-lowest border border-status-critical/20 rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
            <span className="material-symbols-outlined text-status-critical text-[28px]">warning</span>
            <div>
              <h3 className="font-bold text-lg text-on-surface">System Database Administration</h3>
              <p className="text-on-surface-variant text-sm">Perform system-wide resets and administrative cleanup routines.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-bold text-sm">Clear Full Operational Database</p>
              <p className="text-xs text-outline">Truncates all device configurations, telemetry readings, alerts, and system logs. <strong>User accounts will be preserved.</strong></p>
            </div>
            <button 
              onClick={handleClearDbOpen}
              className="px-5 py-2.5 bg-status-critical text-on-primary font-bold text-xs uppercase tracking-wider hover:bg-status-critical-dark transition-all rounded"
            >
              Clear Full Database
            </button>
          </div>
        </div>
      )}

      {/* Modal: Edit Node */}
      {editModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg">Edit Node Profile: {selectedDevice.device_id}</h3>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {actionError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">Node Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Reservoir Delta"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">Location Description</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Pump Station 3, Floor 1"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-outline">Latitude</label>
                  <input 
                    type="number" 
                    step="any"
                    min="-90"
                    max="90"
                    placeholder="e.g. 13.0827"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-outline">Longitude</label>
                  <input 
                    type="number" 
                    step="any"
                    min="-180"
                    max="180"
                    placeholder="e.g. 80.2707"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-outline">Calibration Period (Days)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="365"
                    value={formData.calibration_interval_days}
                    onChange={(e) => setFormData({ ...formData, calibration_interval_days: e.target.value })}
                    className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-outline">Firmware Channel</label>
                  <select 
                    value={formData.firmware_channel}
                    onChange={(e) => setFormData({ ...formData, firmware_channel: e.target.value })}
                    className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="stable">Stable (Default)</option>
                    <option value="beta">Beta</option>
                    <option value="canary">Canary</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="is_active" 
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary border-border-subtle rounded"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-on-surface">Enable Active Communications</label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button 
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-on-primary rounded text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-1"
                >
                  {actionLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rotate API Key */}
      {rotateKeyModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg">Rotate Node Credentials</h3>
              <button 
                onClick={() => setRotateKeyModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {actionError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {actionError}
              </div>
            )}

            {!newApiKey ? (
              <div className="space-y-4">
                <p className="text-sm text-on-surface-variant">
                  Are you sure you want to regenerate the API key for device <strong>{selectedDevice.device_id}</strong>?
                </p>
                <div className="bg-status-warning/10 border border-status-warning/30 p-4 rounded text-xs text-status-warning text-left flex gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <p>This will revoke the old key (after a brief grace period). You must flash the new API key to the ESP32 hardware to resume telemetry ingestion.</p>
                </div>
                
                <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                  <button 
                    onClick={() => setRotateKeyModalOpen(false)}
                    className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleRotateKeyConfirm}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-primary text-on-primary rounded text-sm font-semibold hover:bg-primary-dark transition-colors"
                  >
                    {actionLoading ? 'Regenerating...' : 'Regenerate API Key'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <span className="material-symbols-outlined text-[48px] text-status-nominal">lock_open</span>
                <h4 className="font-bold text-sm">New Node API Key Generated</h4>
                <p className="text-xs text-outline">Copy the key below. It will not be shown again.</p>
                
                <code className="block bg-surface-container p-4 text-xs font-mono break-all border border-border-subtle rounded text-left">
                  {newApiKey}
                </code>

                <div className="flex justify-center pt-3 border-t border-border-subtle">
                  <button 
                    onClick={() => setRotateKeyModalOpen(false)}
                    className="px-6 py-2 bg-primary text-on-primary rounded text-sm font-semibold hover:bg-primary-dark transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Clear Node Telemetry Data (Super Admin Only) */}
      {clearDataModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg text-status-warning">Clear Telemetry Data</h3>
              <button 
                onClick={() => setClearDataModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {actionError}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                You are about to delete all historical telemetry readings, alerts, and valve activity logs for node <strong>{selectedDevice.device_id} ({selectedDevice.name})</strong>.
              </p>
              
              <div className="bg-status-critical/10 border border-status-critical/30 p-4 rounded text-xs text-status-critical text-left flex gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <p>This action is irreversible. The node profile and active credentials themselves will be preserved, but all sensor history will be permanently lost.</p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button 
                  onClick={() => setClearDataModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearDataConfirm}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-status-critical text-on-primary rounded text-sm font-semibold hover:bg-status-critical-dark transition-colors"
                >
                  {actionLoading ? 'Clearing...' : 'Clear Device Telemetry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Device */}
      {deleteDeviceModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg text-status-critical">Remove Node from Fleet</h3>
              <button 
                onClick={() => setDeleteDeviceModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {actionError}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Are you sure you want to permanently delete node <strong>{selectedDevice.device_id} ({selectedDevice.name})</strong>?
              </p>
              
              <div className="bg-status-critical/10 border border-status-critical/30 p-4 rounded text-xs text-status-critical text-left flex gap-2">
                <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                <p>This will completely remove the device record and revoke all active API keys. All associated telemetry logs, alerts, and valve records will be cascaded and deleted automatically.</p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button 
                  onClick={() => setDeleteDeviceModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteDeviceConfirm}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-status-critical text-on-primary rounded text-sm font-semibold hover:bg-status-critical-dark transition-colors"
                >
                  {actionLoading ? 'Deleting...' : 'Delete Node Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clear Full Database (Super Admin Only) */}
      {clearDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg text-status-critical">Danger Zone: Database Reset</h3>
              <button 
                onClick={() => setClearDbModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleClearDbConfirm} className="space-y-4">
              <p className="text-sm text-on-surface-variant leading-relaxed">
                This operation will completely purge all nodes, configurations, alerts, and telemetry logs. User accounts will be preserved.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-outline block">
                  Please type <strong className="text-status-critical">CLEAR DATABASE</strong> to confirm this action:
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="CLEAR DATABASE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full p-3 border border-status-critical/30 rounded bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-status-critical font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button 
                  type="button"
                  onClick={() => setClearDbModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading || confirmText !== 'CLEAR DATABASE'}
                  className="px-4 py-2 bg-status-critical text-on-primary rounded text-sm font-semibold hover:bg-status-critical-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {actionLoading ? 'Resetting Database...' : 'Execute Database Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
