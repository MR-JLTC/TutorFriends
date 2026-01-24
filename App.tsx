import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/auth/AdminLoginPage';
import RegistrationPage from './components/auth/AdminRegistrationPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './components/adminPages/Dashboard';
import UserManagement from './components/adminPages/UserManagement';
import TutorManagement from './components/adminPages/TutorManagement';
import UniversityManagement from './components/adminPages/UniversityManagement';
import CourseManagement from './components/adminPages/CourseManagement';
import PaymentManagement from './components/adminPages/PaymentManagement';
import AdminProfile from './components/adminPages/AdminProfile';
import LandingPage from './components/Tutor_TuteePages/LandingPage';
import TuteeRegistrationPage from './components/Tutor_TuteePages/TuteeRegistrationPage';
import TutorRegistrationPage from './components/Tutor_TuteePages/TutorRegistrationPage';
import TuteeRegistrationPageFull from './components/Tutor_TuteePages/TuteeRegistrationPageFull';
import TutorRegistrationPageFull from './components/Tutor_TuteePages/TutorRegistrationPageFull';
import TutorDashboard from './components/Tutor_TuteePages/TutorDashboard';
import TuteeDashboard from './components/Tutor_TuteePages/TuteeDashboard';
import UnifiedLoginPage from './components/auth/UnifiedLoginPage';
import PasswordResetPage from './components/auth/PasswordResetPage';
import BookingsPage from './components/shared/BookingsPage';

const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      {/* Default redirect for empty path */}
      <Route path="/" element={<Navigate to="/LandingPage" replace />} />

      {/* Protected routes - Move to top for higher priority matching */}
      <Route element={<ProtectedRoute />}>
        {/* Admin routes */}
        <Route path="/admin/*" element={
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="tutors" element={<TutorManagement />} />
              <Route path="universities" element={<UniversityManagement />} />
              <Route path="courses" element={<CourseManagement />} />
              <Route path="payments" element={<PaymentManagement />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </DashboardLayout>
        } />

        {/* Tutor routes */}
        <Route path="/tutor-dashboard/*" element={<TutorDashboard />} />

        {/* Tutee routes */}
        <Route path="/tutee-dashboard/*" element={<TuteeDashboard />} />

        {/* Shared: Upcoming Sessions */}
      </Route>

      {/* Public routes */}
      <Route path="/LandingPage" element={<LandingPage />} />
      <Route path="/landingpage" element={<LandingPage />} />
      <Route path="/TuteeRegistrationPage" element={<TuteeRegistrationPageFull />} />
      <Route path="/TutorRegistrationPage" element={<TutorRegistrationPageFull />} />
      <Route path="/login" element={<UnifiedLoginPage />} />
      <Route path="/password-reset" element={<PasswordResetPage />} />
      <Route path="/admin-login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />

      {/* Default redirect for unmatched paths */}
      <Route path="*" element={<Navigate to="/LandingPage" replace />} />
    </Routes>
  );
};

export default App;
