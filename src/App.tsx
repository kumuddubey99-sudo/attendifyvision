import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Camera,
  ClipboardList,
  Download,
  User,
  LogOut,
  Menu,
  X,
  Award,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { UserSession } from './lib/auth';
import { TeacherAuth } from './components/TeacherAuth';
import { StudentAuth } from './components/StudentAuth';
import { TeacherDashboard } from './components/TeacherDashboard';
import { SubjectManagement } from './components/SubjectManagement';
import { StudentManagement } from './components/StudentManagement';
import { MarkAttendance } from './components/MarkAttendance';
import { TeacherAttendanceView } from './components/TeacherAttendanceView';
import { StudentDashboard } from './components/StudentDashboard';
import { StudentAttendanceView } from './components/StudentAttendanceView';
import { StudentProfile } from './components/StudentProfile';
import { exportAttendanceToCsv, getAttendanceRecords } from './lib/attendanceService';
import { loadFaceModels } from './lib/faceNet';

const SESSION_KEY = 'ai_student_attendance_session';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authRole, setAuthRole] = useState<'teacher' | 'student'>('teacher');
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [attendanceSubjectId, setAttendanceSubjectId] = useState<number | undefined>(undefined);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize face recognition models in background on first load
  useEffect(() => {
    loadFaceModels().catch((err) => {
      console.warn('Face models background preload notice:', err);
    });

    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        setCurrentUser(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const handleLoginSuccess = (session: UserSession) => {
    setCurrentUser(session);
    setActiveView('dashboard');
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('dashboard');
    localStorage.removeItem(SESSION_KEY);
  };

  const handleDownloadCsvDirect = async () => {
    if (!currentUser || currentUser.role !== 'teacher') return;
    const records = await getAttendanceRecords({ teacherId: currentUser.id });
    const today = new Date().toISOString().split('T')[0];
    exportAttendanceToCsv(records, `student_attendance_${today}.csv`);
  };

  const handleNavigateToAttendance = (subId?: number) => {
    setAttendanceSubjectId(subId);
    setActiveView('mark_attendance');
    setIsMobileMenuOpen(false);
  };

  // If no user is logged in, show Teacher or Student Auth portals
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
        {/* Header Branding */}
        <div className="text-center max-w-2xl mx-auto mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-3">
            <Award className="h-4 w-4 text-blue-600" />
            <span>AttendifyVision</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Student Attendance System With Face Recognition
          </h1>
          <p className="text-sm font-medium text-blue-700 mt-1">
            Face Recognition Based Student Attendance
          </p>
          <div className="mt-2 flex flex-wrap justify-center items-center gap-2 text-xs text-slate-500">
            <span>Developed By:</span>
            <span className="font-semibold text-slate-700">Gulshan Gaund</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">Manoj Prajapati</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">Ritesh Gupta</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="w-full flex-1 flex items-center justify-center">
          {authRole === 'teacher' ? (
            <TeacherAuth
              onLoginSuccess={handleLoginSuccess}
              onSwitchToStudent={() => setAuthRole('student')}
            />
          ) : (
            <StudentAuth
              onLoginSuccess={handleLoginSuccess}
              onSwitchToTeacher={() => setAuthRole('teacher')}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          AttendifyVision &bull; Face Recognition Based Student Attendance
        </div>
      </div>
    );
  }

  // LOGGED IN LAYOUT
  const isTeacher = currentUser.role === 'teacher';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                {isTeacher ? <Camera className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  Student Attendance System
                </h1>
                <p className="text-[11px] text-blue-600 font-medium">
                  Face Recognition Based Student Attendance
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Chip */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block text-xs">
                <span className="font-bold text-slate-900 block">{currentUser.name}</span>
                <span className="text-[11px] text-slate-500 font-medium capitalize">
                  {currentUser.role} • {currentUser.stream}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside
          className={`lg:w-64 shrink-0 ${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 shadow-xl flex flex-col justify-between'
              : 'hidden lg:block'
          }`}
        >
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-1 text-xs font-semibold">
            {isTeacher ? (
              <>
                <button
                  onClick={() => {
                    setActiveView('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('subjects');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'subjects'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>My Subjects</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('students');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'students'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Students</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('students');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Camera className="h-4 w-4 text-indigo-600" />
                  <span>Register Face</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('mark_attendance');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'mark_attendance'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Mark Attendance</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('attendance_records');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'attendance_records'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>Attendance</span>
                </button>

                <button
                  onClick={handleDownloadCsvDirect}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Download CSV</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setActiveView('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('my_subjects');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'my_subjects'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>My Subjects</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('my_attendance');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'my_attendance'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>My Attendance</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    activeView === 'profile'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <User className="h-4 w-4" />
                  <span>My Profile</span>
                </button>
              </>
            )}

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Project Details Sidebar Badge */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900">
            <span className="font-bold flex items-center gap-1 text-blue-950 mb-1">
              <Award className="h-3.5 w-3.5 text-blue-600" />
              Project Developers:
            </span>
            <p className="font-medium text-slate-700">1. Gulshan Gaund</p>
            <p className="font-medium text-slate-700">2. Manoj Prajapati</p>
            <p className="font-medium text-slate-700">3. Ritesh Gupta</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* TEACHER VIEWS */}
          {isTeacher && (
            <>
              {activeView === 'dashboard' && (
                <TeacherDashboard
                  user={currentUser}
                  onNavigate={(view, subId) => {
                    if (view === 'mark_attendance') {
                      handleNavigateToAttendance(subId);
                    } else {
                      setActiveView(view);
                    }
                  }}
                />
              )}

              {activeView === 'subjects' && (
                <SubjectManagement
                  user={currentUser}
                  onTakeAttendance={handleNavigateToAttendance}
                />
              )}

              {activeView === 'students' && <StudentManagement />}

              {activeView === 'mark_attendance' && (
                <MarkAttendance
                  user={currentUser}
                  initialSubjectId={attendanceSubjectId}
                  onNavigateToAttendanceView={() => setActiveView('attendance_records')}
                />
              )}

              {activeView === 'attendance_records' && (
                <TeacherAttendanceView user={currentUser} />
              )}
            </>
          )}

          {/* STUDENT VIEWS */}
          {!isTeacher && (
            <>
              {activeView === 'dashboard' && (
                <StudentDashboard
                  user={currentUser}
                  onNavigate={(v) => setActiveView(v)}
                />
              )}

              {(activeView === 'my_subjects' || activeView === 'my_attendance') && (
                <StudentAttendanceView user={currentUser} />
              )}

              {activeView === 'profile' && (
                <StudentProfile
                  user={currentUser}
                  onUpdateSessionEmail={(newEmail) => {
                    setCurrentUser({ ...currentUser, email: newEmail });
                    localStorage.setItem(
                      SESSION_KEY,
                      JSON.stringify({ ...currentUser, email: newEmail })
                    );
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
