import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const LoginForgotPassword = () => (
  <>
    <Helmet>
      <title>Glemt passord – Asoldi</title>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
    <section className="min-h-screen pt-28 pb-20 px-6 bg-[#050505]">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Glemt passord?</h1>
        <p className="text-gray-400 mb-6">
          Passordtilbakestilling via e-post (OTP) kommer snart. Inntil da kan en administrator tilbakestille passordet ditt i admin-panelet.
        </p>
        <Link to="/login" className="text-[#FF5B00] hover:underline">
          ← Tilbake til innlogging
        </Link>
      </div>
    </section>
  </>
);
