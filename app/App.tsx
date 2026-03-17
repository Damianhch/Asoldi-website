import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { PageLoader } from './components/PageLoader';
import { EmployeeAuthProvider } from './contexts/EmployeeAuthContext';

// Lazy-load pages so only the current route's JS is loaded. Reduces initial bundle and speeds up first paint.
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Pricing = lazy(() => import('./pages/Pricing').then(m => ({ default: m.Pricing })));
const AboutUs = lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })));
const WebDevelopment = lazy(() => import('./pages/WebDevelopment').then(m => ({ default: m.WebDevelopment })));
const SocialMediaMarketing = lazy(() => import('./pages/SocialMediaMarketing').then(m => ({ default: m.SocialMediaMarketing })));
const EmailMarketing = lazy(() => import('./pages/EmailMarketing').then(m => ({ default: m.EmailMarketing })));
const PhotoVideo = lazy(() => import('./pages/PhotoVideo').then(m => ({ default: m.PhotoVideo })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const Booking = lazy(() => import('./pages/Booking').then(m => ({ default: m.Booking })));
const Page1000kr = lazy(() => import('./pages/1000kr').then(m => ({ default: m.Page1000kr })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Admin = lazy(() => import('./pages/Admin/Admin').then(m => ({ default: m.Admin })));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin/SuperAdmin').then(m => ({ default: m.SuperAdmin })));
const LoginForgotPassword = lazy(() => import('./pages/LoginForgotPassword').then(m => ({ default: m.LoginForgotPassword })));
const Ansatt = lazy(() => import('./pages/Ansatt').then(m => ({ default: m.Ansatt })));

function AppLayout() {
  const location = useLocation();
  const isAdminArea = location.pathname === '/admin' || location.pathname === '/superadmin' || location.pathname === '/ansatt';
  return (
    <div className="bg-[#050505] min-h-screen text-white font-sans selection:bg-white/20">
      {!isAdminArea && <Navbar />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/services/web-development" element={<WebDevelopment />} />
          <Route path="/services/social-media" element={<SocialMediaMarketing />} />
          <Route path="/services/email-marketing" element={<EmailMarketing />} />
          <Route path="/services/photo-video" element={<PhotoVideo />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/forgot-password" element={<LoginForgotPassword />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/ansatt" element={<Ansatt />} />
          <Route path="/1000kr" element={<Page1000kr />} />
        </Routes>
      </Suspense>
      {!isAdminArea && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <EmployeeAuthProvider>
        <ScrollToTop />
        <AppLayout />
      </EmployeeAuthProvider>
    </Router>
  );
}
