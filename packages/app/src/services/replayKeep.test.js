import {grabAnswer, grabRelease, parseTrackerSearch, queryFor, releaseDetail} from './replayKeep';

describe('replayKeep', () => {
	test('la recherche d\'un épisode', () => {
		expect(queryFor({show: 'Koh-Lanta', season: 25, episode: 3})).toBe('Koh-Lanta S25E03');
		expect(queryFor({show: 'Quotidien', season: 0, episode: 0})).toBe('Quotidien');
	});

	test('le détail d\'une version', () => {
		expect(releaseDetail({size: 2.4 * (1 << 30), seeders: 40, indexer: 'Tracker A', ageDays: 2})).toBe('2,4 Go · 40 sources · Tracker A · il y a 2 j');
		expect(releaseDetail({size: 300 * (1 << 20), seeders: 1, indexer: '', ageDays: 0})).toBe('300 Mo · 1 source · aujourd’hui');
		expect(releaseDetail({size: 0, seeders: 0, indexer: 'X', ageDays: null})).toBe('0 source · X');
	});

	test('la réponse de Ma TV', () => {
		expect(parseTrackerSearch(404, null).error).toBe('Il faut Ma TV 3.67 sur la seedbox.');
		expect(parseTrackerSearch(500, {error: 'Prowlarr absent'}).error).toBe('Prowlarr absent');
		const ok = parseTrackerSearch(200, {may_grab: true, results: [{id: 7, title: 'Koh', size: 10, seeders: 3, indexer: 'A', age: 1}, null]});
		expect(ok).toEqual({results: [{id: '7', title: 'Koh', size: 10, seeders: 3, indexer: 'A', ageDays: 1}], mayGrab: true, error: ''});
	});

	test('l\'envoi au téléchargement', async () => {
		expect(grabAnswer(200, {ok: true, via: 'library'}, 'Koh-Lanta')).toContain('« Koh-Lanta »');
		expect(grabAnswer(200, {ok: true, via: 'qbittorrent'}, '')).toBe('Envoyé à qBittorrent (catégorie « vjod »).');
		expect(grabAnswer(200, {ok: true}, '')).toBe('Envoyé au téléchargement par Prowlarr.');
		expect(grabAnswer(403, {error: 'Réservé aux administrateurs'}, '')).toBe('Réservé aux administrateurs');
		const post = jest.fn(() => Promise.resolve({status: 200, json: {ok: true}}));
		await grabRelease({url: 'u', key: 'k'}, {id: '7'}, 'Koh', post);
		expect(post).toHaveBeenCalledWith({url: 'u', key: 'k'}, '/tv/api/fetch/grab', {id: '7', show: 'Koh'}, 40000);
	});
});
