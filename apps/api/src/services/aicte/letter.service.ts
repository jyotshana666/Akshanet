import { prisma } from '../../lib/prisma.js';
import { s3 } from '../../lib/s3.js';
import { notificationQueue } from '../../lib/queues.js';
import { REJECTION_REASON_CODES, APH_REFERENCES, getRegionForState } from './constants.js';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function generateRefNumber(region: string, year: string, id: string): string {
  const seq = id.slice(0, 6).toUpperCase();
  return `AICTE/${region}/${year}/${seq}`;
}

export async function generateRejectionLetter(
  rejectionRecordId: string,
): Promise<{ url: string } | { error: string }> {
  const rejection = await prisma.rejectionRecord.findUnique({
    where: { id: rejectionRecordId },
    select: {
      id: true,
      institution_id: true,
      academic_year: true,
      rejected_by: true,
      rejected_at: true,
      reason_codes: true,
      custom_note: true,
    },
  });

  if (!rejection) return { error: 'Rejection record not found' };

  const institution = await prisma.institution.findUnique({
    where: { id: rejection.institution_id },
    select: { name: true, state: true, district: true, aicte_id: true },
  });

  if (!institution) return { error: 'Institution not found' };

  const region = getRegionForState(institution.state) ?? 'CENTRAL';
  const refNumber = generateRefNumber(region, rejection.academic_year, rejection.id);

  const reasonDetails = await Promise.all(
    rejection.reason_codes.map(async (code: string) => {
      let count = 0;
      if (code === 'APAAR_COVERAGE_LOW') {
        const total = await prisma.admission.count({ where: { institution_id: rejection.institution_id } });
        const verified = await prisma.admission.count({
          where: { institution_id: rejection.institution_id, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } },
        });
        count = total - verified;
      } else if (code === 'DUPLICATE_UNRESOLVED') {
        count = await prisma.duplicatePair.count({ where: { status: 'OPEN' } });
      } else if (code === 'INTAKE_EXCEEDED') {
        count = await prisma.admission.count({ where: { institution_id: rejection.institution_id, verification_status: 'intake_exceeded' } });
      } else if (code === 'FRAUD_ESCALATION_UNRESOLVED') {
        count = await prisma.admission.count({ where: { institution_id: rejection.institution_id, verification_status: 'fraud_escalation' } });
      } else if (code === 'STUDENT_VERIFICATION_INCOMPLETE') {
        count = await prisma.admission.count({
          where: { institution_id: rejection.institution_id, verification_status: { notIn: ['student_verified', 'aicte_approved', 'submitted_to_aicte', 'rejected', 'withdrawn'] } },
        });
      }

      return {
        code,
        description: REJECTION_REASON_CODES[code] ?? code,
        reference: APH_REFERENCES[code] ?? '',
        affectedRecords: count,
      };
    }),
  );

  const resubmissionDeadline = new Date(rejection.rejected_at);
  resubmissionDeadline.setDate(resubmissionDeadline.getDate() + 30);

  const issuesList = reasonDetails
    .map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.description}</td>
        <td>${r.affectedRecords}</td>
        <td>${r.reference}</td>
      </tr>
    `).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AICTE Rejection Letter</title>
<style>
  body { font-family: 'Times New Roman', serif; margin: 40px 60px; line-height: 1.6; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header h2 { margin: 5px 0; font-size: 14px; font-weight: normal; }
  .ref-block { display: flex; justify-content: space-between; margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 13px; }
  th { background-color: #f0f0f0; }
  .footer { margin-top: 40px; }
  .signature { margin-top: 60px; }
</style>
</head><body>
  <div class="header">
    <h1>ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</h1>
    <h2>${region} Regional Office</h2>
    <h2>New Delhi — 110070</h2>
  </div>

  <div class="ref-block">
    <div><strong>Ref:</strong> ${refNumber}</div>
    <div><strong>Date:</strong> ${formatDate(rejection.rejected_at)}</div>
  </div>

  <p><strong>To:</strong><br>
  The Principal/Director<br>
  ${institution.name}<br>
  ${institution.district}, ${institution.state}<br>
  AICTE Approval ID: ${institution.aicte_id}</p>

  <p><strong>Subject:</strong> Rejection of Student Data Submission for Academic Year ${rejection.academic_year}</p>

  <p>Dear Sir/Madam,</p>

  <p>This is with reference to the student data submission made by your institution for the
  Academic Year ${rejection.academic_year} through the Akshanet platform. After thorough review
  of the submitted data, the following issues have been identified:</p>

  <table>
    <thead>
      <tr><th>S.No.</th><th>Issue</th><th>Affected Records</th><th>Regulatory Reference</th></tr>
    </thead>
    <tbody>
      ${issuesList}
    </tbody>
  </table>

  ${rejection.custom_note ? `<p><strong>Additional Observations:</strong> ${rejection.custom_note}</p>` : ''}

  <p>In light of the above, the submission is hereby <strong>rejected</strong>. Your institution
  is directed to take corrective action as per the referenced APH provisions and resubmit
  the student data within <strong>30 days</strong> of the date of this letter
  (i.e., by ${formatDate(resubmissionDeadline)}).</p>

  <p>Failure to resubmit within the stipulated period may result in further regulatory action
  as per the AICTE Act and the Approval Process Handbook.</p>

  <div class="signature">
    <p>______________________________</p>
    <p><strong>[Officer Name]</strong><br>
    Regional Officer<br>
    AICTE ${region} Regional Office</p>
  </div>
</body></html>`;

  const pdfBuffer = Buffer.from(html, 'utf-8');
  const s3Key = `letters/${rejection.institution_id}/${rejection.academic_year}/${rejectionRecordId}.pdf`;

  await s3.putObject({ key: s3Key, body: pdfBuffer, contentType: 'text/html' });

  await prisma.rejectionRecord.update({
    where: { id: rejectionRecordId },
    data: { letter_s3_key: s3Key },
  });

  const url = s3.getSignedUrl(s3Key, 86400);
  return { url };
}

export async function generateApprovalLetter(
  approvalRecordId: string,
): Promise<{ url: string } | { error: string }> {
  const approval = await prisma.approvalRecord.findUnique({
    where: { id: approvalRecordId },
    select: {
      id: true, institution_id: true, academic_year: true,
      approved_by: true, approved_at: true, record_count: true,
    },
  });

  if (!approval) return { error: 'Approval record not found' };

  const institution = await prisma.institution.findUnique({
    where: { id: approval.institution_id },
    select: { name: true, state: true, district: true, aicte_id: true },
  });

  if (!institution) return { error: 'Institution not found' };

  const region = getRegionForState(institution.state) ?? 'CENTRAL';
  const refNumber = generateRefNumber(region, approval.academic_year, approval.id);

  const programmes = await prisma.programme.findMany({
    where: { institution_id: approval.institution_id },
    select: { name: true, code: true, approved_intake: true },
  });

  const programmeRows = programmes.map((p: typeof programmes[number], i: number) =>
    `<tr><td>${i + 1}</td><td>${p.name} (${p.code})</td><td>${p.approved_intake}</td></tr>`,
  ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AICTE Approval Letter</title>
<style>
  body { font-family: 'Times New Roman', serif; margin: 40px 60px; line-height: 1.6; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header h2 { margin: 5px 0; font-size: 14px; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 13px; }
  th { background-color: #f0f0f0; }
  .signature { margin-top: 60px; }
</style>
</head><body>
  <div class="header">
    <h1>ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</h1>
    <h2>${region} Regional Office</h2>
    <h2>New Delhi — 110070</h2>
  </div>

  <div style="display:flex;justify-content:space-between;margin:20px 0;">
    <div><strong>Ref:</strong> ${refNumber}</div>
    <div><strong>Date:</strong> ${formatDate(approval.approved_at)}</div>
  </div>

  <p><strong>To:</strong><br>
  The Principal/Director<br>
  ${institution.name}<br>
  ${institution.district}, ${institution.state}<br>
  AICTE Approval ID: ${institution.aicte_id}</p>

  <p><strong>Subject:</strong> Approval of Student Data Submission for Academic Year ${approval.academic_year}</p>

  <p>Dear Sir/Madam,</p>

  <p>This is with reference to the student data submission made by your institution for the
  Academic Year ${approval.academic_year}. After review through the Akshanet platform, the
  Council is pleased to inform you that your submission has been <strong>approved</strong>.</p>

  <p><strong>Summary:</strong></p>
  <ul>
    <li>Total student records approved: <strong>${approval.record_count}</strong></li>
    <li>APAAR ID coverage: <strong>100%</strong></li>
  </ul>

  <p><strong>Programmes covered:</strong></p>
  <table>
    <thead><tr><th>S.No.</th><th>Programme</th><th>Approved Intake</th></tr></thead>
    <tbody>${programmeRows}</tbody>
  </table>

  <p>The approved records are now part of the national APAAR registry and will be available
  for verification by authorized parties.</p>

  <div class="signature">
    <p>______________________________</p>
    <p><strong>[Officer Name]</strong><br>
    Regional Officer<br>
    AICTE ${region} Regional Office</p>
  </div>
</body></html>`;

  const pdfBuffer = Buffer.from(html, 'utf-8');
  const s3Key = `letters/${approval.institution_id}/${approval.academic_year}/approval-${approvalRecordId}.pdf`;

  await s3.putObject({ key: s3Key, body: pdfBuffer, contentType: 'text/html' });

  const url = s3.getSignedUrl(s3Key, 86400);
  return { url };
}

export async function sendLetter(
  recordId: string,
  type: 'approval' | 'rejection',
  recipientEmails: string[],
): Promise<{ sent: boolean; error?: string }> {
  if (type === 'rejection') {
    const rejection = await prisma.rejectionRecord.findUnique({
      where: { id: recordId },
      select: { letter_s3_key: true },
    });
    if (!rejection?.letter_s3_key) return { sent: false, error: 'Letter not generated yet' };

    await prisma.rejectionRecord.update({
      where: { id: recordId },
      data: { letter_sent_at: new Date() },
    });

    const url = s3.getSignedUrl(rejection.letter_s3_key, 86400);

    for (const email of recipientEmails) {
      await notificationQueue.add(`letter-${recordId}-${email}`, {
        type: 'institution_rejected',
        email,
        letterUrl: url,
        recordId,
      });
    }
  } else {
    const approval = await prisma.approvalRecord.findUnique({
      where: { id: recordId },
      select: { id: true },
    });
    if (!approval) return { sent: false, error: 'Approval record not found' };

    const letterResult = await generateApprovalLetter(recordId);
    if ('error' in letterResult) return { sent: false, error: letterResult.error };

    for (const email of recipientEmails) {
      await notificationQueue.add(`letter-${recordId}-${email}`, {
        type: 'institution_approved',
        email,
        letterUrl: letterResult.url,
        recordId,
      });
    }
  }

  return { sent: true };
}
