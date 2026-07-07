"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParrotIntegration = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const LEGACY_METADATA_KEYS = new Set([
    'workflow',
    'workflowId',
    'executionId',
    'user_id',
    'userId',
    'action',
]);
function buildCleanMetadata(source) {
    const clean = { ...source };
    for (const key of LEGACY_METADATA_KEYS) {
        delete clean[key];
    }
    return clean;
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
class ParrotIntegration {
    constructor() {
        this.description = {
            displayName: 'Parrot Integration',
            name: 'parrotIntegration',
            icon: 'file:parrot.svg',
            group: ['transform'],
            version: 2,
            description: 'High-performance session commander for Polycracker. Manages tier-aware routing and authentication for seamless API integration.',
            defaults: { name: 'Parrot Integration' },
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
                    displayName: 'Mission Label',
                    name: 'mission_label',
                    type: 'string',
                    default: 'General_Park_Project',
                    required: true,
                },
                {
                    displayName: 'User Context',
                    name: 'userContext',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'e.g., Summarize the incoming data and format it as a bulleted list.',
                    typeOptions: {
                        rows: 6,
                    },
                    description: 'Please insert the context or parameters of what you would like to see happen.',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const items = this.getInputData();
        const returnData = [];
        if (items.length === 0) {
            return [returnData];
        }
        const firstItemIndex = 0;
        let missionLabel;
        let userContext;
        try {
            missionLabel = String(this.getNodeParameter('mission_label', firstItemIndex, '')).trim();
            userContext = String(this.getNodeParameter('userContext', firstItemIndex, '')).trim();
            if (!missionLabel) {
                throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject({ code: 'VALIDATION' }), {
                    message: 'Mission Label is required.',
                    itemIndex: firstItemIndex,
                });
            }
            if (!userContext) {
                throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject({ code: 'VALIDATION' }), {
                    message: 'User Context is required.',
                    itemIndex: firstItemIndex,
                });
            }
            const credentials = await this.getCredentials('parrotApi');
            const apiKey = String((_a = credentials.apiKey) !== null && _a !== void 0 ? _a : '');
            if (!apiKey) {
                throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject({ code: 'NO_API_KEY' }), {
                    message: 'parrotApi credential must include an API Key.',
                    itemIndex: firstItemIndex,
                });
            }
            const baseUrl = String((_b = credentials.baseUrl) !== null && _b !== void 0 ? _b : '').trim().replace(/\/$/, '');
            if (!baseUrl) {
                throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject({ code: 'NO_BASE_URL' }), {
                    message: 'parrotApi credential must include API Base URL.',
                    itemIndex: firstItemIndex,
                });
            }
            const userId = String((_c = credentials.userId) !== null && _c !== void 0 ? _c : '').trim() || 'n8n_user';
            const workflowId = (_d = this.getWorkflow().id) !== null && _d !== void 0 ? _d : 'n8n_workflow';
            const highwayUrl = `${baseUrl}/highway/process`;
            const firstSourceJson = ((_e = items[firstItemIndex].json) !== null && _e !== void 0 ? _e : {});
            const cleanMetadata = buildCleanMetadata(firstSourceJson);
            const goalStatement = userContext;
            const taskParam = 'extract';
            const tierParam = 'guided';
            let rawResponse;
            try {
                rawResponse = await this.helpers.request({
                    method: 'POST',
                    url: highwayUrl,
                    headers: {
                        'X-API-Key': apiKey,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: {
                        user_id: userId,
                        workflow_id: workflowId,
                        goal_statement: goalStatement,
                        task: taskParam,
                        tier: tierParam,
                        payload: cleanMetadata,
                    },
                    json: true,
                });
            }
            catch (error) {
                const errorRecord = error !== null && typeof error === 'object'
                    ? error
                    : undefined;
                const statusCode = typeof (errorRecord === null || errorRecord === void 0 ? void 0 : errorRecord.statusCode) === 'number'
                    ? errorRecord.statusCode
                    : typeof (errorRecord === null || errorRecord === void 0 ? void 0 : errorRecord.httpCode) === 'number'
                        ? errorRecord.httpCode
                        : undefined;
                const errorMessage = typeof (errorRecord === null || errorRecord === void 0 ? void 0 : errorRecord.message) === 'string'
                    ? errorRecord.message
                    : error instanceof Error
                        ? error.message
                        : String(error);
                if (statusCode === 401) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject(errorRecord !== null && errorRecord !== void 0 ? errorRecord : {}), {
                        message: 'Invalid API Key. Please check your credentials.',
                        itemIndex: firstItemIndex,
                    });
                }
                if (statusCode === 402) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject(errorRecord !== null && errorRecord !== void 0 ? errorRecord : {}), {
                        message: 'Out of Fuel. Please refill your Parrot compute credits to continue.',
                        itemIndex: firstItemIndex,
                    });
                }
                const lowerMessage = errorMessage.toLowerCase();
                const isTimeoutOrNetwork = lowerMessage.includes('timed out') ||
                    lowerMessage.includes('timeout') ||
                    lowerMessage.includes('etimedout') ||
                    lowerMessage.includes('econnreset') ||
                    lowerMessage.includes('econnrefused') ||
                    lowerMessage.includes('enotfound') ||
                    lowerMessage.includes('network') ||
                    lowerMessage.includes('socket hang up');
                if (isTimeoutOrNetwork) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject(errorRecord !== null && errorRecord !== void 0 ? errorRecord : {}), {
                        message: 'The Parrot AI took too long to respond. Please check your Gateway connection.',
                        itemIndex: firstItemIndex,
                    });
                }
                const errObj = error !== null && typeof error === 'object'
                    ? asJsonObject(error)
                    : asJsonObject({ message: String(error) });
                throw new n8n_workflow_1.NodeApiError(this.getNode(), errObj, {
                    message: (typeof (error === null || error === void 0 ? void 0 : error.message) === 'string' && error.message) ||
                        'Highway process request failed. Check your API Base URL and network connectivity.',
                    itemIndex: firstItemIndex,
                });
            }
            const parsed = typeof rawResponse === 'string'
                ? (0, n8n_workflow_1.jsonParse)(rawResponse)
                : rawResponse;
            const codeJwt = parsed.code_jwt;
            if (codeJwt === undefined || codeJwt === null || codeJwt === '') {
                throw new n8n_workflow_1.NodeApiError(this.getNode(), asJsonObject(parsed), {
                    message: 'Highway process succeeded but response did not include code_jwt.',
                    itemIndex: firstItemIndex,
                });
            }
            const instruction = (_f = parsed.instruction) !== null && _f !== void 0 ? _f : null;
            const totalTasks = (_g = parsed.total_tasks) !== null && _g !== void 0 ? _g : null;
            for (let i = 0; i < items.length; i++) {
                const sourceJson = ((_h = items[i].json) !== null && _h !== void 0 ? _h : {});
                const userData = buildCleanUserData(sourceJson);
                const outputJson = {
                    ...userData,
                    code_jwt: codeJwt,
                    instruction,
                    task_index: 0,
                    total_tasks: totalTasks,
                    finished: false,
                };
                returnData.push({
                    json: outputJson,
                    pairedItem: { item: i },
                });
            }
        }
        catch (error) {
            if (error instanceof n8n_workflow_1.NodeApiError) {
                throw error;
            }
            const errObj = error !== null && typeof error === 'object'
                ? asJsonObject(error)
                : asJsonObject({ message: String(error) });
            throw new n8n_workflow_1.NodeApiError(this.getNode(), errObj, {
                message: error instanceof Error ? error.message : String(error),
                itemIndex: firstItemIndex,
            });
        }
        return [returnData];
    }
}
exports.ParrotIntegration = ParrotIntegration;
//# sourceMappingURL=ParrotIntegration.node.js.map