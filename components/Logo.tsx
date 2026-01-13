import React from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

const Logo: React.FC<LogoProps> = ({ className = '', style }) => {
  const logoSrc = "assets/images/tutorfriends-logo.png";
  return <img src={logoSrc} alt="TutorFriends Logo" className={className} style={style} />;;
};

// FIX: The component was not exported, causing a module resolution error in LandingPage.tsx.
export default Logo;
