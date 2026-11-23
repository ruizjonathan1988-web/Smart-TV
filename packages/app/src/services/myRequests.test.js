import {STATE, requestState, downloadProgress, myRequestEntries, parseMaTvDownloads, applyLiveDownloads, etaLabel, journey} from './myRequests';

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
});
