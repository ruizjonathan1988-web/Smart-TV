import {enrollMaTv, withPersonalKey, maTvAccessCut, resetMaTvEnrollForTests} from './maTvEnroll';
import {platformFetch} from './secureFetch';

jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));

const server = {url: 'https://seedbox/tv', key: 'partagee'};

describe('maTvEnroll', () => {
	beforeEach(() => {
		localStorage.clear();
		resetMaTvEnrollForTests();
	});

	test('la clé donnée par Ma TV remplace la clé partagée pour ce profil', async () => {
		platformFetch.mockResolvedValue({status: 200, json: async () => ({key: 'perso'})});
		expect(await enrollMaTv({server, userId: 'u1', accessToken: 'jeton'})).toBe(true);
		const [url, init] = platformFetch.mock.calls[0];
		expect(url).toContain('/tv/api/enroll');
		expect(JSON.parse(init.body)).toEqual({token: 'jeton'});
		expect(withPersonalKey(server, 'u1').key).toBe('perso');
		expect(withPersonalKey(server, 'u2').key).toBe('partagee');
	});

	test('403 : l’admin a coupé ce profil', async () => {
		platformFetch.mockResolvedValue({status: 403});
		await enrollMaTv({server, userId: 'u1', accessToken: 'jeton'});
		expect(maTvAccessCut('u1', server.url)).toBe(true);
		expect(withPersonalKey(server, 'u1').key).toBe('partagee');
	});

	test('404 (Ma TV avant 3.60) : rien ne change, et pas plus d’une demande en 30 min', async () => {
		platformFetch.mockResolvedValue({status: 404});
		expect(await enrollMaTv({server, userId: 'u1', accessToken: 'jeton'})).toBe(false);
		await enrollMaTv({server, userId: 'u1', accessToken: 'jeton'});
		expect(platformFetch).toHaveBeenCalledTimes(1);
		expect(withPersonalKey(server, 'u1').key).toBe('partagee');
	});
});
