// API Client with automatic JWT Bearer token attachment
const BASE_URL = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('controlhub_token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { ...getAuthHeaders(), ...options.headers };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth & Roles
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  switchRole: (role) =>
    request('/auth/switch-role', { method: 'POST', body: JSON.stringify({ role }) }),

  getMe: () =>
    request('/auth/me'),

  getDemoUsers: () =>
    request('/auth/demo-users'),

  // Card Servicing Requests
  getRequests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/requests?${query}`);
  },

  getRequestById: (id) =>
    request(`/requests/${id}`),

  createRequest: (payload) =>
    request('/requests', { method: 'POST', body: JSON.stringify(payload) }),

  approveRequest: (id, remarks) =>
    request(`/requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ remarks }) }),

  rejectRequest: (id, remarks) =>
    request(`/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ remarks }) }),

  // Continuous Control Monitoring (CCM)
  getRules: () =>
    request('/ccm/rules'),

  getExceptions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ccm/exceptions?${query}`);
  },

  runScan: () =>
    request('/ccm/scan', { method: 'POST' }),

  updateException: (id, payload) =>
    request(`/ccm/exceptions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  escalateExceptionToCap: (id, payload) =>
    request(`/ccm/exceptions/${id}/escalate-cap`, { method: 'POST', body: JSON.stringify(payload) }),

  // Risk & Control Matrix (RCM)
  getRcmControls: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/rcm?${query}`);
  },

  updateRcmControl: (id, payload) =>
    request(`/rcm/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Corrective Action Plans (CAP)
  getCaps: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/caps?${query}`);
  },

  getCapById: (id) =>
    request(`/caps/${id}`),

  createCap: (payload) =>
    request('/caps', { method: 'POST', body: JSON.stringify(payload) }),

  updateCap: (id, payload) =>
    request(`/caps/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  signoffCap: (id) =>
    request(`/caps/${id}/signoff`, { method: 'POST' }),

  // Analytics & Dashboard
  getDashboardAnalytics: () =>
    request('/analytics/dashboard'),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit?${query}`);
  }
};

