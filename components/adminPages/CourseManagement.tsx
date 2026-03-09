import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Course, Subject, University } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ChevronDown, ChevronRight, Info, Pencil, Trash2, BookOpen, Plus } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface CourseWithDetails extends Course {
    university: University;
    subjects?: Subject[];
}

const CourseManagement: React.FC = () => {
    const { notify } = useToast();
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCourseId, setOpenCourseId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [universities, setUniversities] = useState<University[]>([]);
    const [form, setForm] = useState<{ course_name: string; university_id: number; acronym?: string; subject_name?: string } | null>(null);
    const [editCourse, setEditCourse] = useState<CourseWithDetails | null>(null);
    const [editSubject, setEditSubject] = useState<Subject | null>(null);

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get('/courses');
                setCourses(response.data);
            } catch (e) {
                setError('Failed to fetch courses.');
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        const fetchUniversities = async () => {
            const res = await apiClient.get('/universities');
            setUniversities(res.data);
        }
        fetchCourses();
        fetchUniversities();
    }, []);

    const toggleSubjects = async (courseId: number) => {
        if (openCourseId === courseId) {
            setOpenCourseId(null);
            return;
        }

        const course = courses.find(c => c.course_id === courseId);
        if (course && !course.subjects) {
            try {
                // Fetch subjects if not already fetched
                const response = await apiClient.get(`/courses/${courseId}/subjects`);
                const subjects = response.data;
                setCourses(prevCourses => prevCourses.map(c =>
                    c.course_id === courseId ? { ...c, subjects } : c
                ));
            } catch (err) {
                console.error("Failed to fetch subjects", err);
            }
        }
        setOpenCourseId(courseId);
        // Ensure form exists so the subject input is controlled and editable
        setForm(prev => prev ?? { course_name: '', university_id: 0, acronym: '', subject_name: '' });
    };

    const openAddCourse = () => {
        setForm({ course_name: '', university_id: universities[0]?.university_id || 0, acronym: '' });
        setIsModalOpen(true);
    }

    const saveCourse = async () => {
        if (!form) return;
        try {
            if (editCourse) {
                await apiClient.patch(`/courses/${editCourse.course_id}`, { course_name: form.course_name, university_id: form.university_id, acronym: form.acronym || '' });
            } else {
                await apiClient.post('/courses', { course_name: form.course_name, university_id: form.university_id, acronym: form.acronym || '' });
            }
            const response = await apiClient.get('/courses');
            setCourses(response.data);
            setIsModalOpen(false);
            setEditCourse(null);
            setError(null);
            notify('Course saved successfully!', 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save course.';
            notify(errorMessage, 'error');
        }
    }

    const addSubject = async (courseId: number) => {
        if (!form?.subject_name) return;
        await apiClient.post(`/courses/${courseId}/subjects`, { subject_name: form.subject_name });
        const response = await apiClient.get(`/courses/${courseId}/subjects`);
        setCourses(prev => prev.map(c => c.course_id === courseId ? { ...c, subjects: response.data } as CourseWithDetails : c));
        setForm(prev => prev ? { ...prev, subject_name: '' } : prev);
    }

    const openEditCourse = (course: CourseWithDetails) => {
        setEditCourse(course);
        setForm({ course_name: course.course_name, university_id: course.university.university_id, acronym: course.acronym || '' });
        setIsModalOpen(true);
    }

    const openEditSubject = (subject: Subject) => {
        setEditSubject(subject);
        setForm(prev => ({ course_name: '', university_id: 0, acronym: '', subject_name: subject.subject_name }));
    }

    const saveSubject = async (courseId: number) => {
        if (!editSubject || !form) return;
        await apiClient.patch(`/courses/${courseId}/subjects/${editSubject.subject_id}`, { subject_name: form.subject_name });
        const response = await apiClient.get(`/courses/${courseId}/subjects`);
        setCourses(prev => prev.map(c => c.course_id === courseId ? { ...c, subjects: response.data } as CourseWithDetails : c));
        setEditSubject(null);
        setForm(prev => prev ? { ...prev, subject_name: '' } : prev);
    }

    if (loading) return <div>Loading courses...</div>;

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
                            Manage courses, subjects, and their associated universities across the platform.
                        </p>
                    </div>
                </div>
            </div>
            <Card>
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary-100 rounded-lg">
                            <BookOpen className="h-4 w-4 text-primary-600" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Courses</h2>
                        <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-700 rounded-full border border-primary-200">
                            {courses.length}
                        </span>
                    </div>
                    <Button onClick={openAddCourse} className="w-full sm:w-auto flex items-center gap-1.5">
                        <Plus className="h-4 w-4" /> Add Course
                    </Button>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-primary-600 to-primary-700">
                                <th scope="col" className="px-4 py-3 w-10"></th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Course Name</th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Acronym</th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">University</th>
                                <th scope="col" className="px-5 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {courses.map((course) => (
                                <React.Fragment key={course.course_id}>
                                    <tr
                                        className={`transition-colors duration-150 cursor-pointer ${openCourseId === course.course_id ? 'bg-primary-50/60' : 'hover:bg-slate-50'}`}
                                        onClick={() => toggleSubjects(course.course_id)}
                                    >
                                        <td className="px-4 py-3.5 text-center">
                                            <button className={`p-1 rounded-md transition-colors ${openCourseId === course.course_id ? 'text-primary-600 bg-primary-100' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'}`}>
                                                {openCourseId === course.course_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{course.course_name}</td>
                                        <td className="px-5 py-3.5">
                                            {course.acronym
                                                ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 border border-primary-200">{course.acronym}</span>
                                                : <span className="text-xs text-slate-400 italic">—</span>
                                            }
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                {course.university?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEditCourse(course)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors duration-150"
                                                >
                                                    <Pencil className="h-3 w-3" /> Edit
                                                </button>
                                                <button
                                                    onClick={async () => { await apiClient.delete(`/courses/${course.course_id}`); const res = await apiClient.get('/courses'); setCourses(res.data); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors duration-150"
                                                >
                                                    <Trash2 className="h-3 w-3" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {openCourseId === course.course_id && (
                                        <tr>
                                            <td colSpan={5} className="p-0">
                                                <div className="px-6 py-4 bg-primary-50/40 border-t border-primary-100">
                                                    <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-3">Subjects</p>
                                                    {/* Add subject input row */}
                                                    <div className="flex gap-2 mb-4 max-w-lg">
                                                        <input
                                                            className="flex-1 border border-slate-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 rounded-lg px-3 py-1.5 text-sm outline-none transition"
                                                            placeholder="New subject name…"
                                                            value={form?.subject_name || ''}
                                                            onChange={(e) => setForm(prev => ({ ...(prev ?? { course_name: '', university_id: 0, acronym: '' }), subject_name: e.target.value }))}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); addSubject(course.course_id); }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors duration-150 shadow-sm"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" /> Add
                                                        </button>
                                                    </div>
                                                    {/* Subject list */}
                                                    {course.subjects && course.subjects.length > 0 ? (
                                                        <ul className="space-y-1.5">
                                                            {[...(course.subjects || [])]
                                                                .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
                                                                .map(subject => (
                                                                    <li key={subject.subject_id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2 hover:border-primary-200 hover:bg-primary-50/30 transition-colors duration-150">
                                                                        <span className="text-sm text-slate-700 font-medium">{subject.subject_name}</span>
                                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                            <button
                                                                                onClick={() => openEditSubject(subject)}
                                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-md transition-colors"
                                                                            >
                                                                                <Pencil className="h-3 w-3" /> Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={async () => { await apiClient.delete(`/courses/${course.course_id}/subjects/${subject.subject_id}`); const res = await apiClient.get(`/courses/${course.course_id}/subjects`); setCourses(prev => prev.map(c => c.course_id === course.course_id ? { ...c, subjects: res.data } as CourseWithDetails : c)); }}
                                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" /> Delete
                                                                            </button>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm text-slate-400 italic">No subjects yet. Add one above.</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {courses.map((course) => (
                        <div key={course.course_id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            {/* Card Header Row */}
                            <div className="flex items-center justify-between px-4 py-3 bg-white">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-900 truncate text-sm">{course.course_name}</h3>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {course.acronym && (
                                            <span className="px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-700 rounded-full border border-primary-200">{course.acronym}</span>
                                        )}
                                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-md border border-slate-200 truncate max-w-[160px]">
                                            {course.university?.name || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleSubjects(course.course_id)}
                                    className={`ml-2 p-1.5 rounded-lg flex-shrink-0 transition-colors ${openCourseId === course.course_id ? 'text-primary-600 bg-primary-100' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'}`}
                                >
                                    {openCourseId === course.course_id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>
                            </div>
                            {/* Action row */}
                            <div className="flex gap-2 px-4 pb-3 bg-white">
                                <button
                                    onClick={() => openEditCourse(course)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
                                >
                                    <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                    onClick={async () => { await apiClient.delete(`/courses/${course.course_id}`); const res = await apiClient.get('/courses'); setCourses(res.data); }}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-3 w-3" /> Delete
                                </button>
                            </div>
                            {/* Expanded subjects panel */}
                            {openCourseId === course.course_id && (
                                <div className="border-t border-primary-100 bg-primary-50/40 px-4 py-3 space-y-3">
                                    <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Subjects</p>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 border border-slate-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 rounded-lg px-3 py-1.5 text-sm outline-none transition"
                                            placeholder="New subject name…"
                                            value={form?.subject_name || ''}
                                            onChange={(e) => setForm(prev => ({ ...(prev ?? { course_name: '', university_id: 0, acronym: '' }), subject_name: e.target.value }))}
                                        />
                                        <button
                                            onClick={() => addSubject(course.course_id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Add
                                        </button>
                                    </div>
                                    {course.subjects && course.subjects.length > 0 ? (
                                        <ul className="space-y-1.5">
                                            {[...(course.subjects || [])]
                                                .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
                                                .map(subject => (
                                                    <li key={subject.subject_id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                                                        <span className="text-sm text-slate-700 font-medium flex-1 truncate">{subject.subject_name}</span>
                                                        <div className="flex gap-1.5 ml-2 shrink-0">
                                                            <button
                                                                onClick={() => openEditSubject(subject)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-md transition-colors"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                onClick={async () => { await apiClient.delete(`/courses/${course.course_id}/subjects/${subject.subject_id}`); const res = await apiClient.get(`/courses/${course.course_id}/subjects`); setCourses(prev => prev.map(c => c.course_id === course.course_id ? { ...c, subjects: res.data } as CourseWithDetails : c)); }}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">No subjects yet.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditCourse(null); setError(null); }} title={editCourse ? 'Edit Course' : 'Add Course'} footer={<>
                <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditCourse(null); setError(null); }}>Cancel</Button>
                <Button onClick={saveCourse}>Save</Button>
            </>}>
                {form && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Course Name</label>
                            <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.course_name} onChange={(e) => setForm(prev => prev ? { ...prev, course_name: e.target.value } : prev)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Acronym</label>
                            <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.acronym || ''} onChange={(e) => setForm(prev => prev ? { ...prev, acronym: e.target.value } : prev)} placeholder="e.g., CS, IT, BS" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">University</label>
                            <select className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.university_id} onChange={(e) => setForm(prev => prev ? { ...prev, university_id: Number(e.target.value) } : prev)}>
                                {universities.map(u => (
                                    <option key={u.university_id} value={u.university_id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </Modal>

            {editSubject && (
                <Modal isOpen={true} onClose={() => setEditSubject(null)} title="Edit Subject" footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditSubject(null)}>Cancel</Button>
                        <Button onClick={() => saveSubject(openCourseId || (courses.find(c => c.subjects?.some(s => s.subject_id === editSubject.subject_id))?.course_id as number))}>Save</Button>
                    </>
                }>
                    {form && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Subject Name</label>
                                <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.subject_name || ''} onChange={(e) => setForm(prev => prev ? { ...prev, subject_name: e.target.value } : prev)} />
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default CourseManagement;
