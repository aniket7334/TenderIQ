"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeProvider = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const baseProvider_1 = require("./baseProvider");
const config_1 = require("../../config");
class ClaudeProvider extends baseProvider_1.BaseLLMProvider {
    client;
    constructor() {
        super();
        this.client = new sdk_1.default({ apiKey: config_1.config.llm.anthropicApiKey });
    }
    async extractTenderFields(text) {
        const prompt = this.buildExtractionPrompt(text);
        const response = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
        const content = response.content[0];
        if (content.type === 'text') {
            return this.parseLLMResponse(content.text);
        }
        return {};
    }
}
exports.ClaudeProvider = ClaudeProvider;
//# sourceMappingURL=claudeProvider.js.map