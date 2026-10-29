import { prisma } from '../lib/prisma.js';
import { buildReportData, exportPdf } from '../services/aicte/report.service.js';
import { notificationQueue } from '../lib/queues.js';

export async function processScheduledReports(): Promise<void> {
  const schedules = await prisma.scheduledReport.findMany({
    where: { is_active: true },
    select: {
      id: true,
      report_type: true,
      filters: true,
      recipient_emails: true,
    },
  });

  for (const schedule of schedules) {
    try {
      const filters = schedule.filters as Record<string, string>;
      const reportData = await buildReportData({
        reportType: schedule.report_type,
        ...filters,
      });

      const { url } = await exportPdf(reportData);

      await prisma.scheduledReport.update({
        where: { id: schedule.id },
        data: { last_run_at: new Date() },
      });

      for (const email of schedule.recipient_emails) {
        await notificationQueue.add(`report-${schedule.id}-${email}`, {
          type: 'scheduled_report',
          email,
          reportUrl: url,
          reportType: schedule.report_type,
        });
      }
    } catch (err) {
      console.error(`[scheduled-report] Error processing schedule ${schedule.id}:`, (err as Error).message);
    }
  }
}
