"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParrotGate = void 0;
const n8n_workflow_1 = require("n8n-workflow");
function asJsonObject(payload) {
    return payload;
}
function normalizeApiBaseUrl(raw) {
    return String(raw !== null && raw !== void 0 ? raw : '').trim().replace(/\/$/, '');
}
class ParrotGate {
    constructor() {
        this.description = {
            displayName: 'Parrot Gate',
            name: 'parrotGate',
            icon: {
                light: 'file:parrot-green.svg',
                dark: 'file:parrot-green.dark.svg',
            },
            group: ['transform'],
            version: 2,
            subtitle: '={{$parameter["action"]}}',
            description: 'Standalone privacy gateway tool. Use this to heal schemas, scrub PII, and sanitize raw text or JSON payloads instantly.',
            defaults: {
                name: 'Parrot Gate',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            usableAsTool: true,
            credentials: [
                {
                    name: 'parrotApi',
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: 'First time? <a href="https://portal.polycracker.dev/dashboard?action=register" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-weight:700;text-decoration:underline">Register for Parrot Gate</a> to get your User ID and API Key, then add them to your <strong>Parrot API</strong> credential.',
                    name: 'registerNotice',
                    type: 'notice',
                    typeOptions: {
                        clickable: true,
                    },
                    default: '',
                },
                {
                    displayName: '**Parrot Gate Quick Start:**\n1. Configure your **Parrot API** credential (Base URL, API Key, User ID).\n2. Select your **Action** (The AI&apos;s job).\n3. Set a **Privacy Guardrail** (Target Schema) if required.\n4. Map your **Payload** (or leave blank to auto-process incoming data).',
                    name: 'quickStartNotice',
                    type: 'notice',
                    default: '',
                },
                {
                    displayName: 'Action',
                    name: 'action',
                    type: 'options',
                    noDataExpression: true,
                    description: 'Select the specific cleaning or validation operation to perform on the payload.',
                    options: [
                        {
                            name: 'Audit Logs (Quick Look)',
                            value: 'audit',
                            description: 'Fetches processing history logs without altering the payload.',
                        },
                        {
                            name: 'Basic Processing (Chirp)',
                            value: 'chirp',
                            description: 'Executes basic gateway processing on the payload.',
                        },
                        {
                            name: 'Custom Alchemist (Advanced)',
                            value: 'alchemist',
                            description: 'Executes advanced, custom processing logic on the backend.',
                        },
                        {
                            name: 'Data Architect (Heal)',
                            value: 'architect',
                            description: 'Heals the payload schema to repair broken or malformed data structures.',
                        },
                        {
                            name: 'Integrity Master (Heal + Scrub)',
                            value: 'master',
                            description: 'Performs a combined operation to both heal the schema and scrub PII from the payload.',
                        },
                        {
                            name: 'Privacy Scout (Scrub)',
                            value: 'scout',
                            description: 'Performs privacy scrubbing to remove sensitive PII from the payload.',
                        },
                        {
                            name: 'Validation Sentry',
                            value: 'sentry',
                            description: 'Validates the payload strictly against the selected target schema.',
                        },
                    ],
                    default: 'chirp',
                },
                {
                    displayName: 'Payload',
                    name: 'payload',
                    type: 'string',
                    default: '',
                    displayOptions: {
                        hide: {
                            action: ['audit'],
                        },
                    },
                    description: 'The raw JSON or text data that needs to be scrubbed, healed, or validated. Inject the messy data here.',
                },
                {
                    displayName: 'Privacy Guardrail',
                    name: 'target_schema',
                    type: 'options',
                    displayOptions: {
                        hide: {
                            action: ['audit'],
                        },
                    },
                    description: 'Select the specific data integrity profile to apply.',
                    options: [
                        {
                            name: 'E-Commerce Security (Total + SKU)',
                            value: 'ecommerce',
                            description: 'Applies validation rules tailored for total amounts and SKUs.',
                        },
                        {
                            name: 'Enterprise Standard (Strict Validation)',
                            value: 'strict',
                            description: 'Applies the strict enterprise validation profile.',
                        },
                        {
                            name: 'Financial Audit (Amount + Vendor)',
                            value: 'invoices',
                            description: 'Applies validation rules tailored for financial amounts and vendor data.',
                        },
                        {
                            name: 'HR Compliance (Salary + Role)',
                            value: 'hr',
                            description: 'Applies compliance rules tailored for salary and role data.',
                        },
                        {
                            name: 'Lead Protection (Name + Email)',
                            value: 'leads',
                            description: 'Applies protection rules tailored for names and emails.',
                        },
                        {
                            name: 'None (Manual Mode)',
                            value: 'manual',
                            description: 'Applies no preset profile; uses manual mode or a custom JSON schema.',
                        },
                        {
                            name: 'Support Optimization (Priority)',
                            value: 'support',
                            description: 'Applies validation rules tailored for support priority data.',
                        },
                    ],
                    default: 'manual',
                },
                {
                    displayName: 'Custom JSON Schema',
                    name: 'custom_schema',
                    type: 'string',
                    displayOptions: {
                        show: {
                            target_schema: ['manual'],
                        },
                        hide: {
                            action: ['audit'],
                        },
                    },
                    default: '',
                    description: 'Define custom validation parameters in JSON format',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('parrotApi');
        const baseUrl = normalizeApiBaseUrl(credentials.baseUrl);
        if (!baseUrl) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Parrot API credentials must include API Base URL.');
        }
        const apiKey = String((_a = credentials.apiKey) !== null && _a !== void 0 ? _a : '').trim();
        if (!apiKey) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'A valid Parrot API Key is required. Please add it to your node credentials.');
        }
        const userId = String((_b = credentials.userId) !== null && _b !== void 0 ? _b : '').trim() || 'n8n_user';
        for (let i = 0; i < items.length; i++) {
            try {
                const action = this.getNodeParameter('action', i);
                const sentryPreset = this.getNodeParameter('target_schema', i, 'manual');
                const customSchema = this.getNodeParameter('custom_schema', i, '');
                let payload = this.getNodeParameter('payload', i, '');
                const isAudit = action === 'audit';
                const finalUrl = isAudit
                    ? `${baseUrl}/parrot-gate/history?user_id=${userId}`
                    : `${baseUrl}/parrot-gate/use_api`;
                if (!payload || payload === '') {
                    payload = items[i].json;
                }
                let finalSchema = sentryPreset;
                if (sentryPreset === 'manual' && customSchema !== '') {
                    try {
                        finalSchema = JSON.parse(customSchema);
                    }
                    catch {
                        finalSchema = customSchema;
                    }
                }
                const body = {
                    user_id: userId,
                    api_key: apiKey,
                    action: action,
                    payload: payload,
                    target_schema: finalSchema,
                };
                const options = isAudit
                    ? {
                        method: 'GET',
                        url: finalUrl,
                        json: true,
                    }
                    : {
                        method: 'POST',
                        url: finalUrl,
                        body,
                        json: true,
                    };
                let responseData = (await this.helpers.httpRequestWithAuthentication.call(this, 'parrotApi', options));
                if (!isAudit && (responseData === null || responseData === void 0 ? void 0 : responseData.status) === 'success' && (responseData === null || responseData === void 0 ? void 0 : responseData.data) !== undefined) {
                    responseData = responseData.data;
                }
                if (responseData.status === 'error') {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Parrot Gate Denied: ${String((_c = responseData.message) !== null && _c !== void 0 ? _c : 'Unknown error')}`, { itemIndex: i });
                }
                returnData.push({ json: responseData, pairedItem: { item: i } });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    const message = error instanceof Error ? error.message : String(error);
                    returnData.push({ json: { error: message }, pairedItem: { item: i } });
                    continue;
                }
                throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject(error !== null && typeof error === 'object'
                    ? error
                    : { message: String(error) }), {
                    message: error instanceof Error ? error.message : String(error),
                    itemIndex: i,
                });
            }
        }
        return [returnData];
    }
}
exports.ParrotGate = ParrotGate;
//# sourceMappingURL=ParrotGate.node.js.map