"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParrotSmart = void 0;
const n8n_workflow_1 = require("n8n-workflow");
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asJsonObject(payload) {
    return payload;
}
const PARROT_OUTPUT_STRIP_KEYS = [
    'parrot_string',
    'parrot_session_id',
    'session_id',
    'sessionId',
    'use_vault',
    'production_vault',
    'code_jwt',
    'instruction',
    'task_index',
    'total_tasks',
    'finished',
    'model',
];
function buildCleanUserData(source) {
    const clean = { ...source };
    for (const key of PARROT_OUTPUT_STRIP_KEYS) {
        delete clean[key];
    }
    return clean;
}
const TIER_GUIDED = 'guided';
const TIER_CHAMELEON = 'chameleon';
function normalizeParrotGateUrlForIpv6(url) {
    const trimmed = url.trim();
    const m = trimmed.match(/^(https?:\/\/)([^/]+)(.*)$/i);
    if (!m) {
        return trimmed;
    }
    const [, proto, hostPort, rest] = m;
    if (hostPort.startsWith('[')) {
        return trimmed;
    }
    const lastColon = hostPort.lastIndexOf(':');
    const tail = lastColon === -1 ? '' : hostPort.slice(lastColon + 1);
    const hasNumericPort = lastColon !== -1 && /^\d+$/.test(tail);
    const host = hasNumericPort ? hostPort.slice(0, lastColon) : hostPort;
    const colonSegments = host.split(':').length;
    const looksLikeIpv6 = host.includes(':') && colonSegments > 2;
    if (!looksLikeIpv6) {
        return trimmed;
    }
    const port = hasNumericPort ? tail : '';
    const bracketed = port ? `[${host}]:${port}` : `[${host}]`;
    return `${proto}${bracketed}${rest}`;
}
function extractSmartPlusIntegrityMessage(body) {
    if (body === null || body === undefined) {
        return undefined;
    }
    if (typeof body === 'string') {
        const lower = body.toLowerCase();
        if (lower.includes('logic error') || lower.includes('validation warning')) {
            return body;
        }
        return undefined;
    }
    if (!isRecord(body)) {
        return undefined;
    }
    const typeStr = typeof body.type === 'string' ? body.type : '';
    const errorStr = typeof body.error === 'string' ? body.error : '';
    const msg = (typeof body.message === 'string' && body.message) ||
        (typeof body.detail === 'string' && body.detail) ||
        undefined;
    if (typeStr === 'Logic Error' || errorStr === 'Logic Error') {
        return msg !== null && msg !== void 0 ? msg : 'Logic Error';
    }
    if (body.validationWarning === true || body.validation_warning === true) {
        return msg !== null && msg !== void 0 ? msg : 'Validation warning';
    }
    const warnings = body.warnings;
    if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings.map(String).join('; ');
    }
    if (msg !== undefined) {
        const lower = msg.toLowerCase();
        if (lower.includes('logic error') || lower.includes('validation warning')) {
            return msg;
        }
    }
    return undefined;
}
class ParrotSmart {
    constructor() {
        this.description = {
            displayName: 'Parrot Smart',
            name: 'parrotSmart',
            icon: 'file:parrot.svg',
            group: ['transform'],
            version: 2,
            description: 'Universal AI sequence engine. Choose Guided or Chameleon tiers to eliminate workflow spaghetti and manage session-bound AI data with Polycracker.',
            defaults: {
                name: 'Parrot Smart Node',
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
                    displayName: 'Tier',
                    name: 'tier',
                    type: 'options',
                    noDataExpression: true,
                    default: TIER_GUIDED,
                    required: true,
                    options: [
                        { name: 'Guided (5c)', value: 'guided' },
                        { name: 'Chameleon (20c)', value: 'chameleon' },
                    ],
                },
                {
                    displayName: 'Reasoning Engine',
                    name: 'model',
                    type: 'options',
                    default: 'gpt-4o',
                    options: [
                        { name: 'GPT-4o (Standard)', value: 'gpt-4o' },
                        { name: 'Claude 3.5 Sonnet (Apex/Enterprise)', value: 'claude-3-5-sonnet' },
                    ],
                },
                {
                    displayName: 'Task',
                    name: 'task',
                    type: 'options',
                    default: 'extract',
                    displayOptions: {
                        show: {
                            tier: ['guided'],
                        },
                    },
                    options: [
                        {
                            name: 'Data Extraction (Pull clean JSON from messy text)',
                            value: 'extract',
                        },
                        {
                            name: 'Data Transformation (Reformat data for the next step)',
                            value: 'transform',
                        },
                        {
                            name: 'Routing & Decision Logic (Output categories or True/False)',
                            value: 'route',
                        },
                        {
                            name: 'Summarize & Analyze (Create TL;DRs or action items)',
                            value: 'summarize',
                        },
                        {
                            name: 'Content Generation (Draft emails, reports, or messages)',
                            value: 'generate',
                        },
                    ],
                },
                {
                    displayName: 'Update User Context for this Step?',
                    name: 'overrideContext',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        show: {
                            tier: ['guided'],
                        },
                    },
                },
                {
                    displayName: 'New Context / Instructions',
                    name: 'guidedInstruction',
                    type: 'string',
                    default: '',
                    typeOptions: {
                        rows: 4,
                    },
                    displayOptions: {
                        show: {
                            tier: ['guided'],
                            overrideContext: [true],
                        },
                    },
                },
                {
                    displayName: 'Enable Production Vault Memory',
                    name: 'useVault',
                    type: 'boolean',
                    default: false,
                    description: 'When enabled, queries the Port 8003 microservice to inject historical context fragments into the run loop to eliminate LLM amnesia.',
                },
                {
                    displayName: 'Vault Label',
                    name: 'productionVault',
                    type: 'string',
                    default: 'primary',
                    displayOptions: {
                        show: {
                            useVault: [true],
                        },
                    },
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const credentials = await this.getCredentials('parrotApi');
        const apiKey = String((_a = credentials.apiKey) !== null && _a !== void 0 ? _a : '').trim();
        if (!apiKey) {
            throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject({ code: 'NO_API_KEY' }), {
                message: 'parrotApi credential must include an API Key.',
            });
        }
        const baseUrl = String((_b = credentials.baseUrl) !== null && _b !== void 0 ? _b : '').trim().replace(/\/$/, '');
        if (!baseUrl) {
            throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject({ code: 'NO_BASE_URL' }), {
                message: 'parrotApi credential must include API Base URL.',
            });
        }
        const smartHitUrl = normalizeParrotGateUrlForIpv6(`${baseUrl}/highway/smart-hit`);
        const userId = String((_c = credentials.userId) !== null && _c !== void 0 ? _c : '').trim() || 'n8n_user';
        const workflowId = (_d = this.getWorkflow().id) !== null && _d !== void 0 ? _d : 'n8n_workflow';
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const tier = this.getNodeParameter('tier', i);
            const model = this.getNodeParameter('model', i, 'gpt-4o');
            const useVault = this.getNodeParameter('useVault', i, false);
            const productionVault = String(this.getNodeParameter('productionVault', i, 'primary')).trim();
            let taskValue = '';
            let overrideContext = false;
            let guidedInstruction = '';
            if (tier === TIER_GUIDED) {
                taskValue = this.getNodeParameter('task', i);
                overrideContext = this.getNodeParameter('overrideContext', i, false);
                guidedInstruction = String(this.getNodeParameter('guidedInstruction', i, '')).trim();
            }
            const incomingJson = item.json;
            const rawCodeJwt = incomingJson.code_jwt;
            const sequenceJwt = rawCodeJwt === undefined || rawCodeJwt === null ? '' : String(rawCodeJwt).trim();
            if (!sequenceJwt) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'code_jwt is required: run Parrot Integration (or upstream node) to provide the sequence baton before Parrot Smart.', { itemIndex: i });
            }
            const apiPayloadData = { ...incomingJson };
            if (tier === TIER_GUIDED) {
                delete apiPayloadData.user_context;
                delete apiPayloadData.instruction;
                apiPayloadData.task = taskValue;
                if (overrideContext && guidedInstruction !== '') {
                    apiPayloadData.user_context = guidedInstruction;
                    apiPayloadData.instruction = guidedInstruction;
                }
            }
            apiPayloadData.model = model;
            apiPayloadData.use_vault = useVault;
            apiPayloadData.production_vault = productionVault;
            const smartHitBody = {
                sequence_jwt: sequenceJwt,
                tier,
                model,
                user_id: userId,
                workflow_id: workflowId,
                raw_input_payload: apiPayloadData,
            };
            let rawResponse;
            try {
                rawResponse = await this.helpers.request({
                    method: 'POST',
                    url: smartHitUrl,
                    headers: {
                        'X-API-Key': apiKey,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(smartHitBody),
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Highway smart-hit request failed: ${message}`, {
                    itemIndex: i,
                });
            }
            const body = typeof rawResponse === 'string' ? (0, n8n_workflow_1.jsonParse)(rawResponse) : rawResponse;
            if (tier === TIER_CHAMELEON) {
                const integrityMessage = extractSmartPlusIntegrityMessage(body);
                if (integrityMessage !== undefined) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Logic Integrity Warning: ${integrityMessage}`, { itemIndex: i });
                }
            }
            const responseBody = isRecord(body) ? body : {};
            const userData = buildCleanUserData(incomingJson);
            const outputJson = {
                ...userData,
                code_jwt: (_e = responseBody.code_jwt) !== null && _e !== void 0 ? _e : null,
                instruction: (_f = responseBody.instruction) !== null && _f !== void 0 ? _f : null,
                task_index: (_g = responseBody.task_index) !== null && _g !== void 0 ? _g : null,
                total_tasks: (_h = responseBody.total_tasks) !== null && _h !== void 0 ? _h : null,
                finished: (_j = responseBody.finished) !== null && _j !== void 0 ? _j : null,
                model,
            };
            returnData.push({
                json: outputJson,
                pairedItem: { item: i },
            });
        }
        return [returnData];
    }
}
exports.ParrotSmart = ParrotSmart;
//# sourceMappingURL=ParrotSmart.node.js.map