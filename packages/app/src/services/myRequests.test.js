import {STATE, requestState, downloadProgress, myRequestEntries, parseMaTvDownloads, applyLiveDownloads, etaLabel, journey,
	newlyReady, readyKey, readyNotification, promoteInLibrary, withLibrary, takeReadyNews, onRequestsReady} from './myRequests';
import {getFromStorage, saveToStorage} from './storage';

jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

const NOW = Date.parse('2026-11-23T20:00:00');
const req = (over = {}, media = {}) => ({id: 1, type: 'movie', status: 2, updatedAt: '2026-11-22T10:00:00', media: {tmdbId: 10, status: 3, ...media}, ...over});

describe('myRequests', () => {
	test('états', () => {
		expect(requestState(req({status: 3}))).toBe(STATE.declined);
		expect(requestState(req({}, {downloadStatus: [{size: 10}]}))).toBe(STATE.downloading);
		expect(requestState(req({}, {status: 5}))).toBe(STATE.ready);
		expect(requestState(req({status: 5}, {status: 4}))).toBe(STATE.ready);
		expect(requestState(req({status: 1}))).toBe(STATE.pending);
		expect(requestState(req())).toBe(STATE.approved);
	});

	test('avancement, chaque fichier une fois', () => {
		expect(downloadProgress([{downloadId: 'a', size: 100, sizeLeft: 25}, {downloadId: 'a', size: 100, sizeLeft: 25}])).toBe(0.75);
		expect(downloadProgress([])).toBe(null);
	});

	test('une entrée par titre, fenêtres et tri', () => {
		const list = myRequestEntries([
			req({id: 1, status: 1}),
			req({id: 2}, {downloadStatus: [{size: 10, sizeLeft: 5}]}),
			req({id: 3, type: 'tv'}, {tmdbId: 20, status: 5, mediaAddedAt: '2026-10-01T00:00:00'}),
			req({id: 4, status: 3, updatedAt: '2026-11-20T00:00:00'}, {tmdbId: 30})
		], NOW);
		expect(list.map((e) => e.request.id)).toEqual([2, 4]);
		expect(list[0].progress).toBe(0.5);
	});

	test('téléchargements en direct', () => {
		const downloads = parseMaTvDownloads({items: [{type: 'movie', tmdb: 10, progress: 0.4, eta: '2026-11-23T20:30:00', stalled: false}, {type: 'tv'}]});
		expect(downloads).toHaveLength(1);
		const [e] = applyLiveDownloads(myRequestEntries([req()], NOW), downloads);
		expect(e.state).toBe(STATE.downloading);
		expect(e.progress).toBe(0.4);
		expect(etaLabel(e.eta, NOW)).toBe('fini dans 30 min');
		expect(journey(e)).toBeCloseTo(0.59);
	});

	test('heure de fin', () => {
		expect(etaLabel(Date.parse('2026-11-23T22:05:00'), NOW)).toBe('fin vers 22:05');
		expect(etaLabel(Date.parse('2026-11-24T08:10:00'), NOW)).toBe('fin demain vers 08:10');
		expect(etaLabel(Date.parse('2026-11-26T08:10:00'), NOW)).toBe('fin le 26/11 vers 08:10');
		expect(etaLabel(NOW - 1000, NOW)).toBe('');
	});

	test('prêtes pas encore annoncées : rien au tout premier passage', () => {
		const entries = myRequestEntries([req({id: 7}, {status: 5, mediaAddedAt: '2026-11-23T10:00:00'}), req({id: 8, status: 1}, {tmdbId: 11})], NOW);
		expect(newlyReady(entries, null)).toEqual([]);
		expect(newlyReady(entries, []).map(readyKey)).toEqual(['req:7']);
		expect(newlyReady(entries, ['req:7'])).toEqual([]);
	});

	test('ce que la bibliothèque a déjà passe prêt, sauf une vieille demande', () => {
		const entries = myRequestEntries([
			req({id: 1}, {tmdbId: 10}),
			req({id: 2, status: 1, updatedAt: '2026-09-01T00:00:00'}, {tmdbId: 12}),
			req({id: 3, type: 'tv'}, {tmdbId: 13})
		], NOW);
		const out = promoteInLibrary(entries, new Set(['movie:10', 'movie:12']), NOW);
		expect(out.map((e) => [e.request.id, e.state])).toEqual([[1, STATE.ready], [3, STATE.approved]]);
	});

	test('la bibliothèque est interrogée par l\'id TMDB', async () => {
		const api = {getItems: jest.fn(({AnyProviderIdEquals}) => Promise.resolve({Items: AnyProviderIdEquals === 'tmdb.10' ? [{Type: 'Movie', ProviderIds: {Tmdb: '10'}}] : []}))};
		const out = await withLibrary(api, myRequestEntries([req({id: 1}), req({id: 2}, {tmdbId: 99})], NOW), NOW);
		expect(api.getItems).toHaveBeenCalledTimes(2);
		expect(out.find((e) => e.request.id === 1).state).toBe(STATE.ready);
		expect(out.find((e) => e.request.id === 2).state).toBe(STATE.approved);
		expect(await withLibrary(null, [])).toEqual([]);
	});

	test('annonce une fois ce qui vient d\'arriver', async () => {
		const entries = myRequestEntries([req({id: 7}, {status: 5, mediaAddedAt: '2026-11-23T10:00:00'})], NOW);
		const heard = jest.fn();
		const stop = onRequestsReady(heard);
		getFromStorage.mockResolvedValue(null);
		expect(await takeReadyNews(entries, () => 'Dune')).toEqual([]);
		expect(saveToStorage).toHaveBeenLastCalledWith('vjodAnnouncedReady', ['req:7']);
		getFromStorage.mockResolvedValue([]);
		expect(await takeReadyNews(entries, () => 'Dune')).toEqual(['Dune']);
		expect(heard).toHaveBeenCalledWith(['Dune']);
		getFromStorage.mockResolvedValue(['req:7']);
		expect(await takeReadyNews(entries, () => 'Dune')).toEqual([]);
		stop();
	});

	test('le bandeau « Prêt à regarder »', () => {
		expect(readyNotification(['Dune'], 1)).toEqual({key: 'requests-ready-1', title: 'Prêt à regarder', body: 'Dune est dans votre bibliothèque.'});
		expect(readyNotification(['A', 'B'], 2).body).toBe('2 titres demandés sont dans votre bibliothèque.');
	});
});
