import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient, { getFileUrl } from '../../services/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Info } from 'lucide-react';
import { updateRoleUser } from '../../utils/authRole';

const TuteeProfile: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const studentInfo = (user as any)?.student_profile || {};
  const [universityId, setUniversityId] = useState<number | ''>(studentInfo.university_id ?? (user as any)?.university_id ?? '');
  const [courseId, setCourseId] = useState<number | ''>(studentInfo.course_id ?? (user as any)?.course_id ?? '');
  const [courseName, setCourseName] = useState<string>(studentInfo.course?.course_name || (user as any)?.course?.course_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [universities, setUniversities] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [yearLevel, setYearLevel] = useState<number | ''>(studentInfo.year_level ?? (user as any)?.year_level ?? '');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    // Basic validation
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      setIsSaving(false);
      return;
    }
    if (universityId && email) {
      const uni = universities.find(u => u.university_id === universityId);
      if (uni) {
        const domain = email.split('@')[1] || '';
        if (domain.toLowerCase() !== (uni.email_domain || '').toLowerCase()) {
          setEmailDomainError(`Email domain must be ${(uni.email_domain || '').toLowerCase()}`);
          toast.error('Email domain does not match selected university');
          setIsSaving(false);
          return;
        }
      }
    }
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        university_id: universityId || undefined,
        course_id: courseId || undefined,
        course_name: !courseId && courseName ? courseName.trim() : undefined,
        year_level: yearLevel || undefined,
      };

      const res = await apiClient.patch(`/users/${user.user_id}`, payload);
      // Update localStorage user
      const updated = { ...(user as any), ...res.data };
      localStorage.setItem('user', JSON.stringify(updated));
      updateRoleUser(updated as any);
      toast.success('Profile updated successfully');
      // Reload to ensure AuthContext picks up changes from localStorage
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      console.error('Failed to update profile', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file.');
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post(`/users/${user.user_id}/profile-image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updated = { ...(user as any), profile_image_url: res.data.profile_image_url };
      localStorage.setItem('user', JSON.stringify(updated));
      updateRoleUser(updated as any);
      toast.success('Profile image updated');
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      console.error('Failed to upload profile image', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload image';
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Fetch universities and courses for selects
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const fetchPromises: any[] = [
          apiClient.get('/universities'),
          apiClient.get('/courses')
        ];
        if (user?.user_id) {
          fetchPromises.push(apiClient.get(`/users/${user.user_id}`));
        }

        const [uRes, cRes, userRes] = await Promise.all(fetchPromises);

        if (!mounted) return;

        const active = (uRes.data || []).filter((u: any) => u.status === 'active');
        setUniversities(active);

        const normalized = (Array.isArray(cRes.data) ? cRes.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalized);

        // Instantly update from fresh DB info in case localStorage cache was missing the nested profile
        if (userRes && userRes.data) {
          const freshUser = userRes.data;
          const sInfo = freshUser.student_profile || freshUser.tutee_profile || {};

          setUniversityId(prev => prev === '' ? (sInfo.university_id ?? freshUser.university_id ?? '') : prev);
          setCourseId(prev => prev === '' ? (sInfo.course_id ?? freshUser.course_id ?? '') : prev);
          setCourseName(prev => prev === '' ? (sInfo.course?.course_name ?? freshUser.course?.course_name ?? '') : prev);
          setYearLevel(prev => prev === '' ? (sInfo.year_level ?? freshUser.year_level ?? '') : prev);
        }

      } catch (e) {
        console.error('Failed to fetch universities/courses/user', e);
      }
    })();
    return () => { mounted = false; };
  }, [user?.user_id]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c: any) => {
      const uid = c?.university_id ?? c?.university?.university_id ?? c?.universityId;
      return !universityId || uid === universityId;
    });
  }, [courses, universityId]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10 px-3 sm:px-4 md:px-0">
      <div className="bg-sky-600 from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2 bg-white/10 p-1.5 sm:p-2 rounded-lg backdrop-blur-md border border-white/20 shadow-inner">
            <div className="p-1 bg-white/20 rounded-md shadow-sm shrink-0">
              <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white drop-shadow-md" />
            </div>
            <p className="text-xs sm:text-sm md:text-base text-white font-medium leading-snug tracking-wide text-shadow-sm">
              View and Manage your personal and academic details.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-6 md:p-8 lg:p-10 w-full rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 md:gap-10 lg:gap-12 items-center md:items-start text-left">

          {/* Left Column: Avatar */}
          <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col items-center">
            <div className="relative group mb-4">
              <div className="h-28 w-28 sm:h-32 sm:w-32 md:h-40 md:w-40 rounded-full overflow-hidden border-4 border-slate-100 shadow-md bg-slate-50">
                {user?.profile_image_url ? (
                  <img src={getFileUrl(user.profile_image_url)} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl sm:text-5xl font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            </div>
            <label className={`w-full max-w-[200px] text-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer shadow-sm'}`}>
              {isUploading ? 'Uploading…' : 'Change Photo'}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isUploading} />
            </label>
          </div>

          {/* Right Column: Form */}
          <div className="w-full md:w-2/3 lg:w-3/4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
              <div className="sm:col-span-4">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                <input className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
                <input className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">University</label>
                <select value={universityId as any} onChange={e => setUniversityId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors">
                  <option value="">-- Select university --</option>
                  {universities.map(u => (
                    <option key={u.university_id} value={u.university_id}>{u.name || u.university_name || u.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Year Level</label>
                <select value={yearLevel as any} onChange={e => setYearLevel(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors">
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Course</label>
                <select value={courseId as any} onChange={e => setCourseId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors mb-2">
                  <option value="">-- Select course --</option>
                  {filteredCourses.map(c => (
                    <option key={c.course_id || c.id} value={c.course_id || c.id}>{c.course_name || c.name}</option>
                  ))}
                </select>
              </div>

              {emailDomainError && <div className="sm:col-span-4 text-sm font-semibold text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100">{emailDomainError}</div>}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 pt-6 border-t border-slate-100">
              <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto px-6 py-2.5 font-bold rounded-xl shadow-md">
                {isSaving ? 'Saving Changes…' : 'Save Changes'}
              </Button>
              {/* <Button variant="secondary" onClick={() => { setName(user?.name || ''); setEmail(user?.email || ''); }} className="w-full sm:w-auto px-6 py-2.5 font-bold rounded-xl border border-slate-200">
                Cancel
              </Button> */}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TuteeProfile;
