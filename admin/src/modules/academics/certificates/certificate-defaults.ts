import type { CertificateElement, CertificateTemplate } from '@/api/certificates'

export interface TokenDefinition {
  token: string
  label: string
  category: 'student' | 'guardian' | 'academic' | 'issuance' | 'school' | 'security'
  sampleValue: string
}

export const AVAILABLE_TOKENS: TokenDefinition[] = [
  // Student
  { token: 'student_name', label: 'Student Full Name', category: 'student', sampleValue: 'Alexander Vance' },
  { token: 'first_name', label: 'Student First Name', category: 'student', sampleValue: 'Alexander' },
  { token: 'last_name', label: 'Student Last Name', category: 'student', sampleValue: 'Vance' },
  { token: 'admission_no', label: 'Admission Number', category: 'student', sampleValue: 'ADM-2026-0042' },
  { token: 'student_no', label: 'Student ID', category: 'student', sampleValue: 'STU-2026-0042' },
  { token: 'dob', label: 'Date of Birth', category: 'student', sampleValue: '15/08/2012' },
  { token: 'gender', label: 'Gender', category: 'student', sampleValue: 'Male' },

  // Guardian
  { token: 'father_name', label: "Father's Name", category: 'guardian', sampleValue: 'Arthur Vance' },
  { token: 'mother_name', label: "Mother's Name", category: 'guardian', sampleValue: 'Eleanor Vance' },
  { token: 'guardian_name', label: 'Primary Guardian Name', category: 'guardian', sampleValue: 'Arthur Vance' },

  // Academic
  { token: 'class_name', label: 'Class / Grade Level', category: 'academic', sampleValue: 'Grade 10' },
  { token: 'section_name', label: 'Section / Group', category: 'academic', sampleValue: 'Section A' },
  { token: 'roll_no', label: 'Roll Number', category: 'academic', sampleValue: '14' },
  { token: 'session_name', label: 'Academic Session', category: 'academic', sampleValue: '2026–2027' },

  // Issuance
  { token: 'certificate_no', label: 'Certificate Serial No.', category: 'issuance', sampleValue: 'TC-2026-0042' },
  { token: 'issue_date', label: 'Date of Issue', category: 'issuance', sampleValue: '15/05/2026' },
  { token: 'reason', label: 'Reason for Leaving', category: 'issuance', sampleValue: 'Parent transfer to another city' },
  { token: 'conduct', label: 'General Conduct', category: 'issuance', sampleValue: 'Exemplary' },
  { token: 'dues_status', label: 'School Dues Status', category: 'issuance', sampleValue: 'All dues cleared' },

  // School
  { token: 'school_name', label: 'School Name', category: 'school', sampleValue: 'Green Valley International Academy' },
  { token: 'school_code', label: 'School Affiliation Code', category: 'school', sampleValue: 'CBSE-987654' },
  { token: 'principal_signature', label: 'Principal Signature Title', category: 'school', sampleValue: 'Principal & Head of School' },

   // Security
   { token: 'verification_qr', label: 'QR Verification Code', category: 'security', sampleValue: '[QR Code]' },
  { token: 'serial_barcode', label: 'Certificate Barcode', category: 'security', sampleValue: '[Barcode]' },
 ]

export const DEFAULT_PORTRAIT_ELEMENTS: CertificateElement[] = [
  // Header
  { id: 'school_name', type: 'token', token: 'school_name', label: 'School Name', x: 50, y: 8.5, fontSize: 24, fontWeight: 'bold', fontFamily: 'serif', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'school_tagline', type: 'static', text: 'Affiliated to State Board • Recognized by Directorate of Education', label: 'School Tagline', x: 50, y: 13, fontSize: 11, fontWeight: 'normal', fontFamily: 'sans', color: '#64748b', textAlign: 'center', isVisible: true },
  { id: 'cert_title', type: 'static', text: 'TRANSFER CERTIFICATE', label: 'Certificate Title', x: 50, y: 18, fontSize: 18, fontWeight: 'bold', fontFamily: 'sans', color: '#1e3a8a', textAlign: 'center', isVisible: true },

  // Metadata Bar (TC No & Date)
  { id: 'lbl_cert_no', type: 'static', text: 'TC No:', label: 'TC No. Label', x: 12, y: 23, fontSize: 12, fontWeight: 'normal', fontFamily: 'mono', color: '#64748b', textAlign: 'left', isVisible: true, groupId: 'row_cert_no' },
  { id: 'val_cert_no', type: 'token', token: 'certificate_no', label: 'Certificate No.', x: 22, y: 23, fontSize: 12, fontWeight: 'bold', fontFamily: 'mono', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_cert_no' },

  { id: 'lbl_date', type: 'static', text: 'Date of Issue:', label: 'Date Label', x: 62, y: 23, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#64748b', textAlign: 'left', isVisible: true, groupId: 'row_date' },
  { id: 'val_date', type: 'token', token: 'issue_date', label: 'Date of Issue', x: 77, y: 23, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_date' },

  // Column 1: Labels (X = 12%, spaced from Y: 28% to 74%)
  { id: 'lbl_1', type: 'static', text: '1. Name of Pupil:', label: 'Label: Pupil Name', x: 12, y: 28.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_1' },
  { id: 'lbl_2', type: 'static', text: '2. Admission / Student ID:', label: 'Label: Admission No.', x: 12, y: 33.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_2' },
  { id: 'lbl_3', type: 'static', text: "3. Father's / Guardian's Name:", label: 'Label: Father Name', x: 12, y: 38.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_3' },
  { id: 'lbl_4', type: 'static', text: "4. Mother's Name:", label: 'Label: Mother Name', x: 12, y: 43.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_4' },
  { id: 'lbl_5', type: 'static', text: '5. Date of Birth:', label: 'Label: Date of Birth', x: 12, y: 48.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_5' },
  { id: 'lbl_6', type: 'static', text: '6. Class in which pupil last studied:', label: 'Label: Class Studied', x: 12, y: 53.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_6' },
  { id: 'lbl_7', type: 'static', text: '7. Roll Number:', label: 'Label: Roll Number', x: 12, y: 58.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_7' },
  { id: 'lbl_8', type: 'static', text: '8. Month up to which school dues paid:', label: 'Label: Dues Paid', x: 12, y: 63.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_8' },
  { id: 'lbl_9', type: 'static', text: '9. General Conduct:', label: 'Label: Conduct', x: 12, y: 68.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_9' },
  { id: 'lbl_10', type: 'static', text: '10. Reason for leaving the school:', label: 'Label: Reason for Leaving', x: 12, y: 73.5, fontSize: 12.5, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_10' },

  // Column 2: Dynamic Values (X = 54%)
  { id: 'val_student_name', type: 'token', token: 'student_name', label: 'Student Name', x: 54, y: 28.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_1' },
  { id: 'val_admission_no', type: 'token', token: 'admission_no', label: 'Admission No.', x: 54, y: 33.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_2' },
  { id: 'val_father_name', type: 'token', token: 'father_name', label: "Father's Name", x: 54, y: 38.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_3' },
  { id: 'val_mother_name', type: 'token', token: 'mother_name', label: "Mother's Name", x: 54, y: 43.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_4' },
  { id: 'val_dob', type: 'token', token: 'dob', label: 'Date of Birth', x: 54, y: 48.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_5' },
  { id: 'val_class_name', type: 'token', token: 'class_name', label: 'Class Last Studied', x: 54, y: 53.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_6' },
  { id: 'val_roll_no', type: 'token', token: 'roll_no', label: 'Roll Number', x: 54, y: 58.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_7' },
  { id: 'val_dues_status', type: 'token', token: 'dues_status', label: 'School Dues Status', x: 54, y: 63.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_8' },
  { id: 'val_conduct', type: 'token', token: 'conduct', label: 'General Conduct', x: 54, y: 68.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_9' },
  { id: 'val_reason', type: 'token', token: 'reason', label: 'Reason for Leaving', x: 54, y: 73.5, fontSize: 12.5, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_10' },
  // Footer Anchors & Signatures
  { id: 'teacher_line', type: 'line', label: 'Teacher Signature Line', x: 20, y: 84, lineWidth: 130, lineHeight: 1, color: '#cbd5e1', lineStyle: 'solid', isVisible: true },
  { id: 'teacher_sign', type: 'static', text: 'Class Teacher', label: 'Teacher Sign', x: 20, y: 88.5, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#475569', textAlign: 'center', isVisible: true },

  { id: 'principal_line', type: 'line', label: 'Principal Signature Line', x: 80, y: 84, lineWidth: 130, lineHeight: 1, color: '#cbd5e1', lineStyle: 'solid', isVisible: true },
  { id: 'principal_sign', type: 'token', token: 'principal_signature', label: 'Principal Sign', x: 80, y: 88.5, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#475569', textAlign: 'center', isVisible: true },

  { id: 'verification_qr', type: 'token', token: 'verification_qr', label: 'QR Verification', x: 50, y: 85, imageWidth: 48, color: '#0f172a', isVisible: true },
]

export const DEFAULT_LANDSCAPE_ELEMENTS: CertificateElement[] = [
  { id: 'school_name', type: 'token', token: 'school_name', label: 'School Name', x: 50, y: 12, fontSize: 26, fontWeight: 'bold', fontFamily: 'serif', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'cert_title', type: 'static', text: 'CERTIFICATE OF MERIT & EXCELLENCE', label: 'Certificate Title', x: 50, y: 21, fontSize: 20, fontWeight: 'bold', fontFamily: 'serif', color: '#92400e', textAlign: 'center', isVisible: true },
  { id: 'intro_text', type: 'static', text: 'This certificate is proudly presented to', label: 'Intro Text', x: 50, y: 32, fontSize: 15, fontWeight: 'normal', fontFamily: 'serif', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'student_name', type: 'token', token: 'student_name', label: 'Student Name', x: 50, y: 43, fontSize: 32, fontWeight: 'bold', fontFamily: 'script', color: '#1e3a8a', textAlign: 'center', isVisible: true },
  { id: 'desc_text', type: 'static', text: 'in recognition of outstanding academic performance and exemplary conduct in', label: 'Description', x: 50, y: 54, fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'class_name', type: 'token', token: 'class_name', label: 'Class / Grade', x: 50, y: 62, fontSize: 18, fontWeight: 'semibold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },

  { id: 'date_line', type: 'line', label: 'Date Signature Line', x: 20, y: 81, lineWidth: 130, lineHeight: 1, color: '#cbd5e1', lineStyle: 'solid', isVisible: true },
  { id: 'val_date', type: 'token', token: 'issue_date', label: 'Issue Date', x: 20, y: 78, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'lbl_date', type: 'static', text: 'Date of Award', label: 'Date Label', x: 20, y: 86, fontSize: 11.5, fontWeight: 'normal', fontFamily: 'sans', color: '#6b7280', textAlign: 'center', isVisible: true },

  { id: 'principal_line', type: 'line', label: 'Principal Signature Line', x: 80, y: 81, lineWidth: 130, lineHeight: 1, color: '#cbd5e1', lineStyle: 'solid', isVisible: true },
  { id: 'principal_sign', type: 'token', token: 'principal_signature', label: 'Principal Sign', x: 80, y: 78, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'lbl_sign', type: 'static', text: 'Principal & Head of School', label: 'Principal Label', x: 80, y: 86, fontSize: 11.5, fontWeight: 'normal', fontFamily: 'sans', color: '#6b7280', textAlign: 'center', isVisible: true },

  { id: 'verification_qr', type: 'token', token: 'verification_qr', label: 'QR Verification', x: 50, y: 82, imageWidth: 48, color: '#0f172a', isVisible: true },
]
export const MERIT_PORTRAIT_ELEMENTS: CertificateElement[] = [
  { id: 'school_name', type: 'token', token: 'school_name', label: 'School Name', x: 50, y: 12, fontSize: 24, fontWeight: 'bold', fontFamily: 'serif', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'cert_title', type: 'static', text: 'CERTIFICATE OF MERIT & EXCELLENCE', label: 'Certificate Title', x: 50, y: 20, fontSize: 18, fontWeight: 'bold', fontFamily: 'serif', color: '#92400e', textAlign: 'center', isVisible: true },
  { id: 'intro_text', type: 'static', text: 'This certificate is proudly presented to', label: 'Intro Text', x: 50, y: 30, fontSize: 14, fontWeight: 'normal', fontFamily: 'serif', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'student_name', type: 'token', token: 'student_name', label: 'Student Name', x: 50, y: 40, fontSize: 32, fontWeight: 'bold', fontFamily: 'script', color: '#1e3a8a', textAlign: 'center', isVisible: true },
  { id: 'desc_text', type: 'static', text: 'in recognition of outstanding academic performance and exemplary conduct in', label: 'Description', x: 50, y: 50, fontSize: 13, fontWeight: 'normal', fontFamily: 'sans', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'class_name', type: 'token', token: 'class_name', label: 'Class / Grade', x: 50, y: 56, fontSize: 16, fontWeight: 'semibold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'lbl_date', type: 'static', text: 'Date of Issue', label: 'Date Label', x: 25, y: 78, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#6b7280', textAlign: 'center', isVisible: true },
  { id: 'val_date', type: 'token', token: 'issue_date', label: 'Issue Date', x: 25, y: 83, fontSize: 13, fontWeight: 'bold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'principal_sign', type: 'token', token: 'principal_signature', label: 'Principal Sign', x: 75, y: 83, fontSize: 13, fontWeight: 'semibold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'verification_qr', type: 'token', token: 'verification_qr', label: 'QR Verification', x: 50, y: 82, imageWidth: 48, color: '#0f172a', isVisible: true },
]

export const CHARACTER_PORTRAIT_ELEMENTS: CertificateElement[] = [
  { id: 'school_name', type: 'token', token: 'school_name', label: 'School Name', x: 50, y: 10, fontSize: 24, fontWeight: 'bold', fontFamily: 'serif', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'cert_title', type: 'static', text: 'CHARACTER & CONDUCT CERTIFICATE', label: 'Certificate Title', x: 50, y: 16, fontSize: 18, fontWeight: 'bold', fontFamily: 'sans', color: '#1e3a8a', textAlign: 'center', isVisible: true },
  { id: 'lbl_ref_no', type: 'static', text: 'Ref No:', label: 'Ref No. Label', x: 14, y: 22, fontSize: 13, fontWeight: 'normal', fontFamily: 'mono', color: '#475569', textAlign: 'left', isVisible: true },
  { id: 'val_ref_no', type: 'token', token: 'certificate_no', label: 'Serial No.', x: 23, y: 22, fontSize: 13, fontWeight: 'bold', fontFamily: 'mono', color: '#0f172a', textAlign: 'left', isVisible: true },
  { id: 'lbl_date', type: 'static', text: 'Date:', label: 'Date Label', x: 74, y: 22, fontSize: 13, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true },
  { id: 'val_date', type: 'token', token: 'issue_date', label: 'Date of Issue', x: 81, y: 22, fontSize: 13, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true },

  { id: 'txt_intro', type: 'static', text: 'This is to certify that', label: 'Intro Text', x: 50, y: 30, fontSize: 14, fontWeight: 'normal', fontFamily: 'serif', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'val_student_name', type: 'token', token: 'student_name', label: 'Student Name', x: 50, y: 36, fontSize: 20, fontWeight: 'bold', fontFamily: 'sans', color: '#1e3a8a', textAlign: 'center', isVisible: true },
  { id: 'txt_parent', type: 'static', text: 'son / daughter of', label: 'Parent Intro', x: 50, y: 42, fontSize: 13, fontWeight: 'normal', fontFamily: 'serif', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'val_father_name', type: 'token', token: 'father_name', label: "Father's Name", x: 50, y: 47, fontSize: 15, fontWeight: 'bold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'txt_study', type: 'static', text: 'was a bonafide student of this institution studying in', label: 'Study Intro', x: 50, y: 53, fontSize: 13, fontWeight: 'normal', fontFamily: 'serif', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'val_class_name', type: 'token', token: 'class_name', label: 'Class / Grade', x: 50, y: 58, fontSize: 16, fontWeight: 'bold', fontFamily: 'sans', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'txt_conduct', type: 'static', text: 'During their tenure at this school, their general conduct and moral character were found to be:', label: 'Conduct Statement', x: 50, y: 65, fontSize: 13, fontWeight: 'normal', fontFamily: 'serif', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'val_conduct', type: 'token', token: 'conduct', label: 'Conduct Rating', x: 50, y: 71, fontSize: 16, fontWeight: 'bold', fontFamily: 'sans', color: '#1e3a8a', textAlign: 'center', isVisible: true },
  { id: 'txt_wishes', type: 'static', text: 'We wish them every success in all future academic endeavors.', label: 'Closing Wishes', x: 50, y: 77, fontSize: 13, fontWeight: 'normal', fontFamily: 'serif', color: '#6b7280', textAlign: 'center', isVisible: true },

  { id: 'teacher_sign', type: 'static', text: 'Class Teacher', label: 'Teacher Sign', x: 20, y: 88, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'principal_sign', type: 'token', token: 'principal_signature', label: 'Principal Sign', x: 80, y: 88, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'verification_qr', type: 'token', token: 'verification_qr', label: 'QR Verification', x: 50, y: 87, imageWidth: 48, color: '#0f172a', isVisible: true },
]

export const TRANSFER_LANDSCAPE_ELEMENTS: CertificateElement[] = [
  { id: 'school_name', type: 'token', token: 'school_name', label: 'School Name', x: 50, y: 10, fontSize: 24, fontWeight: 'bold', fontFamily: 'serif', color: '#111827', textAlign: 'center', isVisible: true },
  { id: 'cert_title', type: 'static', text: 'TRANSFER CERTIFICATE', label: 'Certificate Title', x: 50, y: 17, fontSize: 18, fontWeight: 'bold', fontFamily: 'sans', color: '#1e3a8a', textAlign: 'center', isVisible: true },
  { id: 'lbl_cert_no', type: 'static', text: 'TC No:', label: 'TC No.', x: 10, y: 24, fontSize: 12, fontWeight: 'normal', fontFamily: 'mono', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_cert_no' },
  { id: 'val_cert_no', type: 'token', token: 'certificate_no', label: 'Serial No.', x: 18, y: 24, fontSize: 12, fontWeight: 'bold', fontFamily: 'mono', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_cert_no' },
  { id: 'lbl_date', type: 'static', text: 'Date:', label: 'Date', x: 80, y: 24, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_date' },
  { id: 'val_date', type: 'token', token: 'issue_date', label: 'Date', x: 86, y: 24, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_date' },

  // Left Column
  { id: 'lbl_1', type: 'static', text: '1. Name of Pupil:', label: 'Label 1', x: 10, y: 34, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_1' },
  { id: 'val_student_name', type: 'token', token: 'student_name', label: 'Student Name', x: 30, y: 34, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#1e3a8a', textAlign: 'left', isVisible: true, groupId: 'row_1' },
  { id: 'lbl_2', type: 'static', text: '2. Admission / Student ID:', label: 'Label 2', x: 10, y: 42, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_2' },
  { id: 'val_admission_no', type: 'token', token: 'admission_no', label: 'Admission No.', x: 30, y: 42, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_2' },
  { id: 'lbl_3', type: 'static', text: "3. Father's Name:", label: 'Label 3', x: 10, y: 50, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_3' },
  { id: 'val_father_name', type: 'token', token: 'father_name', label: "Father's Name", x: 30, y: 50, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_3' },
  { id: 'lbl_4', type: 'static', text: "4. Mother's Name:", label: 'Label 4', x: 10, y: 58, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_4' },
  { id: 'val_mother_name', type: 'token', token: 'mother_name', label: "Mother's Name", x: 30, y: 58, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_4' },
  { id: 'lbl_5', type: 'static', text: '5. Date of Birth:', label: 'Label 5', x: 10, y: 66, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_5' },
  { id: 'val_dob', type: 'token', token: 'dob', label: 'Date of Birth', x: 30, y: 66, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_5' },

  // Right Column
  { id: 'lbl_6', type: 'static', text: '6. Class Last Studied:', label: 'Label 6', x: 55, y: 34, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_6' },
  { id: 'val_class_name', type: 'token', token: 'class_name', label: 'Class', x: 74, y: 34, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_6' },
  { id: 'lbl_7', type: 'static', text: '7. Roll Number:', label: 'Label 7', x: 55, y: 42, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_7' },
  { id: 'val_roll_no', type: 'token', token: 'roll_no', label: 'Roll No.', x: 74, y: 42, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_7' },
  { id: 'lbl_8', type: 'static', text: '8. School Dues Paid:', label: 'Label 8', x: 55, y: 50, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_8' },
  { id: 'val_dues_status', type: 'token', token: 'dues_status', label: 'Dues Status', x: 74, y: 50, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_8' },
  { id: 'lbl_9', type: 'static', text: '9. General Conduct:', label: 'Label 9', x: 55, y: 58, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_9' },
  { id: 'val_conduct', type: 'token', token: 'conduct', label: 'Conduct', x: 74, y: 58, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_9' },
  { id: 'lbl_10', type: 'static', text: '10. Reason for Leaving:', label: 'Label 10', x: 55, y: 66, fontSize: 12, fontWeight: 'normal', fontFamily: 'sans', color: '#475569', textAlign: 'left', isVisible: true, groupId: 'row_10' },
  { id: 'val_reason', type: 'token', token: 'reason', label: 'Reason', x: 74, y: 66, fontSize: 12, fontWeight: 'bold', fontFamily: 'sans', color: '#0f172a', textAlign: 'left', isVisible: true, groupId: 'row_10' },
  { id: 'teacher_sign', type: 'static', text: 'Class Teacher', label: 'Teacher Sign', x: 20, y: 84, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'principal_sign', type: 'token', token: 'principal_signature', label: 'Principal Sign', x: 80, y: 84, fontSize: 12, fontWeight: 'semibold', fontFamily: 'sans', color: '#4b5563', textAlign: 'center', isVisible: true },
  { id: 'verification_qr', type: 'token', token: 'verification_qr', label: 'QR Verification', x: 50, y: 83, imageWidth: 48, color: '#0f172a', isVisible: true },
]

export function getStarterPreset(
  type: string,
  orientation: 'portrait' | 'landscape'
): CertificateElement[] {
  if (type === 'merit') {
    return orientation === 'portrait' ? MERIT_PORTRAIT_ELEMENTS : DEFAULT_LANDSCAPE_ELEMENTS
  }
  if (type === 'character') {
    return CHARACTER_PORTRAIT_ELEMENTS
  }
  // Default for transfer and other certificate types
  return orientation === 'landscape' ? TRANSFER_LANDSCAPE_ELEMENTS : DEFAULT_PORTRAIT_ELEMENTS
}

export interface CertificateNumberOptions {
  scheme: 'sequential' | 'admission_no' | 'roll_no' | 'custom'
  prefix?: string
  year?: number
  index?: number
  admissionNo?: string
  rollNo?: string
  unitCode?: string
  pattern?: string
}

export function formatCertificateNumber(opts: CertificateNumberOptions): string {
  const pfx = (opts.prefix || 'CERT').trim()
  const year = opts.year ?? new Date().getFullYear()

  if (opts.scheme === 'custom' && opts.pattern) {
    const seqStr = String(opts.index ?? 1).padStart(4, '0')
    const admStr = opts.admissionNo || '0'
    const rollStr = opts.rollNo || '0'
    return opts.pattern
      .replace(/{PREFIX}/g, pfx)
      .replace(/{YEAR}/g, String(year))
      .replace(/{SEQ}/g, seqStr)
      .replace(/{ADMISSION_NO}/g, admStr)
      .replace(/{ROLL_NO}/g, rollStr)
  }

  if (opts.scheme === 'admission_no' && opts.admissionNo) {
    return `${pfx}-${year}-${opts.admissionNo}`
  }
  if (opts.scheme === 'roll_no') {
    const code = (opts.unitCode || 'STD').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const roll = opts.rollNo || String(opts.index ?? 1)
    return `${pfx}-${code}-${roll}`
  }
  return `${pfx}-${year}-${String(opts.index ?? 1).padStart(4, '0')}`
}

export function getFallbackTemplate(
  cert?: {
    reason?: string
    template_id?: number | null
    template?: {
      orientation?: 'portrait' | 'landscape'
      background_url?: string | null
      layout_data?: CertificateElement[]
    } | null
  },
  allTemplates?: CertificateTemplate[]
): Pick<CertificateTemplate, 'orientation' | 'background_url' | 'layout_data'> {
  if (cert?.template && Array.isArray(cert.template.layout_data) && cert.template.layout_data.length > 0) {
    return {
      orientation: cert.template.orientation || 'portrait',
      background_url: cert.template.background_url ?? null,
      layout_data: cert.template.layout_data,
    }
  }
  if (cert?.template_id && allTemplates?.length) {
    const matched = allTemplates.find((t) => t.id === cert.template_id)
    if (matched) return matched
  }
  const reasonLower = (cert?.reason || '').toLowerCase()
  if (
    reasonLower.includes('merit') ||
    reasonLower.includes('academic') ||
    reasonLower.includes('outstanding') ||
    reasonLower.includes('excellence') ||
    reasonLower.includes('conduct')
  ) {
    return {
      orientation: 'landscape',
      background_url: null,
      layout_data: DEFAULT_LANDSCAPE_ELEMENTS,
    }
  }
  return {
    orientation: 'portrait',
    background_url: null,
    layout_data: DEFAULT_PORTRAIT_ELEMENTS,
  }
}
export const DEFAULT_SAMPLE_DATA: Record<string, string> = {
  student_name: 'Alexander Vance',
  first_name: 'Alexander',
  last_name: 'Vance',
  admission_no: 'ADM-2026-0042',
  student_no: 'STU-2026-0042',
  dob: '15/08/2012',
  gender: 'Male',
  father_name: 'Arthur Vance',
  mother_name: 'Eleanor Vance',
  guardian_name: 'Arthur Vance',
  class_name: 'Grade 10',
  section_name: 'Section A',
  roll_no: '14',
  session_name: '2026–2027',
  certificate_no: 'TC-2026-0042',
  issue_date: '15/05/2026',
  reason: 'Parent transfer to another city',
  conduct: 'Exemplary',
  dues_status: 'All dues cleared',
  school_name: 'Green Valley International Academy',
  school_code: 'CBSE-987654',
  principal_signature: 'Arthur Vance, Head of School',
}

/**
 * Reads an image file from an input change event as a Data URL with size boundary check.
 */
export function readImageFile(
  e: React.ChangeEvent<HTMLInputElement>,
  onLoaded: (dataUrl: string, name: string) => void,
  maxBytes = 1.5 * 1024 * 1024
): void {
  const file = e.target.files?.[0]
  if (file && file.size <= maxBytes) {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const url = evt.target?.result as string
      if (url) onLoaded(url, file.name.replace(/\.[^/.]+$/, ''))
    }
    reader.readAsDataURL(file)
  }
  e.target.value = ''
}
