import React, { createContext, useContext, useEffect, useState } from 'react';

const EMPLOYEE_TOKEN_KEY = 'employeeToken';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(EMPLOYEE_TOKEN_KEY) : null;
}

function clearToken(): void {
  localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
}

type EmployeeAuthContextValue = {
  isEmployee: boolean | null;
};

const EmployeeAuthContext = createContext<EmployeeAuthContextValue>({ isEmployee: null });

export function useEmployeeAuth(): EmployeeAuthContextValue {
  return useContext(EmployeeAuthContext);
}

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [isEmployee, setIsEmployee] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsEmployee(false);
      return;
    }
    let cancelled = false;
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
  }, []);

  return (
    <EmployeeAuthContext.Provider value={{ isEmployee }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}
