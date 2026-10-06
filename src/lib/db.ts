import initSqlJs, { Database } from 'sql.js';
import bcrypt from 'bcryptjs';

const DB_STORAGE_KEY = 'ai_student_attendance_db_v1';

let dbInstance: Database | null = null;

export interface TeacherRecord {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  username: string;
  password_hash: string;
  stream: string;
  created_at: string;
}

export interface StudentRecord {
  id: number;
  student_id: string;
  roll_number: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  stream: string;
  year: string;
  semester: string;
  division: string;
  created_at: string;
}

export interface SubjectRecord {
  id: number;
  teacher_id: number;
  subject_name: string;
  subject_code: string;
  stream: string;
  year: string;
  semester: string;
  division: string;
  created_at: string;
}

export interface StudentSubjectRecord {
  id: number;
  student_id: number;
  subject_id: number;
}

export interface FaceEmbeddingRecord {
  id: number;
  student_id: number;
  embedding: string; // JSON array of 128 numbers
  sample_count?: number;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  subject_id: number;
  teacher_id: number;
  attendance_date: string;
  attendance_time: string;
  status: 'Present' | 'Absent';
  confidence: number;
  created_at: string;
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  });

  const savedData = localStorage.getItem(DB_STORAGE_KEY);
  if (savedData) {
    try {
      const uInt8Array = new Uint8Array(JSON.parse(savedData));
      dbInstance = new SQL.Database(uInt8Array);
      return dbInstance;
    } catch (e) {
      console.warn('Failed to load existing SQLite state, creating fresh DB', e);
    }
  }

  dbInstance = new SQL.Database();
  initializeSchema(dbInstance);
  await seedInitialData(dbInstance);
  persistDb();

  return dbInstance;
}

export function persistDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const array = Array.from(data);
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(array));
  } catch (e) {
    console.error('Failed to persist SQLite DB', e);
  }
}

function initializeSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      stream TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL UNIQUE,
      roll_number TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      stream TEXT NOT NULL,
      year TEXT NOT NULL,
      semester TEXT NOT NULL,
      division TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      subject_name TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      stream TEXT NOT NULL,
      year TEXT NOT NULL,
      semester TEXT NOT NULL,
      division TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );

    CREATE TABLE IF NOT EXISTS student_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS face_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      embedding TEXT NOT NULL,
      sample_count INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      attendance_date TEXT NOT NULL,
      attendance_time TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      UNIQUE(student_id, subject_id, attendance_date)
    );
  `);
}

async function seedInitialData(db: Database) {
  const now = new Date().toISOString();
  const defaultPasswordHash = bcrypt.hashSync('Password123', 8);

  // 1. Seed Teacher: Prof. Rahul Sharma (BSc IT)
  db.run(
    `INSERT INTO teachers (full_name, email, phone, username, password_hash, stream, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Prof. Rahul Sharma', 'rahul@gmail.com', '9876543210', 'rahul_teacher', defaultPasswordHash, 'BSc IT', now]
  );

  // 2. Seed Subjects for Prof. Rahul Sharma
  db.run(
    `INSERT INTO subjects (teacher_id, subject_name, subject_code, stream, year, semester, division, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'Web Programming', 'WP101', 'BSc IT', 'TY', '5', 'A', now]
  );

  db.run(
    `INSERT INTO subjects (teacher_id, subject_name, subject_code, stream, year, semester, division, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'Database Management', 'DBMS202', 'BSc IT', 'TY', '5', 'A', now]
  );

  db.run(
    `INSERT INTO subjects (teacher_id, subject_name, subject_code, stream, year, semester, division, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'Computer Networks', 'CN303', 'BSc IT', 'TY', '5', 'A', now]
  );

  // 3. Seed Students
  const students = [
    {
      student_id: 'STU101',
      roll_number: '23',
      name: 'Amit Patel',
      email: 'amit.patel@gmail.com',
      phone: '9820123456',
      stream: 'BSc IT',
      year: 'TY',
      semester: '5',
      division: 'A',
    },
    {
      student_id: 'STU102',
      roll_number: '31',
      name: 'Priya Patel',
      email: 'priya.patel@gmail.com',
      phone: '9819876543',
      stream: 'BSc IT',
      year: 'TY',
      semester: '5',
      division: 'A',
    },
    {
      student_id: 'STU103',
      roll_number: '18',
      name: 'Amit Shah',
      email: 'amit.shah@gmail.com',
      phone: '9765432109',
      stream: 'BSc IT',
      year: 'TY',
      semester: '5',
      division: 'A',
    },
    {
      student_id: 'STU104',
      roll_number: '05',
      name: 'Sneha Verma',
      email: 'sneha.verma@gmail.com',
      phone: '9988776655',
      stream: 'BSc IT',
      year: 'TY',
      semester: '5',
      division: 'A',
    },
    {
      student_id: 'STU201',
      roll_number: '12',
      name: 'Rohan Mehra',
      email: 'rohan.mehra@gmail.com',
      phone: '9123456780',
      stream: 'BCom',
      year: 'SY',
      semester: '3',
      division: 'B',
    }
  ];

  for (const s of students) {
    db.run(
      `INSERT INTO students (student_id, roll_number, name, email, phone, password_hash, stream, year, semester, division, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.student_id, s.roll_number, s.name, s.email, s.phone, defaultPasswordHash, s.stream, s.year, s.semester, s.division, now]
    );
  }

  // 4. Enroll BSc IT students (ids 1, 2, 3, 4) in subjects (ids 1, 2, 3)
  for (let stuId = 1; stuId <= 4; stuId++) {
    for (let subId = 1; subId <= 3; subId++) {
      db.run(
        `INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)`,
        [stuId, subId]
      );
    }
  }

  // 5. Seed some past attendance history so attendance percentage is realistically populated
  // 5 previous days of classes
  const pastDates = [
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-22',
  ];

  for (const pDate of pastDates) {
    // Web Programming (subject 1)
    db.run(
      `INSERT INTO attendance (student_id, subject_id, teacher_id, attendance_date, attendance_time, status, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 1, pDate, '10:30 AM', 'Present', 94.5, now]
    );
    db.run(
      `INSERT INTO attendance (student_id, subject_id, teacher_id, attendance_date, attendance_time, status, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [2, 1, 1, pDate, '10:30 AM', 'Present', 92.1, now]
    );
    db.run(
      `INSERT INTO attendance (student_id, subject_id, teacher_id, attendance_date, attendance_time, status, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [3, 1, 1, pDate, '10:30 AM', pDate === '2026-09-17' ? 'Absent' : 'Present', 95.8, now]
    );
    db.run(
      `INSERT INTO attendance (student_id, subject_id, teacher_id, attendance_date, attendance_time, status, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [4, 1, 1, pDate, '10:30 AM', pDate === '2026-09-16' ? 'Absent' : 'Present', 91.0, now]
    );
  }
}

export function resetDatabase() {
  localStorage.removeItem(DB_STORAGE_KEY);
  dbInstance = null;
}
