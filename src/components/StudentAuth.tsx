import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, GraduationCap, AlertCircle, CheckCircle2, Lock, Mail, Phone, BookOpen, User } from 'lucide-react';
import { loginStudent, hashPassword, validateEmail, validateIndianPhone, validatePassword, UserSession } from '../lib/auth';
import { getDb, persistDb, SubjectRecord } from '../lib/db';

interface Props {
  onLoginSuccess: (session: UserSession) => void;
  onSwitchToTeacher: () => void;
}

export const StudentAuth: React.FC<Props> = ({ onLoginSuccess, onSwitchToTeacher }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('STU101');
  const [loginPassword, setLoginPassword] = useState('Password123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register Form
  const [studentId, setStudentId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stream, setStream] = useState('BSc IT');
  const [year, setYear] = useState('TY');
  const [semester, setSemester] = useState('5');
  const [division, setDivision] = useState('A');
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);

  // Available subjects loaded from database
  const [availableSubjects, setAvailableSubjects] = useState<SubjectRecord[]>([]);

  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, [stream]);

  const loadSubjects = async () => {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM subjects ORDER BY subject_name ASC`);
    const list: SubjectRecord[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject() as unknown as SubjectRecord);
    }
    stmt.free();
    setAvailableSubjects(list);

    // Auto-select subjects matching current stream
    const matching = list.filter((s) => s.stream.toLowerCase() === stream.toLowerCase());
    if (matching.length > 0) {
      setSelectedSubjects(matching.map((m) => m.id));
    } else if (list.length > 0) {
      setSelectedSubjects([list[0].id]);
    }
  };

  const handleToggleSubject = (subId: number) => {
    if (selectedSubjects.includes(subId)) {
      setSelectedSubjects(selectedSubjects.filter((id) => id !== subId));
    } else {
      setSelectedSubjects([...selectedSubjects, subId]);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginIdentifier.trim()) {
      setLoginError('This field is required.');
      return;
    }
    if (!loginPassword) {
      setLoginError('This field is required.');
      return;
    }

    setIsLoggingIn(true);
    const result = await loginStudent(loginIdentifier, loginPassword);
    setIsLoggingIn(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setLoginError(result.message || 'Invalid Student ID or password.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (!studentId.trim()) {
      setRegError('This field is required.');
      return;
    }
    if (!rollNumber.trim()) {
      setRegError('This field is required.');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setRegError('Full Name must be at least 2 characters.');
      return;
    }
    if (!validateEmail(email)) {
      setRegError('Please enter a valid email address.');
      return;
    }
    if (!validateIndianPhone(phone)) {
      setRegError('Phone number must contain exactly 10 digits.');
      return;
    }

    const pwdCheck = validatePassword(regPassword);
    if (!pwdCheck.valid) {
      setRegError(pwdCheck.message || 'Password must be at least 8 characters with uppercase, lowercase, and number.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    if (!stream.trim()) {
      setRegError('Stream is required.');
      return;
    }
    if (!year.trim()) {
      setRegError('Year is required.');
      return;
    }
    if (!semester.trim()) {
      setRegError('Semester is required.');
      return;
    }
    if (!division.trim()) {
      setRegError('Division is required.');
      return;
    }

    if (selectedSubjects.length === 0) {
      setRegError('At least one valid subject must be selected.');
      return;
    }

    setIsRegistering(true);
    try {
      const db = await getDb();

      // Check unique student ID
      const idStmt = db.prepare(`SELECT id FROM students WHERE student_id = ?`);
      idStmt.bind([studentId.trim().toUpperCase()]);
      if (idStmt.step()) {
        idStmt.free();
        setIsRegistering(false);
        setRegError('Student ID already exists.');
        return;
      }
      idStmt.free();

      // Check unique email
      const emailStmt = db.prepare(`SELECT id FROM students WHERE email = ?`);
      emailStmt.bind([email.trim()]);
      if (emailStmt.step()) {
        emailStmt.free();
        setIsRegistering(false);
        setRegError('Email already exists.');
        return;
      }
      emailStmt.free();

      // Check unique roll within stream & class
      const rollStmt = db.prepare(`SELECT id FROM students WHERE roll_number = ? AND stream = ? AND year = ? AND division = ?`);
      rollStmt.bind([rollNumber.trim(), stream.trim(), year.trim(), division.trim().toUpperCase()]);
      if (rollStmt.step()) {
        rollStmt.free();
        setIsRegistering(false);
        setRegError('Roll number already exists.');
        return;
      }
      rollStmt.free();

      const pwdHash = await hashPassword(regPassword);
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO students (student_id, roll_number, name, email, phone, password_hash, stream, year, semester, division, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId.trim().toUpperCase(),
          rollNumber.trim(),
          name.trim(),
          email.trim(),
          phone.trim(),
          pwdHash,
          stream.trim(),
          year.trim(),
          semester.trim(),
          division.trim().toUpperCase(),
          now,
        ]
      );

      // Get inserted student id
      const lastIdStmt = db.prepare(`SELECT last_insert_rowid() as id`);
      lastIdStmt.step();
      const newStuId = (lastIdStmt.getAsObject() as { id: number }).id;
      lastIdStmt.free();

      // Link selected subjects
      for (const subId of selectedSubjects) {
        db.run(`INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)`, [newStuId, subId]);
      }

      persistDb();

      setRegSuccess('Student registration successful! You can now log in.');
      setActiveTab('login');
      setLoginIdentifier(studentId.trim().toUpperCase());
      setLoginPassword('');
    } catch (err: unknown) {
      console.error('Registration error', err);
      setRegError('An error occurred during student registration.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-800 p-6 text-white text-center">
        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-2 border border-white/20">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-bold">Student Portal</h2>
        <p className="text-xs text-blue-100 mt-0.5">
          Face Recognition Based Student Attendance
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setActiveTab('login');
            setLoginError(null);
          }}
          className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
            activeTab === 'login'
              ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Student Login
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('register');
            setRegError(null);
          }}
          className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
            activeTab === 'register'
              ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Student Registration
        </button>
      </div>

      <div className="p-6">
        {/* LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Student ID or Email Address *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. STU101 or amit.patel@gmail.com"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Password with Eye Icon */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="Enter your student password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-[11px] text-indigo-900">
              <span className="font-semibold block">Demo Student Credentials:</span>
              <span>Student ID: <strong>STU101</strong> | Password: <strong>Password123</strong></span>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Logging In...' : 'Sign In as Student'}
            </button>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5 text-xs max-h-[60vh] overflow-y-auto pr-1">
            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student ID *</label>
                <input
                  type="text"
                  placeholder="e.g. STU106"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Roll Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 15"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Amit Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="student@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stream / Course *</label>
                <input
                  type="text"
                  placeholder="e.g. BSc IT, BCom"
                  value={stream}
                  onChange={(e) => setStream(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Division *</label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="A"
                  value={division}
                  onChange={(e) => setDivision(e.target.value.toUpperCase())}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Year *</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
                >
                  <option value="FY">FY</option>
                  <option value="SY">SY</option>
                  <option value="TY">TY</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Semester *</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>Sem {s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject Selection Checkboxes */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1.5">
                Select Enrolled Subjects * (At least 1 required)
              </label>
              {availableSubjects.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {availableSubjects.map((sub) => (
                    <label
                      key={sub.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(sub.id)}
                        onChange={() => handleToggleSubject(sub.id)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-slate-800 font-medium">{sub.subject_name}</span>
                      <span className="text-slate-400 text-[11px]">({sub.subject_code} - {sub.stream})</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">No subjects registered in system yet.</p>
              )}
            </div>

            {/* Password with Eye */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full p-2 pr-10 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password with Eye */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2 pr-10 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isRegistering ? 'Registering...' : 'Register as Student'}
            </button>
          </form>
        )}

        {/* Switch Role Option */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs">
          <span className="text-slate-500">Are you a Teacher / Faculty? </span>
          <button
            onClick={onSwitchToTeacher}
            className="text-indigo-600 font-bold hover:underline cursor-pointer"
          >
            Go to Teacher Portal
          </button>
        </div>
      </div>
    </div>
  );
};
