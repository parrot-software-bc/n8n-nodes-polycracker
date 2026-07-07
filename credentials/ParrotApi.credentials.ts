import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ParrotApi implements ICredentialType {
	name = 'parrotApi';
	displayName = 'Parrot API';
	documentationUrl = '';
	properties: INodeProperties[] = [
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
