import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '../../services/api';
import { getFileUrl } from '../../services/api';
import { User, Payment, University } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { RefreshCw, Ban, FileText, Edit, Info } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<(User & { university_name?: string })[]>([]);
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [disputes, setDisputes] = useState<Payment[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [disputeStatus, setDisputeStatus] = useState<'none' | 'open' | 'under_review' | 'resolved' | 'rejected'>('open');
  const [adminNote, setAdminNote] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    status: 'active' | 'inactive';
    year_level?: number;
    university_id?: number;
  } | null>(null);

  // Modal States for Alerts & Confirms
  const [statusConfirmDialog, setStatusConfirmDialog] = useState<{ userId: number, currentStatus: 'active' | 'inactive', nextStatus: 'active' | 'inactive' } | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ userId: number, newPassword: string } | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users');
      setUsers(response.data);
    } catch (e) {
      setError('Failed to fetch users.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // (Removed accidental admin modal handlers; admin profile is shown from the header instead)

  const fetchDisputes = async () => {
    try {
      setDisputesLoading(true);
      const response = await apiClient.get('/payments');
      const all: Payment[] = response.data;
      setDisputes(all.filter(p => (p.dispute_status && p.dispute_status !== 'none')));
    } catch (e) {
      // no global error surface here to avoid clashing with users list; keep console
      console.error(e);
    } finally {
      setDisputesLoading(false);
    }
  };
  const initiateStatusToggle = (userId: number, currentStatus: 'active' | 'inactive') => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setStatusConfirmDialog({ userId, currentStatus, nextStatus });
  };

  const confirmStatusToggle = async () => {
    if (!statusConfirmDialog) return;
    const { userId, nextStatus } = statusConfirmDialog;
    setStatusConfirmDialog(null);

    try {
      setUpdatingUserId(userId);
      await apiClient.patch(`/users/${userId}/status`, { status: nextStatus });
      await fetchUsers();
      setFeedbackMessage({ type: 'success', text: `User has been effectively ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`});
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: e?.response?.data?.message || 'Failed to update user status.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const initiateResetPassword = (userId: number) => {
    setResetPasswordDialog({ userId, newPassword: '' });
  };

  const passwordError = useMemo(() => {
    if (!resetPasswordDialog || !resetPasswordDialog.newPassword) return null;
    const password = resetPasswordDialog.newPassword;
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character.';
    return null;
  }, [resetPasswordDialog?.newPassword]);

  const confirmResetPassword = async () => {
    if (!resetPasswordDialog) return;
    const { userId, newPassword } = resetPasswordDialog;
    
    if (passwordError) {
      setFeedbackMessage({ type: 'error', text: passwordError });
      return;
    }

    setResetPasswordDialog(null);
    try {
        await apiClient.patch(`/users/${userId}/reset-password`, { newPassword });
        setFeedbackMessage({ type: 'success', text: 'User password reset successfully.' });
    } catch (e: any) {
        setFeedbackMessage({ type: 'error', text: e?.response?.data?.message || 'Failed to reset password.' });
    }
  };

  // const openEdit = (user: User) => {
  //   setEditUser(user);
  //   const base = { name: user.name, email: user.email, status: (user as any).status || 'active' } as { name: string; email: string; status: 'active' | 'inactive'; year_level?: number };
  //   if ((user.role as any) !== 'admin' && (user as any).year_level) {
  //     base.year_level = (user as any).year_level;
  //   }
  //   setEditForm(base);
  // };
  // --- MODIFICATION START (1/3) ---
  // The 'openEdit' function now sets the university_id for ALL user roles.
  const openEdit = (user: User & { university_id?: number }) => {
    setEditUser(user);
    const base: { name: string; email: string; status: 'active' | 'inactive'; year_level?: number; university_id?: number } = {
      name: user.name,
      email: user.email,
      status: (user as any).status || 'active'
    };

    if (user.university_id) {
      base.university_id = user.university_id;
    }

    if ((user.role as any) !== 'admin' && (user as any).year_level) {
      base.year_level = (user as any).year_level;
    }

    setEditForm(base);
  };


  // const saveEdit = async () => {
  //   if (!editUser || !editForm) return;
  //   const payload = { ...editForm } as any;
  //   if ((editUser.role as any) === 'admin') {
  //     delete payload.year_level;
  //   }
  //   await apiClient.patch(`/users/${editUser.user_id}`, payload);
  //   setEditUser(null);
  //   setEditForm(null);
  //   fetchUsers();
  // };
  // --- MODIFICATION START (2/3) ---
  // The 'saveEdit' function no longer removes university_id for admins.
  const saveEdit = async () => {
    if (!editUser || !editForm) return;
    const payload = { ...editForm } as any;

    // Only year_level is removed for admins now.
    if ((editUser.role as any) === 'admin') {
      delete payload.year_level;
    }

    await apiClient.patch(`/users/${editUser.user_id}`, payload);
    setEditUser(null);
    setEditForm(null);
    await fetchUsers();
  };

  const initiateDeleteUser = (userId: number) => {
    setDeleteConfirmDialog(userId);
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmDialog) return;
    const userId = deleteConfirmDialog;
    setDeleteConfirmDialog(null);

    try {
      await apiClient.delete(`/users/${userId}`);
      fetchUsers();
      setFeedbackMessage({ type: 'success', text: 'User deleted successfully.'});
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: e?.response?.data?.message || 'Failed to delete user. They may have related records. Consider deactivating instead.' });
    }
  };

  // This line creates the 'universities' variable.
  const [universities, setUniversities] = useState<University[]>([]);
  // 2. CREATE A FUNCTION TO FETCH THE DATA
  const fetchUniversities = async () => {
    try {
      const response = await apiClient.get('/universities');
      setUniversities(response.data); // This populates the state
    } catch (error) {
      console.error("Failed to fetch universities:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDisputes();
    fetchUniversities();
  }, []);

  // Note: The logic for handleVerificationToggle has been simplified as the backend
  // now handles verification during tutor approval. A more complex user update endpoint
  // could be added later if direct verification from this page is needed.

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <div className="-mt-2 sm:-mt-4 lg:-mt-5 mb-4 sm:mb-6 bg-sky-600 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
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
              Manage registered users, reset passwords, and update account statuses
            </p>
          </div>
        </div>
      </div>

      {/* User Type Filter */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
        <label htmlFor="user-type-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">Filter by User Type:</label>
        <select
          id="user-type-filter"
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full sm:w-auto min-w-[150px]"
          value={userTypeFilter}
          onChange={e => setUserTypeFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="admin">Admin</option>
          <option value="tutor">Tutor</option>
          <option value="student">Tutee</option>
        </select>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        {/* Card Header matching CourseManagement */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary-100 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users h-4 w-4 text-primary-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Users</h2>
            <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-700 rounded-full border border-primary-200">
              {users.filter(user => userTypeFilter === 'all' ? true : (user.role === userTypeFilter)).length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-primary-600 to-primary-700">
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">User</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Role</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">University</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {users
                .filter(user => userTypeFilter === 'all' ? true : (user.role === userTypeFilter))
                .map((user) => (
                  <tr key={user.user_id} className="transition-colors duration-150 hover:bg-slate-50">
                    <td className="px-3 py-2.5 border-l-[3px] border-transparent">
                      <div className="flex items-center">
                        {user.profile_image_url ? (
                          <img
                            src={getFileUrl(user.profile_image_url)}
                            alt={user.name}
                            className="h-10 w-10 rounded-full mr-3 object-cover flex-shrink-0 shadow-sm ring-1 ring-slate-900/5"
                            style={{ aspectRatio: '1 / 1' }}
                            onError={(e) => {
                              const imgElement = e.target as HTMLImageElement;
                              imgElement.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random';
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full mr-3 bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-sm ring-1 ring-slate-900/5 text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm text-slate-900 leading-tight">{user.name}</span>
                          <span className="text-[13px] text-slate-500 leading-tight mt-0.5">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500 capitalize">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">
                      {user.university_name
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200" title={user.university_name}>{user.university_name}</span>
                        : <span className="text-xs text-slate-400 italic">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1 items-start">
                        {/* User Status */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] leading-none font-semibold border ${((user as any).status || 'active') === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {((user as any).status || 'active')}
                        </span>
                        {/* Tutor Application Status (only for tutors) */}
                        {(user.role as any) === 'tutor' && (user as any).tutor_profile && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] leading-none font-semibold border ${(user as any).tutor_profile.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : (user as any).tutor_profile.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            {(user as any).tutor_profile.status || 'pending'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <button className="inline-flex items-center justify-center h-7 w-7 text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 border border-transparent hover:border-primary-200 rounded-md transition-colors" title="Edit" onClick={() => openEdit(user)}>
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button className="inline-flex items-center justify-center h-7 w-7 text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-transparent hover:border-sky-200 rounded-md transition-colors disabled:opacity-50" title="Reset Password" onClick={() => initiateResetPassword(user.user_id)} disabled={updatingUserId === user.user_id}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button className="inline-flex items-center justify-center h-7 w-7 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-transparent hover:border-rose-200 rounded-md transition-colors disabled:opacity-50" title="Toggle Active" onClick={() => initiateStatusToggle(user.user_id, ((user as any).status || 'active'))} disabled={updatingUserId === user.user_id}>
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {users
          .filter(user => userTypeFilter === 'all' ? true : (user.role === userTypeFilter))
          .map((user) => (
            <div key={user.user_id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="space-y-0">
                {/* User Header Row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white">
                  {user.profile_image_url ? (
                    <img
                      src={getFileUrl(user.profile_image_url)}
                      alt={user.name}
                      className="h-10 w-10 rounded-full object-cover flex-shrink-0 ring-1 ring-slate-900/5"
                      style={{ aspectRatio: '1 / 1' }}
                      onError={(e) => {
                        const imgElement = e.target as HTMLImageElement;
                        imgElement.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random';
                      }}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ring-1 ring-slate-900/5">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate text-sm">{user.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="px-4 pb-3 grid grid-cols-2 gap-3 text-xs border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Role</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                      {user.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">University</span>
                    {user.university_name
                      ? <span className="font-medium text-slate-700 truncate block">{user.university_name}</span>
                      : <span className="text-slate-400 italic block">—</span>
                    }
                  </div>
                  <div className="col-span-2 pt-1 flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${((user as any).status || 'active') === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {((user as any).status || 'active')}
                    </span>
                    {(user.role as any) === 'tutor' && (user as any).tutor_profile && (
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${(user as any).tutor_profile.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : (user as any).tutor_profile.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                        Tutor: {(user as any).tutor_profile.status || 'pending'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex bg-slate-50 divide-x divide-slate-100">
                  <button
                    className="flex-1 inline-flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                    onClick={() => openEdit(user)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    className="flex-1 inline-flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
                    onClick={() => initiateResetPassword(user.user_id)}
                    disabled={updatingUserId === user.user_id}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    className="flex-1 inline-flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    onClick={() => initiateStatusToggle(user.user_id, ((user as any).status || 'active'))}
                    disabled={updatingUserId === user.user_id}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span className="truncate max-w-full">Status</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {editUser && editForm && (
        <Modal
          isOpen={true}
          onClose={() => { setEditUser(null); setEditForm(null); }}
          title={`Edit User: ${editUser.name}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setEditUser(null); setEditForm(null); }}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </>
          }
        >
          {/* --- MODIFICATION START (3/3) --- */}
          {/* The modal layout is updated to always show the University field. */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={editForm.name} onChange={(e) => setEditForm(prev => prev ? { ...prev, name: e.target.value } : prev)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={editForm.email} onChange={(e) => setEditForm(prev => prev ? { ...prev, email: e.target.value } : prev)} />
            </div>

            {/* Status and University are now paired in a grid and always visible */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <select className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={editForm.status} onChange={(e) => setEditForm(prev => prev ? { ...prev, status: e.target.value as any } : prev)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">University</label>
                <select
                  className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2"
                  value={editForm.university_id || ''}
                  onChange={(e) => setEditForm(prev => prev ? { ...prev, university_id: e.target.value ? Number(e.target.value) : undefined } : prev)}
                >
                  <option value="">Select University</option>
                  {universities.map(uni => (
                    <option key={uni.university_id} value={uni.university_id}>
                      {uni.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year Level remains conditional and only shows for non-admins */}
            {editUser && (editUser.role as any) !== 'admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Year Level (optional)</label>
                <input type="number" min={1} max={6} className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={editForm.year_level || ''} onChange={(e) => setEditForm(prev => prev ? { ...prev, year_level: e.target.value ? Number(e.target.value) : undefined } : prev)} />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* --- MODAL RENDERS FOR ACTIONS --- */}
      {statusConfirmDialog && (
        <Modal
          isOpen={true}
          onClose={() => setStatusConfirmDialog(null)}
          title={`Confirm Status Change`}
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setStatusConfirmDialog(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmStatusToggle}>
                {statusConfirmDialog.nextStatus === 'active' ? 'Activate User' : 'Deactivate User'}
              </Button>
            </>
          }
        >
          <div className="px-4 py-3 text-sm text-slate-700">
             Are you sure you want to <strong>{statusConfirmDialog.nextStatus === 'active' ? 'activate' : 'deactivate'}</strong> this user?
             {statusConfirmDialog.nextStatus === 'inactive' && " They will not be able to log in while deactivated."}
          </div>
        </Modal>
      )}

      {resetPasswordDialog && (
        <Modal
          isOpen={true}
          onClose={() => setResetPasswordDialog(null)}
          title={`Reset User Password`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setResetPasswordDialog(null)}>Cancel</Button>
              <Button onClick={confirmResetPassword} disabled={!resetPasswordDialog.newPassword || passwordError !== null}>Confirm Reset</Button>
            </>
          }
        >
          <div className="p-4 space-y-4">
             <p className="text-sm text-slate-600">Enter a new secure password for this user below.</p>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
               <input 
                  type="text" 
                  autoFocus
                  className={`w-full border rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500 ${passwordError && resetPasswordDialog.newPassword.length > 0 ? 'border-rose-300 bg-rose-50' : 'border-slate-300'}`}
                  value={resetPasswordDialog.newPassword} 
                  onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog, newPassword: e.target.value })} 
                  placeholder="e.g. NewPass123!"
                />
                {passwordError && resetPasswordDialog.newPassword.length > 0 && (
                    <p className="text-xs text-rose-500 mt-1.5">{passwordError}</p>
                )}
             </div>
          </div>
        </Modal>
      )}

      {deleteConfirmDialog && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmDialog(null)}
          title={`Delete User`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirmDialog(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDeleteUser}>Delete Permanently</Button>
            </>
          }
        >
          <div className="p-4 text-slate-700">
             Are you extremely sure you want to delete this user? This action cannot be undone and will fail if the user has associated payment or booking records.
          </div>
        </Modal>
      )}

      {feedbackMessage && (
        <Modal
          isOpen={true}
          onClose={() => setFeedbackMessage(null)}
          title={feedbackMessage.type === 'success' ? 'Success' : 'Error'}
          maxWidth="sm"
          footer={
              <Button variant={feedbackMessage.type === 'success' ? 'primary' : 'danger'} onClick={() => setFeedbackMessage(null)}>Okay</Button>
          }
        >
          <div className="px-4 py-3 flex items-center gap-2.5">
             {feedbackMessage.type === 'success' 
               ? <div className="p-1 bg-emerald-100 rounded-full shrink-0"><RefreshCw className="h-4 w-4 text-emerald-600" /></div>
               : <div className="p-1 bg-rose-100 rounded-full shrink-0"><Ban className="h-4 w-4 text-rose-600" /></div>
             }
             <p className="text-slate-700 text-sm">{feedbackMessage.text}</p>
          </div>
        </Modal>
      )}

      {/* <div className="mt-8" />
      <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <div className="p-1.5 bg-rose-100 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert h-5 w-5 text-rose-600"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        Payment Disputes
      </h2>
      <Card className="!p-0 overflow-hidden border border-slate-200 shadow-sm">
        {disputesLoading ? (
          <div className="p-6 text-center text-slate-500">Loading disputes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-700 to-slate-800">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Payment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Student</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Tutor</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {disputes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500 italic">No disputes at the moment.</td>
                  </tr>
                ) : (
                  disputes.map((p) => (
                    <tr key={p.payment_id} className="transition-colors hover:bg-slate-50">
                      <td className="px-3 py-3 text-sm font-medium text-slate-700">#{p.payment_id}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 font-medium">
                        {(p.student?.user as any)?.profile_image_url ? (
                           <div className="flex items-center gap-1.5">
                             <img src={getFileUrl((p.student?.user as any).profile_image_url)} alt="" className="h-5 w-5 rounded-full object-cover" />
                             <span>{p.student?.user?.name}</span>
                           </div>
                        ) : <span className="block">{p.student?.user?.name || 'N/A'}</span>}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-700 font-medium">
                        {(p.tutor?.user as any)?.profile_image_url ? (
                           <div className="flex items-center gap-1.5">
                             <img src={getFileUrl((p.tutor?.user as any).profile_image_url)} alt="" className="h-5 w-5 rounded-full object-cover" />
                             <span>{p.tutor?.user?.name}</span>
                           </div>
                        ) : <span className="block">{p.tutor?.user?.name || 'N/A'}</span>}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className="px-2 py-0.5 inline-flex text-[11px] leading-none font-semibold rounded-full border bg-amber-50 text-amber-700 border-amber-200 capitalize">
                            {p.dispute_status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm">
                        <button 
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                            onClick={() => { setSelectedPayment(p); setDisputeStatus((p.dispute_status as any) || 'open'); setAdminNote(p.admin_note || ''); }}
                        >
                          <FileText className="h-3 w-3 text-slate-500" /> Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card> */}

      {selectedPayment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPayment(null)}
          title={`Dispute #${selectedPayment.payment_id}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelectedPayment(null)}>Close</Button>
              <Button onClick={async () => {
                await apiClient.patch(`/payments/${selectedPayment.payment_id}/dispute`, { dispute_status: disputeStatus, admin_note: adminNote });
                setSelectedPayment(null);
                fetchDisputes();
              }}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-slate-500">Student</div>
                <div className="text-slate-800 font-medium">{selectedPayment.student?.user?.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-500">Tutor</div>
                <div className="text-slate-800 font-medium">{selectedPayment.tutor?.user?.name || 'N/A'}</div>
              </div>
            </div>
            {selectedPayment.dispute_proof_url && (
              <div>
                <div className="text-slate-500 mb-1">Proof</div>
                <a href={selectedPayment.dispute_proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary-600 hover:underline">
                  <FileText className="mr-2 h-4 w-4" /> View attachment
                </a>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700">Dispute Status</label>
              <select className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={disputeStatus} onChange={(e) => setDisputeStatus(e.target.value as any)}>
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Admin Note</label>
              <textarea className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" rows={4} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}


    </div>
  );
};

export default UserManagement;
