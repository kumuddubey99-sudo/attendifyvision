import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, BookOpen, ShieldAlert, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { UserSession, validateEmail, validateIndianPhone } from '../lib/auth';
import { getStudentAttendanceSummary, StudentAttendanceSummary, updateStudentPersonalProfile } from '../lib/attendanceService';
import { getDb } from '../lib/db';

interface Props {
  user: UserSession;
  onUpdateSessionEmail: (newEmail: string) => void;
}

export const StudentProfile: React.FC<Props> = ({ user, onUpdateSessionEmail }) => {
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState('');
  const [hasFace, setHasFace] = useState(false);
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadStudentDetails();
  }, [user.id]);

  const loadStudentDetails = async () => {
    const db = await getDb();
    const stmt = db.prepare(`SELECT phone FROM students WHERE id = ?`);
    stmt.bind([user.id]);
    if (stmt.step()) {
      const obj = stmt.getAsObject() as { phone: string };
      setPhone(obj.phone);
    }
    stmt.free();

    // Check face status
    const faceStmt = db.prepare(`SELECT id FROM face_embeddings WHERE student_id = ?`);
    faceStmt.bind([user.id]);
    setHasFace(faceStmt.step());
    faceStmt.free();

    // Enrolled subjects summary
    const sum = await getStudentAttendanceSummary(user.id);
    setSummary(sum);
  };

  const handleSaveContactInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!validateIndianPhone(phone)) {
      setErrorMsg('Phone number must contain exactly 10 digits and start with 6, 7, 8, or 9.');
      return;
    }

    setIsSaving(true);
    const res = await updateStudentPersonalProfile(user.id, email, phone);
    setIsSaving(false);

    if (res.success) {
      setSuccessMsg(res.message);
      onUpdateSessionEmail(email);
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Student Profile
          </h2>
          <p className="text-xs text-slate-500">
            View academic enrollment information and update personal contact details.
          </p>
        </div>

        <div className="text-right">
          {hasFace ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Face Biometrics Registered</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Face Not Registered</span>
            </span>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Academic Information (Read-Only) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Academic Information (Locked & Verified)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Student Name</span>
            <span className="font-bold text-slate-900 text-sm">{user.name}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Student ID</span>
            <span className="font-mono font-bold text-blue-700 text-sm">{user.student_id}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Roll Number</span>
            <span className="font-bold text-slate-900 text-sm">{user.roll_number}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Stream / Course</span>
            <span className="font-bold text-slate-900 text-sm">{user.stream}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Class Year & Semester</span>
            <span className="font-bold text-slate-900 text-sm">{user.year} - Sem {user.semester}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Division</span>
            <span className="font-bold text-slate-900 text-sm">Division {user.division}</span>
          </div>
        </div>
      </div>

      {/* Editable Contact Information */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Personal Contact Information</h3>
            <p className="text-xs text-slate-500">Only verified email and phone number can be edited by the student.</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Edit Contact Details
            </button>
          )}
        </div>

        <form onSubmit={handleSaveContactInfo} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span>Email Address *</span>
              </label>
              <input
                type="email"
                disabled={!isEditing}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-800 disabled:bg-slate-100 disabled:text-slate-600"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-blue-600" />
                <span>Indian Mobile Number (10 Digits) *</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                disabled={!isEditing}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-800 disabled:bg-slate-100 disabled:text-slate-600 font-mono"
                required
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEmail(user.email);
                  loadStudentDetails();
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Enrolled Subjects List */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span>Enrolled Subjects ({summary?.subjectWise.length || 0})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {summary?.subjectWise.map((s) => (
            <div key={s.subjectId} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
              <span className="font-bold text-slate-900 block">{s.subjectName}</span>
              <span className="text-slate-500 font-mono text-[11px] block mt-0.5">{s.subjectCode}</span>
              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-slate-500">{s.totalClasses} classes</span>
                <span className="text-blue-700">{s.percentage}% Attendance</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions notice */}
      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2.5">
        <ShieldAlert className="h-4 w-4 text-slate-500 shrink-0" />
        <span>Student ID, Roll Number, Stream, and Face Biometrics are verified identifiers and cannot be altered by students.</span>
      </div>
    </div>
  );
};
