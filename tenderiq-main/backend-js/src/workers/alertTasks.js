"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUpcomingDeadlines = checkUpcomingDeadlines;
exports.sendNewTenderAlerts = sendNewTenderAlerts;
const { pool } = require('../db');
const { createAlert } = require("../notifications/inApp");
const { sendDeadlineReminder, sendNewTenderAlert } = require("../notifications/emailSender");

async function checkUpcomingDeadlines() {
    // Get users with email alerts enabled
    const [preferences] = await pool.execute(
        `SELECT up.*, u.email AS user_email, u.full_name AS user_full_name
         FROM user_preferences up
         JOIN users u ON u.id = up.user_id
         WHERE up.email_alerts = 1`
    );

    for (const pref of preferences) {
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + pref.deadline_reminder_days);

        const [tenders] = await pool.execute(
            `SELECT * FROM tenders
             WHERE is_shortlisted = 1
               AND submission_end_date >= NOW()
               AND submission_end_date <= ?`,
            [reminderDate]
        );

        for (const tender of tenders) {
            const daysRemaining = Math.ceil(
                (new Date(tender.submission_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            // Create in-app alert
            await createAlert(
                pref.user_id,
                'deadline',
                `Deadline approaching for "${tender.title}" - ${daysRemaining} days remaining`,
                tender.id
            );

            // Send email
            if (pref.user_email) {
                await sendDeadlineReminder(pref.user_email, {
                    title: tender.title,
                    referenceNo: tender.reference_no || undefined,
                    submissionEndDate: tender.submission_end_date || undefined,
                }, daysRemaining);
            }
        }
    }
}

async function sendNewTenderAlerts() {
    // Find shortlisted tenders created in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const [newTenders] = await pool.execute(
        `SELECT * FROM tenders
         WHERE is_shortlisted = 1
           AND created_at >= ?`,
        [oneHourAgo]
    );

    if (!newTenders.length) return;

    const [users] = await pool.execute(
        `SELECT u.*, up.email_alerts
         FROM users u
         LEFT JOIN user_preferences up ON up.user_id = u.id
         WHERE u.is_active = 1`
    );

    for (const user of users) {
        for (const tender of newTenders) {
            await createAlert(
                user.id,
                'new_tender',
                `New shortlisted tender: "${tender.title}"`,
                tender.id
            );
            if (user.email_alerts !== 0 && user.email) {
                await sendNewTenderAlert(user.email, {
                    title: tender.title,
                    referenceNo: tender.reference_no || undefined,
                    sourceUrl: tender.source_url || undefined,
                });
            }
        }
    }
}
