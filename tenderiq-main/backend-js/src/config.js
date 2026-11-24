"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function parseOrigins(raw) {
    if (!raw) return ['http://localhost:3000', 'http://localhost:5173'];
    const text = raw.trim();
    let list;
    try {
        list = text.startsWith('[') ? JSON.parse(text) : text.split(',');
    }
    catch {
        list = text.replace(/[\[\]"']/g, '').split(',');
    }
    // "https://site.app/" and "https://site.app" must both match the browser's Origin
    return list.map((o) => String(o).trim().replace(/\/+$/, '')).filter(Boolean);
}
exports.config = {
    database: {
        // Set DATABASE_URL in .env — never hard-code real credentials here.
        url: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/tenderiq',
    },
    jwt: {
        secret: process.env.JWT_SECRET_KEY || 'change-this-to-a-secure-random-string',
        algorithm: process.env.JWT_ALGORITHM || 'HS256',
        accessTokenExpireMinutes: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES || '30'),
        refreshTokenExpireDays: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRE_DAYS || '7'),
    },
    oauth: {
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
        microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    },
    llm: {
        provider: process.env.LLM_PROVIDER || 'claude',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        from: process.env.SMTP_FROM || 'noreply@tenderiq.com',
    },
    app: {
        name: process.env.APP_NAME || 'TenderIQ',
        url: process.env.APP_URL || 'http://localhost:3000',
        // CORS_ORIGINS: a JSON array or a comma-separated list of allowed site
        // addresses, e.g. https://tenderiq.vercel.app,http://localhost:5173
        corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
        port: parseInt(process.env.PORT || '8000'),
        debug: process.env.DEBUG === 'true',
    },
};
