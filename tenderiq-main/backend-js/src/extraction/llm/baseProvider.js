"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLLMProvider = exports.TENDER_EXTRACTION_SCHEMA = void 0;
exports.TENDER_EXTRACTION_SCHEMA = {
    title: 'string',
    reference_no: 'string',
    name_of_work: 'string',
    client_name: 'string',
    issued_by: 'string',
    location: 'string',
    state: 'string',
    estimated_project_cost: 'number',
    emd_amount: 'number',
    tender_fee: 'number',
    issue_date: 'date (YYYY-MM-DD)',
    clarification_date: 'datetime (ISO)',
    submission_start_date: 'datetime (ISO)',
    submission_end_date: 'datetime (ISO)',
    opening_date: 'datetime (ISO)',
    scope_of_work: 'string',
    financial_criteria: 'string',
    experience_criteria: 'string',
    technical_requirements: 'string',
};
class BaseLLMProvider {
    buildExtractionPrompt(text) {
        const schemaStr = Object.entries(exports.TENDER_EXTRACTION_SCHEMA)
            .map(([k, v]) => `  "${k}": ${v}`)
            .join(',\n');
        return `Extract tender information from the following document text. Return ONLY a JSON object with these fields (use null for missing values):

{
${schemaStr}
}

Document text:
${text}

Return ONLY valid JSON, no markdown, no explanation.`;
    }
    parseLLMResponse(response) {
        let cleaned = response.trim();
        // Remove markdown code fences
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        try {
            return JSON.parse(cleaned);
        }
        catch {
            console.error('Failed to parse LLM response:', cleaned.slice(0, 200));
            return {};
        }
    }
}
exports.BaseLLMProvider = BaseLLMProvider;
//# sourceMappingURL=baseProvider.js.map