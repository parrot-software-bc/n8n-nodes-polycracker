import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

function asJsonObject(payload: IDataObject | Record<string, unknown>): JsonObject {
	return payload as unknown as JsonObject;
}

function normalizeApiBaseUrl(raw: unknown): string {
	return String(raw ?? '').trim().replace(/\/$/, '');
}

export class ParrotGate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Parrot Gate',
		name: 'parrotGate',
		icon: {
			light: 'file:parrot-green.svg',
			dark: 'file:parrot-green.dark.svg',
		},
		group: ['transform'],
		version: 2,
		subtitle: '={{$parameter["action"]}}',
		description:
			'Privacy-first gateway for Polycracker. Provides schema healing, data scrubbing, and secure API access',
		defaults: {
			name: 'Parrot Gate',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'parrotApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'First time? <a href="https://portal.polycracker.dev/dashboard?action=register" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-weight:700;text-decoration:underline">Register for Parrot Gate</a> to get your User ID and API Key, then add them to your <strong>Parrot API</strong> credential.',
				name: 'registerNotice',
				type: 'notice',
				typeOptions: {
					clickable: true,
				},
				default: '',
			},
			{
				displayName:
					'**Parrot Gate Quick Start:**\n1. Configure your **Parrot API** credential (Base URL, API Key, User ID).\n2. Select your **Action** (The AI&apos;s job).\n3. Set a **Privacy Guardrail** (Target Schema) if required.\n4. Map your **Payload** (or leave blank to auto-process incoming data).',
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
					{ name: 'Audit Logs (Quick Look)', value: 'audit' },
					{ name: 'Basic Processing (Chirp)', value: 'chirp' },
					{ name: 'Custom Alchemist (Advanced)', value: 'alchemist' },
					{ name: 'Data Architect (Heal)', value: 'architect' },
					{ name: 'Integrity Master (Heal + Scrub)', value: 'master' },
					{ name: 'Privacy Scout (Scrub)', value: 'scout' },
					{ name: 'Validation Sentry', value: 'sentry' },
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
					{ name: 'E-Commerce Security (Total + SKU)', value: 'ecommerce' },
					{ name: 'Enterprise Standard (Strict Validation)', value: 'strict' },
					{ name: 'Financial Audit (Amount + Vendor)', value: 'invoices' },
					{ name: 'HR Compliance (Salary + Role)', value: 'hr' },
					{ name: 'Lead Protection (Name + Email)', value: 'leads' },
					{ name: 'None (Manual Mode)', value: 'manual' },
					{ name: 'Support Optimization (Priority)', value: 'support' },
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
		if (!baseUrl) {
			throw new NodeOperationError(
				this.getNode(),
				'Parrot API credentials must include API Base URL.',
			);
		}

		const apiKey = String(credentials.apiKey ?? '').trim();
		if (!apiKey) {
			throw new NodeOperationError(
				this.getNode(),
				'A valid Parrot API Key is required. Please add it to your node credentials.',
			);
		}

		const userId = String(credentials.userId ?? '').trim() || 'n8n_user';

		for (let i = 0; i < items.length; i++) {
			try {
				const action = this.getNodeParameter('action', i) as string;
				const sentryPreset = this.getNodeParameter('target_schema', i, 'manual') as string;
				const customSchema = this.getNodeParameter('custom_schema', i, '') as string;
				let payload = this.getNodeParameter('payload', i, '') as unknown;

				const isAudit = action === 'audit';
				const finalUrl = isAudit
					? `${baseUrl}/parrot-gate/history?user_id=${userId}`
					: `${baseUrl}/parrot-gate/use_api`;

				if (!payload || payload === '') {
					payload = items[i].json;
				}

				let finalSchema: unknown = sentryPreset;
				if (sentryPreset === 'manual' && customSchema !== '') {
					try {
						finalSchema = JSON.parse(customSchema);
					} catch {
						finalSchema = customSchema;
					}
				}

				const body: IDataObject = {
					user_id: userId,
					api_key: apiKey,
					action: action,
					payload: payload as IDataObject,
					target_schema: finalSchema as IDataObject,
				};

				const options = isAudit
					? {
							method: 'GET' as const,
							url: finalUrl,
							json: true,
						}
					: {
							method: 'POST' as const,
							url: finalUrl,
							body,
							json: true,
						};

				let responseData = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'parrotApi',
					options,
				)) as IDataObject;

				if (!isAudit && responseData?.status === 'success' && responseData?.data !== undefined) {
					responseData = responseData.data as IDataObject;
				}

				if (responseData.status === 'error') {
					throw new NodeOperationError(
						this.getNode(),
						`Parrot Gate Denied: ${String(responseData.message ?? 'Unknown error')}`,
						{ itemIndex: i },
					);
				}

				returnData.push({ json: responseData, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					const message = error instanceof Error ? error.message : String(error);
					returnData.push({ json: { error: message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(
					this.getNode(),
					asJsonObject(
						error !== null && typeof error === 'object'
							? (error as Record<string, unknown>)
							: { message: String(error) },
					),
					{
						message: error instanceof Error ? error.message : String(error),
						itemIndex: i,
					},
				);
			}
		}
		return [returnData];
	}
}
