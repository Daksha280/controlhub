import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreateRequests: false,
    canApproveRequests: false,
    canRejectRequests: false,
    canAccessRCM: false,
    canRunCCM: false,
    canManageCAPs: false,
    isReadOnly: false
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info', duration = 4000) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev && prev.message === message ? null : prev));
    }, duration);
  };

  const updateSession = (userData, token) => {
    if (token) {
      localStorage.setItem('controlhub_token', token);
    }
    setUser(userData);
    setPermissions({
      canCreateRequests: userData.role === 'maker',
      canApproveRequests: userData.role === 'checker',
      canRejectRequests: userData.role === 'checker',
      canAccessRCM: userData.role === 'auditor',
      canRunCCM: userData.role === 'auditor',
      canManageCAPs: userData.role === 'auditor',
      isReadOnly: userData.role === 'auditor'
    });
  };

  const switchRole = async (role) => {
    try {
      setLoading(true);
      const res = await api.switchRole(role);
      updateSession(res.user, res.token);
      showToast(`Switched active profile to ${res.user.name} (${res.user.role.toUpperCase()})`, 'success');
      return res.user;
    } catch (err) {
      showToast(err.message || 'Failed to switch role', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // On initial mount, verify existing session or auto-switch to Checker (or Maker)
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('controlhub_token');
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          setPermissions(res.permissions);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('controlhub_token');
        }
      }

      // Default demo role: Checker (allows viewing both queue & dashboard)
      try {
        const res = await api.switchRole('checker');
        updateSession(res.user, res.token);
      } catch (err) {
        console.error('Failed to init demo user:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        switchRole,
        showToast,
        toast
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

