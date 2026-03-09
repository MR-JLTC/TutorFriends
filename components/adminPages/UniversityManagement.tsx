import React, { useState, useEffect, useCallback } from 'react';
import { University } from '../../types';
import apiClient, { getFileUrl } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Pencil, Trash2, Plus, Info, GraduationCap } from 'lucide-react';

const UniversityManagement: React.FC = () => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUniversity, setCurrentUniversity] = useState<Partial<University> | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUniversities = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/universities');
      setUniversities(response.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUniversities();
  }, [fetchUniversities]);

  const handleOpenModal = (university: Partial<University> | null = null) => {
    setCurrentUniversity(university ? { ...university } : { name: '', acronym: '', email_domain: '', status: 'active' });
    setIsModalOpen(true);
    setLogoFile(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUniversity(null);
  };

  const handleSave = async () => {
    if (!currentUniversity || !currentUniversity.name || !(currentUniversity as any).email_domain) {
      alert('Please fill out all fields.');
      return;
    }
    setIsSaving(true);
    try {
      if (currentUniversity.university_id) {
        const res = await apiClient.patch(`/universities/${currentUniversity.university_id}`, currentUniversity);
        if (logoFile) {
          const form = new FormData();
          form.append('file', logoFile);
          try {
            await apiClient.post(`/universities/${currentUniversity.university_id}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch (e: any) {
            // Fallback path variant if proxy rewrites: /universities/logo/:id
            await apiClient.post(`/universities/logo/${currentUniversity.university_id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          }
        }
      } else {
        const created = await apiClient.post('/universities', currentUniversity);
        const newId = created?.data?.university_id;
        if (newId && logoFile) {
          const form = new FormData();
          form.append('file', logoFile);
          try {
            await apiClient.post(`/universities/${newId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch (e: any) {
            await apiClient.post(`/universities/logo/${newId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          }
        }
      }
      handleCloseModal();
      fetchUniversities();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/universities/${deleteTarget.id}`);
      fetchUniversities();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.message;
      // alert(apiMsg || 'Cannot delete this university because it has existing courses/subjects. Please remove those first or set status to Inactive.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentUniversity((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const inputStyles = 'mt-1 block w-full px-3 py-2 rounded-md shadow-sm border border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600';

  return (
    <>
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
              Manage supported universities/schools used for email domain verification.
            </p>
          </div>
        </div>
      </div>
      <Card>
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary-100 rounded-lg">
              <GraduationCap className="h-4 w-4 text-primary-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Universities</h2>
            <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-700 rounded-full border border-primary-200">
              {universities.length}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            <input
              className="w-full sm:w-52 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition"
              placeholder="Search name, acronym or domain..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none min-w-[110px] transition"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add University
            </Button>
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm sm:text-base">Loading...</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-primary-600 to-primary-700">
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Acronym</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Email Domain</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-5 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {universities
                    .filter((u) => {
                      const q = query.toLowerCase();
                      const statusOk = statusFilter === 'all' || u.status === statusFilter;
                      return (
                        statusOk && (
                          u.name.toLowerCase().includes(q) ||
                          ((u as any).acronym || '').toLowerCase().includes(q) ||
                          ((u as any).email_domain || '').toLowerCase().includes(q)
                        )
                      );
                    })
                    .map((uni) => (
                      <tr key={uni.university_id} className="transition-colors duration-150 hover:bg-slate-50">
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">
                          <div className="flex items-center gap-3 min-w-0">
                            {((uni as any).logo_url) ? (
                              <img
                                src={getFileUrl((uni as any).logo_url)}
                                alt={(uni as any).acronym || uni.name}
                                className="h-8 w-8 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0" />
                            )}
                            <span className="truncate" title={uni.name}>{uni.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {(uni as any).acronym
                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 border border-primary-200">{(uni as any).acronym}</span>
                            : <span className="text-xs text-slate-400 italic">—</span>
                          }
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {(uni as any).email_domain || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${uni.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {uni.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenModal(uni)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors duration-150"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(uni.university_id, uni.name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors duration-150"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {universities.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-500">No universities added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {universities
                .filter((u) => {
                  const q = query.toLowerCase();
                  const statusOk = statusFilter === 'all' || u.status === statusFilter;
                  return (
                    statusOk && (
                      u.name.toLowerCase().includes(q) ||
                      ((u as any).acronym || '').toLowerCase().includes(q) ||
                      ((u as any).email_domain || '').toLowerCase().includes(q)
                    )
                  );
                })
                .map((uni) => (
                  <div key={uni.university_id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Card Header Row */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-white">
                      {((uni as any).logo_url) ? (
                        <img
                          src={getFileUrl((uni as any).logo_url)}
                          alt={(uni as any).acronym || uni.name}
                          className="h-10 w-10 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate text-sm">{uni.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {(uni as any).acronym && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-700 rounded-full border border-primary-200">{(uni as any).acronym}</span>
                          )}
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-md border border-slate-200 truncate max-w-[160px]">
                            {(uni as any).email_domain || 'N/A'}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${uni.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {uni.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Action row */}
                    <div className="flex gap-2 px-4 pb-3 bg-white">
                      <button
                        onClick={() => handleOpenModal(uni)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(uni.university_id, uni.name)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              {universities.filter((u) => {
                const q = query.toLowerCase();
                const statusOk = statusFilter === 'all' || u.status === statusFilter;
                return (
                  statusOk && (
                    u.name.toLowerCase().includes(q) ||
                    ((u as any).acronym || '').toLowerCase().includes(q) ||
                    ((u as any).email_domain || '').toLowerCase().includes(q)
                  )
                );
              }).length === 0 && (
                  <p className="text-center text-slate-500 py-6">No universities found.</p>
                )}
            </div>
          </>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={currentUniversity?.university_id ? 'Edit University' : 'Add University'}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
          </>
        }
      >
        {currentUniversity && (
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">University Name</label>
                <input type="text" name="name" id="name" value={currentUniversity.name || ''} onChange={handleChange} className={inputStyles} placeholder="e.g., De La Salle University" />
              </div>
              <div>
                <label htmlFor="acronym" className="block text-sm font-medium text-slate-700">Acronym</label>
                <input type="text" name="acronym" id="acronym" value={(currentUniversity as any).acronym || ''} onChange={handleChange} className={inputStyles} placeholder="e.g., DLSU" />
              </div>
              <div>
                <label htmlFor="email_domain" className="block text-sm font-medium text-slate-700">Email Domain</label>
                <input type="text" name="email_domain" id="email_domain" value={(currentUniversity as any).email_domain || ''} onChange={handleChange} className={inputStyles} placeholder="e.g., dlsu.edu.ph" />
                <p className="mt-1 text-xs text-slate-500">The domain used for student/tutor verification.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
                />
                {logoFile && <p className="text-xs text-slate-500 mt-1">Selected: {logoFile.name}</p>}
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label>
                <select name="status" id="status" value={currentUniversity.status} onChange={handleChange} className={inputStyles}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title=""
        maxWidth="sm"
        hideCloseButton
        footer={
          <div className="flex items-center gap-3 w-full sm:justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-60 rounded-xl transition-all duration-150 shadow-md shadow-red-200"
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Yes, Delete
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center gap-5 pt-2 pb-1">
          {/* Icon with layered rings */}
          <div className="relative flex items-center justify-center">
            <div className="absolute h-24 w-24 rounded-full bg-red-100/60 animate-pulse" />
            <div className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-red-100" />
            <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-200">
              <Trash2 className="h-7 w-7 text-white" />
            </div>
          </div>
          {/* Text */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Delete University?</h3>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
              You're about to permanently delete{' '}
              <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">{deleteTarget?.name}</span>.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              This action cannot be undone
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default UniversityManagement;
