import {describeQuickConnectError, normalizeQuickConnectCode, serverMessageOf, supportsQuickConnectAuthorize} from './quickConnectAuthorize';

describe('quickConnectAuthorize', () => {
	test('ne garde que huit chiffres', () => {
		expect(normalizeQuickConnectCode(' 12-34 56 789 ')).toBe('12345678');
		expect(normalizeQuickConnectCode(null)).toBe('');
	});

	test('réservé à Jellyfin', () => {
		expect(supportsQuickConnectAuthorize('jellyfin')).toBe(true);
		expect(supportsQuickConnectAuthorize(undefined)).toBe(true);
		expect(supportsQuickConnectAuthorize('emby')).toBe(false);
		expect(supportsQuickConnectAuthorize('plex')).toBe(false);
	});

	test('lit le message du serveur', () => {
		expect(serverMessageOf({body: '{"Message":"Nope"}'})).toBe('Nope');
		expect(serverMessageOf({body: 'Texte brut'})).toBe('Texte brut');
		expect(serverMessageOf({})).toBeNull();
	});

	test('traduit les statuts comme l\'APK', () => {
		expect(describeQuickConnectError({unsupported: true})).toEqual({key: 'notSupported'});
		expect(describeQuickConnectError({status: 401})).toEqual({key: 'disabled'});
		expect(describeQuickConnectError({status: 403})).toEqual({key: 'forbidden'});
		expect(describeQuickConnectError({status: 403, body: 'Refusé'})).toEqual({key: 'raw', message: 'Refusé'});
		expect(describeQuickConnectError({status: 404})).toEqual({key: 'notFound'});
		expect(describeQuickConnectError({status: 500, body: '{"message":"Boum"}'})).toEqual({key: 'failedWithMessage', message: 'Boum'});
		expect(describeQuickConnectError(new Error('réseau'))).toEqual({key: 'failed'});
	});
});
