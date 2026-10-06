import { getDb, persistDb, SubjectRecord, StudentRecord, AttendanceRecord } from './db';
import { FACE_RECOGNITION_THRESHOLD, calculateEuclideanDistance, distanceToConfidence } from './faceNet';

export interface SubjectWithStats extends SubjectRecord {
  enrolled_count: number;
}

export interface StudentWithEmbeddingStatus extends StudentRecord {
  has_face_registered: boolean;
  sample_count?: number;
}

export interface AttendanceRowView {
  id: number;
  student_id_str: string;
  roll_number: string;
  student_name: string;
  stream: string;
  year: string;
  division: string;
  subject_name: string;
  subject_code: string;
  attendance_date: string;
  attendance_time: string;
  status: 'Present' | 'Absent';
  confidence: number;
}

export async function getTeacherSubjects(teacherId: number): Promise<SubjectWithStats[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = s.id) as enrolled_count
    FROM subjects s
    WHERE s.teacher_id = ?
    ORDER BY s.id DESC
  `);
  stmt.bind([teacherId]);

  const results: SubjectWithStats[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as SubjectWithStats);
  }
  stmt.free();
  return results;
}

export async function addTeacherSubject(
  teacherId: number,
  subjectName: string,
  subjectCode: string,
  stream: string,
  year: string,
  semester: string,
  division: string
): Promise<{ success: boolean; message?: string; subjectId?: number }> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Check duplicate subject code for this teacher
  const checkStmt = db.prepare(`SELECT id FROM subjects WHERE teacher_id = ? AND subject_code = ?`);
  checkStmt.bind([teacherId, subjectCode.trim()]);
  if (checkStmt.step()) {
    checkStmt.free();
    return { success: false, message: 'Subject code already exists in your subject list.' };
  }
  checkStmt.free();

  db.run(
    `INSERT INTO subjects (teacher_id, subject_name, subject_code, stream, year, semester, division, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      teacherId,
      subjectName.trim(),
      subjectCode.trim().toUpperCase(),
      stream.trim(),
      year.trim(),
      semester.trim(),
      division.trim().toUpperCase(),
      now,
    ]
  );
  persistDb();

  const idStmt = db.prepare(`SELECT last_insert_rowid() as id`);
  idStmt.step();
  const idObj = idStmt.getAsObject() as { id: number };
  idStmt.free();

  return { success: true, subjectId: idObj.id };
}

export async function getAllStudentsWithFaceStatus(
  streamFilter?: string,
  divisionFilter?: string
): Promise<StudentWithEmbeddingStatus[]> {
  const db = await getDb();
  let query = `
    SELECT s.*, 
      CASE WHEN fe.id IS NOT NULL THEN 1 ELSE 0 END as has_face_registered,
      fe.sample_count
    FROM students s
    LEFT JOIN face_embeddings fe ON s.id = fe.student_id
  `;
  const params: (string | number | null)[] = [];
  const clauses: string[] = [];

  if (streamFilter) {
    clauses.push(`s.stream = ?`);
    params.push(streamFilter);
  }
  if (divisionFilter) {
    clauses.push(`s.division = ?`);
    params.push(divisionFilter);
  }

  if (clauses.length > 0) {
    query += ` WHERE ` + clauses.join(' AND ');
  }

  query += ` ORDER BY s.stream, s.year, s.division, CAST(s.roll_number AS INTEGER), s.name ASC`;

  const stmt = db.prepare(query);
  stmt.bind(params);

  const list: StudentWithEmbeddingStatus[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as (StudentRecord & { has_face_registered: number; sample_count: number });
    list.push({
      ...row,
      has_face_registered: Boolean(row.has_face_registered),
    });
  }
  stmt.free();
  return list;
}

export async function getEnrolledStudentsForSubject(subjectId: number): Promise<StudentWithEmbeddingStatus[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT s.*, 
      CASE WHEN fe.id IS NOT NULL THEN 1 ELSE 0 END as has_face_registered,
      fe.sample_count
    FROM students s
    INNER JOIN student_subjects ss ON s.id = ss.student_id
    LEFT JOIN face_embeddings fe ON s.id = fe.student_id
    WHERE ss.subject_id = ?
    ORDER BY CAST(s.roll_number AS INTEGER), s.name ASC
  `);
  stmt.bind([subjectId]);

  const list: StudentWithEmbeddingStatus[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as (StudentRecord & { has_face_registered: number; sample_count: number });
    list.push({
      ...row,
      has_face_registered: Boolean(row.has_face_registered),
    });
  }
  stmt.free();
  return list;
}

export async function saveFaceEmbedding(studentId: number, embeddingVector: number[], sampleCount = 5): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const embeddingJson = JSON.stringify(embeddingVector);

  // Check if exists, update or insert
  const check = db.prepare(`SELECT id FROM face_embeddings WHERE student_id = ?`);
  check.bind([studentId]);
  const exists = check.step();
  check.free();

  if (exists) {
    db.run(
      `UPDATE face_embeddings SET embedding = ?, sample_count = ?, created_at = ? WHERE student_id = ?`,
      [embeddingJson, sampleCount, now, studentId]
    );
  } else {
    db.run(
      `INSERT INTO face_embeddings (student_id, embedding, sample_count, created_at)
       VALUES (?, ?, ?, ?)`,
      [studentId, embeddingJson, sampleCount, now]
    );
  }
  persistDb();
  return true;
}

export interface FaceRecognitionMatch {
  student: StudentRecord;
  confidence: number;
  distance: number;
  box: { x: number; y: number; width: number; height: number };
  isEnrolled: boolean;
}

export interface RecognitionResult {
  recognizedStudents: FaceRecognitionMatch[];
  unauthorizedMatches: FaceRecognitionMatch[]; // Found face of a student from another subject
  unknownFacesCount: number;
  totalFacesDetected: number;
}

/**
 * Compare classroom detected face descriptors with registered database embeddings
 */
export async function matchClassroomFaces(
  detectedFaces: { box: { x: number; y: number; width: number; height: number }; descriptor: number[] }[],
  subjectId: number
): Promise<RecognitionResult> {
  const db = await getDb();

  // Load subject info
  const subStmt = db.prepare(`SELECT * FROM subjects WHERE id = ?`);
  subStmt.bind([subjectId]);
  let targetSubject: SubjectRecord | null = null;
  if (subStmt.step()) {
    targetSubject = subStmt.getAsObject() as unknown as SubjectRecord;
  }
  subStmt.free();

  if (!targetSubject) {
    throw new Error('Selected subject does not exist');
  }

  // Get enrolled student IDs
  const enrolledStmt = db.prepare(`SELECT student_id FROM student_subjects WHERE subject_id = ?`);
  enrolledStmt.bind([subjectId]);
  const enrolledIds = new Set<number>();
  while (enrolledStmt.step()) {
    const r = enrolledStmt.getAsObject() as { student_id: number };
    enrolledIds.add(r.student_id);
  }
  enrolledStmt.free();

  // Get all registered student embeddings
  const embStmt = db.prepare(`
    SELECT fe.student_id, fe.embedding, s.*
    FROM face_embeddings fe
    INNER JOIN students s ON fe.student_id = s.id
  `);

  const registeredStudents: { student: StudentRecord; embedding: number[] }[] = [];
  while (embStmt.step()) {
    const row = embStmt.getAsObject() as unknown as (StudentRecord & { embedding: string });
    try {
      registeredStudents.push({
        student: row,
        embedding: JSON.parse(row.embedding),
      });
    } catch (e) {
      console.error('Failed parsing embedding for student', row.id, e);
    }
  }
  embStmt.free();

  const recognizedStudents: FaceRecognitionMatch[] = [];
  const unauthorizedMatches: FaceRecognitionMatch[] = [];
  let unknownFacesCount = 0;

  const matchedStudentIds = new Set<number>();

  for (const detected of detectedFaces) {
    let bestMatch: { student: StudentRecord; distance: number } | null = null;

    for (const reg of registeredStudents) {
      const dist = calculateEuclideanDistance(detected.descriptor, reg.embedding);
      if (dist < FACE_RECOGNITION_THRESHOLD) {
        if (!bestMatch || dist < bestMatch.distance) {
          bestMatch = { student: reg.student, distance: dist };
        }
      }
    }

    if (bestMatch && !matchedStudentIds.has(bestMatch.student.id)) {
      matchedStudentIds.add(bestMatch.student.id);
      const conf = distanceToConfidence(bestMatch.distance);
      const isEnrolled = enrolledIds.has(bestMatch.student.id) &&
        bestMatch.student.stream === targetSubject.stream &&
        bestMatch.student.division === targetSubject.division;

      const matchObj: FaceRecognitionMatch = {
        student: bestMatch.student,
        confidence: conf,
        distance: bestMatch.distance,
        box: detected.box,
        isEnrolled,
      };

      if (isEnrolled) {
        recognizedStudents.push(matchObj);
      } else {
        unauthorizedMatches.push(matchObj);
      }
    } else {
      unknownFacesCount++;
    }
  }

  return {
    recognizedStudents,
    unauthorizedMatches,
    unknownFacesCount,
    totalFacesDetected: detectedFaces.length,
  };
}

export async function confirmAttendanceSession(
  teacherId: number,
  subjectId: number,
  recognizedStudentIdsWithConf: { studentId: number; confidence: number }[],
  attendanceDate: string,
  attendanceTime: string
): Promise<{ success: boolean; message: string; presentCount: number; absentCount: number }> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Get subject info
  const subStmt = db.prepare(`SELECT * FROM subjects WHERE id = ?`);
  subStmt.bind([subjectId]);
  if (!subStmt.step()) {
    subStmt.free();
    return { success: false, message: 'Subject not found', presentCount: 0, absentCount: 0 };
  }
  const subject = subStmt.getAsObject() as unknown as SubjectRecord;
  subStmt.free();

  // Check if attendance already marked for ANY enrolled student today
  const enrolledStudents = await getEnrolledStudentsForSubject(subjectId);
  if (enrolledStudents.length === 0) {
    return { success: false, message: 'No students enrolled in this subject yet.', presentCount: 0, absentCount: 0 };
  }

  // Check duplicate attendance for today
  const dupCheck = db.prepare(`
    SELECT id FROM attendance 
    WHERE subject_id = ? AND attendance_date = ? 
    LIMIT 1
  `);
  dupCheck.bind([subjectId, attendanceDate]);
  if (dupCheck.step()) {
    dupCheck.free();
    return {
      success: false,
      message: `Attendance has already been recorded for subject "${subject.subject_name}" on ${attendanceDate}. Duplicate attendance is prevented.`,
      presentCount: 0,
      absentCount: 0,
    };
  }
  dupCheck.free();

  const recognizedMap = new Map<number, number>();
  for (const item of recognizedStudentIdsWithConf) {
    recognizedMap.set(item.studentId, item.confidence);
  }

  let presentCount = 0;
  let absentCount = 0;

  for (const student of enrolledStudents) {
    const isRecognized = recognizedMap.has(student.id);
    const status = isRecognized ? 'Present' : 'Absent';
    const confidence = isRecognized ? (recognizedMap.get(student.id) || 90) : 0;

    db.run(
      `INSERT INTO attendance (student_id, subject_id, teacher_id, attendance_date, attendance_time, status, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [student.id, subjectId, teacherId, attendanceDate, attendanceTime, status, confidence, now]
    );

    if (isRecognized) presentCount++;
    else absentCount++;
  }

  persistDb();

  return {
    success: true,
    message: `Attendance recorded successfully: ${presentCount} Present, ${absentCount} Absent.`,
    presentCount,
    absentCount,
  };
}

export async function getAttendanceRecords(filters: {
  teacherId?: number;
  stream?: string;
  subjectId?: number;
  year?: string;
  division?: string;
  date?: string;
  searchQuery?: string;
}): Promise<AttendanceRowView[]> {
  const db = await getDb();
  let query = `
    SELECT 
      a.id,
      s.student_id as student_id_str,
      s.roll_number,
      s.name as student_name,
      s.stream,
      s.year,
      s.division,
      sub.subject_name,
      sub.subject_code,
      a.attendance_date,
      a.attendance_time,
      a.status,
      a.confidence
    FROM attendance a
    INNER JOIN students s ON a.student_id = s.id
    INNER JOIN subjects sub ON a.subject_id = sub.id
  `;

  const clauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (filters.teacherId) {
    clauses.push(`a.teacher_id = ?`);
    params.push(filters.teacherId);
  }
  if (filters.stream) {
    clauses.push(`s.stream = ?`);
    params.push(filters.stream);
  }
  if (filters.subjectId) {
    clauses.push(`a.subject_id = ?`);
    params.push(filters.subjectId);
  }
  if (filters.year) {
    clauses.push(`s.year = ?`);
    params.push(filters.year);
  }
  if (filters.division) {
    clauses.push(`s.division = ?`);
    params.push(filters.division);
  }
  if (filters.date) {
    clauses.push(`a.attendance_date = ?`);
    params.push(filters.date);
  }
  if (filters.searchQuery) {
    clauses.push(`(s.name LIKE ? OR s.roll_number LIKE ? OR s.student_id LIKE ?)`);
    const q = `%${filters.searchQuery.trim()}%`;
    params.push(q, q, q);
  }

  if (clauses.length > 0) {
    query += ` WHERE ` + clauses.join(' AND ');
  }

  query += ` ORDER BY a.attendance_date DESC, a.attendance_time DESC, CAST(s.roll_number AS INTEGER) ASC`;

  const stmt = db.prepare(query);
  stmt.bind(params);

  const rows: AttendanceRowView[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as AttendanceRowView);
  }
  stmt.free();
  return rows;
}

export function exportAttendanceToCsv(records: AttendanceRowView[], filename = 'student_attendance_report.csv') {
  const headers = [
    'Student ID',
    'Roll Number',
    'Student Name',
    'Stream',
    'Year',
    'Division',
    'Subject',
    'Subject Code',
    'Date',
    'Time',
    'Status',
    'Confidence',
  ];

  const csvRows = [headers.join(',')];

  for (const r of records) {
    const row = [
      `"${r.student_id_str}"`,
      `"${r.roll_number}"`,
      `"${r.student_name.replace(/"/g, '""')}"`,
      `"${r.stream}"`,
      `"${r.year}"`,
      `"${r.division}"`,
      `"${r.subject_name.replace(/"/g, '""')}"`,
      `"${r.subject_code}"`,
      `"${r.attendance_date}"`,
      `"${r.attendance_time}"`,
      `"${r.status}"`,
      `"${r.confidence > 0 ? r.confidence + '%' : 'N/A'}"`,
    ];
    csvRows.push(row.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface StudentAttendanceSummary {
  overall: {
    totalClasses: number;
    presentClasses: number;
    absentClasses: number;
    percentage: number;
  };
  subjectWise: {
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    totalClasses: number;
    presentClasses: number;
    absentClasses: number;
    percentage: number;
  }[];
}

export async function getStudentAttendanceSummary(studentId: number): Promise<StudentAttendanceSummary> {
  const db = await getDb();

  // Get subjects the student is enrolled in
  const subStmt = db.prepare(`
    SELECT sub.* 
    FROM subjects sub
    INNER JOIN student_subjects ss ON sub.id = ss.subject_id
    WHERE ss.student_id = ?
    ORDER BY sub.subject_name ASC
  `);
  subStmt.bind([studentId]);

  const enrolledSubjects: SubjectRecord[] = [];
  while (subStmt.step()) {
    enrolledSubjects.push(subStmt.getAsObject() as unknown as SubjectRecord);
  }
  subStmt.free();

  let overallTotal = 0;
  let overallPresent = 0;

  const subjectWise = [];

  for (const sub of enrolledSubjects) {
    const attStmt = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE student_id = ? AND subject_id = ?
      GROUP BY status
    `);
    attStmt.bind([studentId, sub.id]);

    let present = 0;
    let absent = 0;

    while (attStmt.step()) {
      const row = attStmt.getAsObject() as { status: string; count: number };
      if (row.status === 'Present') present = row.count;
      else if (row.status === 'Absent') absent = row.count;
    }
    attStmt.free();

    const total = present + absent;
    const percentage = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;

    overallTotal += total;
    overallPresent += present;

    subjectWise.push({
      subjectId: sub.id,
      subjectName: sub.subject_name,
      subjectCode: sub.subject_code,
      totalClasses: total,
      presentClasses: present,
      absentClasses: absent,
      percentage,
    });
  }

  const overallAbsent = overallTotal - overallPresent;
  const overallPercentage = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100 * 10) / 10 : 0;

  return {
    overall: {
      totalClasses: overallTotal,
      presentClasses: overallPresent,
      absentClasses: overallAbsent,
      percentage: overallPercentage,
    },
    subjectWise,
  };
}

export async function getStudentAttendanceHistory(
  studentId: number,
  subjectIdFilter?: number
): Promise<AttendanceRowView[]> {
  const db = await getDb();
  let query = `
    SELECT 
      a.id,
      s.student_id as student_id_str,
      s.roll_number,
      s.name as student_name,
      s.stream,
      s.year,
      s.division,
      sub.subject_name,
      sub.subject_code,
      a.attendance_date,
      a.attendance_time,
      a.status,
      a.confidence
    FROM attendance a
    INNER JOIN students s ON a.student_id = s.id
    INNER JOIN subjects sub ON a.subject_id = sub.id
    WHERE a.student_id = ?
  `;
  const params: (string | number | null)[] = [studentId];

  if (subjectIdFilter) {
    query += ` AND a.subject_id = ?`;
    params.push(subjectIdFilter);
  }

  query += ` ORDER BY a.attendance_date DESC, a.attendance_time DESC`;

  const stmt = db.prepare(query);
  stmt.bind(params);

  const list: AttendanceRowView[] = [];
  while (stmt.step()) {
    list.push(stmt.getAsObject() as unknown as AttendanceRowView);
  }
  stmt.free();
  return list;
}

export async function updateStudentPersonalProfile(
  studentId: number,
  email: string,
  phone: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();

  // Check unique email
  const checkEmail = db.prepare(`SELECT id FROM students WHERE email = ? AND id != ?`);
  checkEmail.bind([email.trim(), studentId]);
  if (checkEmail.step()) {
    checkEmail.free();
    return { success: false, message: 'Email already in use by another student.' };
  }
  checkEmail.free();

  db.run(`UPDATE students SET email = ?, phone = ? WHERE id = ?`, [email.trim(), phone.trim(), studentId]);
  persistDb();

  return { success: true, message: 'Profile updated successfully.' };
}
