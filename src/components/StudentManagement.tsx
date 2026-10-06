import React, { useState, useEffect } from 'react';
import { Users, Search, Camera, CheckCircle2, AlertCircle, Plus, Filter } from 'lucide-react';
import { StudentWithEmbeddingStatus, getAllStudentsWithFaceStatus } from '../lib/attendanceService';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { getDb, persistDb } from '../lib/db';
import { hashPassword, validateIndianPhone, validateEmail, validatePassword } from '../lib/auth';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<StudentWithEmbeddingStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  const [selectedStudentForFace, setSelectedStudentForFace] = useState<StudentWithEmbeddingStatus | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);

  // New Student Form Fields
  const [studentId, setStudentId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('Student123');
  const [stream, setStream] = useState('BSc IT');
  const [year, setYear] = useState('TY');
  const [semester, setSemester] = useState('5');
  const [division, setDivision] = useState('A');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [streamFilter]);

  const loadStudents = async () => {
    const list = await getAllStudentsWithFaceStatus(streamFilter || undefined);
    setStudents(list);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!studentId.trim()) return setFormError('Student ID is required.');
    if (!rollNumber.trim()) return setFormError('Roll Number is required.');
    if (name.trim().length < 2) return setFormError('Full Name must be at least 2 characters.');
    if (!validateEmail(email)) return setFormError('Please enter a valid email address.');
    if (!validateIndianPhone(phone)) return setFormError('Phone number must contain exactly 10 digits.');
    
    const pwdVal = validatePassword(password);
    if (!pwdVal.valid) return setFormError(pwdVal.message || 'Invalid password.');

    setIsSubmitting(true);
    try {
      const db = await getDb();
      // Check unique student id
      const checkId = db.prepare(`SELECT id FROM students WHERE student_id = ?`);
      checkId.bind([studentId.trim()]);
      if (checkId.step()) {
        checkId.free();
        setIsSubmitting(false);
        return setFormError('Student ID already exists.');
      }
      checkId.free();

      // Check unique email
      const checkEmail = db.prepare(`SELECT id FROM students WHERE email = ?`);
      checkEmail.bind([email.trim()]);
      if (checkEmail.step()) {
        checkEmail.free();
        setIsSubmitting(false);
        return setFormError('Email already exists.');
      }
      checkEmail.free();

      // Check unique roll within stream & class
      const checkRoll = db.prepare(`SELECT id FROM students WHERE roll_number = ? AND stream = ? AND year = ? AND division = ?`);
      checkRoll.bind([rollNumber.trim(), stream.trim(), year.trim(), division.trim().toUpperCase()]);
      if (checkRoll.step()) {
        checkRoll.free();
        setIsSubmitting(false);
        return setFormError('Roll number already exists in this stream, year, and division.');
      }
      checkRoll.free();

      const pwdHash = await hashPassword(password);
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
      persistDb();

      setShowAddStudentModal(false);
      setStudentId('');
      setRollNumber('');
      setName('');
      setEmail('');
      setPhone('');
      loadStudents();
    } catch (err: unknown) {
      console.error('Error creating student', err);
      setFormError('Failed to register student.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Student Directory & Face Registration
          </h2>
          <p className="text-xs text-slate-500">
            View student profiles, manage enrollments, and register 128-dimensional facial biometric embeddings.
          </p>
        </div>
        <button
          onClick={() => setShowAddStudentModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, Student ID, or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-700"
          >
            <option value="">All Streams</option>
            <option value="BSc IT">BSc IT</option>
            <option value="BCom">BCom</option>
            <option value="BCA">BCA</option>
            <option value="BSc Computer Science">BSc Computer Science</option>
            <option value="BA">BA</option>
            <option value="BMS">BMS</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Registered Students ({filteredStudents.length})
          </h3>
        </div>

        {filteredStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Stream</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Face Status</th>
                  <th className="px-4 py-3 text-right">Biometric Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{stu.student_id}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{stu.roll_number}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-slate-900 block">{stu.name}</span>
                        <span className="text-slate-400 text-[11px]">{stu.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {stu.stream}
                      </span>
                    </td>
                    <td className="px-4 py-3">{stu.year} - Sem {stu.semester}</td>
                    <td className="px-4 py-3 font-bold">{stu.division}</td>
                    <td className="px-4 py-3">
                      {stu.has_face_registered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Registered ({stu.sample_count || 5} samples)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span>Not Registered</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedStudentForFace(stu)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>{stu.has_face_registered ? 'Re-Register Face' : 'Register Face'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm font-medium text-slate-500">No students found matching the criteria.</p>
          </div>
        )}
      </div>

      {/* Face Registration Modal */}
      {selectedStudentForFace && (
        <FaceRegistrationModal
          student={selectedStudentForFace}
          isOpen={Boolean(selectedStudentForFace)}
          onClose={() => setSelectedStudentForFace(null)}
          onSuccess={() => {
            loadStudents();
            setSelectedStudentForFace(null);
          }}
        />
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Add New Student</h3>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Student ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. STU105"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-300 p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Roll Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. 42"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2"
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
                    className="w-full rounded-lg border border-slate-300 p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone (10 Digits) *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stream / Course *</label>
                  <input
                    type="text"
                    placeholder="e.g. BSc IT, BCom, BCA"
                    value={stream}
                    onChange={(e) => setStream(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2"
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
                    className="w-full rounded-lg border border-slate-300 p-2"
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
                    className="w-full rounded-lg border border-slate-300 p-2 bg-white"
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
                    className="w-full rounded-lg border border-slate-300 p-2 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>Sem {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
