"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenders = listTenders;
exports.getTender = getTender;
exports.updateTender = updateTender;
exports.shortlistTender = shortlistTender;
exports.addTag = addTag;
exports.removeTag = removeTag;
exports.addComment = addComment;
exports.listDocuments = listDocuments;
exports.getTenderHistory = getTenderHistory;
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../db");
const { AppError } = require("../middleware/errorHandler");
const { detectCategories } = require("./category.service");

const SORT_COLUMN_MAP = {
    title: 'title_sort', // indexed first 191 chars of title (TEXT can't be index-sorted)
    created_at: 'created_at',
    submission_end_date: 'submission_end_date',
    submission_deadline: 'submission_end_date',
    estimated_project_cost: 'estimated_project_cost',
    estimated_value: 'estimated_project_cost',
    status: 'status',
    client_name: 'client_name',
    organization: 'client_name',
};

function serializeTender(tender, tags, source, assignee, comments, documents, noteCount, docCount) {
    const tagNames = Array.isArray(tags) ? tags.map(t => t.tag_name || t) : [];
    const searchText = [tender.title, tender.name_of_work, tender.scope_of_work, tender.client_name].filter(Boolean).join(' ');
    const detectedCats = detectCategories(searchText);

    const category = tagNames.length > 0
        ? tagNames[0]
        : (detectedCats.length > 0 ? detectedCats[0].category : 'General');

    const categories = tagNames.length > 0
        ? tagNames
        : detectedCats.map(c => c.category);

    return {
        id: tender.id,
        title: tender.title,
        reference_number: tender.reference_no || '',
        reference_no: tender.reference_no,
        name_of_work: tender.name_of_work,
        description: tender.scope_of_work || tender.name_of_work || '',
        organization: tender.client_name || '',
        client_name: tender.client_name,
        department: tender.issued_by || null,
        issued_by: tender.issued_by,
        category,
        categories,
        subcategory: null,
        tender_type: 'open',
        status: tender.status || 'new',
        internal_status: tender.status || 'new',
        estimated_value: tender.estimated_project_cost ? Number(tender.estimated_project_cost) : null,
        estimated_project_cost: tender.estimated_project_cost ? Number(tender.estimated_project_cost) : null,
        currency: tender.estimated_cost_currency || 'INR',
        estimated_cost_currency: tender.estimated_cost_currency,
        emd_amount: tender.emd_amount ? Number(tender.emd_amount) : null,
        tender_fee: tender.tender_fee ? Number(tender.tender_fee) : null,
        published_date: tender.issue_date,
        issue_date: tender.issue_date,
        submission_deadline: tender.submission_end_date || '',
        submission_end_date: tender.submission_end_date,
        submission_start_date: tender.submission_start_date,
        opening_date: tender.opening_date,
        closing_date: tender.submission_end_date,
        clarification_date: tender.clarification_date,
        location: tender.location || null,
        state: tender.state || null,
        // All tracked sources (GeM, CPPP, eTenders, IREPS) are Indian portals
        country: 'India',
        // "Mumbai, India": the source's stored city, else the first city named in the tender
        // (GeM listings have no place; see place.service.js). null when none is known.
        city: require('./place.service').cityForTender(tender),
        scope_of_work: tender.scope_of_work,
        financial_criteria: tender.financial_criteria,
        experience_criteria: tender.experience_criteria,
        eligibility_criteria: tender.experience_criteria || null,
        technical_requirements: tender.technical_requirements,
        time_schedule: tender.time_schedule,
        salient_features: tender.salient_features,
        deliverables: tender.deliverables,
        source_url: tender.source_url || null,
        source_id: tender.source_id || null,
        source_name: source ? source.name : null,
        assigned_to: tender.assigned_to || null,
        assigned_to_name: assignee ? assignee.full_name : null,
        priority: 'medium',
        // 2 = matches the company keyword list (listed first of all), 1 = other marine, 0 = other
        priority_level: Number(tender.is_priority || 0),
        tags: tagNames,
        notes_count: noteCount !== undefined ? noteCount : 0,
        documents_count: docCount !== undefined ? docCount : 0,
        is_bookmarked: tender.is_shortlisted ? true : false,
        is_shortlisted: tender.is_shortlisted ? true : false,
        extraction_confidence: tender.extraction_confidence,
        raw_data: tender.raw_data,
        created_at: tender.created_at,
        updated_at: tender.updated_at,
        ...(comments && {
            comments: comments.map(c => ({
                id: c.id,
                tender_id: c.tender_id,
                user_id: c.user_id,
                comment: c.comment,
                user_name: c.user_full_name || '',
                created_at: c.created_at,
            })),
        }),
        ...(documents && {
            documents: documents.map(d => ({
                id: d.id,
                tender_id: d.tender_id,
                file_name: d.file_name,
                file_type: d.file_type,
                file_size: d.file_size,
                file_url: d.file_path,
                storage_key: d.storage_key,
                is_primary: d.is_primary ? true : false,
                ocr_status: d.ocr_status,
                created_at: d.created_at,
            })),
        }),
    };
}

async function listTenders(params) {
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = ['t.source_id IS NOT NULL'];
    const queryParams = [];

    if (params.search) {
        // Smart search: company keyword topics, synonyms / abbreviations, plurals,
        // all words in any order, across title, scope, buyer and location; bid numbers as typed
        const cond = require('./search.service').sqlCondition(params.search);
        if (cond) {
            conditions.push(cond.sql);
            queryParams.push(...cond.params);
        }
    }

    const status = params.internal_status || params.status;
    if (status) {
        conditions.push('t.status = ?');
        queryParams.push(status);
    }

    if (params.sourceId) {
        conditions.push('t.source_id = ?');
        queryParams.push(params.sourceId);
    }

    if (params.location) {
        conditions.push('t.location LIKE ?');
        queryParams.push(`%${params.location}%`);
    }

    // Every source TenderIQ scrapes is an Indian portal (see formatTender's
    // country: 'India'), so filtering by any other country matches nothing.
    if (params.country && params.country.toLowerCase() !== 'india') {
        conditions.push('1 = 0');
    }

    if (params.state) {
        conditions.push('t.state LIKE ?');
        queryParams.push(`%${params.state}%`);
    }

    if (params.category) {
        // Sector filter: any of the sector's keywords as a whole word (so "Port" no longer
        // matches "support" / "transport"), or a tag added by hand
        const body = require('./category.service').categoryRegexBody(params.category);
        if (body) {
            conditions.push(
                `(EXISTS (SELECT 1 FROM tender_tags tt2 WHERE tt2.tender_id = t.id AND tt2.tag_name = ?)
                  OR LOWER(CONCAT_WS(' ', t.title, t.name_of_work, t.scope_of_work, t.client_name)) REGEXP ?)`
            );
            queryParams.push(params.category, body);
        }
        else {
            const cat = params.category.toLowerCase();
            conditions.push(
                `(EXISTS (SELECT 1 FROM tender_tags tt2 WHERE tt2.tender_id = t.id AND tt2.tag_name = ?)
                  OR t.title LIKE ? OR t.name_of_work LIKE ? OR t.scope_of_work LIKE ? OR t.client_name LIKE ?)`
            );
            queryParams.push(params.category, `%${cat}%`, `%${cat}%`, `%${cat}%`, `%${cat}%`);
        }
    }

    if (params.minValue !== undefined) {
        conditions.push('t.estimated_project_cost >= ?');
        queryParams.push(params.minValue);
    }
    if (params.maxValue !== undefined) {
        conditions.push('t.estimated_project_cost <= ?');
        queryParams.push(params.maxValue);
    }

    if (params.dateFrom) {
        conditions.push('t.submission_end_date >= ?');
        queryParams.push(new Date(params.dateFrom));
    }
    if (params.dateTo) {
        conditions.push('t.submission_end_date <= ?');
        queryParams.push(new Date(params.dateTo));
    }

    if (params.isShortlisted !== undefined) {
        conditions.push('t.is_shortlisted = ?');
        queryParams.push(params.isShortlisted ? 1 : 0);
    }
    if (params.is_bookmarked !== undefined) {
        conditions.push('t.is_shortlisted = ?');
        queryParams.push(params.is_bookmarked ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const sortField = params.sortBy && SORT_COLUMN_MAP[params.sortBy]
        ? SORT_COLUMN_MAP[params.sortBy]
        : 'created_at';
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
    // Priority categories (dredging, marine, pipelines…) first, then the chosen sort
    const { isPriorityReady } = require('./priority.service');
    const priorityFirst = params.priorityFirst && isPriorityReady() ? 't.is_priority DESC, ' : '';

    let total;
    // With a search: how many results are still open (shown first)
    let openTotal;
    let items;
    if (params.search || params.category) {
        // Search / sector filter: these match few tenders, so walking the date index
        // (the plan below) would read almost every row before finding 20 — ~6 s for a
        // rare word. Instead: one pass for the matching ids and sort keys only, sort
        // here, then load just this page's rows.
        // A search shows OPEN tenders first (deadline still ahead), then the rest
        // (closed, or no deadline given); within each group the usual order applies.
        const openFirst = !!params.search;
        const [matches] = await pool.query(
            `SELECT t.id, ${priorityFirst ? 't.is_priority' : '0'} AS prio, t.${sortField} AS sort_val,
                    ${openFirst ? "CASE WHEN t.submission_end_date >= NOW() THEN 1 ELSE 0 END" : '0'} AS is_open
               FROM tenders t ${whereClause}`,
            queryParams);
        total = matches.length;
        if (openFirst) openTotal = matches.filter((m) => Number(m.is_open) === 1).length;
        const dir = sortOrder === 'ASC' ? 1 : -1;
        const key = (v) => (v == null ? null : v instanceof Date ? v.getTime() : typeof v === 'string' && v !== '' && !isNaN(Number(v)) ? Number(v) : v);
        const cmp = (a, b) => {
            // NULLs sort first ascending and last descending, as in MySQL
            if (a === b) return 0;
            if (a === null) return -1;
            if (b === null) return 1;
            if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b));
            return a < b ? -1 : 1;
        };
        matches.sort((a, b) => (Number(b.is_open) - Number(a.is_open))
            || (Number(b.prio) - Number(a.prio))
            || dir * cmp(key(a.sort_val), key(b.sort_val))
            || dir * String(a.id).localeCompare(String(b.id)));
        const pageIds = matches.slice(offset, offset + parseInt(pageSize, 10)).map((m) => m.id);
        items = [];
        if (pageIds.length) {
            const [rows] = await pool.query(
                `SELECT t.*, ts.name as source_name, u.full_name as assignee_full_name
                   FROM tenders t
                   LEFT JOIN tender_sources ts ON t.source_id = ts.id
                   LEFT JOIN users u ON t.assigned_to = u.id
                  WHERE t.id IN (?)`, [pageIds]);
            const byId = new Map(rows.map((r) => [r.id, r]));
            items = pageIds.map((id) => byId.get(id)).filter(Boolean);
        }
    }
    else {
    // Count query
    const countSql = `SELECT COUNT(*) as total FROM tenders t ${whereClause}`;
    const [countRows] = await pool.query(countSql, queryParams);
    total = countRows[0].total;

    // Main query — "deferred join": sort and page through ids only, then load
    // full rows for just this page. Sorting whole rows (with long TEXT columns)
    // forced MySQL to filesort ~10k wide rows on every request (~3s).
    const dataSql = `
        SELECT t.*, ts.name as source_name, u.full_name as assignee_full_name
        FROM (
            SELECT t.id FROM tenders t ${params.sourceId ? '' : 'IGNORE INDEX (idx_tenders_source_ref)'}
            ${whereClause}
            ORDER BY ${priorityFirst}t.${sortField} ${sortOrder}, t.id ${sortOrder}
            LIMIT ${parseInt(pageSize, 10)} OFFSET ${parseInt(offset, 10)}
        ) page
        JOIN tenders t ON t.id = page.id
        LEFT JOIN tender_sources ts ON t.source_id = ts.id
        LEFT JOIN users u ON t.assigned_to = u.id
        ORDER BY ${priorityFirst}t.${sortField} ${sortOrder}, t.id ${sortOrder}
    `;
    [items] = await pool.query(dataSql, queryParams);
    }

    // Get tags for all fetched tenders
    let tagsMap = {};
    if (items.length > 0) {
        const tenderIds = items.map(i => i.id);
        const placeholders = tenderIds.map(() => '?').join(',');
        const [tagRows] = await pool.query(
            `SELECT tender_id, tag_name FROM tender_tags WHERE tender_id IN (${placeholders})`,
            tenderIds
        );
        for (const row of tagRows) {
            if (!tagsMap[row.tender_id]) tagsMap[row.tender_id] = [];
            tagsMap[row.tender_id].push(row);
        }
    }

    // Get note and document counts
    let noteCountMap = {};
    let docCountMap = {};
    if (items.length > 0) {
        const tenderIds = items.map(i => i.id);
        const placeholders = tenderIds.map(() => '?').join(',');

        const [noteCounts] = await pool.query(
            `SELECT tender_id, COUNT(*) as cnt FROM tender_notes WHERE tender_id IN (${placeholders}) GROUP BY tender_id`,
            tenderIds
        );
        for (const row of noteCounts) {
            noteCountMap[row.tender_id] = row.cnt;
        }

        const [docCounts] = await pool.query(
            `SELECT tender_id, COUNT(*) as cnt FROM tender_documents WHERE tender_id IN (${placeholders}) GROUP BY tender_id`,
            tenderIds
        );
        for (const row of docCounts) {
            docCountMap[row.tender_id] = row.cnt;
        }
    }

    // Where else each tender is published (same tender on several sources — one entry)
    const alsoOn = await require('./crossSource.service').aliasesFor(items.map((i) => i.id)).catch(() => ({}));
    const serialized = items.map(tender => {
        const source = tender.source_name ? { name: tender.source_name } : null;
        const assignee = tender.assignee_full_name ? { full_name: tender.assignee_full_name } : null;
        const tags = tagsMap[tender.id] || [];
        const out = serializeTender(tender, tags, source, assignee, null, null, noteCountMap[tender.id] || 0, docCountMap[tender.id] || 0);
        out.also_on = (alsoOn[tender.id] || []).map((a) => ({ source_name: a.source_name, reference_no: a.reference_no }));
        return out;
    });

    return {
        items: serialized,
        total,
        ...(openTotal !== undefined && { open_total: openTotal }),
        page,
        page_size: pageSize,
        total_pages: Math.ceil(total / pageSize),
    };
}

async function getTender(tenderId) {
    const [rows] = await pool.execute(
        `SELECT t.*, ts.name as source_name, u.full_name as assignee_full_name
         FROM tenders t
         LEFT JOIN tender_sources ts ON t.source_id = ts.id
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.id = ?`,
        [tenderId]
    );
    const tender = rows[0];
    if (!tender) {
        throw new AppError('Tender not found', 404);
    }

    // Fetch tags
    const [tags] = await pool.execute(
        'SELECT id, tender_id, tag_name, created_at FROM tender_tags WHERE tender_id = ?',
        [tenderId]
    );

    // Fetch comments with user info
    const [comments] = await pool.execute(
        `SELECT tc.id, tc.tender_id, tc.user_id, tc.comment, tc.created_at, u.full_name as user_full_name
         FROM tender_comments tc
         LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.tender_id = ?
         ORDER BY tc.created_at DESC`,
        [tenderId]
    );

    // Fetch documents
    const [documents] = await pool.execute(
        'SELECT * FROM tender_documents WHERE tender_id = ?',
        [tenderId]
    );

    const source = tender.source_name ? { name: tender.source_name } : null;
    const assignee = tender.assignee_full_name ? { full_name: tender.assignee_full_name } : null;

    const out = serializeTender(tender, tags, source, assignee, comments, documents);
    // Where else this tender is published: [{ source_name, reference_no, source_url, closing_date, last_seen_at }]
    out.also_on = ((await require('./crossSource.service').aliasesFor([tender.id]).catch(() => ({})))[tender.id]) || [];
    // Every place to view or bid on it (same list as the Documents tab)
    const [[src]] = await pool.query('SELECT adapter_type FROM tender_sources WHERE id = ?', [tender.source_id || null]);
    out.links = await require('./crossSource.service').whereToApply({
        id: tender.id, reference_no: tender.reference_no, source_url: tender.source_url,
        source_name: tender.source_name, adapter_type: src?.adapter_type,
    }).catch(() => []);
    return out;
}

async function updateTender(tenderId, data) {
    const [existing] = await pool.execute('SELECT id FROM tenders WHERE id = ?', [tenderId]);
    if (existing.length === 0) {
        throw new AppError('Tender not found', 404);
    }

    const fieldMap = {
        internal_status: 'status',
        status: 'status',
        assigned_to: 'assigned_to',
        is_bookmarked: 'is_shortlisted',
        is_shortlisted: 'is_shortlisted',
        title: 'title',
        name_of_work: 'name_of_work',
        client_name: 'client_name',
        issued_by: 'issued_by',
        location: 'location',
        state: 'state',
        estimated_project_cost: 'estimated_project_cost',
        emd_amount: 'emd_amount',
        tender_fee: 'tender_fee',
        scope_of_work: 'scope_of_work',
        submission_end_date: 'submission_end_date',
    };

    const setClauses = [];
    const updateParams = [];

    for (const [key, value] of Object.entries(data)) {
        if (key === 'tags' || value === undefined) continue;
        const dbCol = fieldMap[key] || key;
        setClauses.push(`${dbCol} = ?`);
        updateParams.push(value);
    }

    // Always update updated_at
    setClauses.push('updated_at = ?');
    updateParams.push(new Date());

    if (setClauses.length > 0) {
        updateParams.push(tenderId);
        await pool.execute(
            `UPDATE tenders SET ${setClauses.join(', ')} WHERE id = ?`,
            updateParams
        );
    }

    // Handle tags separately
    if (data.tags && Array.isArray(data.tags)) {
        await pool.execute('DELETE FROM tender_tags WHERE tender_id = ?', [tenderId]);
        for (const tagName of data.tags) {
            const tagId = uuidv4();
            await pool.execute(
                'INSERT INTO tender_tags (id, tender_id, tag_name, created_at) VALUES (?, ?, ?, ?)',
                [tagId, tenderId, tagName, new Date()]
            );
        }
    }

    return getTender(tenderId);
}

async function shortlistTender(tenderId) {
    const [existing] = await pool.execute('SELECT id, is_shortlisted FROM tenders WHERE id = ?', [tenderId]);
    if (existing.length === 0) {
        throw new AppError('Tender not found', 404);
    }

    const newShortlisted = existing[0].is_shortlisted ? 0 : 1;
    const newStatus = newShortlisted ? 'shortlisted' : 'new';

    await pool.execute(
        'UPDATE tenders SET is_shortlisted = ?, status = ?, updated_at = ? WHERE id = ?',
        [newShortlisted, newStatus, new Date(), tenderId]
    );

    return getTender(tenderId);
}

async function addTag(tenderId, tagName) {
    const [existing] = await pool.execute('SELECT id FROM tenders WHERE id = ?', [tenderId]);
    if (existing.length === 0) {
        throw new AppError('Tender not found', 404);
    }

    const tagId = uuidv4();
    const now = new Date();
    await pool.execute(
        'INSERT INTO tender_tags (id, tender_id, tag_name, created_at) VALUES (?, ?, ?, ?)',
        [tagId, tenderId, tagName, now]
    );

    await require('./priority.service').refreshPriority({ ids: [tenderId] });
    return { id: tagId, tender_id: tenderId, tag_name: tagName, created_at: now };
}

async function removeTag(tenderId, tagName) {
    const [rows] = await pool.execute(
        'SELECT id FROM tender_tags WHERE tender_id = ? AND tag_name = ?',
        [tenderId, tagName]
    );
    if (rows.length === 0) {
        throw new AppError('Tag not found', 404);
    }

    await pool.execute(
        'DELETE FROM tender_tags WHERE tender_id = ? AND tag_name = ?',
        [tenderId, tagName]
    );
    await require('./priority.service').refreshPriority({ ids: [tenderId] });
}

async function addComment(tenderId, userId, comment) {
    const [existing] = await pool.execute('SELECT id FROM tenders WHERE id = ?', [tenderId]);
    if (existing.length === 0) {
        throw new AppError('Tender not found', 404);
    }

    const commentId = uuidv4();
    const now = new Date();
    await pool.execute(
        'INSERT INTO tender_comments (id, tender_id, user_id, comment, created_at) VALUES (?, ?, ?, ?, ?)',
        [commentId, tenderId, userId, comment, now]
    );

    // Fetch user name
    const [userRows] = await pool.execute('SELECT full_name FROM users WHERE id = ?', [userId]);
    const userName = userRows.length > 0 ? userRows[0].full_name : '';

    return {
        id: commentId,
        tender_id: tenderId,
        user_id: userId,
        comment,
        user_name: userName,
        created_at: now,
    };
}

async function listDocuments(tenderId) {
    const [docs] = await pool.execute(
        'SELECT * FROM tender_documents WHERE tender_id = ?',
        [tenderId]
    );

    return docs.map(d => ({
        id: d.id,
        tender_id: d.tender_id,
        file_name: d.file_name,
        file_type: d.file_type,
        file_size: d.file_size,
        file_url: d.file_path,
        storage_key: d.storage_key,
        is_primary: d.is_primary ? true : false,
        ocr_status: d.ocr_status,
        created_at: d.created_at,
    }));
}

async function getTenderHistory(tenderId) {
    const [logs] = await pool.execute(
        `SELECT * FROM audit_logs WHERE entity_type = 'tender' AND entity_id = ? ORDER BY created_at DESC`,
        [tenderId]
    );
    return logs;
}
