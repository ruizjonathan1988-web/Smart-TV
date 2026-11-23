import {platformFetch} from './secureFetch';
import {mergeSeedboxPlaces, placeFromSeedbox, resetReplayProgressForTests, resumePosition, saveReplayPlace, setProgressSeedbox, continueOnMaTv} from './maTvProgress';

jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));
jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

const storage = jest.requireMock('./storage');
const urls = {movieUrl: (m) => `M/${m.id}.${m.extension}`, episodeUrl: (e) => `E/${e.id}.${e.extension}`};
const SERVER = {url: 'https://matv', key: 'k'};

beforeEach(() => {
	resetReplayProgressForTests({});
	platformFetch.mockReset();
	storage.saveToStorage.mockImplementation(async () => {});
	storage.getFromStorage.mockImplementation(async () => null);
});

describe('places IPTV sur la seedbox', () => {
	test('un film commencé ailleurs reprend ici, avec sa lecture', () => {
		const now = Date.now();
		mergeSeedboxPlaces([{kind: 'movie', id: '42', name: 'Dune', ext: 'mkv', pos: 1200, dur: 9000, at: now / 1000}], urls);
		expect(resumePosition('vod:movie:42')).toBe(1200000);
		const [card] = continueOnMaTv(now);
		expect(card._maTvResume).toEqual(expect.objectContaining({url: 'M/42.mkv', title: 'Dune', startMs: 1200000}));
	});

	test('un épisode garde sa série et ses numéros ; la place la plus récente gagne', () => {
		const got = placeFromSeedbox({kind: 'series', id: '7', name: 'Lupin', ep: '700', ext: 'mp4', season: 2, episode: 3, ep_name: 'Le collier', pos: 100, dur: 3000, at: 10}, urls);
		expect(got.id).toBe('vod:ep:700');
		expect(got.place.meta.subtitle).toBe('S2 · É3 · Le collier');
		saveReplayPlace('vod:ep:700', 500000, 3000000, {url: 'x'});
		mergeSeedboxPlaces([{kind: 'series', id: '7', ep: '700', pos: 100, dur: 3000, at: 10}], urls);
		expect(resumePosition('vod:ep:700')).toBe(500000);
	});

	test('une place gardée ici part aussi sur la seedbox, pour ce profil', async () => {
		platformFetch.mockResolvedValue({status: 200, json: async () => ({items: []})});
		await setProgressSeedbox(SERVER, 'jon', urls);
		saveReplayPlace('vod:movie:42', 120000, 6000000, {url: 'u', watch: {kind: 'movie', id: '42', name: 'Dune', ext: 'mkv'}});
		const post = platformFetch.mock.calls.find(([, o]) => o && o.method === 'POST');
		expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({kind: 'movie', id: '42', pos: 120, dur: 6000, user: 'jon'}));
	});
});
