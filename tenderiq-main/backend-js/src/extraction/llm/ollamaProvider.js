"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const baseProvider_1 = require("./baseProvider");
const config_1 = require("../../config");
class OllamaProvider extends baseProvider_1.BaseLLMProvider {
    baseUrl;
    constructor() {
        super();
        this.baseUrl = config_1.config.llm.ollamaBaseUrl;
    }
    async extractTenderFields(text) {
        const prompt = this.buildExtractionPrompt(text);
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/generate`, {
                model: 'llama3',
                prompt,
                stream: false,
                format: 'json',
            }, { timeout: 120000 });
            if (response.data?.response) {
                return this.parseLLMResponse(response.data.response);
            }
        }
        catch (err) {
            console.error('Ollama extraction failed:', err);
        }
        return {};
    }
}
exports.OllamaProvider = OllamaProvider;
//# sourceMappingURL=ollamaProvider.js.map