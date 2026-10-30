import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function main() {
  console.log('Seeding Akshanet database...');

  // ── Clean existing data (order matters for FK constraints) ──
  await prisma.accessLog.deleteMany();
  await prisma.consentRequest.deleteMany();
  await prisma.employerBlock.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.flag.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.duplicatePair.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.rejectionRecord.deleteMany();
  await prisma.aphChecklist.deleteMany();
  await prisma.scheduledReport.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.programme.deleteMany();
  await prisma.employer.deleteMany();
  await prisma.otpSession.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();

  console.log('Cleaned existing data.');

  // ── Institutions ────────────────────────────────────────────
  const saveetha = await prisma.institution.create({
    data: {
      name: 'Saveetha Engineering College',
      aicte_id: 'SEC-TN-2019-001',
      state: 'Tamil Nadu',
      district: 'Chennai',
      type: 'Engineering',
      approved_intake: { 'B.Tech-AIDS': 60, 'B.Tech-CSE': 120, 'B.Tech-ECE': 60 },
    },
  });

  const psg = await prisma.institution.create({
    data: {
      name: 'PSG College of Technology',
      aicte_id: 'PSG-TN-2018-002',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      type: 'Engineering',
      approved_intake: { 'B.Tech-MECH': 60, 'B.Tech-EEE': 60, 'M.Tech-CSE': 30 },
    },
  });

  const iitb = await prisma.institution.create({
    data: {
      name: 'IIT Bombay',
      aicte_id: 'IITB-MH-2001-001',
      state: 'Maharashtra',
      district: 'Mumbai',
      type: 'Engineering',
      approved_intake: { 'B.Tech-CSE': 90, 'B.Tech-EE': 60 },
    },
  });

  console.log('Created 3 institutions.');

  // ── Programmes ──────────────────────────────────────────────
  const savProgrammes = await Promise.all([
    prisma.programme.create({ data: { institution_id: saveetha.id, name: 'B.Tech AIDS', code: 'B.Tech-AIDS', duration_years: 4, approved_intake: 60, academic_year: '2024-25' } }),
    prisma.programme.create({ data: { institution_id: saveetha.id, name: 'B.Tech CSE', code: 'B.Tech-CSE', duration_years: 4, approved_intake: 120, academic_year: '2024-25' } }),
    prisma.programme.create({ data: { institution_id: saveetha.id, name: 'B.Tech ECE', code: 'B.Tech-ECE', duration_years: 4, approved_intake: 60, academic_year: '2024-25' } }),
  ]);

  const psgProgrammes = await Promise.all([
    prisma.programme.create({ data: { institution_id: psg.id, name: 'B.Tech MECH', code: 'B.Tech-MECH', duration_years: 4, approved_intake: 60, academic_year: '2024-25' } }),
    prisma.programme.create({ data: { institution_id: psg.id, name: 'B.Tech EEE', code: 'B.Tech-EEE', duration_years: 4, approved_intake: 60, academic_year: '2024-25' } }),
    prisma.programme.create({ data: { institution_id: psg.id, name: 'M.Tech CSE', code: 'M.Tech-CSE', duration_years: 2, approved_intake: 30, academic_year: '2024-25' } }),
  ]);

  const iitbProgrammes = await Promise.all([
    prisma.programme.create({ data: { institution_id: iitb.id, name: 'B.Tech CSE', code: 'B.Tech-CSE', duration_years: 4, approved_intake: 90, academic_year: '2024-25' } }),
    prisma.programme.create({ data: { institution_id: iitb.id, name: 'B.Tech EE', code: 'B.Tech-EE', duration_years: 4, approved_intake: 60, academic_year: '2024-25' } }),
  ]);

  console.log('Created programmes for all institutions.');

  // ── Users (institution admins) ──────────────────────────────
  const savAdmin = await prisma.user.create({
    data: {
      email_hash: sha256('admin@saveetha.edu'),
      mobile_hash: sha256('9876543210'),
      password_hash: sha256('password123'),
      role: 'INSTITUTION_ADMIN',
      institution_id: saveetha.id,
    },
  });

  const psgAdmin = await prisma.user.create({
    data: {
      email_hash: sha256('admin@psg.edu'),
      mobile_hash: sha256('9876543211'),
      password_hash: sha256('password123'),
      role: 'INSTITUTION_ADMIN',
      institution_id: psg.id,
    },
  });

  const iitbAdmin = await prisma.user.create({
    data: {
      email_hash: sha256('admin@iitb.ac.in'),
      mobile_hash: sha256('9876543212'),
      password_hash: sha256('password123'),
      role: 'INSTITUTION_ADMIN',
      institution_id: iitb.id,
    },
  });

  // ── AICTE Officers ─────────────────────────────────────────
  const southernOfficer = await prisma.user.create({
    data: {
      email_hash: sha256('southern_officer@aicte.gov.in'),
      mobile_hash: sha256('9000000001'),
      password_hash: sha256('aicte123'),
      role: 'AICTE_REVIEWER',
    },
  });

  const nationalOfficer = await prisma.user.create({
    data: {
      email_hash: sha256('national_officer@aicte.gov.in'),
      mobile_hash: sha256('9000000002'),
      password_hash: sha256('aicte123'),
      role: 'AICTE_ADMIN',
    },
  });

  // ── Employer User ──────────────────────────────────────────
  const tcsUser = await prisma.user.create({
    data: {
      email_hash: sha256('hr@tcs.com'),
      mobile_hash: sha256('9000000003'),
      password_hash: sha256('employer123'),
      role: 'EMPLOYER',
    },
  });

  console.log('Created 6 users (3 inst admins, 2 AICTE, 1 employer).');

  // ── Employer profile ───────────────────────────────────────
  const tcsEmployer = await prisma.employer.create({
    data: {
      user_id: tcsUser.id,
      company_name: 'Tata Consultancy Services',
      cin: 'L22210MH1995PLC084781',
      industry: 'IT Services',
      website: 'https://www.tcs.com',
      contact_name: 'HR Department',
      contact_email_hash: sha256('hr@tcs.com'),
      status: 'APPROVED',
      approved_by: nationalOfficer.id,
      approved_at: new Date('2024-08-01'),
    },
  });

  console.log('Created TCS employer (APPROVED).');

  // ── Students ───────────────────────────────────────────────
  const students = await Promise.all([
    // Saveetha students (1-7)
    prisma.student.create({ data: { apaar_id: '543210987654', name: 'Riya Krishnamoorthy', date_of_birth: new Date('2003-05-15'), gender: 'Female', mobile_hash: sha256('9111111101'), email_hash: sha256('riya@student.edu'), apaar_verified_at: new Date('2024-09-01') } }),
    prisma.student.create({ data: { apaar_id: '543210987655', name: 'Arjun Mehta', date_of_birth: new Date('2003-08-22'), gender: 'Male', mobile_hash: sha256('9111111102'), email_hash: sha256('arjun@student.edu'), apaar_verified_at: new Date('2024-09-01') } }),
    prisma.student.create({ data: { apaar_id: '543210987656', name: 'Priya Sundaram', date_of_birth: new Date('2003-03-10'), gender: 'Female', mobile_hash: sha256('9111111103'), email_hash: sha256('priya@student.edu'), apaar_verified_at: new Date('2024-09-15') } }),
    prisma.student.create({ data: { apaar_id: '543210987657', name: 'Karthik Rajan', date_of_birth: new Date('2003-11-25'), gender: 'Male', mobile_hash: sha256('9111111104'), email_hash: sha256('karthik@student.edu'), apaar_verified_at: new Date('2024-09-15') } }),
    prisma.student.create({ data: { apaar_id: '000210987658', name: 'Meera Nair', date_of_birth: new Date('2003-06-08'), gender: 'Female', mobile_hash: sha256('9111111105'), email_hash: sha256('meera@student.edu') } }),
    prisma.student.create({ data: { apaar_id: '111210987659', name: 'Sanjay Gupta', date_of_birth: new Date('2003-01-30'), gender: 'Male', mobile_hash: sha256('9111111106'), email_hash: sha256('sanjay@student.edu') } }),
    prisma.student.create({ data: { apaar_id: '543210987660', name: 'Divya Sharma', date_of_birth: new Date('2003-09-12'), gender: 'Female', mobile_hash: sha256('9111111107'), email_hash: sha256('divya@student.edu'), apaar_verified_at: new Date('2024-09-20') } }),
    // PSG student 8 (duplicate APAAR with Divya)
    prisma.student.create({ data: { apaar_id: '543210987668', name: 'Rohit Verma', date_of_birth: new Date('2003-04-18'), gender: 'Male', mobile_hash: sha256('9111111108'), email_hash: sha256('rohit@student.edu'), apaar_verified_at: new Date('2024-09-20') } }),
    // PSG students 9-10
    prisma.student.create({ data: { apaar_id: '543210987661', name: 'Ananya Iyer', date_of_birth: new Date('2003-07-05'), gender: 'Female', mobile_hash: sha256('9111111109'), email_hash: sha256('ananya@student.edu'), apaar_verified_at: new Date('2024-09-10') } }),
    prisma.student.create({ data: { apaar_id: '543210987662', name: 'Vikram Singh', date_of_birth: new Date('2003-02-14'), gender: 'Male', mobile_hash: sha256('9111111110'), email_hash: sha256('vikram@student.edu'), apaar_verified_at: new Date('2024-09-10') } }),
    // IIT Bombay students 11-12
    prisma.student.create({ data: { apaar_id: '543210987663', name: 'Neha Patil', date_of_birth: new Date('2003-12-01'), gender: 'Female', mobile_hash: sha256('9111111111'), email_hash: sha256('neha@student.edu'), apaar_verified_at: new Date('2024-09-05') } }),
    prisma.student.create({ data: { apaar_id: '543210987664', name: 'Rahul Das', date_of_birth: new Date('2003-10-20'), gender: 'Male', mobile_hash: sha256('9111111112'), email_hash: sha256('rahul@student.edu'), apaar_verified_at: new Date('2024-09-05') } }),
  ]);

  // Create student User records (for auth)
  const studentUsers = await Promise.all(
    students.map((s, i) =>
      prisma.user.create({
        data: {
          email_hash: sha256(`student${i + 1}@akshanet.in`),
          mobile_hash: s.mobile_hash ?? sha256(`fallback${i}`),
          password_hash: sha256('student123'),
          role: 'STUDENT',
        },
      }),
    ),
  );

  console.log(`Created ${students.length} students + ${studentUsers.length} student user accounts.`);

  // ── Admissions ─────────────────────────────────────────────
  const admissions = await Promise.all([
    // 1. Riya — AICTE_APPROVED (clean)
    prisma.admission.create({ data: { student_id: students[0].id, institution_id: saveetha.id, programme_id: savProgrammes[1].id, apaar_id: '543210987654', academic_year: '2024-25', verification_status: 'aicte_approved', apaar_validated_at: new Date('2024-09-01'), verified_at: new Date('2024-10-01'), approved_at: new Date('2024-11-01'), submitted_at: new Date('2024-09-15') } }),
    // 2. Arjun — AICTE_APPROVED (clean)
    prisma.admission.create({ data: { student_id: students[1].id, institution_id: saveetha.id, programme_id: savProgrammes[1].id, apaar_id: '543210987655', academic_year: '2024-25', verification_status: 'aicte_approved', apaar_validated_at: new Date('2024-09-01'), verified_at: new Date('2024-10-01'), approved_at: new Date('2024-11-01'), submitted_at: new Date('2024-09-15') } }),
    // 3. Priya — STUDENT_VERIFIED (awaiting AICTE)
    prisma.admission.create({ data: { student_id: students[2].id, institution_id: saveetha.id, programme_id: savProgrammes[0].id, apaar_id: '543210987656', academic_year: '2024-25', verification_status: 'student_verified', apaar_validated_at: new Date('2024-09-15'), verified_at: new Date('2024-10-05'), submitted_at: new Date('2024-09-20') } }),
    // 4. Karthik — STUDENT_FLAGGED
    prisma.admission.create({ data: { student_id: students[3].id, institution_id: saveetha.id, programme_id: savProgrammes[2].id, apaar_id: '543210987657', academic_year: '2024-25', verification_status: 'student_flagged', apaar_validated_at: new Date('2024-09-15'), submitted_at: new Date('2024-09-20') } }),
    // 5. Meera — APAAR_NOT_FOUND (000* prefix)
    prisma.admission.create({ data: { student_id: students[4].id, institution_id: saveetha.id, programme_id: savProgrammes[0].id, apaar_id: '000210987658', academic_year: '2024-25', verification_status: 'apaar_not_found', submitted_at: new Date('2024-09-20') } }),
    // 6. Sanjay — DATA_MISMATCH (111* prefix)
    prisma.admission.create({ data: { student_id: students[5].id, institution_id: saveetha.id, programme_id: savProgrammes[1].id, apaar_id: '111210987659', academic_year: '2024-25', verification_status: 'data_mismatch', submitted_at: new Date('2024-09-20') } }),
    // 7. Divya — DUPLICATE_FLAGGED
    prisma.admission.create({ data: { student_id: students[6].id, institution_id: saveetha.id, programme_id: savProgrammes[2].id, apaar_id: '543210987660', academic_year: '2024-25', verification_status: 'duplicate_flagged', apaar_validated_at: new Date('2024-09-20'), submitted_at: new Date('2024-09-25') } }),
    // 8. Rohit (PSG) — DUPLICATE_FLAGGED (cross-institution dup with Divya)
    prisma.admission.create({ data: { student_id: students[7].id, institution_id: psg.id, programme_id: psgProgrammes[0].id, apaar_id: '543210987668', academic_year: '2024-25', verification_status: 'duplicate_flagged', apaar_validated_at: new Date('2024-09-20'), submitted_at: new Date('2024-09-25') } }),
    // 9. Ananya (PSG) — APAAR_VERIFIED (ML scored CLEAN)
    prisma.admission.create({ data: { student_id: students[8].id, institution_id: psg.id, programme_id: psgProgrammes[1].id, apaar_id: '543210987661', academic_year: '2024-25', verification_status: 'apaar_verified', apaar_validated_at: new Date('2024-09-10'), anomaly_score: 0.15, submitted_at: new Date('2024-09-15') } }),
    // 10. Vikram (PSG) — FRAUD_ESCALATION (risk_score: 0.85)
    prisma.admission.create({ data: { student_id: students[9].id, institution_id: psg.id, programme_id: psgProgrammes[2].id, apaar_id: '543210987662', academic_year: '2024-25', verification_status: 'fraud_escalation', apaar_validated_at: new Date('2024-09-10'), anomaly_score: 0.85, submitted_at: new Date('2024-09-15') } }),
    // 11. Neha (IITB) — AICTE_APPROVED
    prisma.admission.create({ data: { student_id: students[10].id, institution_id: iitb.id, programme_id: iitbProgrammes[0].id, apaar_id: '543210987663', academic_year: '2024-25', verification_status: 'aicte_approved', apaar_validated_at: new Date('2024-09-05'), verified_at: new Date('2024-10-01'), approved_at: new Date('2024-11-01'), submitted_at: new Date('2024-09-10') } }),
    // 12. Rahul (IITB) — SUBMITTED_TO_AICTE
    prisma.admission.create({ data: { student_id: students[11].id, institution_id: iitb.id, programme_id: iitbProgrammes[1].id, apaar_id: '543210987664', academic_year: '2024-25', verification_status: 'submitted_to_aicte', apaar_validated_at: new Date('2024-09-05'), verified_at: new Date('2024-10-01'), submitted_at: new Date('2024-09-10') } }),
  ]);

  console.log(`Created ${admissions.length} admissions covering all states.`);

  // ── DuplicatePair ──────────────────────────────────────────
  await prisma.duplicatePair.create({
    data: {
      apaar_id: '543210987660',
      admission_id_a: admissions[6].id,
      admission_id_b: admissions[7].id,
      academic_year: '2024-25',
      status: 'OPEN',
    },
  });

  console.log('Created 1 duplicate pair (Divya ↔ Rohit).');

  // ── Flag ───────────────────────────────────────────────────
  await prisma.flag.create({
    data: {
      admission_id: admissions[3].id,
      student_id: students[3].id,
      field_name: 'cgpa',
      reason: 'My CGPA is 8.5 not 7.2 as shown',
      status: 'OPEN',
    },
  });

  console.log('Created 1 flag (Karthik CGPA).');

  // ── Consents ───────────────────────────────────────────────
  const riyaConsent = await prisma.consent.create({
    data: {
      student_id: students[0].id,
      type: 'EMPLOYER_ACCESS',
      scope: 'EMPLOYER',
      granted_to: tcsEmployer.id,
      status: 'GRANTED',
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Created consent (Riya → TCS).');

  // ── Consent Requests ───────────────────────────────────────
  await prisma.consentRequest.create({
    data: {
      employer_id: tcsEmployer.id,
      student_id: students[0].id,
      apaar_id: '543210987654',
      purpose: 'Employment background verification for campus placement 2025',
      token: 'riya-consent-token-approved-2024',
      status: 'APPROVED',
      expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000),
      responded_at: new Date('2024-10-15'),
    },
  });

  await prisma.consentRequest.create({
    data: {
      employer_id: tcsEmployer.id,
      student_id: students[1].id,
      apaar_id: '543210987655',
      purpose: 'Employment background verification for campus placement 2025',
      token: 'arjun-consent-token-pending-2024',
      status: 'PENDING',
      expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });

  console.log('Created 2 consent requests (1 approved, 1 pending).');

  // ── Access Logs ────────────────────────────────────────────
  await prisma.accessLog.create({
    data: {
      student_id: students[0].id,
      accessor_id: tcsEmployer.id,
      accessor_role: 'EMPLOYER',
      fields_accessed: ['name', 'programme', 'academicYear', 'institutionName', 'verificationStatus', 'verifiedDate'],
      consent_id: riyaConsent.id,
    },
  });

  console.log('Created 1 access log (TCS accessed Riya).');

  // ── Approval Records ──────────────────────────────────────
  await prisma.approvalRecord.create({
    data: {
      institution_id: saveetha.id,
      academic_year: '2024-25',
      approved_by: southernOfficer.id,
      record_count: 2,
      notes: 'Partial approval — only clean records',
    },
  });

  await prisma.approvalRecord.create({
    data: {
      institution_id: iitb.id,
      academic_year: '2024-25',
      approved_by: nationalOfficer.id,
      record_count: 1,
    },
  });

  console.log('Created 2 approval records.');

  // ── Audit Events (key actions) ─────────────────────────────
  await prisma.auditEvent.create({
    data: {
      actor_id: savAdmin.id,
      institution_id: saveetha.id,
      action: 'UPLOAD',
      target_table: 'uploads',
      target_id: 'seed-upload-1',
      new_value: { filename: 'saveetha_2024_students.csv', rowCount: 8 },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actor_id: southernOfficer.id,
      institution_id: saveetha.id,
      action: 'APPROVE',
      target_table: 'institutions',
      target_id: saveetha.id,
      new_value: { academicYear: '2024-25', recordCount: 2 },
    },
  });

  console.log('Created audit events.');

  // ── Summary ────────────────────────────────────────────────
  const counts = {
    institutions: await prisma.institution.count(),
    users: await prisma.user.count(),
    students: await prisma.student.count(),
    admissions: await prisma.admission.count(),
    programmes: await prisma.programme.count(),
    employers: await prisma.employer.count(),
    consentRequests: await prisma.consentRequest.count(),
    consents: await prisma.consent.count(),
    duplicatePairs: await prisma.duplicatePair.count(),
    flags: await prisma.flag.count(),
    approvalRecords: await prisma.approvalRecord.count(),
    accessLogs: await prisma.accessLog.count(),
    auditEvents: await prisma.auditEvent.count(),
  };

  console.log('\n=== Seed Complete ===');
  console.table(counts);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
