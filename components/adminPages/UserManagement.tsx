import React, { useEffect, useState } from 'react';
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
  const handleStatusToggle = async (userId: number, currentStatus: 'active' | 'inactive') => {
    const next = currentStatus === 'active' ? 'inactive' : 'active';
    const confirmMsg = next === 'inactive' ? 'Deactivate this user?' : 'Activate this user?';
    if (!confirm(confirmMsg)) return;
    try {
      setUpdatingUserId(userId);
      await apiClient.patch(`/users/${userId}/status`, { status: next });
      await fetchUsers();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to update user status.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleResetPassword = async (userId: number) => {
    const newPassword = prompt('Enter a new password (min 7 chars):');
    if (!newPassword || newPassword.length < 7) return;
    await apiClient.patch(`/users/${userId}/reset-password`, { newPassword });
    alert('Password reset successfully');
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

  const deleteUser = async (userId: number) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/users/${userId}`);
      fetchUsers();
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('User deleted successfully.', 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to delete user. They may have related records. Consider deactivating instead.';
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify(msg, 'error');
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
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users
                .filter(user => userTypeFilter === 'all' ? true : (user.role === userTypeFilter))
                .map((user) => (
                  <tr key={user.user_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        {user.profile_image_url ? (
                          <img
                            src={getFileUrl(user.profile_image_url)}
                            alt={user.name}
                            className="h-10 w-10 rounded-full mr-3 object-cover flex-shrink-0"
                            style={{ aspectRatio: '1 / 1' }}
                            onError={(e) => {
                              const imgElement = e.target as HTMLImageElement;
                              imgElement.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random';
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full mr-3 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {user.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.university_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {/* User Status */}
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${((user as any).status || 'active') === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                          {((user as any).status || 'active')}
                        </span>
                        {/* Tutor Application Status (only for tutors) */}
                        {(user.role as any) === 'tutor' && (user as any).tutor_profile && (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${(user as any).tutor_profile.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : (user as any).tutor_profile.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {(user as any).tutor_profile.status || 'pending'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="inline-flex items-center gap-2">
                        {/* Edit button - green */}
                        <button className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded px-2 py-1 transition-colors" title="Edit" onClick={() => openEdit(user)}>
                          <Edit className="inline h-4 w-4" />
                        </button>
                        {/* Reset password button - blue */}
                        <button className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 transition-colors disabled:opacity-50" title="Reset Password" onClick={() => handleResetPassword(user.user_id)} disabled={updatingUserId === user.user_id}>
                          <RefreshCw className="inline h-4 w-4" />
                        </button>
                        {/* Deactivate/activate button - red */}
                        <button className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 transition-colors disabled:opacity-50" title="Toggle Active" onClick={() => handleStatusToggle(user.user_id, ((user as any).status || 'active'))} disabled={updatingUserId === user.user_id}>
                          <Ban className="inline h-4 w-4" />
                        </button>
                        {/* <button className="text-red-600 hover:text-red-700" title="Delete" onClick={() => deleteUser(user.user_id)}>
                        <Trash2 className="inline h-4 w-4" />
                      </button> */}
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
            <Card key={user.user_id} className="p-4">
              <div className="space-y-3">
                {/* User Header */}
                <div className="flex items-center gap-3">
                  {user.profile_image_url ? (
                    <img
                      src={getFileUrl(user.profile_image_url)}
                      alt={user.name}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      style={{ aspectRatio: '1 / 1' }}
                      onError={(e) => {
                        const imgElement = e.target as HTMLImageElement;
                        imgElement.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random';
                      }}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{user.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>

                {/* User Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Role</p>
                    <p className="font-medium text-slate-900 capitalize">{user.role}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">University</p>
                    <p className="font-medium text-slate-900 truncate">{user.university_name || 'N/A'}</p>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${((user as any).status || 'active') === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    {((user as any).status || 'active')}
                  </span>
                  {(user.role as any) === 'tutor' && (user as any).tutor_profile && (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${(user as any).tutor_profile.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : (user as any).tutor_profile.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {(user as any).tutor_profile.status || 'pending'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    className="flex-1 text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    title="Edit"
                    onClick={() => openEdit(user)}
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    className="flex-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    title="Reset Password"
                    onClick={() => handleResetPassword(user.user_id)}
                    disabled={updatingUserId === user.user_id}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Reset</span>
                  </button>
                  <button
                    className="flex-1 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    title="Toggle Active"
                    onClick={() => handleStatusToggle(user.user_id, ((user as any).status || 'active'))}
                    disabled={updatingUserId === user.user_id}
                  >
                    <Ban className="h-4 w-4" />
                    <span>Status</span>
                  </button>
                </div>
              </div>
            </Card>
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
      )}{/* --- MODIFICATION ENDS (3/3) --- */}

      <div className="mt-8" />
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Payment Disputes</h2>
      <Card>
        {disputesLoading ? (
          <div>Loading disputes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {disputes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No disputes at the moment.</td>
                  </tr>
                ) : (
                  disputes.map((p) => (
                    <tr key={p.payment_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">#{p.payment_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.student?.user?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.tutor?.user?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">{p.dispute_status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Button variant="secondary" onClick={() => { setSelectedPayment(p); setDisputeStatus((p.dispute_status as any) || 'open'); setAdminNote(p.admin_note || ''); }}>
                          <FileText className="mr-2 h-4 w-4" /> Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
