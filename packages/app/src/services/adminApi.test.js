import {createAdminApi, describeAdminError, toQuery, versionCandidates} from './adminApi';

jest.mock('./jellyfinApi', () => ({getServerUrl: () => 'https://jf.example', getAuthHeader: () => 'MediaBrowser Token="t"'}));
jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));

const reply = (status, body) => ({
	ok: status >= 200 && status < 300,
	status,
	text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body))
});

const makeApi = (handler) => {
	const calls = [];
	const send = jest.fn(async (url, opts) => {
		calls.push({url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined, headers: opts.headers});
		return handler(url, opts);
	});
	return {api: createAdminApi({fetch: send, baseUrl: 'https://jf.example', authHeader: 'MediaBrowser Token="t"'}), calls};
};

describe('paramètres', () => {
	test('les valeurs vides ne partent pas', () => {
		expect(toQuery({a: 1, b: null, c: '', d: undefined, e: false})).toBe('?a=1&e=false');
		expect(toQuery({})).toBe('');
	});

	test('versions de plugin', () => {
		expect(versionCandidates('10.9.0.0-beta')).toEqual(['10.9.0.0-beta', '10.9.0.0']);
		expect(versionCandidates('3.0')).toEqual(['3.0']);
	});
});

describe('routes', () => {
	test('configuration du serveur : lecture et écriture', async () => {
		const {api, calls} = makeApi(() => reply(200, {ServerName: 'Maison'}));
		expect(await api.getServerConfiguration()).toEqual({ServerName: 'Maison'});
		await api.updateServerConfiguration({ServerName: 'Salon'});
		expect(calls[0]).toMatchObject({url: 'https://jf.example/System/Configuration', method: 'GET'});
		expect(calls[1]).toMatchObject({method: 'POST', body: {ServerName: 'Salon'}});
		expect(calls[1].headers.Authorization).toBe('MediaBrowser Token="t"');
	});

	test('nouvelle bibliothèque avec ses dossiers', async () => {
		const {api, calls} = makeApi(() => reply(204));
		await api.addVirtualFolder({name: 'Films', collectionType: 'movies', paths: ['/media/films'], libraryOptions: {EnableRealtimeMonitor: true}});
		expect(calls[0].url).toBe('https://jf.example/Library/VirtualFolders?name=Films&collectionType=movies&refreshLibrary=false');
		expect(calls[0].body).toEqual({LibraryOptions: {EnableRealtimeMonitor: true, PathInfos: [{Path: '/media/films'}]}});
	});

	test('mise à jour d’un utilisateur : repli sur l’ancienne route', async () => {
		const {api, calls} = makeApi((url) => (url.indexOf('/Users?userId=') >= 0 ? reply(404) : reply(204)));
		await api.updateUser('u1', {Name: 'Léa'});
		expect(calls.map((c) => c.url)).toEqual(['https://jf.example/Users?userId=u1', 'https://jf.example/Users/u1']);
	});

	test('activer un plugin : repli sur la version numérique', async () => {
		const {api, calls} = makeApi((url) => (url.indexOf('beta') >= 0 ? reply(404) : reply(204)));
		await api.enablePlugin('abc', '1.2.3.0-beta');
		expect(calls.map((c) => c.url)).toEqual([
			'https://jf.example/Plugins/abc/1.2.3.0-beta/Enable',
			'https://jf.example/Plugins/abc/1.2.3.0/Enable'
		]);
	});

	test('pays de Schedules Direct triés, région ZZZ ignorée', async () => {
		const {api} = makeApi(() => reply(200, {ZZZ: [{fullName: 'Test'}], Europe: [{fullName: 'France'}, {fullName: 'Allemagne'}]}));
		expect((await api.getSchedulesDirectCountries()).map((c) => c.fullName)).toEqual(['Allemagne', 'France']);
	});

	test('les clés API renvoyées en objet ou en liste', async () => {
		const {api} = makeApi(() => reply(200, {Items: [{AccessToken: 'k'}]}));
		expect(await api.getApiKeys()).toEqual([{AccessToken: 'k'}]);
	});

	test('le journal se lit en texte', async () => {
		const {api} = makeApi(() => reply(200, 'ligne 1\nligne 2'));
		expect(await api.getLogFileContent('log.txt')).toBe('ligne 1\nligne 2');
	});

	test('une erreur garde le code et la réponse', async () => {
		const {api} = makeApi(() => reply(400, 'Chemin invalide'));
		await expect(api.validatePath('/x')).rejects.toMatchObject({status: 400, body: 'Chemin invalide'});
		expect(describeAdminError({status: 400, body: 'Chemin invalide'})).toBe('Erreur 400 : Chemin invalide');
		expect(describeAdminError({status: 403})).toMatch(/administrateur/);
	});
});
