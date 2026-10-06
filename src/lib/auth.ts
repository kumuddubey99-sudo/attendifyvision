import bcrypt from 'bcryptjs';
import { getDb, persistDb, TeacherRecord, StudentRecord } from './db';

export interface UserSession {
  role: 'teacher' | 'student';
  id: number;
  name: string;
  email: string;
  stream: string;
  username?: string;
  student_id?: string;
  roll_number?: string;
  year?: string;
  semester?: string;
  division?: string;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateIndianPhone(phone: string): boolean {
  // Exactly 10 digits, starts with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(phone.trim());
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 8);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function loginTeacher(identifier: string, password: string): Promise<{ success: boolean; message?: string; user?: UserSession }> {
  const db = await getDb();
  const trimmed = identifier.trim();

  const stmt = db.prepare(`SELECT * FROM teachers WHERE username = ? OR email = ? LIMIT 1`);
  stmt.bind([trimmed, trimmed]);

  if (!stmt.step()) {
    stmt.free();
    return { success: false, message: 'Invalid username or password.' };
  }

  const row = stmt.getAsObject() as unknown as TeacherRecord;
  stmt.free();

  const isMatch = await verifyPassword(password, row.password_hash);
  if (!isMatch) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const session: UserSession = {
    role: 'teacher',
    id: row.id,
    name: row.full_name,
    email: row.email,
    stream: row.stream,
    username: row.username,
  };

  return { success: true, user: session };
}

export async function loginStudent(identifier: string, password: string): Promise<{ success: boolean; message?: string; user?: UserSession }> {
  const db = await getDb();
  const trimmed = identifier.trim();

  const stmt = db.prepare(`SELECT * FROM students WHERE student_id = ? OR email = ? LIMIT 1`);
  stmt.bind([trimmed, trimmed]);

  if (!stmt.step()) {
    stmt.free();
    return { success: false, message: 'Invalid Student ID or password.' };
  }

  const row = stmt.getAsObject() as unknown as StudentRecord;
  stmt.free();

  const isMatch = await verifyPassword(password, row.password_hash);
  if (!isMatch) {
    return { success: false, message: 'Invalid Student ID or password.' };
  }

  const session: UserSession = {
    role: 'student',
    id: row.id,
    name: row.name,
    email: row.email,
    stream: row.stream,
    student_id: row.student_id,
    roll_number: row.roll_number,
    year: row.year,
    semester: row.semester,
    division: row.division,
  };

  return { success: true, user: session };
}
