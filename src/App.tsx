import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Pricing } from './pages/Pricing';
import { AboutUs } from './pages/AboutUs';
import { WebDevelopment } from './pages/WebDevelopment';
import { SocialMediaMarketing } from './pages/SocialMediaMarketing';
import { EmailMarketing } from './pages/EmailMarketing';
import { PhotoVideo } from './pages/PhotoVideo';
import { Clients } from './pages/Clients';
import { Booking } from './pages/Booking';

export default function App() {
  return (
    <Router>
      <div className="bg-[#050505] min-h-screen text-white font-sans selection:bg-white/20">
        <Navbar />
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
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
