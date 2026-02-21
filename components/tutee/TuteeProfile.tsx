import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient, { getFileUrl } from '../../services/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { updateRoleUser } from '../../utils/authRole';

const TuteeProfile: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [universityId, setUniversityId] = useState<number | ''>((user as any)?.university_id ?? '');
  const [courseId, setCourseId] = useState<number | ''>((user as any)?.course_id ?? '');
  const [courseName, setCourseName] = useState<string>((user as any)?.course?.course_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [universities, setUniversities] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [yearLevel, setYearLevel] = useState<number | ''>((user as any)?.year_level ?? '');
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
        const [uRes, cRes] = await Promise.all([apiClient.get('/universities'), apiClient.get('/courses')]);
        if (!mounted) return;
        const active = (uRes.data || []).filter((u: any) => u.status === 'active');
        setUniversities(active);
        const normalized = (Array.isArray(cRes.data) ? cRes.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalized);
      } catch (e) {
        console.error('Failed to fetch universities/courses', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((c: any) => {
      const uid = c?.university_id ?? c?.university?.university_id ?? c?.universityId;
      return !universityId || uid === universityId;
    });
  }, [courses, universityId]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <ToastContainer position="top-center" aria-label="Notification center" />
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="flex flex-col items-center">
            <div className="h-28 w-28 rounded-full overflow-hidden border-2 border-slate-200 mb-3">
              {user?.profile_image_url ? (
                <img src={getFileUrl(user.profile_image_url)} alt={user?.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-semibold">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
              )}
            </div>
            <label className={`px-3 py-2 text-sm rounded-md bg-gray-100 border ${isUploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-200'}`}>
              {isUploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isUploading} />
            </label>
          </div>

          <div className="md:col-span-2">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full name</label>
                <input className="w-full border px-3 py-2 rounded-md" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input className="w-full border px-3 py-2 rounded-md" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">University</label>
                <select value={universityId as any} onChange={e => setUniversityId(e.target.value ? Number(e.target.value) : '')} className="w-full border px-3 py-2 rounded-md">
                  <option value="">-- Select university --</option>
                  {universities.map(u => (
                    <option key={u.university_id} value={u.university_id}>{u.name || u.university_name || u.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Course</label>
                <select value={courseId as any} onChange={e => setCourseId(e.target.value ? Number(e.target.value) : '')} className="w-full border px-3 py-2 rounded-md">
                  <option value="">-- Select course --</option>
                  {filteredCourses.map(c => (
                    <option key={c.course_id || c.id} value={c.course_id || c.id}>{c.course_name || c.name}</option>
                  ))}
                </select>
                {!courseId && (
                  <input className="w-full border px-3 py-2 rounded-md mt-2" placeholder="Or enter course name" value={courseName} onChange={e => setCourseName(e.target.value)} />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Year level</label>
                <select value={yearLevel as any} onChange={e => setYearLevel(e.target.value ? Number(e.target.value) : '')} className="w-full border px-3 py-2 rounded-md">
                  <option value="">-- Select year level --</option>
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {emailDomainError && <div className="text-sm text-red-600">{emailDomainError}</div>}

              <div className="flex items-center gap-3 mt-4">
                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
                <Button variant="secondary" onClick={() => { setName(user?.name || ''); setEmail(user?.email || ''); }}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TuteeProfile;
