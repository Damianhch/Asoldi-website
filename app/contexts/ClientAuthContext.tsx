import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CLIENT_TOKEN_KEY = 'clientToken';
const CLIENT_AUTH_EVENT = 'client-auth-changed';

type ClientProfile = {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  businessOrgNumber?: string;
  position: string;
  discoveryChannel: string;
  onboardingCompleted: boolean;
  customWebsitePlan?: {
    title: string;
    subtitle: string;
    monthlyPrice: string;
    highlighted: boolean;
  };
  websiteBuilder?: {
    existingWebsiteCode: string;
    selectedPlanId: string;
    selectedPlanName: string;
    selectedPlanPrice: string;
    selectedPlanType: string;
    lastCheckoutStartedAt: string;
  };
  payment?: {
    status?: string;
    method?: string;
    planId?: string;
    planName?: string;
    amount?: number;
    currency?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeSessionId?: string;
    paidAt?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
    cancelAt?: string;
    canceledAt?: string;
    updatedAt?: string;
  };
  clientDataBank?: Record<string, any>;
};

type ClientAuthUser = {
  id: string;
  email: string;
  role: 'client';
};

type ClientAuthContextValue = {
  loading: boolean;
  isClient: boolean;
  user: ClientAuthUser | null;
  profile: ClientProfile | null;
  token: string;
  setClientSession: (token: string) => Promise<void>;
  clearClientSession: () => void;
  refreshClientSession: () => Promise<void>;
  authHeaders: () => Record<string, string>;
  updateProfileState: (next: ClientProfile | null) => void;
};

const ClientAuthContext = createContext<ClientAuthContextValue>({
  loading: true,
  isClient: false,
  user: null,
  profile: null,
  token: '',
  setClientSession: async () => {},
  clearClientSession: () => {},
  refreshClientSession: async () => {},
  authHeaders: () => ({}),
  updateProfileState: () => {},
});

function getClientToken() {
  return typeof window !== 'undefined' ? localStorage.getItem(CLIENT_TOKEN_KEY) || '' : '';
}

function setClientToken(token: string) {
  localStorage.setItem(CLIENT_TOKEN_KEY, token);
}

function removeClientToken() {
  localStorage.removeItem(CLIENT_TOKEN_KEY);
}

export function useClientAuth() {
  return useContext(ClientAuthContext);
}

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<ClientAuthUser | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  const refreshClientSession = useCallback(async () => {
    const existing = getClientToken();
    if (!existing) {
      setToken('');
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setToken(existing);
    try {
      const response = await fetch('/api/client/auth/me', {
        headers: {
          Authorization: `Bearer ${existing}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        removeClientToken();
        setToken('');
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(data.user || null);
      setProfile(data.profile || null);
    } catch {
      // Keep local token but clear resolved identity on network failures.
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearClientSession = useCallback(() => {
    removeClientToken();
    setToken('');
    setUser(null);
    setProfile(null);
    window.dispatchEvent(new Event(CLIENT_AUTH_EVENT));
  }, []);

  const setClientSession = useCallback(async (nextToken: string) => {
    if (!nextToken) {
      clearClientSession();
      return;
    }
    setClientToken(nextToken);
    setToken(nextToken);
    window.dispatchEvent(new Event(CLIENT_AUTH_EVENT));
    await refreshClientSession();
  }, [clearClientSession, refreshClientSession]);

  useEffect(() => {
    void refreshClientSession();
  }, [refreshClientSession]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CLIENT_TOKEN_KEY) {
        void refreshClientSession();
      }
    };
    const handleAuthChange = () => {
      void refreshClientSession();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CLIENT_AUTH_EVENT, handleAuthChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CLIENT_AUTH_EVENT, handleAuthChange as EventListener);
    };
  }, [refreshClientSession]);

  const value = useMemo<ClientAuthContextValue>(() => ({
    loading,
    isClient: Boolean(user?.id),
    user,
    profile,
    token,
    setClientSession,
    clearClientSession,
    refreshClientSession,
    authHeaders: () => (token ? { Authorization: `Bearer ${token}` } : {}),
    updateProfileState: (next) => setProfile(next),
  }), [loading, user, profile, token, setClientSession, clearClientSession, refreshClientSession]);

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}
