import React, { useState, useEffect, useMemo } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useVerification } from '../../context/VerificationContext';
import { User, Camera, CreditCard, Star, Edit, Save, X, CheckCircle, Clock, Mail, Info } from 'lucide-react';
import { updateRoleUser } from '../../utils/authRole';

interface TutorProfile {
  bio: string;
  profile_photo: string;
  gcash_number: string;
  gcash_qr: string;
  session_rate_per_hour: number | null;
  subjects: string[];
  rating: number;
  total_reviews: number;
}

interface BookingRequest {
  id: number;
  subject: string;
  tutee_rating?: number;
  status: string;
}

interface SubjectRating {
  subject: string;
  averageRating: number;
  totalRatings: number;
}

const ProfileSetup: React.FC = () => {
  const { user } = useAuth();
  const { isVerified, applicationStatus } = useVerification();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [profile, setProfile] = useState<TutorProfile>({
    bio: '',
    profile_photo: '',
    gcash_number: '',
    gcash_qr: '',
    session_rate_per_hour: null,
    subjects: [],
    rating: 0,
    total_reviews: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [gcashQR, setGcashQR] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);

  useEffect(() => {
    if (user) {
      // Prefer tutor_id from user context if available
      const contextTutorId = (user as any)?.tutor_profile?.tutor_id ?? (user as any)?.tutor_id;
      if (contextTutorId) {
        const parsed = Number(contextTutorId);
        if (!Number.isNaN(parsed)) {
          setTutorId(parsed);
          return;
        }
      }

      const uid = (user as any)?.id ?? (user as any)?.user_id;
      if (!uid) return;

      const fetchTutorId = async () => {
        try {
          const response = await apiClient.get(`/tutors/by-user/${uid}/tutor-id`);
          const raw = response?.data ?? {};
          const extracted = raw.tutor_id ?? raw.tutorId ?? raw.id ?? raw.data?.tutor_id ?? raw.data?.tutorId;
          const actualTutorId = extracted != null ? Number(extracted) : null;
          console.log('Fetched tutor_id via by-user:', raw, 'resolved:', actualTutorId, 'for uid:', uid);
          if (actualTutorId) {
            setTutorId(actualTutorId);
            return;
          }
          throw new Error('Tutor ID not present in response');
        } catch (error: any) {
          console.error('Failed to fetch tutor ID via by-user endpoint:', error?.response?.data || error?.message);
          setTutorId(null);
        }
      };
      fetchTutorId();
    }
  }, [user]);

  useEffect(() => {
    if (tutorId) {
      fetchProfile();
      fetchBookingRequests();
    }
  }, [tutorId]);

  const fetchBookingRequests = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/booking-requests`);
      setBookingRequests(response.data || []);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  };

  const fetchProfile = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/profile`);
      console.log('Profile response data:', response.data);
      console.log('Profile photo URL from API:', response.data.profile_photo);
      console.log('User profile_image_url:', user?.profile_image_url);

      // Prefer API value, then keep existing state if already updated, then fallback to user context
      setProfile(prev => {
        let profilePhotoUrl = response.data.profile_photo || prev.profile_photo || user?.profile_image_url || '';
        // Keep cache-busting token if present
        if (profilePhotoUrl && typeof profilePhotoUrl === 'string' && !/\?t=/.test(profilePhotoUrl) && prev.profile_photo?.includes('?t=')) {
          const ts = prev.profile_photo.split('?t=')[1];
          if (ts) profilePhotoUrl = `${profilePhotoUrl}?t=${ts}`;
        }
        console.log('Setting profile photo URL to:', profilePhotoUrl);
        return { ...prev, ...response.data, profile_photo: profilePhotoUrl };
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleInputChange = (field: keyof TutorProfile, value: string | number | null) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setProfileImage(file);
  };

  const handleGcashQRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setGcashQR(file);
  };

  const saveProfile = async () => {
    // Basic client-side validation
    const bioToSave = (profile.bio || '').trim();
    const gcashToSave = (profile.gcash_number || '').trim();
    const bioValid = !bioToSave || /^[A-Za-z\s]+$/.test(bioToSave);
    const gcashValid = !gcashToSave || /^09\d{9}$/.test(gcashToSave);
    if (!bioValid) {
      alert('Bio can contain letters and spaces only.');
      return;
    }
    if (!gcashValid) {
      alert('GCash number must be 11 digits and start with 09.');
      return;
    }

    // Ensure we have a tutorId before proceeding
    const ensureTutorId = async (): Promise<number | null> => {
      if (tutorId) return tutorId;
      try {
        const ctxTid = (user as any)?.tutor_profile?.tutor_id ?? (user as any)?.tutor_id;
        if (ctxTid) {
          const parsed = Number(ctxTid);
          if (!Number.isNaN(parsed)) {
            setTutorId(parsed);
            return parsed;
          }
        }
        const uid = (user as any)?.id ?? (user as any)?.user_id;
        if (uid) {
          const res = await apiClient.get(`/tutors/by-user/${uid}/tutor-id`);
          const raw = res?.data ?? {};
          const extracted = raw.tutor_id ?? raw.tutorId ?? raw.id ?? raw.data?.tutor_id ?? raw.data?.tutorId;
          const resolved = extracted != null ? Number(extracted) : null;
          if (resolved) {
            setTutorId(resolved);
            return resolved;
          }
        }
      } catch (e) {
        /* keep null if cannot resolve authoritatively */
      }
      return null; // Require real tutor_id
    };

    const id = await ensureTutorId();
    if (!id) {
      console.warn('Tutor ID could not be resolved. Will proceed with user-only updates (e.g., profile image) if available.');
      // Allow profile image upload via user id even if tutor id is missing
      if (profileImage) {
        setLoading(true);
        try {
          const userIdForUpload = (user as any)?.user_id ?? (user as any)?.id;
          const formData = new FormData();
          formData.append('file', profileImage);
          const profileResponse = await apiClient.post(`/users/${userIdForUpload}/profile-image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          const profilePhotoUrl = profileResponse.data.profile_image_url || profileResponse.data?.data?.profile_image_url;
          if (profilePhotoUrl) {
            setProfile(prev => ({ ...prev, profile_photo: profilePhotoUrl }));
            if (user) {
              const updatedUser = { ...user, profile_image_url: profilePhotoUrl } as any;
              localStorage.setItem('user', JSON.stringify(updatedUser));
              updateRoleUser(updatedUser);
            }
          }
          setIsEditing(false);
          setProfileImage(null);
          alert('Profile image updated successfully!');
        } catch (e) {
          console.error('Failed user profile image upload without tutorId:', e);
          alert('Failed to upload profile image.');
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    setLoading(true);
    try {
      console.log('Saving profile with tutorId:', id, 'user:', user);
      // Update basic profile info with authoritative endpoint first
      const sessionRateToSave = profile.session_rate_per_hour != null ? Number(profile.session_rate_per_hour) : null;
      let updatedBasics = false;
      try {
        await apiClient.put(`/tutors/${id}`, {
          bio: bioToSave,
          gcash_number: gcashToSave,
          session_rate_per_hour: sessionRateToSave
        });
        updatedBasics = true;
      } catch (ePrimary: any) {
        console.warn('PUT /tutors/:id failed', ePrimary?.response?.data || ePrimary?.message);
        // Fallback endpoint
        try {
          await apiClient.put(`/tutors/${id}/profile`, {
            bio: bioToSave,
            gcash_number: gcashToSave,
            session_rate_per_hour: sessionRateToSave
          });
          updatedBasics = true;
        } catch (eFallback: any) {
          console.error('Fallback update failed', eFallback?.response?.data || eFallback?.message);
        }
      }

      // Upload profile image using USER ID (not tutor id)
      if (profileImage) {
        try {
          const userIdForUpload = (user as any)?.user_id ?? (user as any)?.id;
          console.log('Uploading profile image for user:', userIdForUpload);
          const formData = new FormData();
          formData.append('file', profileImage);
          const profileResponse = await apiClient.post(`/users/${userIdForUpload}/profile-image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          console.log('Profile image upload response:', profileResponse.data);

          // The backend returns { success: true, profile_image_url: fileUrl }
          let profilePhotoUrl = profileResponse.data.profile_image_url || profileResponse.data?.data?.profile_image_url;
          if (profilePhotoUrl) {
            // Cache-bust to force image refresh
            if (!/\?t=/.test(profilePhotoUrl)) {
              profilePhotoUrl = `${profilePhotoUrl}?t=${Date.now()}`;
            }
            console.log('Setting profile photo URL to:', profilePhotoUrl);
            setProfile(prev => ({ ...prev, profile_photo: profilePhotoUrl }));

            // Also update user context if available
            if (user) {
              const updatedUser = { ...user, profile_image_url: profilePhotoUrl };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              updateRoleUser(updatedUser);
            }
          } else {
            console.warn('Profile image URL not found in response:', profileResponse.data);
          }
        } catch (profileError: any) {
          console.error('Failed to upload profile image:', profileError);
          console.error('Error details:', profileError?.response?.data);
          // Non-blocking: continue saving other fields
        }
      } else if (user?.profile_image_url && !profileImage) {
        // If no new image is selected and user already has one, keep it
        setProfile(prev => ({ ...prev, profile_photo: user.profile_image_url }));
      }

      // Upload GCash QR if changed
      if (gcashQR) {
        try {
          console.log('Uploading GCash QR for tutor:', id);
          const formData = new FormData();
          formData.append('file', gcashQR);
          const gcashResponse = await apiClient.post(`/tutors/${id}/gcash-qr`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          console.log('GCash QR upload response:', gcashResponse.data);

          // The backend returns { success: true, gcash_qr_url: fileUrl }
          let gcashQRUrl = gcashResponse.data.gcash_qr_url || gcashResponse.data?.data?.gcash_qr_url;
          if (gcashQRUrl) {
            // Cache-bust to force image refresh
            if (!/\?t=/.test(gcashQRUrl)) {
              gcashQRUrl = `${gcashQRUrl}?t=${Date.now()}`;
            }
            console.log('Setting GCash QR URL to:', gcashQRUrl);
            setProfile(prev => ({ ...prev, gcash_qr: gcashQRUrl }));
          } else {
            console.warn('GCash QR URL not found in response:', gcashResponse.data);
          }
        } catch (gcashError: any) {
          console.error('Failed to upload GCash QR:', gcashError);
          console.error('Error details:', gcashError?.response?.data);
          // Non-blocking: proceed without QR update
        }
      }

      setIsEditing(false);
      setProfileImage(null);
      setGcashQR(null);

      // Refresh profile from server to ensure accurate persisted values
      await fetchProfile();

      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      const errorMessage = (error?.response?.data?.message || error?.message || '').toString();
      // Suppress noisy backend message
      if (errorMessage.toLowerCase().includes('tutor not found')) {
        console.warn('Tutor not found during save. Suppressing alert.');
      } else {
        alert(errorMessage || 'Failed to save profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'
          }`}
      />
    ));
  };

  // Calculate average rating per subject
  const subjectRatings = useMemo(() => {
    const ratingsBySubject: Record<string, number[]> = {};

    bookingRequests.forEach(booking => {
      if (booking.tutee_rating && booking.tutee_rating > 0 && booking.subject) {
        if (!ratingsBySubject[booking.subject]) {
          ratingsBySubject[booking.subject] = [];
        }
        ratingsBySubject[booking.subject].push(Number(booking.tutee_rating));
      }
    });

    const subjectRatingList: SubjectRating[] = Object.entries(ratingsBySubject).map(([subject, ratings]) => {
      const sum = ratings.reduce((acc, rating) => acc + rating, 0);
      const average = sum / ratings.length;
      return {
        subject,
        averageRating: average,
        totalRatings: ratings.length
      };
    });

    return subjectRatingList.sort((a, b) => b.averageRating - a.averageRating);
  }, [bookingRequests]);

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-6 sm:pb-8 md:pb-10">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
        </div>
        <div className="relative flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-4 bg-white/10 p-3 sm:p-4 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
            <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg shadow-sm shrink-0">
              <Info className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-md" />
            </div>
            <p className="text-sm sm:text-base md:text-lg text-white font-medium leading-snug tracking-wide text-shadow-sm">
              Manage your public profile and payment information
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg w-full lg:w-auto border border-white/40">
            <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border-2 flex items-center justify-center space-x-2 shadow-inner transition-colors duration-300 ${applicationStatus === 'approved' ? 'border-green-400 bg-green-50 text-green-800' : 'border-red-400 bg-red-50 text-red-800'}`}>
              {applicationStatus === 'approved' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="whitespace-nowrap tracking-wide">Approved</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className="whitespace-nowrap tracking-wide">Not Approved</span>
                </>
              )}
            </div>
            <div className="flex space-x-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)} className="!px-3 sm:!px-4 !py-2 text-xs sm:text-sm flex-1 sm:flex-none font-medium border-slate-200 hover:bg-slate-100 transition-colors">
                    Cancel
                  </Button>
                  <Button onClick={saveProfile} disabled={loading} className="!px-3 sm:!px-4 !py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg text-xs sm:text-sm flex-1 sm:flex-none font-medium border border-primary-500/50 transition-all active:scale-95">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="!px-3 sm:!px-4 !py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg flex items-center justify-center space-x-2 text-xs sm:text-sm w-full sm:w-auto font-medium border border-primary-500/50 transition-all active:scale-95">
                  <Edit className="h-4 w-4 flex-shrink-0" />
                  <span>Edit Profile</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Overview */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
        <div className="mb-5 sm:mb-6">
          {/* Profile Image */}
          <div className="flex justify-center mb-4 sm:mb-5">
            {profileImage ? (
              <div className="relative">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-primary-200 shadow-2xl bg-slate-100 transform hover:scale-105 transition-transform duration-300">
                  <img
                    src={URL.createObjectURL(profileImage)}
                    alt="Profile Preview"
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '1/1' }}
                  />
                </div>
                {applicationStatus === 'approved' && (
                  <div className="absolute -top-1 -right-1 bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xs px-2 py-1 rounded-full border-2 border-white shadow-lg">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                )}
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex space-x-1.5">
                    <label className="bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-full p-2.5 cursor-pointer hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                    {profileImage && (
                      <button
                        onClick={() => setProfileImage(null)}
                        className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-full p-2.5 hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
                        title="Remove selected image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : profile.profile_photo || user?.profile_image_url ? (
              <div className="relative">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-primary-200 shadow-2xl bg-slate-100 transform hover:scale-105 transition-transform duration-300">
                  <img
                    src={getFileUrl(profile.profile_photo || (user as any)?.profile_image_url || '')}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '1/1' }}
                    onError={(e) => {
                      console.error('Failed to load profile image. Original URL:', profile.profile_photo || (user as any)?.profile_image_url);
                      console.error('Constructed URL:', getFileUrl(profile.profile_photo || (user as any)?.profile_image_url || ''));
                      // Fallback to initials avatar
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent((user as any)?.name || 'Tutor')}&background=random`;
                    }}
                    onLoad={() => {
                      console.log('Profile image loaded successfully:', getFileUrl(profile.profile_photo || (user as any)?.profile_image_url || ''));
                    }}
                  />
                </div>
                {applicationStatus === 'approved' ? (
                  <div className="absolute -top-1 -right-1 bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xs px-2 py-1 rounded-full border-2 border-white shadow-lg">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs px-2 py-1 rounded-full border-2 border-white shadow-lg">
                    <X className="h-3 w-3" />
                  </div>
                )}
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex space-x-1.5">
                    <label className="bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-full p-2.5 cursor-pointer hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                    {profileImage && (
                      <button
                        onClick={() => setProfileImage(null)}
                        className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-full p-2.5 hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
                        title="Remove selected image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center ring-4 ring-primary-200 shadow-2xl">
                <User className="h-14 w-14 sm:h-16 sm:w-16 text-slate-500" />
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex space-x-1.5">
                    <label className="bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-full p-2.5 cursor-pointer hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tutor Name and Email - Below Profile Image */}
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1.5">
              {user?.name || 'Tutor'}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 break-words flex items-center justify-center gap-1.5">
              <Mail className="h-4 w-4 text-primary-600" />
              {user?.email || ''}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Your Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 p-4 rounded-xl border-2 border-primary-200/50 shadow-lg hover:shadow-xl transition-all">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Approved Subjects</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary-700">{profile.subjects.length}</p>
            </div>
            <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 p-4 rounded-xl border-2 border-primary-200/50 shadow-lg hover:shadow-xl transition-all">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Total Reviews</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary-700">{subjectRatings.reduce((sum, sr) => sum + sr.totalRatings, 0)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Bio Section */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <User className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Bio & Description</h2>
        </div>

        {isEditing ? (
          <>
            <textarea
              className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white shadow-sm transition-all"
              rows={5}
              placeholder="Tell students about your teaching experience, specialties, and approach..."
              value={profile.bio}
              onChange={(e) => {
                const filtered = e.target.value.replace(/[^A-Za-z\s]/g, '');
                handleInputChange('bio', filtered);
              }}
            />
            {profile.bio && /[^A-Za-z\s]/.test(profile.bio) && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <X className="h-3 w-3" />
                Bio can contain letters and spaces only.
              </p>
            )}
          </>
        ) : (
          <div className="bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-50 p-5 rounded-xl border-2 border-slate-200/50 shadow-sm min-h-[120px]">
            {profile.bio ? (
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
            ) : (
              <p className="text-slate-500 italic text-center py-4">No bio added yet. Click "Edit Profile" to add one.</p>
            )}
          </div>
        )}
      </Card>

      {/* Subjects Section */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <Star className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Approved Subjects of Expertise</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {profile.subjects.map((subject, index) => (
            <span
              key={index}
              className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 border border-primary-400/30 flex items-center space-x-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{subject}</span>
            </span>
          ))}
          {profile.subjects.length === 0 && (
            <div className="w-full text-center py-6">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-6 shadow-lg">
                <Clock className="h-10 w-10 text-yellow-600 mx-auto mb-3" />
                <p className="text-yellow-800 font-semibold text-base mb-1">No approved subjects yet</p>
                <p className="text-sm text-yellow-700">
                  Your subject expertise applications are being reviewed by our admin team.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 border-2 border-primary-200/50 rounded-xl shadow-sm">
          <p className="text-sm text-primary-800 flex items-start gap-2">
            <span className="font-bold">Note:</span>
            <span>Only subjects approved by our admin team will appear here. To add new subjects or check the status of your applications, go to the Application & Verification section.</span>
          </p>
        </div>
      </Card>

      {/* Payment Information */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Payment Information</h2>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Session Rate per Hour
            </label>
            {isEditing ? (
              <>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600 font-bold text-lg">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white shadow-sm transition-all"
                    placeholder="0.00"
                    value={profile.session_rate_per_hour ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? null : parseFloat(e.target.value);
                      handleInputChange('session_rate_per_hour', value);
                    }}
                  />
                </div>
                {profile.session_rate_per_hour != null && (profile.session_rate_per_hour < 0 || isNaN(profile.session_rate_per_hour)) && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    Session rate must be a positive number.
                  </p>
                )}
              </>
            ) : (
              <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 p-4 rounded-xl border-2 border-primary-200/50 shadow-sm">
                <p className="text-primary-700 font-bold text-lg sm:text-xl">
                  {profile.session_rate_per_hour != null
                    ? `₱${Number(profile.session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="text-slate-500 italic font-normal">No session rate set yet</span>}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              GCash Number
            </label>
            {isEditing ? (
              <>
                <input
                  type="text"
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white shadow-sm transition-all"
                  placeholder="09XX XXX XXXX"
                  value={profile.gcash_number}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    // Enforce max length 11
                    const limited = digits.slice(0, 11);
                    handleInputChange('gcash_number', limited);
                  }}
                />
                {profile.gcash_number && (!/^09\d{9}$/.test(profile.gcash_number) || profile.gcash_number.length !== 11) && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    GCash number must be 11 digits, start with 09.
                  </p>
                )}
              </>
            ) : (
              <div className="bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-50 p-4 rounded-xl border-2 border-slate-200/50 shadow-sm">
                <p className="text-slate-700 font-semibold">
                  {profile.gcash_number || <span className="text-slate-500 italic font-normal">No GCash number added yet</span>}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              GCash QR Code
            </label>
            {isEditing ? (
              <div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGcashQRChange}
                    className="flex-1 border-2 border-slate-300 rounded-xl px-4 py-3 bg-white shadow-sm text-sm transition-all"
                  />
                  {gcashQR && (
                    <button
                      onClick={() => setGcashQR(null)}
                      className="bg-gradient-to-br from-red-600 to-red-700 text-white px-4 py-3 rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      title="Remove selected QR code"
                    >
                      <X className="h-4 w-4" />
                      <span className="text-sm">Remove</span>
                    </button>
                  )}
                </div>
                {gcashQR && (
                  <p className="text-sm text-slate-600 mt-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Selected: {gcashQR.name}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-50 p-5 rounded-xl border-2 border-slate-200/50 shadow-sm flex justify-center">
                {gcashQR ? (
                  <img
                    src={URL.createObjectURL(gcashQR)}
                    alt="GCash QR Preview"
                    className="w-32 h-32 sm:w-40 sm:h-40 object-contain border-2 border-primary-200 rounded-xl bg-white shadow-lg"
                  />
                ) : profile.gcash_qr ? (
                  <img
                    src={getFileUrl(profile.gcash_qr)}
                    alt="GCash QR Code"
                    className="w-32 h-32 sm:w-40 sm:h-40 object-contain border-2 border-primary-200 rounded-xl bg-white shadow-lg hover:shadow-xl transition-all"
                  />
                ) : (
                  <p className="text-sm text-slate-500 italic py-4">No GCash QR code uploaded yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Average Rating per Subject */}
      {subjectRatings.length > 0 && (
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <Star className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Average Rating per Subject</h2>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {subjectRatings.map((subjectRating) => (
              <div key={subjectRating.subject} className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-lg border-2 border-primary-200/50 shadow-sm hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-semibold text-slate-900 mb-1 truncate">{subjectRating.subject}</p>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {subjectRating.totalRatings} {subjectRating.totalRatings === 1 ? 'rating' : 'ratings'}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 ml-4">
                  <div className="flex items-center gap-1">
                    {renderStars(subjectRating.averageRating)}
                  </div>
                  <span className="text-base sm:text-lg md:text-xl font-bold text-primary-700 min-w-[3rem] text-right">
                    {subjectRating.averageRating.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProfileSetup;