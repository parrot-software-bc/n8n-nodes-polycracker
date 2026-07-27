"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParrotApi = void 0;
class ParrotApi {
    constructor() {
        this.name = 'parrotApi';
        this.displayName = 'Parrot API';
        this.documentationUrl = 'https://www.polycracker.dev';
        this.icon = {
            light: 'file:parrot.svg',
            dark: 'file:parrot.dark.svg',
        };
        this.properties = [
            {
                displayName: 'API Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://api.polycracker.dev',
                required: true,
            },
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                required: true,
            },
            {
                displayName: 'User ID',
                name: 'userId',
                type: 'string',
                default: '',
                required: true,
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'X-API-Key': '={{$credentials.apiKey}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.baseUrl}}',
                url: '/',
                method: 'GET',
            },
        };
    }
}
exports.ParrotApi = ParrotApi;
//# sourceMappingURL=ParrotApi.credentials.js.map