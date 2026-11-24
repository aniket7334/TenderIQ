"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatValue = formatValue;
exports.getPlaceholderValues = getPlaceholderValues;
exports.getPlaceholderInfo = getPlaceholderInfo;
const FIELD_MAP = {
    title: 'title',
    reference_no: 'referenceNo',
    name_of_work: 'nameOfWork',
    client_name: 'clientName',
    issued_by: 'issuedBy',
    location: 'location',
    state: 'state',
    estimated_project_cost: 'estimatedProjectCost',
    estimated_cost_currency: 'estimatedCostCurrency',
    emd_amount: 'emdAmount',
    emd_currency: 'emdCurrency',
    tender_fee: 'tenderFee',
    tender_fee_currency: 'tenderFeeCurrency',
    issue_date: 'issueDate',
    clarification_date: 'clarificationDate',
    submission_start_date: 'submissionStartDate',
    submission_end_date: 'submissionEndDate',
    opening_date: 'openingDate',
    scope_of_work: 'scopeOfWork',
    financial_criteria: 'financialCriteria',
    experience_criteria: 'experienceCriteria',
    time_schedule: 'timeSchedule',
    salient_features: 'salientFeatures',
    deliverables: 'deliverables',
    technical_requirements: 'technicalRequirements',
    status: 'status',
    source_url: 'sourceUrl',
    is_shortlisted: 'isShortlisted',
};
function formatIndianNumber(num) {
    const str = num.toFixed(2);
    const [intPart, decPart] = str.split('.');
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (rest ? ',' : '') + lastThree;
    return formatted + '.' + decPart;
}
function formatValue(value) {
    if (value === null || value === undefined)
        return '';
    if (value instanceof Date) {
        const d = value.getDate().toString().padStart(2, '0');
        const m = (value.getMonth() + 1).toString().padStart(2, '0');
        const y = value.getFullYear();
        return `${d}/${m}/${y}`;
    }
    if (typeof value === 'number')
        return formatIndianNumber(value);
    if (typeof value === 'boolean')
        return value ? 'Yes' : 'No';
    return String(value);
}
function getPlaceholderValues(tender) {
    const values = {};
    for (const [placeholder, field] of Object.entries(FIELD_MAP)) {
        const raw = tender[field];
        values[placeholder] = formatValue(raw);
    }
    return values;
}
function getPlaceholderInfo() {
    return Object.entries(FIELD_MAP).map(([key, _field]) => ({
        field_name: key,
        display_name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }));
}
//# sourceMappingURL=placeholderMapper.js.map