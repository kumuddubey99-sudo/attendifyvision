import React, { useState, useEffect } from 'react';
import { UserSession } from '../lib/auth';
import { StudentAttendanceSummary, getStudentAttendanceSummary } from '../lib/attendanceService';
import { BookOpen, UserCheck, AlertCircle, Percent, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  user: UserSession;
  onNavigate: (view: string) => void;
}

export const StudentDashboard: React.FC<Props> = ({ user, onNavigate }) => {
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [user.id]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await getStudentAttendanceSummary(user.id);
      setSummary(data);
    } catch (e) {
      console.error('Failed to load student summary', e);
    } finally {
      setLoading(false);
    }
  };

  const overall = summary?.overall || {
    totalClasses: 0,
    presentClasses: 0,
    absentClasses: 0,
    percentage: 0,
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-blue-100 mb-2">
              Student Portal (Read-Only)
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {user.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-blue-100 text-xs mt-2">
              <span>Student ID: <strong className="text-white font-mono">{user.student_id}</strong></span>
              <span>•</span>
              <span>Roll Number: <strong className="text-white">{user.roll_number}</strong></span>
              <span>•</span>
              <span>Stream: <strong className="text-white">{user.stream}</strong></span>
              <span>•</span>
              <span>Class: <strong className="text-white">{user.year} - Sem {user.semester} (Div {user.division})</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl text-xs border border-white/20">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span className="text-emerald-100 font-medium">Verified Academic Profile</span>
          </div>
        </div>
      </div>

      {/* Overall Attendance Metrics */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Overall Attendance Record
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Total Classes Held</span>
              <p className="text-2xl font-bold text-slate-900">{overall.totalClasses}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Classes Attended (Present)</span>
              <p className="text-2xl font-bold text-slate-900">{overall.presentClasses}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Classes Missed (Absent)</span>
              <p className="text-2xl font-bold text-slate-900">{overall.absentClasses}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Percent className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Attendance Percentage</span>
              <p
                className={`text-2xl font-bold ${
                  overall.percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {overall.percentage}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subject-Wise Attendance Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              Subject-Wise Attendance Breakdown
            </h2>
            <p className="text-xs text-slate-500">Live attendance percentage dynamically calculated for your enrolled courses</p>
          </div>
          <button
            onClick={() => onNavigate('my_attendance')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View Detailed Date Log</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {summary && summary.subjectWise.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Subject Code</th>
                  <th className="px-4 py-3 text-center">Total Classes</th>
                  <th className="px-4 py-3 text-center">Present</th>
                  <th className="px-4 py-3 text-center">Absent</th>
                  <th className="px-4 py-3 text-center">Percentage</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.subjectWise.map((sub) => {
                  const isGood = sub.percentage >= 75;
                  return (
                    <tr key={sub.subjectId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{sub.subjectName}</td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-500">{sub.subjectCode}</td>
                      <td className="px-4 py-3 text-center font-medium">{sub.totalClasses}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{sub.presentClasses}</td>
                      <td className="px-4 py-3 text-center font-bold text-rose-700">{sub.absentClasses}</td>
                      <td className="px-4 py-3 text-center font-bold text-base">
                        <span className={isGood ? 'text-emerald-700' : 'text-amber-700'}>
                          {sub.percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isGood
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isGood ? 'Eligible' : 'Low Attendance (<75%)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No subject attendance records found.</p>
            <p className="text-xs text-slate-400 mt-1">Attendance sessions marked by your teacher will appear here.</p>
          </div>
        )}
      </div>

      {/* Student Read-Only Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
        <span>Attendance records are recorded via classroom face recognition and are read-only.</span>
      </div>
    </div>
  );
};
