import {readSimpleMode, simpleModeFromPrefs, withSimpleMode, writeSimpleMode} from './adminSimpleMode';

describe('adminSimpleMode', () => {
	test('lit le drapeau', () => {
		expect(simpleModeFromPrefs({CustomPrefs: {simpleMode: 'true'}})).toBe(true);
		expect(simpleModeFromPrefs({CustomPrefs: {simpleMode: 'false'}})).toBe(false);
		expect(simpleModeFromPrefs(null)).toBe(false);
	});

	test('garde le reste des préférences', () => {
		expect(withSimpleMode({Id: 'x', SortBy: 'Name', CustomPrefs: {a: '1'}}, true)).toEqual({Id: 'x', Client: 'vjod', SortBy: 'Name', CustomPrefs: {a: '1', simpleMode: 'true'}});
		expect(withSimpleMode(null, false)).toEqual({Id: 'vjod', Client: 'vjod', CustomPrefs: {simpleMode: 'false'}});
	});

	test('lit et écrit dans Jellyfin', async () => {
		const calls = [];
		const api = {call: jest.fn((method, p, opts) => {
			calls.push([method, p, opts]);
			return Promise.resolve(method === 'GET' ? {Id: 'vjod', CustomPrefs: {autre: 'x'}} : null);
		})};
		expect(await readSimpleMode(api, 'u1')).toBe(false);
		await writeSimpleMode(api, 'u1', true);
		expect(calls[2]).toEqual(['POST', '/DisplayPreferences/vjod', {query: {userId: 'u1', client: 'vjod'}, body: {Id: 'vjod', Client: 'vjod', CustomPrefs: {autre: 'x', simpleMode: 'true'}}}]);
		expect(await readSimpleMode({call: () => Promise.reject(new Error('non'))}, 'u1')).toBeNull();
	});
});
