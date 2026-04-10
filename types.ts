// This file defines the shape of data as it's expected on the FRONTEND
// after being processed/joined by the backend.

export enum UserRole {
  Student = 'student',
  Tutor = 'tutor',
  Admin = 'admin',
}

export interface University {
  domain: any;
  university_id: number;
  name: string;
  acronym?: string;
  email_domain: string;
  status: 'active' | 'inactive';
}

export interface Course {
  course_id: number;
  course_name: string;
  acronym?: string;
  university_id: number;
  university?: University; // Joined data
}

export interface Subject {
  subject_id: number;
  subject_name: string;
  course_id: number;
}

export interface User {
  user_id: number;
  id: string;  // For API compatibility
  email: string;
  name: string;
  user_type?: 'tutor' | 'tutee' | 'admin';
  role?: UserRole;
  status?: 'active' | 'inactive' | 'pending_verification';
  created_at: string;
  profile_image_url?: string | null;
  password?: string;
  is_verified?: boolean;
  university_id?: number;
  course_id?: number;
  year_level?: number;

  // Joined data from backend
  university?: University;
  course?: Course;
  tutor_profile?: Tutor;
}

export interface Document {
  document_id: number;
  file_url: string;
  file_name: string;
  file_type: string;
}

export interface Tutor {
  tutor_id: number;
  user_id: number;
  bio: string;
  status: 'pending' | 'approved' | 'rejected';

  // Joined data from backend
  user?: User;
  documents: Document[];
}

export interface TutorSubject {
  tutor_subject_id: number;
  tutor_id: number;
  subject_id: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at: string;

  // Joined data from backend
  tutor?: Tutor;
  subject?: Subject;
}

export interface Payment {
  payment_id: number;
  student_id: number;
  tutor_id: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'refunded' | 'paid';
  created_at: string;
  dispute_status?: 'none' | 'open' | 'under_review' | 'resolved' | 'rejected';
  payment_proof_url?: string;
  dispute_proof_url?: string;
  admin_note?: string;
  admin_payment_proof_url?: string;
  rejection_reason?: string;
  booking_id?: number;

  // Joined data from backend
  student?: { user?: { name: string } };
  tutor?: { user?: { name: string } };
}

export enum Page {
  Landing = 'LANDING',
  TuteeRegister = 'TUTEE_REGISTER',
  TutorRegister = 'TUTOR_REGISTER',
}

// export type University = {
//   name: string;
//   domain: string;
// };
