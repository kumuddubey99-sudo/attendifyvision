import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, AlertCircle, CheckCircle2, Camera } from 'lucide-react';
import { UserSession } from '../lib/auth';
import { SubjectWithStats, getTeacherSubjects, addTeacherSubject } from '../lib/attendanceService';

interface Props {
  user: UserSession;
  onTakeAttendance: (subjectId: number) => void;
}

export const SubjectManagement: React.FC<Props> = ({ user, onTakeAttendance }) => {
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [stream, setStream] = useState(user.stream || 'BSc IT');
  const [year, setYear] = useState('TY');
  const [semester, setSemester] = useState('5');
  const [division, setDivision] = useState('A');

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, [user.id]);

  const loadSubjects = async () => {
    const list = await getTeacherSubjects(user.id);
    setSubjects(list);
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!subjectName.trim()) {
      setFormError('Subject Name is required.');
      return;
    }
    if (!subjectCode.trim()) {
      setFormError('Subject Code is required.');
      return;
    }
    if (!stream.trim()) {
      setFormError('Stream / Course is required.');
      return;
    }
    if (!year.trim()) {
      setFormError('Year is required.');
      return;
    }
    if (!semester.trim()) {
      setFormError('Semester is required.');
      return;
    }
    if (!division.trim()) {
      setFormError('Division is required.');
      return;
    }

    setIsSubmitting(true);
    const res = await addTeacherSubject(
      user.id,
      subjectName,
      subjectCode,
      stream,
      year,
      semester,
      division
    );
    setIsSubmitting(false);

    if (res.success) {
      setFormSuccess(`Subject "${subjectName}" added successfully.`);
      setSubjectName('');
      setSubjectCode('');
      loadSubjects();
      setTimeout(() => setFormSuccess(null), 3000);
    } else {
      setFormError(res.message || 'Failed to add subject.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Subject Management
          </h2>
          <p className="text-xs text-slate-500">
            Create and manage curriculum subjects across any stream, year, semester, and division.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{showAddForm ? 'Close Form' : 'Add New Subject'}</span>
        </button>
      </div>

      {/* Add Subject Collapsible Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-md">
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Add Subject Details
          </h3>

          {formError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAddSubject} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Web Programming, Financial Accounting"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject Code *</label>
                <input
                  type="text"
                  placeholder="e.g. WP101, FA201, CS501"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stream / Course *</label>
                <input
                  type="text"
                  placeholder="e.g. BSc IT, BCom, BCA, BMS, BA"
                  value={stream}
                  onChange={(e) => setStream(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Supports any academic course</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Year *</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 bg-white"
                >
                  <option value="FY">FY (First Year)</option>
                  <option value="SY">SY (Second Year)</option>
                  <option value="TY">TY (Third Year)</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Semester *</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <option key={sem} value={String(sem)}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Division *</label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="e.g. A, B, C"
                  value={division}
                  onChange={(e) => setDivision(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Save Subject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Registered Subjects ({subjects.length})
          </h3>
        </div>

        {subjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Subject Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Stream</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Enrolled Students</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{sub.subject_name}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-600">{sub.subject_code}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {sub.stream}
                      </span>
                    </td>
                    <td className="px-4 py-3">{sub.year} - Sem {sub.semester}</td>
                    <td className="px-4 py-3 font-bold">{sub.division}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                        {sub.enrolled_count} Students
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onTakeAttendance(sub.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Camera className="h-3 w-3" />
                        <span>Take Attendance</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm font-medium text-slate-500">No subjects created yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click &ldquo;Add New Subject&rdquo; above to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
};
