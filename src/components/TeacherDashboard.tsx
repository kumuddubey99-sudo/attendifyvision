import React, { useState, useEffect } from 'react';
import { BookOpen, Users, UserCheck, Percent, PlusCircle, UserPlus, Camera, ClipboardList, Download, Calendar, Clock, ArrowRight } from 'lucide-react';
import { UserSession } from '../lib/auth';
import { SubjectWithStats, getTeacherSubjects, getAttendanceRecords, exportAttendanceToCsv } from '../lib/attendanceService';
import { getAllStudentsWithFaceStatus } from '../lib/attendanceService';

interface Props {
  user: UserSession;
  onNavigate: (view: string, extraSubjectId?: number) => void;
}

export const TeacherDashboard: React.FC<Props> = ({ user, onNavigate }) => {
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [totalClassesToday, setTotalClassesToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [user.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const subs = await getTeacherSubjects(user.id);
      setSubjects(subs);

      const allStudents = await getAllStudentsWithFaceStatus();
      // Students matching teacher stream or overall
      setTotalStudents(allStudents.length);

      // Attendance records for teacher
      const attRecords = await getAttendanceRecords({ teacherId: user.id, date: todayStr });
      const presentCount = attRecords.filter((a) => a.status === 'Present').length;
      setPresentToday(presentCount);
      setTotalClassesToday(attRecords.length);
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    const records = await getAttendanceRecords({ teacherId: user.id });
    exportAttendanceToCsv(records, `attendance_report_${todayStr}.csv`);
  };

  const attendancePercentage = totalClassesToday > 0 
    ? Math.round((presentToday / totalClassesToday) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner with Teacher details & live clock */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-blue-100 mb-2">
              Teacher Portal
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {user.name}</h1>
            <p className="text-blue-100 text-sm mt-0.5">
              Department / Stream: <span className="font-semibold text-white">{user.stream}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono bg-white/10 backdrop-blur-xs px-4 py-2 rounded-xl border border-white/15">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-300" />
              <span>{todayStr}</span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-300" />
              <span>{currentTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Subjects</span>
            <p className="text-2xl font-bold text-slate-900">{subjects.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Students</span>
            <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Present Today</span>
            <p className="text-2xl font-bold text-slate-900">{presentToday}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Attendance Rate Today</span>
            <p className="text-2xl font-bold text-slate-900">{attendancePercentage}%</p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('subjects')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center group cursor-pointer"
          >
            <PlusCircle className="h-5 w-5 text-blue-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-slate-800">Add Subject</span>
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <UserPlus className="h-5 w-5 text-indigo-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-slate-800">Add Student</span>
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all text-center group cursor-pointer"
          >
            <Camera className="h-5 w-5 text-violet-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-slate-800">Register Face</span>
          </button>

          <button
            onClick={() => onNavigate('mark_attendance')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <UserCheck className="h-5 w-5 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-slate-800">Mark Attendance</span>
          </button>

          <button
            onClick={() => onNavigate('attendance_records')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <ClipboardList className="h-5 w-5 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-slate-800">View Attendance</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition-all text-center group cursor-pointer"
          >
            <Download className="h-5 w-5 text-teal-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-slate-800">Download CSV</span>
          </button>
        </div>
      </div>

      {/* My Subjects Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">My Subjects</h2>
            <p className="text-xs text-slate-500">Subjects assigned to you across streams and divisions</p>
          </div>
          <button
            onClick={() => onNavigate('subjects')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Manage All Subjects</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {subjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Subject Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Stream</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{sub.subject_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 font-medium">{sub.subject_code}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {sub.stream}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{sub.year}</td>
                    <td className="px-4 py-3">{sub.semester}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{sub.division}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                        {sub.enrolled_count} Students
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onNavigate('mark_attendance', sub.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Camera className="h-3.5 w-3.5" />
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
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No subjects added yet</p>
            <p className="text-xs text-slate-400 mt-1">Click &ldquo;Add Subject&rdquo; to create your first class</p>
            <button
              onClick={() => onNavigate('subjects')}
              className="mt-3 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 cursor-pointer"
            >
              Add Subject
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
