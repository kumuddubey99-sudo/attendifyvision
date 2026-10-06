import React, { useState, useEffect } from 'react';
import { ClipboardList, Filter, Calendar, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserSession } from '../lib/auth';
import { AttendanceRowView, getStudentAttendanceHistory, getStudentAttendanceSummary, StudentAttendanceSummary } from '../lib/attendanceService';

interface Props {
  user: UserSession;
}

export const StudentAttendanceView: React.FC<Props> = ({ user }) => {
  const [records, setRecords] = useState<AttendanceRowView[]>([]);
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user.id, selectedSubjectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const hist = await getStudentAttendanceHistory(
        user.id,
        selectedSubjectId ? Number(selectedSubjectId) : undefined
      );
      setRecords(hist);

      const sum = await getStudentAttendanceSummary(user.id);
      setSummary(sum);
    } catch (e) {
      console.error('Failed to load student attendance', e);
    } finally {
      setLoading(false);
    }
  };

  const presentCount = records.filter((r) => r.status === 'Present').length;
  const absentCount = records.filter((r) => r.status === 'Absent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            My Attendance History (Read-Only)
          </h2>
          <p className="text-xs text-slate-500">
            View your personal attendance logs recorded by teachers via classroom facial recognition.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Verified Student: <strong>{user.name}</strong></span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <label className="text-xs font-semibold text-slate-700">Filter By Subject:</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 font-medium focus:border-blue-500"
          >
            <option value="">All Enrolled Subjects</option>
            {summary?.subjectWise.map((sub) => (
              <option key={sub.subjectId} value={sub.subjectId}>
                {sub.subjectName} ({sub.subjectCode})
              </option>
            ))}
          </select>
        </div>

        {/* Quick count chips */}
        <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-end">
          <span className="bg-slate-100 px-3 py-1 rounded-md font-medium text-slate-700">
            Total Sessions: {records.length}
          </span>
          <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-md font-semibold border border-emerald-200">
            Present: {presentCount}
          </span>
          <span className="bg-rose-50 text-rose-800 px-3 py-1 rounded-md font-semibold border border-rose-200">
            Absent: {absentCount}
          </span>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Subject Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Class Date</th>
                  <th className="px-4 py-3">Class Time</th>
                  <th className="px-4 py-3">Attendance Status</th>
                  <th className="px-4 py-3 text-right">Recognition Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.subject_name}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-500">{r.subject_code}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{r.attendance_date}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{r.attendance_time}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {r.status === 'Present' ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-rose-600" />
                        )}
                        <span>{r.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {r.status === 'Present' && r.confidence > 0 ? (
                        <span className="text-emerald-700">{r.confidence}%</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No attendance sessions found.</p>
          </div>
        )}
      </div>

      {/* Essential attendance notice */}
      <p className="text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
        Student attendance records are verified by classroom face recognition and are read-only.
      </p>
    </div>
  );
};
