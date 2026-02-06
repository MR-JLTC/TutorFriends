import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import TutorLayout from '../layout/TutorLayout';
import ApplicationVerification from '../tutor/ApplicationVerification';
import ProfileSetup from '../tutor/ProfileSetup';
import AvailabilityScheduling from '../tutor/AvailabilityScheduling';
import SessionHandling from '../tutor/SessionHandling';
import EarningsHistory from '../tutor/EarningsHistory';
import SessionHistory from '../tutor/SessionHistory';
import PaymentsHistoryPage from '../tutor/PaymentsHistoryPage';
import UpcomingSessionsPage from '../shared/UpcomingSessionsPage';
// UpcomingSessions removed from the tutor sessions sidebar per UX: use the dedicated Upcoming Sessions page via the sidebar link.
import { useAuth } from '../../hooks/useAuth';
import ChatPage from '../chat/ChatPage';

const TutorDashboard: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  // don't render the small Upcoming widget in the sessions page; users should use the dedicated Upcoming Sessions page

  return (
    <TutorLayout>
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 lg:gap-6">
          <div className="lg:col-span-4 w-full">
            <Routes>
              <Route path="/" element={<Navigate to="/tutor-dashboard/application" replace />} />
              <Route path="application" element={<ApplicationVerification />} />
              <Route path="profile" element={<ProfileSetup />} />
              <Route path="availability" element={<AvailabilityScheduling />} />
              <Route path="sessions" element={<SessionHandling />} />
              <Route path="upcoming-sessions" element={<UpcomingSessionsPage />} />
              <Route path="earnings" element={<EarningsHistory />} />
              <Route path="earnings/payments" element={<PaymentsHistoryPage />} />
              <Route path="earnings/payments" element={<PaymentsHistoryPage />} />
              <Route path="session-history" element={<SessionHistory />} />
              <Route path="messages" element={<ChatPage />} />
              <Route path="*" element={<Navigate to="/tutor-dashboard/application" replace />} />
            </Routes>
          </div>
          {/* UpcomingSessions sidebar widget intentionally removed here. Use the dedicated /upcoming-sessions route accessible from the sidebar. */}
        </div>
      </div>
    </TutorLayout>
  );
};

export default TutorDashboard;