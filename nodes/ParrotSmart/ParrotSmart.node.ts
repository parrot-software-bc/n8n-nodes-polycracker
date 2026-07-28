import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, jsonParse } from 'n8n-workflow';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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

const TIER_GUIDED = 'guided' as const;
const TIER_CHAMELEON = 'chameleon' as const;

type TierParam = typeof TIER_GUIDED | typeof TIER_CHAMELEON;

/**
 * Ensures literal IPv6 appears in bracket form before the port (`http://[addr]:port/...`).
 */
function normalizeParrotGateUrlForIpv6(url: string): string {
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

function extractSmartPlusIntegrityMessage(body: unknown): string | undefined {
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
	const msg =
		(typeof body.message === 'string' && body.message) ||
		(typeof body.detail === 'string' && body.detail) ||
		undefined;

	if (typeStr === 'Logic Error' || errorStr === 'Logic Error') {
		return msg ?? 'Logic Error';
	}
	if (body.validationWarning === true || body.validation_warning === true) {
		return msg ?? 'Validation warning';
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

function extractHttpStatusCode(error: unknown): number | undefined {
	const errorRecord =
		error !== null && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
	if (typeof errorRecord?.statusCode === 'number') {
		return errorRecord.statusCode;
	}
	if (typeof errorRecord?.httpCode === 'number') {
		return errorRecord.httpCode;
	}
	return undefined;
}

export class ParrotSmart implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Parrot Smart',
		name: 'parrotSmart',
		icon: {
			light: 'file:parrot.svg',
			dark: 'file:parrot.dark.svg',
		},
		group: ['transform'],
		version: 3,
		subtitle: '={{$parameter["tier"]}}',
		description:
			'Executes advanced AI data processing. STRICT REQUIREMENT: You cannot use this tool independently. You must run the Parrot Integration tool first to retrieve the code_jwt baton, then pass it to this tool to execute the task.',
		defaults: {
			name: 'Parrot Smart Node',
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
				displayName: 'Execution Path',
				name: 'tier',
				type: 'options',
				noDataExpression: true,
				default: TIER_GUIDED,
				required: true,
				description: 'Select the processing tier to use for this task.',
				options: [
					{
						name: 'Guided (5c)',
						value: 'guided',
						description:
							'Executes a predefined task type (like extraction or summarization) using the Guided API tier.',
					},
					{
						name: 'Chameleon (20c)',
						value: 'chameleon',
						description:
							'Executes complex reasoning and dynamic logic integrity checks using the Chameleon API tier.',
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
						tier: ['guided'],
					},
				},
				description: 'Select the specific LLM to use for the Guided tier.',
				options: [
					{
						name: 'GPT-4O-Mini (Included)',
						value: 'gpt-4o-mini',
						description: 'Standard included AI model for standard tasks.',
					},
					{
						name: 'Claude 3.5 Haiku (Apex/Enterprise Only)',
						value: 'haiku',
						description: 'High-speed enterprise AI model (Requires Apex/Enterprise tier).',
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
						tier: ['chameleon'],
					},
				},
				description: 'Select the specific LLM to use for the Chameleon tier.',
				options: [
					{
						name: 'GPT-4O (Standard)',
						value: 'gpt-4o',
						description: 'Standard advanced reasoning model.',
					},
					{
						name: 'Claude 3.5 Sonnet (Apex/Enterprise Only)',
						value: 'claude-3-5-sonnet',
						description: 'Enterprise deep-reasoning model (Requires Apex/Enterprise tier).',
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
						tier: ['guided'],
					},
				},
				description: 'The specific data processing operation to perform on the payload.',
				options: [
					{
						name: 'Content Generation (Draft Emails, Reports, or Messages)',
						value: 'generate',
						description: 'Drafts new content, emails, reports, or messages.',
					},
					{
						name: 'Data Extraction (Pull Clean JSON From Messy Text)',
						value: 'extract',
						description: 'Pulls clean JSON and structured data out of messy text.',
					},
					{
						name: 'Data Transformation (Reformat Data for the Next Step)',
						value: 'transform',
						description: 'Reformats the data structure for the next step in a pipeline.',
					},
					{
						name: 'Routing & Decision Logic (Output Categories or True/False)',
						value: 'route',
						description: 'Analyzes the payload to output categories or true/false routing decisions.',
					},
					{
						name: 'Summarize & Analyze (Create TL;DRs or Action Items)',
						value: 'summarize',
						description: 'Analyzes the payload to create concise TL;DRs or action items.',
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
						tier: ['guided'],
					},
				},
				description: 'Set to true to inject specific, overriding instructions for this processing step.',
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
				description: 'The specific custom text instructions or constraints for the model to follow.',
			},
			{
				displayName: 'Enable Production Vault Memory',
				name: 'useVault',
				type: 'boolean',
				default: false,
				description:
					'Whether to query the Port 8003 microservice to inject historical context fragments into the run loop to eliminate LLM amnesia',
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
				description:
					'The unique string identifier of the production vault used for memory and historical context injection.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('parrotApi');
		const apiKey = String(credentials.apiKey ?? '').trim();
		if (!apiKey) {
			throw new NodeApiError(this.getNode(), asJsonObject({ code: 'NO_API_KEY' }), {
				message: 'parrotApi credential must include an API Key.',
			});
		}

		const baseUrl = String(credentials.baseUrl ?? '').trim().replace(/\/$/, '');
		if (!baseUrl) {
			throw new NodeApiError(this.getNode(), asJsonObject({ code: 'NO_BASE_URL' }), {
				message: 'parrotApi credential must include API Base URL.',
			});
		}

		const smartHitUrl = normalizeParrotGateUrlForIpv6(`${baseUrl}/highway/smart-hit`);

		const userId = String(credentials.userId ?? '').trim() || 'n8n_user';
		const workflowId = this.getWorkflow().id ?? 'n8n_workflow';

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const tier = this.getNodeParameter('tier', i) as TierParam;
			const model =
				tier === TIER_GUIDED
					? (this.getNodeParameter('guided_model', i, 'gpt-4o-mini') as string)
					: (this.getNodeParameter('chameleon_model', i, 'gpt-4o') as string);
			const useVault = this.getNodeParameter('useVault', i, false) as boolean;
			const productionVault = String(this.getNodeParameter('productionVault', i, 'primary')).trim();

			let taskValue = '';
			let overrideContext = false;
			let guidedInstruction = '';
			if (tier === TIER_GUIDED) {
				taskValue = this.getNodeParameter('task', i) as string;
				overrideContext = this.getNodeParameter('overrideContext', i, false) as boolean;
				guidedInstruction = String(this.getNodeParameter('guidedInstruction', i, '')).trim();
			}

			const incomingJson = item.json as IDataObject;

			const rawCodeJwt = incomingJson.code_jwt;
			const sequenceJwt =
				rawCodeJwt === undefined || rawCodeJwt === null ? '' : String(rawCodeJwt).trim();
			if (!sequenceJwt) {
				throw new NodeOperationError(
					this.getNode(),
					'code_jwt is required: run Parrot Integration (or upstream node) to provide the sequence baton before Parrot Smart.',
					{ itemIndex: i },
				);
			}

			const apiPayloadData: IDataObject = { ...incomingJson };
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

			const smartHitBody: IDataObject = {
				sequence_jwt: sequenceJwt,
				tier,
				model,
				user_id: userId,
				workflow_id: workflowId,
				raw_input_payload: apiPayloadData,
			};

			let rawResponse: unknown;
			try {
				rawResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'parrotApi', {
					method: 'POST',
					url: smartHitUrl,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: smartHitBody,
					json: true,
				});
			} catch (error) {
				const statusCode = extractHttpStatusCode(error);

				if (statusCode === 403) {
					throw new NodeApiError(
						this.getNode(),
						asJsonObject(
							error !== null && typeof error === 'object'
								? (error as Record<string, unknown>)
								: { code: 'TIER_UPGRADE_REQUIRED' },
						),
						{
							message: 'Tier Upgrade Required',
							description: 'This model is reserved for Apex and Enterprise tiers.',
							itemIndex: i,
						},
					);
				}

				const message = error instanceof Error ? error.message : String(error);
				throw new NodeOperationError(this.getNode(), `Highway smart-hit request failed: ${message}`, {
					itemIndex: i,
				});
			}

			const body: unknown =
				typeof rawResponse === 'string' ? jsonParse(rawResponse) : rawResponse;

			if (tier === TIER_CHAMELEON) {
				const integrityMessage = extractSmartPlusIntegrityMessage(body);
				if (integrityMessage !== undefined) {
					throw new NodeOperationError(
						this.getNode(),
						`Logic Integrity Warning: ${integrityMessage}`,
						{ itemIndex: i },
					);
				}
			}

			const responseBody = isRecord(body) ? body : {};

			const userData = buildCleanUserData(incomingJson);

			const outputJson: IDataObject = {
				...userData,
				code_jwt: responseBody.code_jwt ?? null,
				instruction: responseBody.instruction ?? null,
				task_index: responseBody.task_index ?? null,
				total_tasks: responseBody.total_tasks ?? null,
				finished: responseBody.finished ?? null,
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
