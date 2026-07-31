"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parrot = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const helpers_1 = require("./helpers");
async function executeGate(context, items, returnData, baseUrl, userId) {
    var _a;
    for (let i = 0; i < items.length; i++) {
        try {
            const operation = context.getNodeParameter('operation', i);
            const sentryPreset = context.getNodeParameter('target_schema', i, 'manual');
            const customSchema = context.getNodeParameter('custom_schema', i, '');
            let payload = context.getNodeParameter('payload', i, '');
            const isAudit = operation === 'audit';
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
                action: operation,
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
            let responseData = (await context.helpers.httpRequestWithAuthentication.call(context, 'parrotApi', options));
            if (!isAudit && (responseData === null || responseData === void 0 ? void 0 : responseData.status) === 'success' && (responseData === null || responseData === void 0 ? void 0 : responseData.data) !== undefined) {
                responseData = responseData.data;
            }
            if (responseData.status === 'error') {
                throw new n8n_workflow_1.NodeOperationError(context.getNode(), `Parrot Gate Denied: ${String((_a = responseData.message) !== null && _a !== void 0 ? _a : 'Unknown error')}`, { itemIndex: i });
            }
            returnData.push({ json: responseData, pairedItem: { item: i } });
        }
        catch (error) {
            if (context.continueOnFail()) {
                const message = error instanceof Error ? error.message : String(error);
                returnData.push({ json: { error: message }, pairedItem: { item: i } });
                continue;
            }
            throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)(error !== null && typeof error === 'object'
                ? error
                : { message: String(error) }), {
                message: error instanceof Error ? error.message : String(error),
                itemIndex: i,
            });
        }
    }
    return [returnData];
}
async function executeIntegration(context, items, returnData, baseUrl, userId) {
    var _a, _b, _c, _d, _e;
    if (items.length === 0) {
        return [returnData];
    }
    const firstItemIndex = 0;
    const missionLabel = String(context.getNodeParameter('mission_label', firstItemIndex, '')).trim();
    const userContext = String(context.getNodeParameter('userContext', firstItemIndex, '')).trim();
    if (!missionLabel) {
        throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)({ code: 'VALIDATION' }), {
            message: 'Mission Label is required.',
            itemIndex: firstItemIndex,
        });
    }
    if (!userContext) {
        throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)({ code: 'VALIDATION' }), {
            message: 'User Context is required.',
            itemIndex: firstItemIndex,
        });
    }
    const workflowId = (_a = context.getWorkflow().id) !== null && _a !== void 0 ? _a : 'n8n_workflow';
    const highwayUrl = `${baseUrl}/highway/process`;
    const firstSourceJson = ((_b = items[firstItemIndex].json) !== null && _b !== void 0 ? _b : {});
    const cleanMetadata = (0, helpers_1.buildCleanMetadata)(firstSourceJson);
    let rawResponse;
    try {
        rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'parrotApi', {
            method: 'POST',
            url: highwayUrl,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: {
                user_id: userId,
                workflow_id: workflowId,
                goal_statement: userContext,
                task: 'extract',
                tier: 'guided',
                payload: cleanMetadata,
            },
            json: true,
        });
    }
    catch (error) {
        const errorRecord = error !== null && typeof error === 'object' ? error : undefined;
        const statusCode = (0, helpers_1.extractHttpStatusCode)(error);
        const errorMessage = typeof (errorRecord === null || errorRecord === void 0 ? void 0 : errorRecord.message) === 'string'
            ? errorRecord.message
            : error instanceof Error
                ? error.message
                : String(error);
        if (statusCode === 401) {
            throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)(errorRecord !== null && errorRecord !== void 0 ? errorRecord : {}), {
                message: 'Invalid API Key. Please check your credentials.',
                itemIndex: firstItemIndex,
            });
        }
        if (statusCode === 402) {
            throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)(errorRecord !== null && errorRecord !== void 0 ? errorRecord : {}), {
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
            throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)(errorRecord !== null && errorRecord !== void 0 ? errorRecord : {}), {
                message: 'The Parrot AI took too long to respond. Please check your Gateway connection.',
                itemIndex: firstItemIndex,
            });
        }
        const errObj = error !== null && typeof error === 'object'
            ? (0, helpers_1.asJsonObject)(error)
            : (0, helpers_1.asJsonObject)({ message: String(error) });
        throw new n8n_workflow_1.NodeApiError(context.getNode(), errObj, {
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
        throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)(parsed), {
            message: 'Highway process succeeded but response did not include code_jwt.',
            itemIndex: firstItemIndex,
        });
    }
    const instruction = (_c = parsed.instruction) !== null && _c !== void 0 ? _c : null;
    const totalTasks = (_d = parsed.total_tasks) !== null && _d !== void 0 ? _d : null;
    for (let i = 0; i < items.length; i++) {
        const sourceJson = ((_e = items[i].json) !== null && _e !== void 0 ? _e : {});
        const userData = (0, helpers_1.buildCleanUserData)(sourceJson);
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
    return [returnData];
}
async function executeSmart(context, items, returnData, baseUrl, userId) {
    var _a, _b, _c, _d, _e, _f;
    const smartHitUrl = (0, helpers_1.normalizeParrotGateUrlForIpv6)(`${baseUrl}/highway/smart-hit`);
    const workflowId = (_a = context.getWorkflow().id) !== null && _a !== void 0 ? _a : 'n8n_workflow';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const tier = context.getNodeParameter('tier', i);
        const model = tier === helpers_1.TIER_GUIDED
            ? context.getNodeParameter('guided_model', i, 'gpt-4o-mini')
            : context.getNodeParameter('chameleon_model', i, 'gpt-4o');
        const useVault = context.getNodeParameter('useVault', i, false);
        const productionVault = String(context.getNodeParameter('productionVault', i, 'primary')).trim();
        let taskValue = '';
        let overrideContext = false;
        let guidedInstruction = '';
        if (tier === helpers_1.TIER_GUIDED) {
            taskValue = context.getNodeParameter('task', i);
            overrideContext = context.getNodeParameter('overrideContext', i, false);
            guidedInstruction = String(context.getNodeParameter('guidedInstruction', i, '')).trim();
        }
        const incomingJson = item.json;
        const rawCodeJwt = incomingJson.code_jwt;
        const sequenceJwt = rawCodeJwt === undefined || rawCodeJwt === null ? '' : String(rawCodeJwt).trim();
        if (!sequenceJwt) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'code_jwt is required: run Parrot Integration (or upstream node) to provide the sequence baton before Parrot Smart.', { itemIndex: i });
        }
        const apiPayloadData = { ...incomingJson };
        if (tier === helpers_1.TIER_GUIDED) {
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
            rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'parrotApi', {
                method: 'POST',
                url: smartHitUrl,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: smartHitBody,
                json: true,
            });
        }
        catch (error) {
            const statusCode = (0, helpers_1.extractHttpStatusCode)(error);
            if (statusCode === 403) {
                throw new n8n_workflow_1.NodeApiError(context.getNode(), (0, helpers_1.asJsonObject)(error !== null && typeof error === 'object'
                    ? error
                    : { code: 'TIER_UPGRADE_REQUIRED' }), {
                    message: 'Tier Upgrade Required',
                    description: 'This model is reserved for Apex and Enterprise tiers.',
                    itemIndex: i,
                });
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `Highway smart-hit request failed: ${message}`, {
                itemIndex: i,
            });
        }
        const body = typeof rawResponse === 'string' ? (0, n8n_workflow_1.jsonParse)(rawResponse) : rawResponse;
        if (tier === helpers_1.TIER_CHAMELEON) {
            const integrityMessage = (0, helpers_1.extractSmartPlusIntegrityMessage)(body);
            if (integrityMessage !== undefined) {
                throw new n8n_workflow_1.NodeOperationError(context.getNode(), `Logic Integrity Warning: ${integrityMessage}`, { itemIndex: i });
            }
        }
        const responseBody = (0, helpers_1.isRecord)(body) ? body : {};
        const userData = (0, helpers_1.buildCleanUserData)(incomingJson);
        const outputJson = {
            ...userData,
            code_jwt: (_b = responseBody.code_jwt) !== null && _b !== void 0 ? _b : null,
            instruction: (_c = responseBody.instruction) !== null && _c !== void 0 ? _c : null,
            task_index: (_d = responseBody.task_index) !== null && _d !== void 0 ? _d : null,
            total_tasks: (_e = responseBody.total_tasks) !== null && _e !== void 0 ? _e : null,
            finished: (_f = responseBody.finished) !== null && _f !== void 0 ? _f : null,
            model,
        };
        returnData.push({
            json: outputJson,
            pairedItem: { item: i },
        });
    }
    return [returnData];
}
class Parrot {
    constructor() {
        this.description = {
            displayName: 'Parrot',
            name: 'parrot',
            icon: {
                light: 'file:parrot-green.svg',
                dark: 'file:parrot-green.dark.svg',
            },
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
            description: 'Polycracker AI orchestration: privacy gateway, mission integration, and smart processing in one node.',
            defaults: {
                name: 'Parrot',
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
                    displayName: 'First time? <a href="https://portal.polycracker.dev/dashboard?action=register" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-weight:700;text-decoration:underline">Register for Parrot</a> to get your User ID and API Key, then add them to your <strong>Parrot API</strong> credential.',
                    name: 'registerNotice',
                    type: 'notice',
                    typeOptions: {
                        clickable: true,
                    },
                    default: '',
                },
                {
                    displayName: 'Resource',
                    name: 'resource',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Parrot Gate',
                            value: 'parrotGate',
                        },
                        {
                            name: 'Parrot Integration',
                            value: 'parrotIntegration',
                        },
                        {
                            name: 'Parrot Smart',
                            value: 'parrotSmart',
                        },
                    ],
                    default: 'parrotGate',
                },
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['parrotGate'],
                        },
                    },
                    options: [
                        {
                            name: 'Audit Logs (Quick Look)',
                            value: 'audit',
                            action: 'Fetches processing history logs without altering the payload',
                            description: 'Fetches processing history logs without altering the payload',
                        },
                        {
                            name: 'Basic Processing (Chirp)',
                            value: 'chirp',
                            action: 'Executes basic gateway processing on the payload',
                            description: 'Executes basic gateway processing on the payload',
                        },
                        {
                            name: 'Custom Alchemist (Advanced)',
                            value: 'alchemist',
                            action: 'Execute advanced custom processing logic on the backend',
                            description: 'Execute advanced custom processing logic on the backend',
                        },
                        {
                            name: 'Data Architect (Heal)',
                            value: 'architect',
                            action: 'Heals the payload schema to repair broken or malformed data structures',
                            description: 'Heals the payload schema to repair broken or malformed data structures',
                        },
                        {
                            name: 'Integrity Master (Heal + Scrub)',
                            value: 'master',
                            action: 'Performs a combined operation to both heal the schema and scrub PII from the payload',
                            description: 'Performs a combined operation to both heal the schema and scrub PII from the payload',
                        },
                        {
                            name: 'Privacy Scout (Scrub)',
                            value: 'scout',
                            action: 'Performs privacy scrubbing to remove sensitive PII from the payload',
                            description: 'Performs privacy scrubbing to remove sensitive PII from the payload',
                        },
                        {
                            name: 'Validation Sentry',
                            value: 'sentry',
                            action: 'Validates the payload strictly against the selected target schema',
                            description: 'Validates the payload strictly against the selected target schema',
                        },
                    ],
                    default: 'chirp',
                },
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['parrotIntegration'],
                        },
                    },
                    options: [
                        {
                            name: 'Process Mission',
                            value: 'process',
                            action: 'Initialize a Polycracker mission and generate the code_jwt baton',
                            description: 'Initialize a Polycracker mission and generate the code_jwt baton',
                        },
                    ],
                    default: 'process',
                },
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                        },
                    },
                    options: [
                        {
                            name: 'Execute',
                            value: 'execute',
                            action: 'Execute advanced AI data processing with a code_jwt baton',
                            description: 'Execute advanced AI data processing with a code_jwt baton',
                        },
                    ],
                    default: 'execute',
                },
                {
                    displayName: '**Parrot Gate Quick Start:**\n1. Configure your **Parrot API** credential (Base URL, API Key, User ID).\n2. Select your **Operation** (The AI&apos;s job).\n3. Set a **Privacy Guardrail** (Target Schema) if required.\n4. Map your **Payload** (or leave blank to auto-process incoming data).',
                    name: 'gateQuickStartNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['parrotGate'],
                        },
                    },
                },
                {
                    displayName: 'Payload',
                    name: 'payload',
                    type: 'string',
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['parrotGate'],
                        },
                        hide: {
                            operation: ['audit'],
                        },
                    },
                    description: 'The raw JSON or text data that needs to be scrubbed, healed, or validated. Inject the messy data here.',
                },
                {
                    displayName: 'Privacy Guardrail',
                    name: 'target_schema',
                    type: 'options',
                    displayOptions: {
                        show: {
                            resource: ['parrotGate'],
                        },
                        hide: {
                            operation: ['audit'],
                        },
                    },
                    description: 'Select the specific data integrity profile to apply',
                    options: [
                        {
                            name: 'E-Commerce Security (Total + SKU)',
                            value: 'ecommerce',
                            description: 'Applies validation rules tailored for total amounts and SKUs',
                        },
                        {
                            name: 'Enterprise Standard (Strict Validation)',
                            value: 'strict',
                            description: 'Applies the strict enterprise validation profile',
                        },
                        {
                            name: 'Financial Audit (Amount + Vendor)',
                            value: 'invoices',
                            description: 'Applies validation rules tailored for financial amounts and vendor data',
                        },
                        {
                            name: 'HR Compliance (Salary + Role)',
                            value: 'hr',
                            description: 'Applies compliance rules tailored for salary and role data',
                        },
                        {
                            name: 'Lead Protection (Name + Email)',
                            value: 'leads',
                            description: 'Applies protection rules tailored for names and emails',
                        },
                        {
                            name: 'None (Manual Mode)',
                            value: 'manual',
                            description: 'Applies no preset profile; uses manual mode or a custom JSON schema',
                        },
                        {
                            name: 'Support Optimization (Priority)',
                            value: 'support',
                            description: 'Applies validation rules tailored for support priority data',
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
                            resource: ['parrotGate'],
                            target_schema: ['manual'],
                        },
                        hide: {
                            operation: ['audit'],
                        },
                    },
                    default: '',
                    description: 'Define custom validation parameters in JSON format',
                },
                {
                    displayName: 'Mission Label',
                    name: 'mission_label',
                    type: 'string',
                    default: 'General_Park_Project',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['parrotIntegration'],
                            operation: ['process'],
                        },
                    },
                    description: 'A unique string label for the mission. Required to generate the authentication baton.',
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
                    displayOptions: {
                        show: {
                            resource: ['parrotIntegration'],
                            operation: ['process'],
                        },
                    },
                    description: 'The specific goal or instructions for this mission. Summarize what the user wants to achieve.',
                },
                {
                    displayName: 'Execution Path',
                    name: 'tier',
                    type: 'options',
                    noDataExpression: true,
                    default: helpers_1.TIER_GUIDED,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                        },
                    },
                    description: 'Select the processing tier to use for this task',
                    options: [
                        {
                            name: 'Guided (5c)',
                            value: 'guided',
                            description: 'Executes a predefined task type (like extraction or summarization) using the Guided API tier',
                        },
                        {
                            name: 'Chameleon (20c)',
                            value: 'chameleon',
                            description: 'Executes complex reasoning and dynamic logic integrity checks using the Chameleon API tier',
                        },
                    ],
                },
                {
                    displayName: 'Reasoning Engine',
                    name: 'guided_model',
                    type: 'options',
                    default: 'gpt-4o-mini',
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                            tier: ['guided'],
                        },
                    },
                    description: 'Select the specific LLM to use for the Guided tier',
                    options: [
                        {
                            name: 'GPT-4O-Mini (Included)',
                            value: 'gpt-4o-mini',
                            description: 'Standard included AI model for standard tasks',
                        },
                        {
                            name: 'Claude 3.5 Haiku (Apex/Enterprise Only)',
                            value: 'haiku',
                            description: 'High-speed enterprise AI model (Requires Apex/Enterprise tier)',
                        },
                    ],
                },
                {
                    displayName: 'Reasoning Engine',
                    name: 'chameleon_model',
                    type: 'options',
                    default: 'gpt-4o',
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                            tier: ['chameleon'],
                        },
                    },
                    description: 'Select the specific LLM to use for the Chameleon tier',
                    options: [
                        {
                            name: 'GPT-4O (Standard)',
                            value: 'gpt-4o',
                            description: 'Standard advanced reasoning model',
                        },
                        {
                            name: 'Claude 3.5 Sonnet (Apex/Enterprise Only)',
                            value: 'claude-3-5-sonnet',
                            description: 'Enterprise deep-reasoning model (Requires Apex/Enterprise tier)',
                        },
                    ],
                },
                {
                    displayName: 'Task',
                    name: 'task',
                    type: 'options',
                    default: 'extract',
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                            tier: ['guided'],
                        },
                    },
                    options: [
                        {
                            name: 'Content Generation (Draft Emails, Reports, or Messages)',
                            value: 'generate',
                            description: 'Drafts new content, emails, reports, or messages',
                        },
                        {
                            name: 'Data Extraction (Pull Clean JSON From Messy Text)',
                            value: 'extract',
                            description: 'Pulls clean JSON and structured data out of messy text',
                        },
                        {
                            name: 'Data Transformation (Reformat Data for the Next Step)',
                            value: 'transform',
                            description: 'Reformats the data structure for the next step in a pipeline',
                        },
                        {
                            name: 'Routing & Decision Logic (Output Categories or True/False)',
                            value: 'route',
                            description: 'Analyzes the payload to output categories or true/false routing decisions',
                        },
                        {
                            name: 'Summarize & Analyze (Create TL;DRs or Action Items)',
                            value: 'summarize',
                            description: 'Analyzes the payload to create concise TL;DRs or action items',
                        },
                    ],
                },
                {
                    displayName: 'Update User Context for This Step?',
                    name: 'overrideContext',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                            tier: ['guided'],
                        },
                    },
                    description: 'Whether to inject specific, overriding instructions for this processing step',
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
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                            tier: ['guided'],
                            overrideContext: [true],
                        },
                    },
                    description: 'The specific custom text instructions or constraints for the model to follow',
                },
                {
                    displayName: 'Enable Production Vault Memory',
                    name: 'useVault',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                        },
                    },
                    description: 'Whether to query the Port 8003 microservice to inject historical context fragments into the run loop to eliminate LLM amnesia',
                },
                {
                    displayName: 'Vault Label',
                    name: 'productionVault',
                    type: 'string',
                    default: 'primary',
                    displayOptions: {
                        show: {
                            resource: ['parrotSmart'],
                            operation: ['execute'],
                            useVault: [true],
                        },
                    },
                    description: 'The unique string identifier of the production vault used for memory and historical context injection',
                },
            ],
        };
    }
    async execute() {
        var _a;
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('parrotApi');
        const baseUrl = (0, helpers_1.normalizeApiBaseUrl)(credentials.baseUrl);
        if (!baseUrl) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Parrot API credentials must include API Base URL.');
        }
        const userId = String((_a = credentials.userId) !== null && _a !== void 0 ? _a : '').trim() || 'n8n_user';
        const resource = this.getNodeParameter('resource', 0);
        if (resource === 'parrotGate') {
            return executeGate(this, items, returnData, baseUrl, userId);
        }
        if (resource === 'parrotIntegration') {
            return executeIntegration(this, items, returnData, baseUrl, userId);
        }
        if (resource === 'parrotSmart') {
            return executeSmart(this, items, returnData, baseUrl, userId);
        }
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`);
    }
}
exports.Parrot = Parrot;
//# sourceMappingURL=ParrotGate.node.js.map