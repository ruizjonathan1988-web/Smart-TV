import {platformFetch} from './secureFetch';
import {
	redactIptvSecrets, reportProblemText, reportPlay, reportCrash, pending, flush, lastReport,
	setReportsServer, setReportsAllowed, resetReportsForTests, loadSupportNumber, sendTimings
} from './maTvReports';
import {addTiming} from '../utils/vjodTimings';

jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));
jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn(), removeFromStorage: jest.fn()}));

const storage = jest.requireMock('./storage');
const store = {};
const SERVER = {url: 'https://matv.example', key: 'secret'};
const settle = async () => {
	for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); // eslint-disable-line no-await-in-loop
};

beforeEach(() => {
	resetReportsForTests();
	for (const k of Object.keys(store)) delete store[k];
	storage.getFromStorage.mockImplementation(async (k) => (k in store ? JSON.parse(store[k]) : null));
	storage.saveToStorage.mockImplementation(async (k, v) => {
		store[k] = JSON.stringify(v);
	});
	storage.removeFromStorage.mockImplementation(async (k) => {
		delete store[k];
	});
	platformFetch.mockReset();
});

describe('maTvReports', () => {
	test('la clé, le compte et le mot de passe IPTV sont retirés', () => {
		expect(redactIptvSecrets('https://x/tv/play/1.ts?k=abc&u=jon')).toBe('https://x/tv/play/1.ts?k=[REDACTED]&u=jon');
		expect(redactIptvSecrets('http://p:80/movie/moi/motdepasse/12.mkv')).toBe('http://p:80/movie/[REDACTED]/[REDACTED]/12.mkv');
	});

	test('un souci attend sur la télé, puis part sur Ma TV avec la télé qui l’envoie', async () => {
		reportPlay('Pas d’image', {channel: '1 TF1', source: 'http://p/live/u/p/1.ts'});
		reportPlay('Pas d’image', {channel: '1 TF1', source: 'http://p/live/u/p/1.ts'});
		await settle();
		const list = await pending();
		expect(list).toHaveLength(1);
		expect(list[0].source).toBe('http://p/live/[REDACTED]/[REDACTED]/1.ts');
		expect((await lastReport()).channel).toBe('1 TF1');
		platformFetch.mockResolvedValue({status: 200});
		setReportsServer(SERVER);
		expect(await flush()).toBe(1);
		const call = platformFetch.mock.calls.find(([url]) => url.includes('/tv/api/report'));
		const body = JSON.parse(call[1].body);
		expect(body.reports[0]).toEqual(expect.objectContaining({kind: 'play', channel: '1 TF1', device: expect.any(String), app: expect.stringMatching(/^TV /)}));
		expect(await pending()).toEqual([]);
	});

	test('rien quand la famille a coupé les signalements', async () => {
		setReportsAllowed(false);
		reportCrash(new Error('boum'));
		await settle();
		expect(await pending()).toEqual([]);
	});

	test('le message prérempli dit l’écran, le dernier souci récent, la version et l’appareil', () => {
		const now = Date.parse('2026-11-23T20:00:00Z');
		const text = reportProblemText({
			what: 'Chaîne 1 TF1',
			last: {kind: 'play', message: 'Pas d’image\ndétail', channel: '1 TF1', at: now / 1000 - 300},
			version: 'TV 1.0',
			device: 'TV · webOS',
			deviceNumber: 'abc123',
			now
		});
		expect(text).toBe('Problème sur VJOD :\n\n\n— Chaîne 1 TF1\n— Dernier souci noté : lecture ratée (1 TF1), il y a 5 min : Pas d’image\n— VJOD TV 1.0 · TV · webOS\n— Appareil abc123 (page Ma TV)');
	});

	test('le numéro WhatsApp vient de Ma TV', async () => {
		setReportsServer(SERVER);
		const n = await loadSupportNumber(async (url) => {
			expect(url).toContain('/tv/api/support');
			return {whatsapp: ' 33612345678 '};
		});
		expect(n).toBe('33612345678');
	});

	test('les temps de réponse partent vers /tv/api/timings, une fois par changement', async () => {
		platformFetch.mockResolvedValue({status: 200, json: async () => ({})});
		setReportsServer(SERVER);
		await settle();
		platformFetch.mockClear();
		addTiming('Jellyfin', 240, '/Items');
		expect(await sendTimings()).toBe(true);
		const call = platformFetch.mock.calls.find(([u]) => u.includes('/tv/api/timings'));
		expect(call).toBeTruthy();
		const body = JSON.parse(call[1].body);
		expect(body.services.Jellyfin).toMatchObject({median: 240, p90: 240, n: 1, slow: '/Items'});
		expect(body.app).toMatch(/^TV /);
		expect(await sendTimings()).toBe(false);
	});
});
