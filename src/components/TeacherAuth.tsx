import React, { useState } from 'react';
import { Eye, EyeOff, UserCheck, AlertCircle, CheckCircle2, Lock, Mail, Phone, BookOpen, User } from 'lucide-react';
import { loginTeacher, hashPassword, validateEmail, validateIndianPhone, validatePassword, UserSession } from '../lib/auth';
import { getDb, persistDb } from '../lib/db';

interface Props {
  onLoginSuccess: (session: UserSession) => void;
  onSwitchToStudent: () => void;
}

export const TeacherAuth: React.FC<Props> = ({ onLoginSuccess, onSwitchToStudent }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('rahul_teacher');
  const [loginPassword, setLoginPassword] = useState('Password123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stream, setStream] = useState('BSc IT');

  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

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
    const result = await loginTeacher(loginIdentifier, loginPassword);
    setIsLoggingIn(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setLoginError(result.message || 'Invalid username or password.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    // Validations
    if (!fullName.trim() || fullName.trim().length < 2) {
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
    if (!username.trim()) {
      setRegError('Username is required.');
      return;
    }

    const pwdCheck = validatePassword(regPassword);
    if (!pwdCheck.valid) {
      setRegError(pwdCheck.message || 'Password does not meet requirements.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    if (!stream.trim()) {
      setRegError('Stream / Course is required.');
      return;
    }

    setIsRegistering(true);
    try {
      const db = await getDb();

      // Check unique email
      const emailStmt = db.prepare(`SELECT id FROM teachers WHERE email = ?`);
      emailStmt.bind([email.trim()]);
      if (emailStmt.step()) {
        emailStmt.free();
        setIsRegistering(false);
        setRegError('Email already exists.');
        return;
      }
      emailStmt.free();

      // Check unique username
      const userStmt = db.prepare(`SELECT id FROM teachers WHERE username = ?`);
      userStmt.bind([username.trim()]);
      if (userStmt.step()) {
        userStmt.free();
        setIsRegistering(false);
        setRegError('Username already exists.');
        return;
      }
      userStmt.free();

      const pwdHash = await hashPassword(regPassword);
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO teachers (full_name, email, phone, username, password_hash, stream, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fullName.trim(), email.trim(), phone.trim(), username.trim(), pwdHash, stream.trim(), now]
      );
      persistDb();

      setRegSuccess('Teacher registration successful! You can now log in.');
      setActiveTab('login');
      setLoginIdentifier(username.trim());
      setLoginPassword('');
    } catch (err: unknown) {
      console.error('Registration error', err);
      setRegError('An error occurred during teacher registration.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center">
        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-2 border border-white/20">
          <UserCheck className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-bold">Faculty / Teacher Portal</h2>
        <p className="text-xs text-blue-100 mt-0.5">
          Student Attendance System With Face Recognition
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
          Teacher Login
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
          Teacher Registration
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
                Username or Email Address *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. rahul_teacher or rahul@gmail.com"
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
                  placeholder="Enter your password"
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

            <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100 text-[11px] text-blue-900">
              <span className="font-semibold block">Demo Account Credentials:</span>
              <span>Username: <strong>rahul_teacher</strong> | Password: <strong>Password123</strong></span>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In as Teacher'}
            </button>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="Prof. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="rahul@gmail.com"
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
                <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  placeholder="rahul_teacher"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stream / Course *</label>
                <input
                  type="text"
                  placeholder="e.g. BSc IT, BCom, BCA"
                  value={stream}
                  onChange={(e) => setStream(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>
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
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isRegistering ? 'Registering...' : 'Register as Faculty'}
            </button>
          </form>
        )}

        {/* Switch Role Option */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs">
          <span className="text-slate-500">Are you a Student? </span>
          <button
            onClick={onSwitchToStudent}
            className="text-blue-600 font-bold hover:underline cursor-pointer"
          >
            Go to Student Portal
          </button>
        </div>
      </div>
    </div>
  );
};
