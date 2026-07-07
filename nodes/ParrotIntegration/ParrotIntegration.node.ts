import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, jsonParse } from 'n8n-workflow';

const LEGACY_METADATA_KEYS = new Set([
	'workflow',
	'workflowId',
	'executionId',
	'user_id',
	'userId',
	'action',
]);

function buildCleanMetadata(source: IDataObject): IDataObject {
	const clean: IDataObject = { ...source };
	for (const key of LEGACY_METADATA_KEYS) {
		delete clean[key];
	}
	return clean;
}

function asJsonObject(payload: IDataObject | Record<string, unknown>): JsonObject {
	return payload as unknown as JsonObject;
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
] as const;

function buildCleanUserData(source: IDataObject): IDataObject {
	const clean: IDataObject = { ...source };
	for (const key of PARROT_OUTPUT_STRIP_KEYS) {
		delete clean[key];
	}
	return clean;
}

export class ParrotIntegration implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Parrot Integration',
		name: 'parrotIntegration',
		icon: 'file:parrot.svg',
		group: ['transform'],
		version: 2,
		description:
			'High-performance session commander for Polycracker. Manages tier-aware routing and authentication for seamless API integration.',
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
				description:
					'Please insert the context or parameters of what you would like to see happen.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		if (items.length === 0) {
			return [returnData];
		}

		const firstItemIndex = 0;
		let missionLabel: string;
		let userContext: string;

		try {
			missionLabel = String(this.getNodeParameter('mission_label', firstItemIndex, '')).trim();
			userContext = String(this.getNodeParameter('userContext', firstItemIndex, '')).trim();

			if (!missionLabel) {
				throw new NodeApiError(this.getNode(), asJsonObject({ code: 'VALIDATION' }), {
					message: 'Mission Label is required.',
					itemIndex: firstItemIndex,
				});
			}
			if (!userContext) {
				throw new NodeApiError(this.getNode(), asJsonObject({ code: 'VALIDATION' }), {
					message: 'User Context is required.',
					itemIndex: firstItemIndex,
				});
			}

			const credentials = await this.getCredentials('parrotApi');
			const apiKey = String(credentials.apiKey ?? '');
			if (!apiKey) {
				throw new NodeApiError(this.getNode(), asJsonObject({ code: 'NO_API_KEY' }), {
					message: 'parrotApi credential must include an API Key.',
					itemIndex: firstItemIndex,
				});
			}

			const baseUrl = String(credentials.baseUrl ?? '').trim().replace(/\/$/, '');
			if (!baseUrl) {
				throw new NodeApiError(this.getNode(), asJsonObject({ code: 'NO_BASE_URL' }), {
					message: 'parrotApi credential must include API Base URL.',
					itemIndex: firstItemIndex,
				});
			}

			const userId = String(credentials.userId ?? '').trim() || 'n8n_user';
			const workflowId = this.getWorkflow().id ?? 'n8n_workflow';

			const highwayUrl = `${baseUrl}/highway/process`;

			const firstSourceJson = (items[firstItemIndex].json ?? {}) as IDataObject;
			const cleanMetadata = buildCleanMetadata(firstSourceJson);

			const goalStatement = userContext;
			const taskParam = 'extract';
			const tierParam = 'guided';

			let rawResponse: unknown;
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
			} catch (error) {
				const errorRecord =
					error !== null && typeof error === 'object'
						? (error as Record<string, unknown>)
						: undefined;
				const statusCode =
					typeof errorRecord?.statusCode === 'number'
						? errorRecord.statusCode
						: typeof errorRecord?.httpCode === 'number'
							? errorRecord.httpCode
							: undefined;
				const errorMessage =
					typeof errorRecord?.message === 'string'
						? errorRecord.message
						: error instanceof Error
							? error.message
							: String(error);

				if (statusCode === 401) {
					throw new NodeApiError(this.getNode(), asJsonObject(errorRecord ?? {}), {
						message: 'Invalid API Key. Please check your credentials.',
						itemIndex: firstItemIndex,
					});
				}

				if (statusCode === 402) {
					throw new NodeApiError(this.getNode(), asJsonObject(errorRecord ?? {}), {
						message: 'Out of Fuel. Please refill your Parrot compute credits to continue.',
						itemIndex: firstItemIndex,
					});
				}

				const lowerMessage = errorMessage.toLowerCase();
				const isTimeoutOrNetwork =
					lowerMessage.includes('timed out') ||
					lowerMessage.includes('timeout') ||
					lowerMessage.includes('etimedout') ||
					lowerMessage.includes('econnreset') ||
					lowerMessage.includes('econnrefused') ||
					lowerMessage.includes('enotfound') ||
					lowerMessage.includes('network') ||
					lowerMessage.includes('socket hang up');
				if (isTimeoutOrNetwork) {
					throw new NodeApiError(this.getNode(), asJsonObject(errorRecord ?? {}), {
						message:
							'The Parrot AI took too long to respond. Please check your Gateway connection.',
						itemIndex: firstItemIndex,
					});
				}

				const errObj =
					error !== null && typeof error === 'object'
						? asJsonObject(error as Record<string, unknown>)
						: asJsonObject({ message: String(error) });
				throw new NodeApiError(this.getNode(), errObj, {
					message:
						(typeof (error as Error)?.message === 'string' && (error as Error).message) ||
						'Highway process request failed. Check your API Base URL and network connectivity.',
					itemIndex: firstItemIndex,
				});
			}

			const parsed =
				typeof rawResponse === 'string'
					? (jsonParse(rawResponse) as IDataObject)
					: (rawResponse as IDataObject);
			const codeJwt = parsed.code_jwt;
			if (codeJwt === undefined || codeJwt === null || codeJwt === '') {
				throw new NodeApiError(this.getNode(), asJsonObject(parsed), {
					message: 'Highway process succeeded but response did not include code_jwt.',
					itemIndex: firstItemIndex,
				});
			}

			const instruction = parsed.instruction ?? null;
			const totalTasks = parsed.total_tasks ?? null;

			for (let i = 0; i < items.length; i++) {
				const sourceJson = (items[i].json ?? {}) as IDataObject;
				const userData = buildCleanUserData(sourceJson);
				const outputJson: IDataObject = {
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
		} catch (error) {
			if (error instanceof NodeApiError) {
				throw error;
			}
			const errObj =
				error !== null && typeof error === 'object'
					? asJsonObject(error as Record<string, unknown>)
					: asJsonObject({ message: String(error) });
			throw new NodeApiError(this.getNode(), errObj, {
				message: error instanceof Error ? error.message : String(error),
				itemIndex: firstItemIndex,
			});
		}

		return [returnData];
	}
}
