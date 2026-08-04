"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_CHAMELEON = exports.TIER_GUIDED = void 0;
exports.asJsonObject = asJsonObject;
exports.isRecord = isRecord;
exports.normalizeApiBaseUrl = normalizeApiBaseUrl;
exports.normalizeApiUrlForIpv6 = normalizeApiUrlForIpv6;
exports.buildCleanMetadata = buildCleanMetadata;
exports.buildCleanUserData = buildCleanUserData;
exports.extractSmartPlusIntegrityMessage = extractSmartPlusIntegrityMessage;
exports.extractHttpStatusCode = extractHttpStatusCode;
exports.TIER_GUIDED = 'guided';
exports.TIER_CHAMELEON = 'chameleon';
const LEGACY_METADATA_KEYS = new Set([
    'workflow',
    'workflowId',
    'executionId',
    'user_id',
    'userId',
    'action',
]);
const OUTPUT_STRIP_KEYS = [
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
function asJsonObject(payload) {
    return payload;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizeApiBaseUrl(raw) {
    return String(raw !== null && raw !== void 0 ? raw : '').trim().replace(/\/$/, '');
}
function normalizeApiUrlForIpv6(url) {
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
function buildCleanMetadata(source) {
    const clean = { ...source };
    for (const key of LEGACY_METADATA_KEYS) {
        delete clean[key];
    }
    return clean;
}
function buildCleanUserData(source) {
    const clean = { ...source };
    for (const key of OUTPUT_STRIP_KEYS) {
        delete clean[key];
    }
    return clean;
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
function extractHttpStatusCode(error) {
    const errorRecord = error !== null && typeof error === 'object' ? error : undefined;
    if (typeof (errorRecord === null || errorRecord === void 0 ? void 0 : errorRecord.statusCode) === 'number') {
        return errorRecord.statusCode;
    }
    if (typeof (errorRecord === null || errorRecord === void 0 ? void 0 : errorRecord.httpCode) === 'number') {
        return errorRecord.httpCode;
    }
    return undefined;
}
//# sourceMappingURL=helpers.js.map