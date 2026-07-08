"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParrotGate = void 0;
const n8n_workflow_1 = require("n8n-workflow");
function normalizeApiBaseUrl(raw) {
    const base = String(raw !== null && raw !== void 0 ? raw : '').trim().replace(/\/$/, '');
    if (!base) {
        throw new Error('Parrot API credentials must include API Base URL.');
    }
    return base;
}
class ParrotGate {
    constructor() {
        this.description = {
            displayName: 'Parrot Gate',
            name: 'parrotGate',
            icon: 'file:parrot-green.svg',
            group: ['transform'],
            version: 2,
            description: 'Privacy-first gateway for Polycracker. Provides schema healing, data scrubbing, and secure API access.',
            defaults: {
                name: 'Parrot Gate',
            },
            inputs: ['main'],
            outputs: ['main'],
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
                    displayName: '📖 **Parrot Gate Quick Start:**\n1. Configure your **Parrot API** credential (Base URL, API Key, User ID).\n2. Select your **Action** (The AI&apos;s job).\n3. Set a **Privacy Guardrail** (Target Schema) if required.\n4. Map your **Payload** (or leave blank to auto-process incoming data).',
                    name: 'quickStartNotice',
                    type: 'notice',
                    default: '',
                },
                {
                    displayName: 'Action',
                    name: 'action',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        { name: 'Integrity Master (Heal + Scrub)', value: 'master' },
                        { name: 'Data Architect (Heal)', value: 'architect' },
                        { name: 'Custom Alchemist (Advanced)', value: 'alchemist' },
                        { name: 'Validation Sentry', value: 'sentry' },
                        { name: 'Privacy Scout (Scrub)', value: 'scout' },
                        { name: 'Basic Processing (Chirp)', value: 'chirp' },
                        { name: 'Audit Logs (Quick Look)', value: 'audit' },
                    ],
                    default: 'chirp',
                },
                {
                    displayName: 'Payload',
                    name: 'payload',
                    type: 'string',
                    default: '',
                    required: false,
                    displayOptions: {
                        hide: {
                            action: ['audit'],
                        },
                    },
                    description: 'Leave empty to process all incoming data',
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
                    options: [
                        { name: 'None (Manual Mode)', value: 'manual' },
                        { name: 'Lead Protection (Name + Email)', value: 'leads' },
                        { name: 'Financial Audit (Amount + Vendor)', value: 'invoices' },
                        { name: 'E-commerce Security (Total + SKU)', value: 'ecommerce' },
                        { name: 'HR Compliance (Salary + Role)', value: 'hr' },
                        { name: 'Support Optimization (Priority)', value: 'support' },
                        { name: 'Enterprise Standard (Strict Validation)', value: 'strict' },
                    ],
                    default: 'manual',
                    description: 'Select a pre-built data integrity profile',
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
        var _a, _b;
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('parrotApi');
        const baseUrl = normalizeApiBaseUrl(credentials.baseUrl);
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
                    catch (e) {
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
                        uri: finalUrl,
                        headers: {
                            'X-API-Key': apiKey,
                        },
                        json: true,
                    }
                    : {
                        method: 'POST',
                        uri: finalUrl,
                        body,
                        headers: {
                            'X-API-Key': apiKey,
                        },
                        json: true,
                    };
                let responseData = await this.helpers.request(options);
                if (!isAudit && (responseData === null || responseData === void 0 ? void 0 : responseData.status) === 'success' && (responseData === null || responseData === void 0 ? void 0 : responseData.data) !== undefined) {
                    responseData = responseData.data;
                }
                if (responseData.status === 'error') {
                    throw new Error(`Parrot Gate Denied: ${responseData.message}`);
                }
                returnData.push({ json: responseData });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    const message = error instanceof Error ? error.message : String(error);
                    returnData.push({ json: { error: message } });
                    continue;
                }
                throw error;
            }
        }
        return [returnData];
    }
}
exports.ParrotGate = ParrotGate;
//# sourceMappingURL=ParrotGate.node.js.map