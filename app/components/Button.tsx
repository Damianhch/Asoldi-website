import React from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps {
  text: string;
  href: string;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ text, href, className = '', variant = 'primary' }) => {
  return (
    <Link 
      to={href} 
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full px-8 py-4 font-medium transition-all duration-300 ${
        variant === 'primary' 
          ? 'bg-[#FF5B00] text-white' 
          : 'bg-transparent text-white border border-white/20 hover:bg-white hover:text-black'
      } ${className}`}
    >
      <div className="relative h-6 overflow-hidden w-full flex flex-col items-center">
        <span className="block transition-transform duration-300 ease-in-out group-hover:-translate-y-[150%]">
          {text}
        </span>
        <span className="absolute top-0 block translate-y-[150%] transition-transform duration-300 ease-in-out group-hover:translate-y-0">
          {text}
        </span>
      </div>
    </Link>
  );
};
