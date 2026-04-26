import React from 'react';

const PesoIcon = ({ className = "h-5 w-5", ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M7 6h6a4 4 0 0 1 0 8H7" />
    <path d="M5 10h10" />
    <path d="M5 14h10" />
    <path d="M7 18v-12" />
  </svg>
);

export default PesoIcon;
