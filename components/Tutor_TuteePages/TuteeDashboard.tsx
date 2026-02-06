import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import TuteeLayout from '../layout/TuteeLayout';
import TuteeBecomeTutor from '../tutee/TuteeBecomeTutor';
import TuteeFindAndBookTutors from '../tutee/TuteeFindAndBookTutors';
import TuteePayment from '../tutee/TuteePayment';
import TuteeAfterSession from '../tutee/TuteeAfterSession';
import UpcomingSessionsPage from '../shared/UpcomingSessionsPage';
// import BookingsPage from '../shared/BookingsPage'; // Removed
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types/index';
import TuteeMyBookings from '../tutee/TuteeMyBookings';
import TuteeProfile from '../tutee/TuteeProfile';
import ChatPage from '../chat/ChatPage';

const TuteeDashboard: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isMyBookingsRoute = location.pathname.includes('/tutee-dashboard/my-bookings');

  return (
    <TuteeLayout>
      <div className="w-full">
        <div className={isMyBookingsRoute ? "lg:col-span-3" : "lg:col-span-4"}>
          <Routes>
            <Route path="/" element={<Navigate to="/tutee-dashboard/become-tutor" replace />} />
            <Route path="become-tutor" element={<TuteeBecomeTutor />} />
            <Route path="find-tutors" element={<TuteeFindAndBookTutors />} />
            <Route path="my-bookings" element={<TuteeMyBookings />} />
            <Route path="profile" element={<TuteeProfile />} />
            <Route path="upcoming-sessions" element={<UpcomingSessionsPage />} />
            <Route path="payment" element={<TuteePayment />} />
            <Route path="after-session" element={<TuteeAfterSession />} />
            <Route path="messages" element={<ChatPage />} />
            <Route path="*" element={<Navigate to="/tutee-dashboard/become-tutor" replace />} />
          </Routes>
        </div>
        {/* Upcoming bookings widget removed from My Bookings per UX change; upcoming bookings are available via the sidebar "Upcoming Bookings" page. */}
      </div>
    </TuteeLayout>
  );
};

export default TuteeDashboard;
