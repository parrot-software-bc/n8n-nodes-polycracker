import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

function normalizeApiBaseUrl(raw: unknown): string {
    const base = String(raw ?? '').trim().replace(/\/$/, '');
    if (!base) {
        throw new Error('Parrot API credentials must include API Base URL.');
    }
    return base;
}

export class ParrotGate implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Parrot Gate',
        name: 'parrotGate',
        icon: 'file:parrot-green.svg',
        group: ['transform'],
        version: 1,
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
                displayName:
                    'First time? <a href="https://portal.polycracker.dev/dashboard?action=register" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-weight:700;text-decoration:underline">Register for Parrot Gate</a> to get your User ID and API Key.',
                name: 'registerNotice',
                type: 'notice',
                typeOptions: {
                    clickable: true,
                },
                default: '',
            },
            {
                displayName:
                    '📖 **Parrot Gate Quick Start:**\n1. Select your **Action** (The AI&apos;s job).\n2. Set a **Privacy Guardrail** (Target Schema) if required.\n3. Map your **Payload** (or leave blank to auto-process incoming data).',
                name: 'quickStartNotice',
                type: 'notice',
                default: '',
            },
            {
                displayName: 'User ID',
                name: 'user_id',
                type: 'string',
                default: '',
                required: true,
                description: 'Your Parrot Gate user id (required when you run this node)',
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

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const credentials = await this.getCredentials('parrotApi');
        const baseUrl = normalizeApiBaseUrl(credentials.baseUrl);
        const apiKey = String(credentials.apiKey ?? '').trim();
        if (!apiKey) {
            throw new NodeOperationError(
                this.getNode(),
                'A valid Parrot API Key is required. Please add it to your node credentials.',
            );
        }

        for (let i = 0; i < items.length; i++) {
            try {
                const row = items[i].json as IDataObject;
                const userId =
                    (typeof row.user_id === 'string' && row.user_id) ||
                    (typeof row.userId === 'string' && row.userId) ||
                    (this.getNodeParameter('user_id', i) as string);
                const action = this.getNodeParameter('action', i) as string;
                const sentryPreset = this.getNodeParameter('target_schema', i, 'manual') as string;
                const customSchema = this.getNodeParameter('custom_schema', i, '') as string;
                let payload = this.getNodeParameter('payload', i, '') as any;

                const isAudit = action === 'audit';
                const finalUrl = isAudit
                    ? `${baseUrl}/parrot-gate/history?user_id=${userId}`
                    : `${baseUrl}/parrot-gate/use_api`;

                if (!payload || payload === '') {
                    payload = items[i].json;
                }

                let finalSchema: any = sentryPreset;
                if (sentryPreset === 'manual' && customSchema !== '') {
                    try {
                        finalSchema = JSON.parse(customSchema);
                    } catch (e) {
                        finalSchema = customSchema;
                    }
                }

                const body: IDataObject = {
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

                let responseData = await this.helpers.request!(options as any);

                if (!isAudit && responseData?.status === 'success' && responseData?.data !== undefined) {
                    responseData = responseData.data;
                }

                if (responseData.status === 'error') {
                    throw new Error(`Parrot Gate Denied: ${responseData.message}`);
                }

                returnData.push({ json: responseData as IDataObject });

            } catch (error) {
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
