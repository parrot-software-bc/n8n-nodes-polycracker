import type { IDataObject, JsonObject } from 'n8n-workflow';

export const TIER_GUIDED = 'guided' as const;
export const TIER_CHAMELEON = 'chameleon' as const;
export type TierParam = typeof TIER_GUIDED | typeof TIER_CHAMELEON;

const LEGACY_METADATA_KEYS = new Set([
	'workflow',
	'workflowId',
	'executionId',
	'user_id',
	'userId',
	'action',
]);

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

export function asJsonObject(payload: IDataObject | Record<string, unknown>): JsonObject {
	return payload as unknown as JsonObject;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeApiBaseUrl(raw: unknown): string {
	return String(raw ?? '').trim().replace(/\/$/, '');
}

/**
 * Ensures literal IPv6 appears in bracket form before the port (`http://[addr]:port/...`).
 */
export function normalizeParrotGateUrlForIpv6(url: string): string {
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

export function buildCleanMetadata(source: IDataObject): IDataObject {
	const clean: IDataObject = { ...source };
	for (const key of LEGACY_METADATA_KEYS) {
		delete clean[key];
	}
	return clean;
}

export function buildCleanUserData(source: IDataObject): IDataObject {
	const clean: IDataObject = { ...source };
	for (const key of PARROT_OUTPUT_STRIP_KEYS) {
		delete clean[key];
	}
	return clean;
}

export function extractSmartPlusIntegrityMessage(body: unknown): string | undefined {
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

export function extractHttpStatusCode(error: unknown): number | undefined {
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
