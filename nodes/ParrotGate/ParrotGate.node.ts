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
			'Standalone privacy gateway tool. Use this to heal schemas, scrub PII, and sanitize raw text or JSON payloads instantly.',
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
						description:
							'Performs a combined operation to both heal the schema and scrub PII from the payload.',
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
				description:
					'The raw JSON or text data that needs to be scrubbed, healed, or validated. Inject the messy data here.',
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
