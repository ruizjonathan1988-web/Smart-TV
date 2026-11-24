import {setTraktProfile, setTraktCallForTests, startTraktConnecting, finishTraktConnecting, isTraktConnected, traktUsername, traktRecommendations, traktMarkWatched, disconnectTrakt} from './traktAccount';

jest.mock('./outsideFetch', () => ({fetchOutside: jest.fn()}));

describe('traktAccount', () => {
	let calls;
	const answer = (map) => setTraktCallForTests(async (url, opts = {}) => {
		calls.push([url, opts]);
		const path = url.replace('https://api.trakt.tv', '').split('?')[0];
		const r = map[path];
		return typeof r === 'function' ? r(opts) : (r || {status: 404, json: null});
	});

	beforeEach(() => {
		jest.useFakeTimers();
		localStorage.clear();
		calls = [];
		setTraktProfile('u1');
	});
	afterEach(() => {
		jest.useRealTimers();
		setTraktCallForTests(null);
	});

	test('relier par le code, garder les jetons et le nom du compte', async () => {
		let polls = 0;
		answer({
			'/oauth/device/code': {status: 200, json: {device_code: 'D', user_code: 'ABCD1234', verification_url: 'https://trakt.tv/activate', interval: 5, expires_in: 600}},
			'/oauth/device/token': () => (++polls < 2 ? {status: 400, json: null} : {status: 200, json: {access_token: 'A', refresh_token: 'R', expires_in: 7776000, created_at: Math.floor(Date.now() / 1000)}}),
			'/users/settings': {status: 200, json: {user: {username: 'jon'}}}
		});
		const code = await startTraktConnecting();
		expect(code).toMatchObject({userCode: 'ABCD1234', url: 'https://trakt.tv/activate', intervalMs: 5000});
		const done = finishTraktConnecting(code, () => false);
		for (let i = 0; i < 3; i++) {
			await jest.advanceTimersByTimeAsync(5000); // eslint-disable-line no-await-in-loop
		}
		expect(await done).toBe(true);
		expect(isTraktConnected()).toBe(true);
		expect(traktUsername()).toBe('jon');
		setTraktProfile('u2');
		expect(isTraktConnected()).toBe(false);
	});

	test('code refusé ou expiré', async () => {
		answer({'/oauth/device/token': {status: 418, json: null}});
		const done = finishTraktConnecting({deviceCode: 'D', intervalMs: 1000, expiresMs: 60000}, () => false);
		const caught = done.catch((e) => e.message);
		await jest.advanceTimersByTimeAsync(1000);
		expect(await caught).toBe('denied');
	});

	test('recommandations et historique avec le jeton du compte', async () => {
		localStorage.setItem('vjod_trakt_u1', JSON.stringify({accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 30 * 86400000}));
		answer({
			'/recommendations/movies': {status: 200, json: [{title: 'Dune', ids: {tmdb: 438631}}]},
			'/sync/history': {status: 201, json: {}}
		});
		expect(await traktRecommendations('movie')).toEqual([438631]);
		await traktMarkWatched({mediaType: 'tv', tmdbId: 70523, season: 1, episode: 2});
		const [, opts] = calls.find(([u]) => u.includes('/sync/history'));
		expect(opts.headers.Authorization).toBe('Bearer A');
		expect(opts.body.shows[0]).toMatchObject({ids: {tmdb: 70523}, seasons: [{number: 1, episodes: [{number: 2}]}]});
		disconnectTrakt();
		expect(await traktRecommendations('movie')).toEqual([]);
	});
});
