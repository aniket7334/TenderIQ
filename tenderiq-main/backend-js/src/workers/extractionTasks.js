"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTender = extractTender;
exports.extractAllPending = extractAllPending;
const { pool } = require('../db');
const { extractText } = require("../extraction/textExtractor");
const { smartChunk } = require("../extraction/chunker");
const { ClaudeProvider } = require("../extraction/llm/claudeProvider");
const { OpenAIProvider } = require("../extraction/llm/openaiProvider");
const { OllamaProvider } = require("../extraction/llm/ollamaProvider");
const { config } = require("../config");

function getLLMProvider() {
    switch (config.llm.provider) {
        case 'openai': return new OpenAIProvider();
        case 'ollama': return new OllamaProvider();
        case 'claude':
        default: return new ClaudeProvider();
    }
}

async function extractTender(tenderId) {
    const [documents] = await pool.execute(
        'SELECT * FROM tender_documents WHERE tender_id = ? AND ocr_status = ?',
        [tenderId, 'pending']
    );
    if (!documents.length) return;

    const provider = getLLMProvider();
    let combinedText = '';

    for (const doc of documents) {
        try {
            if (!doc.file_path) continue;
            const text = await extractText(doc.file_path);
            await pool.execute(
                'UPDATE tender_documents SET extracted_text = ?, ocr_status = ? WHERE id = ?',
                [text, 'completed', doc.id]
            );
            combinedText += text + '\n\n';
        }
        catch (err) {
            await pool.execute(
                'UPDATE tender_documents SET ocr_status = ? WHERE id = ?',
                ['failed', doc.id]
            );
        }
    }

    if (!combinedText.trim()) return;

    // Chunk and extract
    const chunks = smartChunk(combinedText);
    const allFields = [];
    for (const chunk of chunks) {
        try {
            const fields = await provider.extractTenderFields(chunk);
            allFields.push(fields);
        }
        catch (err) {
            console.error('LLM extraction failed for chunk:', err);
        }
    }

    if (!allFields.length) return;

    // Merge results (first non-null wins)
    const merged = {};
    for (const fields of allFields) {
        for (const [key, value] of Object.entries(fields)) {
            if (value !== null && value !== undefined && !merged[key]) {
                merged[key] = value;
            }
        }
    }

    // Map extraction fields to DB column names
    const fieldMap = {
        title: 'title',
        reference_no: 'reference_no',
        name_of_work: 'name_of_work',
        client_name: 'client_name',
        issued_by: 'issued_by',
        location: 'location',
        state: 'state',
        estimated_project_cost: 'estimated_project_cost',
        emd_amount: 'emd_amount',
        tender_fee: 'tender_fee',
        scope_of_work: 'scope_of_work',
        financial_criteria: 'financial_criteria',
        experience_criteria: 'experience_criteria',
        technical_requirements: 'technical_requirements',
    };

    const setClauses = [];
    const values = [];
    let fieldsExtracted = 0;

    for (const [extractKey, dbCol] of Object.entries(fieldMap)) {
        if (merged[extractKey] !== undefined && merged[extractKey] !== null) {
            setClauses.push(`${dbCol} = ?`);
            values.push(merged[extractKey]);
            fieldsExtracted++;
        }
    }

    // Date fields
    const dateFields = {
        issue_date: 'issue_date',
        clarification_date: 'clarification_date',
        submission_start_date: 'submission_start_date',
        submission_end_date: 'submission_end_date',
        opening_date: 'opening_date',
    };

    for (const [extractKey, dbCol] of Object.entries(dateFields)) {
        if (merged[extractKey]) {
            try {
                const dateVal = new Date(merged[extractKey]);
                setClauses.push(`${dbCol} = ?`);
                values.push(dateVal);
                fieldsExtracted++;
            }
            catch { }
        }
    }

    // Calculate confidence
    const totalFields = Object.keys(fieldMap).length + Object.keys(dateFields).length;
    const confidence = fieldsExtracted / totalFields;
    setClauses.push('extraction_confidence = ?');
    values.push(confidence);

    setClauses.push('updated_at = NOW()');

    if (setClauses.length > 0) {
        values.push(tenderId);
        await pool.execute(
            `UPDATE tenders SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );
    }
}

async function extractAllPending() {
    const [tenders] = await pool.execute(
        `SELECT DISTINCT t.id FROM tenders t
         INNER JOIN tender_documents td ON td.tender_id = t.id
         WHERE td.ocr_status = 'pending'`
    );

    for (const tender of tenders) {
        try {
            await extractTender(tender.id);
        }
        catch (err) {
            console.error(`Extraction failed for tender ${tender.id}:`, err);
        }
    }
}
