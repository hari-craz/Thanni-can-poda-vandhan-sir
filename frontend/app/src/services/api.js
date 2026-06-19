// API Service Layer to communicate with the FastAPI backend

const BASE_URL = '/api';

function getHeaders(isMultipart = false) {
  const headers = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errData = await response.json();
      errorMsg = errData.error || errData.detail || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  return response.json();
}

export const api = {
  // Authentication
  async login(email, password) {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    const data = await handleResponse(res);
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  // Health and System Status
  async getSystemStatus() {
    const res = await fetch(`${BASE_URL}/status`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Devices
  async getDevices() {
    const res = await fetch(`${BASE_URL}/devices`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getDevice(deviceId) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async provisionDevice(deviceId, name, location) {
    const res = await fetch(`${BASE_URL}/devices/provision`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ device_id: deviceId, name, location }),
    });
    return handleResponse(res);
  },

  async getDeviceConfig(deviceId) {
    // Note: The device pulling config requires X-API-Key, but admin reading config is usually PATCH or similar.
    // However, the GET /devices/{device_id}/config in backend specifies Depends(get_device_id_from_auth) which expects device API key.
    // If the admin cannot query it directly without API Key, we will fall back to using default config values or handle it.
    // Let's call it and see, or pass the token.
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/config`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateDeviceConfig(deviceId, config) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/config`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(config),
    });
    return handleResponse(res);
  },

  // Sensor Data / Telemetry
  async getDeviceData(deviceId, limit = 100) {
    const res = await fetch(`${BASE_URL}/data/${deviceId}?limit=${limit}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Anomalies
  async getAnomalies(deviceId = null) {
    const url = deviceId ? `${BASE_URL}/anomalies?device_id=${deviceId}` : `${BASE_URL}/anomalies`;
    const res = await fetch(url, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Alerts
  async getAlerts(status = null, severity = null) {
    let url = `${BASE_URL}/alerts?limit=100`;
    if (status) url += `&status=${status}`;
    if (severity) url += `&severity=${severity}`;
    
    const res = await fetch(url, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async acknowledgeAlert(alertId, userId, message) {
    const res = await fetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        user_id: userId,
        acknowledgement_message: message || 'Acknowledged via UI Dashboard',
      }),
    });
    return handleResponse(res);
  },

  // Valve Control
  async getValveStatus(deviceId) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/valve/status`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getValveHistory(deviceId, limit = 50) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/valve/history?limit=${limit}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async closeValve(deviceId, reason) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/valve/close`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason: reason || 'Manual override close' }),
    });
    return handleResponse(res);
  },

  async openValve(deviceId, reason) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/valve/open`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason: reason || 'Manual override open' }),
    });
    return handleResponse(res);
  },

  // Calibration
  async getCalibrationStatus(deviceId) {
    const res = await fetch(`${BASE_URL}/devices/${deviceId}/calibration-status`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Firmware OTA
  async uploadFirmware(formData) {
    const res = await fetch(`${BASE_URL}/devices/firmware/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse(res);
  },

  // User Management
  async getUsers() {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createUser(user) {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(user),
    });
    return handleResponse(res);
  },

  async updateUser(userId, data) {
    const res = await fetch(`${BASE_URL}/users/${userId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteUser(userId) {
    const res = await fetch(`${BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errData = await res.json();
        errorMsg = errData.error || errData.detail || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    return true;
  },

  async resetUserPassword(userId, password) {
    const res = await fetch(`${BASE_URL}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });
    return handleResponse(res);
  },
};
