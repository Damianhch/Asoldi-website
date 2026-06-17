import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClientAuth } from '../../contexts/ClientAuthContext';

export function ClientRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isClient, profile } = useClientAuth();

  useEffect(() => {
    if (loading) return;
    if (!isClient) {
      navigate('/login/kunde', { replace: true });
      return;
    }
    const isOnboarding = location.pathname === '/kunde/onboarding';
    const completed = Boolean(profile?.onboardingCompleted);
    if (!completed && !isOnboarding) {
      navigate('/kunde/onboarding', { replace: true });
      return;
    }
    if (completed && isOnboarding) {
      navigate('/kunde/hjem', { replace: true });
    }
  }, [loading, isClient, profile, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-[#6B7280]">
        Laster kundeportal…
      </div>
    );
  }

  if (!isClient) return null;

  return <>{children}</>;
}
