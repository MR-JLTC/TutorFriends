import React from 'react';
import { useNavigate } from 'react-router-dom';
import TutorRegistrationPage from './TutorRegistrationPage';

/**
 * Full-page version of Tutor Registration for mobile devices
 * This component always renders as a full page (not a modal)
 */
const TutorRegistrationPageFull: React.FC = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/LandingPage');
  };

  // Render as full page by not passing isOpen prop
  return <TutorRegistrationPage isOpen={undefined} onClose={handleClose} />;
};

export default TutorRegistrationPageFull;

