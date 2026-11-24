"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const baseProvider_1 = require("./baseProvider");
const config_1 = require("../../config");
class OpenAIProvider extends baseProvider_1.BaseLLMProvider {
    client;
    constructor() {
        super();
        this.client = new openai_1.default({ apiKey: config_1.config.llm.openaiApiKey });
    }
    async extractTenderFields(text) {
        const prompt = this.buildExtractionPrompt(text);
        const response = await this.client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 4096,
        });
        const content = response.choices[0]?.message?.content;
        if (content)
            return this.parseLLMResponse(content);
        return {};
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openaiProvider.js.map