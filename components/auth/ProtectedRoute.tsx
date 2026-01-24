import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Navigate, useLocation, Outlet } from 'react-router-dom';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    // Decide redirect target based on attempted area
    const path = location.pathname.toLowerCase();
    const isTutorOrTutee = path.startsWith('/tutor') || path.startsWith('/tutee');
    return <Navigate to={isTutorOrTutee ? "/login" : "/admin-login"} state={{ from: location }} replace />;
  }

  // Role-based route protection
  const path = location.pathname.toLowerCase();
  if (path.startsWith('/admin')) {
    if (user.role !== 'admin' && user.user_type !== 'admin') {
      // If a non-admin tries to access admin routes, send them to the admin login
      return <Navigate to="/admin-login" replace />;
    }
  } else if (path.startsWith('/tutor')) {
    if (user.role !== 'tutor' && user.user_type !== 'tutor') {
      return <Navigate to="/login" replace />;
    }
  } else if (path.startsWith('/tutee')) {
    if (user.role !== 'tutee' && user.user_type !== 'tutee' && user.user_type !== 'student') {
      console.log('Access denied to tutee route:', { role: user.role, user_type: user.user_type });
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
