"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParrotApi = void 0;
class ParrotApi {
    constructor() {
        this.name = 'parrotApi';
        this.displayName = 'Parrot API';
        this.documentationUrl = '';
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
    }
}
exports.ParrotApi = ParrotApi;
//# sourceMappingURL=ParrotApi.credentials.js.map