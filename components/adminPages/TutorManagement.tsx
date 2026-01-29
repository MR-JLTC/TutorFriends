import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Tutor, TutorSubject } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Check, X, FileText, User, Mail, School, Book, Clock, CreditCard } from 'lucide-react';
import { getFileUrl } from '../../services/api';

const TutorManagement: React.FC = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewType, setPreviewType] = useState<string>('');

  // Tutor subject states
  const [tutorSubjects, setTutorSubjects] = useState<TutorSubject[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(true);
  const [selectedTutorSubject, setSelectedTutorSubject] = useState<TutorSubject | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isSubjectUpdating, setIsSubjectUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [tutorRejectionNotes, setTutorRejectionNotes] = useState<string>('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [pendingRejectionAction, setPendingRejectionAction] = useState<(() => void) | null>(null);

  const fetchTutors = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tutors/applications');
      setTutors(response.data);
    } catch (e) {
      setError('Failed to fetch tutor applications.');
      console.error(e);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Unable to load tutor applications. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTutorSubjects = async () => {
    try {
      setSubjectLoading(true);
      const response = await apiClient.get('/tutors/pending-subjects');
      setTutorSubjects(response.data);
    } catch (e) {
      console.error('Failed to fetch tutor subjects:', e);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Unable to load tutor subjects. Please try again.', 'error');
    } finally {
      setSubjectLoading(false);
    }
  };

  useEffect(() => {
    fetchTutors();
    fetchTutorSubjects();
  }, []);

  const handleViewDetails = (tutor: Tutor) => {
    setSelectedTutor(tutor);
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!selectedTutor) return;

    // If rejecting, show modal to collect rejection reason
    if (status === 'rejected') {
      setTutorRejectionNotes('');
      // Create action that will read tutorRejectionNotes from state when executed
      setPendingRejectionAction(() => async () => {
        // Read current state value when button is clicked, not when closure is created
        await performStatusUpdate(status);
      });
      setShowRejectionModal(true);
      return;
    }

    // For approval, proceed directly
    await performStatusUpdate(status);
  };

  const performStatusUpdate = async (status: 'approved' | 'rejected', rejectionNotes?: string) => {
    if (!selectedTutor) return;
    setIsUpdating(true);
    try {
      // Prepare adminNotes: For rejected status, this will be saved to tutors.admin_notes database column
      let adminNotes: string | undefined = undefined;
      if (status === 'rejected') {
        // Use rejectionNotes parameter if provided, otherwise fall back to state
        const notesToUse = rejectionNotes !== undefined ? rejectionNotes : tutorRejectionNotes.trim();
        if (notesToUse.length > 0) {
          adminNotes = notesToUse;
          console.log(`[Frontend] Admin rejection reason entered: "${adminNotes}"`);
          console.log(`[Frontend] This will be stored in tutors.admin_notes database column`);
        } else {
          console.error(`[Frontend] ERROR: Rejecting without admin notes - modal validation should prevent this!`);
          alert('Please provide a rejection reason before confirming.');
          setIsUpdating(false);
          return;
        }
      }

      console.log(`[Frontend] Sending PATCH request to update tutor ${selectedTutor.tutor_id} status to '${status}'`);
      console.log(`[Frontend] Admin notes being sent to backend (will be saved to tutors.admin_notes):`, adminNotes || 'undefined');

      // Send request to backend - adminNotes will be saved to tutors.admin_notes database column
      await apiClient.patch(`/tutors/${selectedTutor.tutor_id}/status`, {
        status,
        adminNotes: adminNotes // This will be saved to tutors.admin_notes column in database
      });

      // If rejecting, automatically reject all pending subject applications
      if (status === 'rejected') {
        try {
          // Fetch all subject applications for this tutor
          const subjectAppsResponse = await apiClient.get(`/tutors/${selectedTutor.tutor_id}/subject-applications`);
          const subjectApplications = subjectAppsResponse.data || [];

          // Filter for pending applications and reject them
          const pendingSubjects = subjectApplications.filter((app: any) => app.status === 'pending');

          if (pendingSubjects.length > 0) {
            // Create rejection note that explains the main application was rejected
            const mainRejectionReason = adminNotes ? adminNotes : 'No specific reason provided';
            const rejectionNote = `Automatically rejected: Main tutor application was rejected. Reason: ${mainRejectionReason}`;

            // Reject each pending subject application
            const rejectionPromises = pendingSubjects.map((subjectApp: any) =>
              apiClient.patch(`/tutors/tutor-subjects/${subjectApp.id}/status`, {
                status: 'rejected',
                adminNotes: rejectionNote
              })
            );

            await Promise.all(rejectionPromises);
            console.log(`Automatically rejected ${pendingSubjects.length} pending subject application(s) for tutor ${selectedTutor.tutor_id}`);
          }
        } catch (subjectError) {
          console.error('Failed to auto-reject subject applications:', subjectError);
          // Don't fail the whole operation if subject rejection fails
          // Log it but continue with the main rejection
        }
      }

      setIsModalOpen(false);
      setShowRejectionModal(false);
      setTutorRejectionNotes('');
      // Refetch tutors and tutor subjects to update the lists
      await fetchTutors();
      await fetchTutorSubjects();
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify(`Application ${status === 'approved' ? 'approved' : 'rejected'} successfully.${status === 'rejected' ? ' All pending subject applications have also been rejected.' : ''}`, 'success');
    } catch (err) {
      console.error("Failed to update status", err);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to update application status. Please try again.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Tutor subject handlers
  const handleViewSubjectDetails = (tutorSubject: TutorSubject) => {
    setSelectedTutorSubject(tutorSubject);
    setAdminNotes(tutorSubject.admin_notes || '');
    setIsSubjectModalOpen(true);
  };

  const handleSubjectStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!selectedTutorSubject) return;
    setIsSubjectUpdating(true);
    try {
      await apiClient.patch(`/tutors/tutor-subjects/${selectedTutorSubject.tutor_subject_id}/status`, {
        status,
        adminNotes: adminNotes.trim() || undefined
      });
      setIsSubjectModalOpen(false);
      setAdminNotes('');
      // Refetch tutor subjects to update the list
      await fetchTutorSubjects();
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify(`Tutor subject ${status === 'approved' ? 'approved' : 'rejected'} successfully.`, 'success');
    } catch (err) {
      console.error("Failed to update tutor subject status", err);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to update tutor subject status. Please try again.', 'error');
    } finally {
      setIsSubjectUpdating(false);
    }
  };

  const handleOpenDocument = (fileUrl: string, fileType?: string) => {
    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.startsWith('image/') || normalizedType === 'application/pdf') {
      setPreviewUrl(fileUrl);
      setPreviewType(normalizedType);
      setIsPreviewOpen(true);
      return;
    }
    // Fallback: try extension-based handling
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) {
      setPreviewUrl(fileUrl);
      setPreviewType('application/pdf');
      setIsPreviewOpen(true);
      return;
    }
    if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/.test(lower)) {
      setPreviewUrl(fileUrl);
      setPreviewType('image/*');
      setIsPreviewOpen(true);
      return;
    }
    // As a last resort, open in new tab
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };


  if (loading) return <div>Loading applications...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Tutor Application Management</h1>

      <Card>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Pending Applications ({tutors.length})</h2>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tutors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No pending applications found.</td>
                </tr>
              ) : (
                tutors.map((tutor) => (
                  <tr key={tutor.tutor_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {tutor.user?.profile_image_url ? (
                          <img
                            src={getFileUrl(tutor.user.profile_image_url)}
                            alt="Tutor"
                            className="h-8 w-8 rounded-full object-cover border flex-shrink-0"
                            style={{ aspectRatio: '1 / 1' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`;
                            }}
                          />
                        ) : (
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`}
                            alt="Tutor"
                            className="h-8 w-8 rounded-full object-cover border flex-shrink-0"
                            style={{ aspectRatio: '1 / 1' }}
                          />
                        )}
                        <span className="truncate max-w-[200px]">{tutor.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tutor as any).university?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tutor as any).course?.course_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center">
                        <Button onClick={() => handleViewDetails(tutor)}>View Details</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View for Applications */}
        <div className="md:hidden space-y-3 mt-4">
          {tutors.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No pending applications found.</p>
          ) : (
            tutors.map((tutor) => (
              <Card key={tutor.tutor_id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {tutor.user?.profile_image_url ? (
                      <img
                        src={getFileUrl(tutor.user.profile_image_url)}
                        alt="Tutor"
                        className="h-12 w-12 rounded-full object-cover border flex-shrink-0"
                        style={{ aspectRatio: '1 / 1' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`;
                        }}
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`}
                        alt="Tutor"
                        className="h-12 w-12 rounded-full object-cover border flex-shrink-0"
                        style={{ aspectRatio: '1 / 1' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{tutor.user?.name}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">University</p>
                      <p className="font-medium text-slate-900 truncate">{(tutor as any).university?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Course</p>
                      <p className="font-medium text-slate-900 truncate">{(tutor as any).course?.course_name || 'N/A'}</p>
                    </div>
                  </div>
                  <Button onClick={() => handleViewDetails(tutor)} className="w-full">View Details</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>

      {/* Tutor Subjects Section */}
      <Card className="mt-6 sm:mt-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Pending Subject Expertise ({tutorSubjects.length})</h2>
        {subjectLoading ? (
          <div className="text-center py-4 text-sm">Loading tutor subjects...</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tutorSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No pending subject expertise found.</td>
                    </tr>
                  ) : (
                    tutorSubjects.map((tutorSubject) => (
                      <tr key={tutorSubject.tutor_subject_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-3">
                            {(tutorSubject.tutor.user as any)?.profile_image_url ? (
                              <img
                                src={getFileUrl((tutorSubject.tutor.user as any).profile_image_url)}
                                alt="Tutor"
                                className="h-8 w-8 rounded-full object-cover border flex-shrink-0"
                                style={{ aspectRatio: '1 / 1' }}
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-slate-200 border flex-shrink-0" />
                            )}
                            <span className="truncate max-w-[200px]">{(tutorSubject.tutor as any)?.user?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {(tutorSubject.subject as any)?.subject_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(tutorSubject.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex justify-center">
                            <Button onClick={() => handleViewSubjectDetails(tutorSubject)}>View Details</Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Tutor Subjects */}
            <div className="md:hidden space-y-3 mt-4">
              {tutorSubjects.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No pending subject expertise found.</p>
              ) : (
                tutorSubjects.map((tutorSubject) => (
                  <Card key={tutorSubject.tutor_subject_id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {(tutorSubject.tutor.user as any)?.profile_image_url ? (
                          <img
                            src={getFileUrl((tutorSubject.tutor.user as any).profile_image_url)}
                            alt="Tutor"
                            className="h-12 w-12 rounded-full object-cover border flex-shrink-0"
                            style={{ aspectRatio: '1 / 1' }}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-slate-200 border flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{(tutorSubject.tutor as any)?.user?.name}</h3>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs mb-1">Subject</p>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {(tutorSubject.subject as any)?.subject_name}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs mb-1">Applied Date</p>
                          <p className="font-medium text-slate-900">{new Date(tutorSubject.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button onClick={() => handleViewSubjectDetails(tutorSubject)} className="w-full">View Details</Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </Card>

      {selectedTutor && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Application Details`} maxWidth="5xl"
          footer={
            <div className="flex flex-row items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
              <Button
                onClick={() => handleStatusUpdate('rejected')}
                variant="danger"
                disabled={isUpdating}
                className="flex items-center"
              >
                <X className="mr-2 h-4 w-4" />
                {isUpdating ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button
                onClick={() => handleStatusUpdate('approved')}
                variant="primary"
                disabled={isUpdating}
                className="flex items-center"
              >
                <Check className="mr-2 h-4 w-4" />
                {isUpdating ? 'Approving...' : 'Approve'}
              </Button>
            </div>
          }
        >
          <div className="space-y-6 sm:space-y-8">
            {/* Enhanced Header Section */}
            <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-6 sm:p-8 rounded-2xl text-white relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-2xl"></div>
                <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-xl"></div>
              </div>
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
                {selectedTutor.user?.profile_image_url ? (
                  <div className="flex-shrink-0">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-white/40 shadow-2xl overflow-hidden bg-white/20 backdrop-blur-sm transform hover:scale-105 transition-transform duration-300">
                      <img src={getFileUrl(selectedTutor.user.profile_image_url)} alt="Tutor Profile" className="w-full h-full object-cover" style={{ aspectRatio: '1/1' }} />
                    </div>
                  </div>
                ) : (
                  <div className="flex-shrink-0">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-white/40 shadow-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <User className="h-12 w-12 sm:h-14 sm:w-14 text-white/80" />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2 drop-shadow-lg">{selectedTutor.user?.name}</h3>
                  <div className="flex flex-col gap-1.5 text-white/95">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      <p className="text-sm sm:text-base truncate">{selectedTutor.user?.email}</p>
                    </div>
                    {/* Course - Now below email */}
                    {(selectedTutor as any).course?.course_name && (
                      <div className="flex items-center gap-2">
                        <Book className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <p className="text-sm sm:text-base truncate">{(selectedTutor as any).course?.course_name}</p>
                      </div>
                    )}
                    {/* University - Now below course */}
                    {(selectedTutor as any).university?.name && (
                      <div className="flex items-center gap-2">
                        <School className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <p className="text-sm sm:text-base truncate">{(selectedTutor as any).university?.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Body - Row Layout */}
            <div className="space-y-6 sm:space-y-8">

              {/* Row 1: Bio and Session Rate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Bio Card */}
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Bio</h4>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-50 p-3.5 sm:p-4 rounded-xl border-2 border-slate-200/50 shadow-sm min-h-[80px]">
                    <p className="text-slate-700 leading-relaxed text-sm">{selectedTutor.bio || <span className="text-slate-400 italic">No bio provided.</span>}</p>
                  </div>
                </div>

                {/* Session Rate Card */}
                <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-primary-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <h4 className="text-base sm:text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Session Rate</h4>
                  </div>
                  <div className="bg-white p-3.5 sm:p-4 rounded-xl border-2 border-primary-200/50 shadow-lg">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-2">Rate per hour</span>
                    <p className="text-primary-700 font-bold text-lg sm:text-xl">
                      {(selectedTutor as any).session_rate_per_hour
                        ? `₱${Number((selectedTutor as any).session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : <span className="text-slate-400 italic text-sm">Not specified</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Row 2: Expert Subjects Card */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <Book className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Expert Subjects</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedTutor as any).subjects?.length ? (selectedTutor as any).subjects.map((ts: any) => (
                    <span key={(ts as any).tutor_subject_id} className="px-3 py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 border border-primary-400/30">
                      {(ts as any).subject?.subject_name}
                    </span>
                  )) : <span className="text-xs sm:text-sm text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">No subjects submitted.</span>}
                </div>
              </div>

              {/* Row 3: Availability Card */}
              <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-primary-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Availability</h4>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(selectedTutor as any).availabilities?.length ? (() => {
                    // Group availabilities by day_of_week
                    const grouped = (selectedTutor as any).availabilities.reduce((acc: any, a: any) => {
                      const day = (a as any).day_of_week;
                      if (!acc[day]) {
                        acc[day] = [];
                      }
                      acc[day].push(a);
                      return acc;
                    }, {} as Record<string, any[]>);

                    return Object.entries(grouped).map(([day, slots]) => (
                      <li key={day} className="bg-white p-3.5 sm:p-4 rounded-xl border-2 border-primary-200/50 hover:border-primary-400 hover:shadow-lg transition-all duration-200 shadow-sm">
                        <div className="flex flex-col gap-2">
                          <span className="font-bold text-slate-800 text-sm sm:text-base flex-shrink-0 min-w-[100px]">{day}</span>
                          <div className="flex flex-wrap gap-2">
                            {slots.map((slot: any) => (
                              <span key={slot.availability_id} className="text-primary-700 font-semibold text-xs sm:text-sm bg-gradient-to-r from-primary-50 to-primary-100/50 px-2.5 py-1.5 rounded-lg border border-primary-200 whitespace-nowrap">
                                {slot.start_time} - {slot.end_time}
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    ));
                  })() : <li className="text-sm text-slate-400 italic bg-white p-3.5 sm:p-4 rounded-xl border-2 border-slate-200 text-center col-span-full">No availability submitted.</li>}
                </ul>
              </div>

              {/* Row 4: Submitted Documents Card */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Submitted Documents</h4>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTutor.documents?.length ? selectedTutor.documents.map(doc => (
                    <li key={doc.document_id} className="flex items-center justify-between bg-gradient-to-r from-slate-50 via-primary-50/50 to-slate-50 rounded-xl p-3 border-2 border-slate-200/50 hover:border-primary-300 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mr-2.5 flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary-600" />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                          className="text-primary-700 hover:text-primary-900 hover:underline truncate text-left text-xs sm:text-sm font-semibold"
                          title="Open file"
                        >
                          {doc.file_name}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                          className="text-xs px-2.5 py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                        >
                          Open
                        </button>
                        <a href={getFileUrl(doc.file_url)} download className="text-xs px-2.5 py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200">
                          Download
                        </a>
                      </div>
                    </li>
                  )) : <li className="text-xs sm:text-sm text-slate-400 italic bg-slate-50 p-3 rounded-xl border-2 border-slate-200 text-center col-span-full">No documents uploaded.</li>}
                </ul>
              </div>

              {/* Row 5: GCash Information Card */}
              <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-primary-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-base sm:text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">GCash Payment</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(selectedTutor as any).gcash_number && (
                    <div className="bg-white p-3 rounded-xl border-2 border-primary-200/50 shadow-lg">
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1.5">GCash Number</span>
                      <p className="text-primary-700 font-bold text-sm sm:text-base">
                        {(selectedTutor as any).gcash_number}
                      </p>
                    </div>
                  )}
                  {(selectedTutor as any).gcash_qr_url && (
                    <div className="bg-white p-3 rounded-xl border-2 border-primary-200/50 shadow-lg">
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-2">GCash QR Code</span>
                      <div className="flex justify-center bg-gradient-to-br from-primary-50 to-primary-100/50 p-2 rounded-xl border border-primary-200/50">
                        <img
                          src={getFileUrl((selectedTutor as any).gcash_qr_url)}
                          alt="GCash QR Code"
                          className="max-w-full h-auto rounded-xl border-2 border-primary-300 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
                          style={{ maxHeight: '180px' }}
                          onClick={() => handleOpenDocument(getFileUrl((selectedTutor as any).gcash_qr_url), 'image/*')}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              parent.innerHTML = '<p class="text-xs text-slate-400 italic">QR code image not available</p>';
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {!(selectedTutor as any).gcash_number && !(selectedTutor as any).gcash_qr_url && (
                    <div className="bg-white p-3 rounded-xl border-2 border-primary-200/50 shadow-lg col-span-full">
                      <p className="text-xs text-slate-400 italic text-center">No GCash information provided.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Tutor Subject Modal */}
      {selectedTutorSubject && (
        <Modal
          isOpen={isSubjectModalOpen}
          onClose={() => {
            setIsSubjectModalOpen(false);
            setAdminNotes('');
          }}
          title="Subject Expertise Details"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => handleSubjectStatusUpdate('rejected')}
                variant="danger"
                disabled={isSubjectUpdating}
                className="flex items-center"
              >
                <X className="mr-2 h-4 w-4" />
                {isSubjectUpdating ? 'Rejecting...' : 'Reject'}
              </Button>

              <Button
                onClick={() => handleSubjectStatusUpdate('approved')}
                variant="primary"
                disabled={isSubjectUpdating}
                className="flex items-center"
              >
                <Check className="mr-2 h-4 w-4" />
                {isSubjectUpdating ? 'Approving...' : 'Approve'}
              </Button>
            </div>
          }
        >

          <div className="space-y-5 sm:space-y-6">
            {/* Enhanced Header */}
            <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-5 sm:p-6 rounded-2xl text-white relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12 blur-xl"></div>
              </div>
              <div className="relative">
                <h3 className="text-xl sm:text-2xl font-bold mb-2 drop-shadow-lg">{(selectedTutorSubject.tutor as any)?.user?.name}</h3>
                <div className="flex items-center gap-2 text-white/95">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm sm:text-base truncate">{(selectedTutorSubject.tutor as any)?.user?.email}</p>
                </div>
              </div>
            </div>

            {/* Subject Expertise Details */}
            <div className="space-y-4 sm:space-y-5">
              {/* Subject Expertise Card */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <Book className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Subject Expertise</h4>
                </div>
                <div className="mt-3">
                  <span className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm sm:text-base font-semibold shadow-md border border-primary-400/30">
                    {(selectedTutorSubject.subject as any)?.subject_name}
                  </span>
                </div>
              </div>

              {/* Application Date Card */}
              <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-primary-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Application Date</h4>
                </div>
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border-2 border-primary-200/50 shadow-sm">
                  <p className="text-slate-800 font-semibold text-sm sm:text-base">
                    {new Date(selectedTutorSubject.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Supporting Documents Card */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Supporting Documents</h4>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {(selectedTutorSubject as any).documents?.length ? (selectedTutorSubject as any).documents.map((doc: any) => (
                    <li key={doc.id} className="flex items-center justify-between bg-gradient-to-r from-slate-50 via-primary-50/50 to-slate-50 rounded-xl p-3 border-2 border-slate-200/50 hover:border-primary-300 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mr-2.5 flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary-600" />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                          className="text-primary-700 hover:text-primary-900 hover:underline truncate text-left text-xs sm:text-sm font-semibold"
                          title="Open file"
                        >
                          {doc.file_name}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                          className="text-xs px-2.5 py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                        >
                          Open
                        </button>
                        <a href={getFileUrl(doc.file_url)} download className="text-xs px-2.5 py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200">
                          Download
                        </a>
                      </div>
                    </li>
                  )) : <li className="text-xs sm:text-sm text-slate-400 italic bg-slate-50 p-3 rounded-xl border-2 border-slate-200 text-center">No supporting documents uploaded.</li>}
                </ul>
              </div>

              {/* Admin Notes Card */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/50 hover:shadow-2xl hover:border-primary-300 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex-shrink-0 shadow-lg">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Admin Notes</h4>
                </div>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for this subject expertise..."
                  className="w-full p-3.5 border-2 border-slate-200 rounded-xl mt-3 min-h-[100px] resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white text-sm"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={showRejectionModal}
        onClose={() => {
          setShowRejectionModal(false);
          setTutorRejectionNotes('');
          setPendingRejectionAction(null);
        }}
        title="Rejection Reason"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowRejectionModal(false);
                setTutorRejectionNotes('');
                setPendingRejectionAction(null);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                // Read the rejection notes directly from state when button is clicked
                const rejectionReason = tutorRejectionNotes.trim();

                if (!rejectionReason) {
                  alert('Please provide a rejection reason before confirming.');
                  return;
                }

                console.log(`[Frontend] Modal Confirm clicked - Rejection reason from state: "${rejectionReason}"`);

                // Call performStatusUpdate directly with the rejection notes
                if (pendingRejectionAction) {
                  // Pass the rejection reason directly to avoid closure issues
                  await performStatusUpdate('rejected', rejectionReason);
                }
              }}
              disabled={isUpdating || !tutorRejectionNotes.trim()}
            >
              {isUpdating ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Please provide a reason for rejecting this tutor application. This feedback will be shared with the tutor.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={tutorRejectionNotes}
              onChange={(e) => setTutorRejectionNotes(e.target.value)}
              placeholder="Enter the reason for rejection (e.g., incomplete documents, insufficient qualifications, etc.)..."
              className="w-full p-3 border border-gray-300 rounded-md mt-1 min-h-[120px] resize-none"
              required
            />
          </div>
        </div>
      </Modal>

      {/* File Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={previewType.startsWith('image/') ? 'Image Preview' : previewType === 'application/pdf' ? 'PDF Preview' : 'File Preview'}
        footer={
          <>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600">Open in new tab</a>
          </>
        }
      >
        <div className="w-full h-[70vh] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          {previewType === 'application/pdf' ? (
            <iframe title="PDF" src={previewUrl} className="w-full h-full" />
          ) : previewType.startsWith('image/') || previewType === 'image/*' ? (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-sm text-slate-600 p-4 text-center">
              Preview not available. You can open the file in a new tab.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TutorManagement;
