import {platformFetch} from './secureFetch';
import {
	cleanPortalUrl,
	createMaTvClient,
	findMaTvServer,
	maTvEndpoint,
	maTvServerFromCode,
	maTvServerFromJson,
	maTvServerFromOverview
} from './maTvApi';

jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));

// Encode {url, key} comme IPTV Checker l'écrit dans la description de la
// collection « VJOD – TV » : JSON -> base64url.
const marker = (json) => {
	const b64 = Buffer.from(JSON.stringify(json), 'binary').toString('base64');
	return `VJOD-TV:${b64.replace(/\+/g, '-').replace(/\//g, '_')}`;
};

// L'adresse du portail est la racine du serveur Ma TV ; `/tv/...` fait partie
// de la route (comme l'APK : Uri.parse('$url$path')).
const SERVER = {url: 'https://seed.example', key: 'ABC123'};

describe('adresse du portail', () => {
	test('retire les barres finales', () => {
		expect(cleanPortalUrl('https://seed.example/tv///')).toBe('https://seed.example/tv');
	});

	test('rejette ce qui n\'est pas http(s) ou sans hôte', () => {
		expect(cleanPortalUrl('ftp://seed.example')).toBeNull();
		expect(cleanPortalUrl('pas une url')).toBeNull();
		expect(cleanPortalUrl('')).toBeNull();
	});
});

describe('découverte du serveur Ma TV', () => {
	test('depuis la description d\'une collection', () => {
		expect(maTvServerFromOverview(`avant ${marker(SERVER)} après`)).toEqual(SERVER);
	});

	test('depuis un code collé à la main', () => {
		expect(maTvServerFromCode('https://seed.example#ABC123')).toEqual(SERVER);
	});

	test('exige une url et une clé', () => {
		expect(maTvServerFromJson({url: 'https://seed.example/tv'})).toBeNull();
		expect(maTvServerFromJson({key: 'ABC123'})).toBeNull();
	});

	test('trouve le serveur parmi plusieurs collections', () => {
		const items = [
			{Overview: 'Films'},
			{Overview: marker(SERVER)},
			{Overview: 'Séries'}
		];
		expect(findMaTvServer(items)).toEqual(SERVER);
		expect(findMaTvServer([{Overview: 'rien'}])).toBeNull();
	});
});

describe('construction des routes', () => {
	test('ajoute toujours la clé', () => {
		expect(maTvEndpoint(SERVER, '/tv/api/cats')).toBe('https://seed.example/tv/api/cats?k=ABC123');
	});

	test('garde les paramètres et ignore les vides', () => {
		const url = maTvEndpoint(SERVER, '/tv/api/chans', {cat: 'fr', vide: ''});
		expect(url).toContain('cat=fr');
		expect(url).not.toContain('vide=');
		expect(url).toContain('k=ABC123');
	});
});

describe('client Ma TV', () => {
	const calls = [];
	const fetchJson = jest.fn((url) => {
		calls.push(url);
		return Promise.resolve({ok: true});
	});
	const client = createMaTvClient({server: SERVER, user: 'jon', caps: 'h264', fetchJson});

	beforeEach(() => {
		calls.length = 0;
		fetchJson.mockClear();
	});

	test('catégories et chaînes', async () => {
		await client.cats();
		await client.channels('fr');
		expect(calls[0]).toBe('https://seed.example/tv/api/cats?k=ABC123');
		expect(calls[1]).toContain('/tv/api/chans?cat=fr');
	});

	test('EPG : epochs en secondes et ids tronqués à 100', async () => {
		const ids = Array.from({length: 150}, (_, i) => `c${i}`);
		const from = new Date(2_000_000_000_000);
		const to = new Date(2_000_000_600_000);
		await client.programs(ids, from, to);
		const url = calls[0];
		expect(url).toContain('from=2000000000');
		expect(url).toContain('to=2000000600');
		expect(url).toContain('ids=c0,c1,'.replace(/,/g, '%2C'));
		expect(url).not.toContain('c100');
	});

	test('lecture directe : URL avec identité client', () => {
		expect(client.liveUrl({id: '42'})).toBe(
			'https://seed.example/tv/play/42.ts?u=jon&caps=h264&k=ABC123'
		);
	});

	test('timeshift : instant en secondes', () => {
		const url = client.shiftUrl({id: '42'}, new Date(2_000_000_000_000));
		expect(url).toContain('/tv/shift/42.ts?');
		expect(url).toContain('at=2000000000');
		expect(url).toContain('k=ABC123');
	});
});

describe('fetch par défaut', () => {
	beforeEach(() => platformFetch.mockReset());

	test('renvoie null hors 200, l\'objet sinon', async () => {
		platformFetch.mockResolvedValueOnce({status: 500, json: () => Promise.resolve({})});
		const client = createMaTvClient({server: SERVER});
		await expect(client.cats()).resolves.toBeNull();

		platformFetch.mockResolvedValueOnce({status: 200, json: () => Promise.resolve({cats: []})});
		await expect(client.cats()).resolves.toEqual({cats: []});
	});

	test('avale les exceptions réseau', async () => {
		platformFetch.mockRejectedValueOnce(new Error('réseau'));
		const client = createMaTvClient({server: SERVER});
		await expect(client.cats()).resolves.toBeNull();
	});
});
