import React, { createContext, useContext, useEffect, useState } from 'react';

const EMPLOYEE_TOKEN_KEY = 'employeeToken';
const EMPLOYEE_AUTH_EVENT = 'employee-auth-changed';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(EMPLOYEE_TOKEN_KEY) : null;
}

function clearToken(): void {
  localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
}

type EmployeeAuthContextValue = {
  isEmployee: boolean | null;
  refreshEmployeeAuth: () => void;
};

const EmployeeAuthContext = createContext<EmployeeAuthContextValue>({
  isEmployee: null,
  refreshEmployeeAuth: () => {},
});

export function useEmployeeAuth(): EmployeeAuthContextValue {
  return useContext(EmployeeAuthContext);
}

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [isEmployee, setIsEmployee] = useState<boolean | null>(null);
  const [authNonce, setAuthNonce] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsEmployee(false);
      return;
    }
    let cancelled = false;
    // Optimistic: show employee UI immediately; we verify below.
    setIsEmployee(true);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 200) {
          res.json().then((data) => {
            if (!cancelled) setIsEmployee(data.user?.role === 'employee');
          }).catch(() => {
            if (!cancelled) setIsEmployee(false);
          });
        } else {
          if (res.status === 401 || res.status === 403) clearToken();
          if (!cancelled) setIsEmployee(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsEmployee(false);
      });
    return () => { cancelled = true; };
  }, [authNonce]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === EMPLOYEE_TOKEN_KEY) setAuthNonce((n) => n + 1);
    };
    const onAuthEvent = () => setAuthNonce((n) => n + 1);
    window.addEventListener('storage', onStorage);
    window.addEventListener(EMPLOYEE_AUTH_EVENT, onAuthEvent as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EMPLOYEE_AUTH_EVENT, onAuthEvent as EventListener);
    };
  }, []);

  return (
    <EmployeeAuthContext.Provider value={{ isEmployee, refreshEmployeeAuth: () => setAuthNonce((n) => n + 1) }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}
