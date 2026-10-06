import React, { useState, useEffect } from 'react';
import { ClipboardList, Download, Filter, Search, Calendar } from 'lucide-react';
import { UserSession } from '../lib/auth';
import { AttendanceRowView, getAttendanceRecords, exportAttendanceToCsv, getTeacherSubjects, SubjectWithStats } from '../lib/attendanceService';

interface Props {
  user: UserSession;
}

export const TeacherAttendanceView: React.FC<Props> = ({ user }) => {
  const [records, setRecords] = useState<AttendanceRowView[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [streamFilter, setStreamFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSubjects();
  }, [user.id]);

  useEffect(() => {
    loadAttendance();
  }, [user.id, streamFilter, subjectFilter, yearFilter, divisionFilter, dateFilter, searchQuery]);

  const loadSubjects = async () => {
    const list = await getTeacherSubjects(user.id);
    setSubjects(list);
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const data = await getAttendanceRecords({
        teacherId: user.id,
        stream: streamFilter || undefined,
        subjectId: subjectFilter ? Number(subjectFilter) : undefined,
        year: yearFilter || undefined,
        division: divisionFilter || undefined,
        date: dateFilter || undefined,
        searchQuery: searchQuery || undefined,
      });
      setRecords(data);
    } catch (err) {
      console.error('Failed to load attendance records', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    const filename = `attendance_export_${dateFilter || 'all'}_${new Date().getTime()}.csv`;
    exportAttendanceToCsv(records, filename);
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
            Teacher Attendance Records
          </h2>
          <p className="text-xs text-slate-500">
            Filter, inspect, and export verified facial biometric attendance logs across all enrolled subjects.
          </p>
        </div>

        {/* Download CSV Button */}
        <button
          onClick={handleDownloadCsv}
          disabled={records.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Download className="h-4 w-4" />
          <span>Download CSV Report ({records.length})</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
          <Filter className="h-3.5 w-3.5 text-blue-600" />
          <span>Filter Records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 bg-white text-slate-800"
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_name} ({sub.subject_code})
                </option>
              ))}
            </select>
          </div>

          {/* Stream Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stream / Course</label>
            <select
              value={streamFilter}
              onChange={(e) => setStreamFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 bg-white text-slate-800"
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

          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 bg-white text-slate-800"
            >
              <option value="">All Years</option>
              <option value="FY">FY</option>
              <option value="SY">SY</option>
              <option value="TY">TY</option>
            </select>
          </div>

          {/* Division Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Division</label>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 bg-white text-slate-800"
            >
              <option value="">All Divisions</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Attendance Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-1.5 text-slate-800 bg-white"
            />
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Student</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Name or Roll No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 rounded-md border border-slate-300 text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Active Filter summary & clear */}
        {(streamFilter || subjectFilter || yearFilter || divisionFilter || dateFilter || searchQuery) && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>Filters active: Showing {records.length} records</span>
            <button
              onClick={() => {
                setStreamFilter('');
                setSubjectFilter('');
                setYearFilter('');
                setDivisionFilter('');
                setDateFilter('');
                setSearchQuery('');
              }}
              className="text-blue-600 hover:underline cursor-pointer font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 shadow-2xs">
          Total Records: {records.length}
        </span>
        <span className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold text-emerald-800 shadow-2xs">
          Present: {presentCount}
        </span>
        <span className="bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 font-semibold text-rose-800 shadow-2xs">
          Absent: {absentCount}
        </span>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Stream</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-slate-900 block">{r.student_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{r.student_id_str}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{r.roll_number}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {r.stream} ({r.year}-{r.division})
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.subject_name} <span className="text-slate-400 font-mono text-[11px]">({r.subject_code})</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{r.attendance_date}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{r.attendance_time}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {r.status}
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
            <p className="text-sm font-medium text-slate-500">No attendance records found.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the filter options or take attendance for a class.</p>
          </div>
        )}
      </div>
    </div>
  );
};
