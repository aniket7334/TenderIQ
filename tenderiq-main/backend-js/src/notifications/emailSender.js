"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendNewTenderAlert = sendNewTenderAlert;
exports.sendDeadlineReminder = sendDeadlineReminder;
exports.sendCorrigendumAlert = sendCorrigendumAlert;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config");
const transporter = nodemailer_1.default.createTransport({
    host: config_1.config.smtp.host,
    port: config_1.config.smtp.port,
    secure: config_1.config.smtp.port === 465,
    auth: config_1.config.smtp.user ? { user: config_1.config.smtp.user, pass: config_1.config.smtp.password } : undefined,
});
async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: config_1.config.smtp.from,
            to,
            subject,
            html,
        });
    }
    catch (err) {
        console.error('Failed to send email:', err);
    }
}
async function sendNewTenderAlert(to, tender) {
    const subject = `New Tender: ${tender.title}`;
    const html = `
    <h2>New Tender Alert</h2>
    <p><strong>Title:</strong> ${tender.title}</p>
    ${tender.referenceNo ? `<p><strong>Reference:</strong> ${tender.referenceNo}</p>` : ''}
    ${tender.sourceUrl ? `<p><a href="${tender.sourceUrl}">View Tender</a></p>` : ''}
    <p>Visit <a href="${config_1.config.app.url}">${config_1.config.app.name}</a> for details.</p>
  `;
    await sendEmail(to, subject, html);
}
async function sendDeadlineReminder(to, tender, daysRemaining) {
    const subject = `Deadline Reminder: ${tender.title} (${daysRemaining} days)`;
    const html = `
    <h2>Tender Deadline Reminder</h2>
    <p><strong>Title:</strong> ${tender.title}</p>
    ${tender.referenceNo ? `<p><strong>Reference:</strong> ${tender.referenceNo}</p>` : ''}
    <p><strong>Days Remaining:</strong> ${daysRemaining}</p>
    ${tender.submissionEndDate ? `<p><strong>Submission Deadline:</strong> ${tender.submissionEndDate.toISOString()}</p>` : ''}
    <p>Visit <a href="${config_1.config.app.url}">${config_1.config.app.name}</a> for details.</p>
  `;
    await sendEmail(to, subject, html);
}
async function sendCorrigendumAlert(to, tender, corrigendum) {
    const subject = `Corrigendum: ${tender.title}`;
    const html = `
    <h2>Tender Corrigendum Alert</h2>
    <p><strong>Tender:</strong> ${tender.title}</p>
    ${tender.referenceNo ? `<p><strong>Reference:</strong> ${tender.referenceNo}</p>` : ''}
    ${corrigendum.corrigendumNo ? `<p><strong>Corrigendum No:</strong> ${corrigendum.corrigendumNo}</p>` : ''}
    ${corrigendum.description ? `<p><strong>Description:</strong> ${corrigendum.description}</p>` : ''}
    <p>Visit <a href="${config_1.config.app.url}">${config_1.config.app.name}</a> for details.</p>
  `;
    await sendEmail(to, subject, html);
}
//# sourceMappingURL=emailSender.js.map