import {
	replayItem, replayPage, replayChannelPage, subtitleOf, titleOf, dayGroupLabel, firstSentence,
	rowLabel, replayNameKey, nextEpisode, replayLogos, liveForReplay, pickArteStream,
	findIptvRecording, findInLibrary
} from './maTvReplay';

jest.mock('./secureFetch', () => ({platformFetch: () => Promise.resolve(null)}));

describe('maTvReplay — données', () => {
	test('replayItem lit les clés courtes de Ma TV', () => {
		const e = replayItem({id: 1, kind: 'ftv', chan: 'france-2', show: 'Envoyé spécial', aired: 100, dur: 3600, new: true, season: '2', episode: 3});
		expect(e.id).toBe('1');
		expect(e.isNew).toBe(true);
		expect(e.season).toBe(2);
		expect(e.dur).toBe(3600);
	});

	test('replayPage et replayChannelPage tolèrent les trous', () => {
		const p = replayPage({rows: [{id: 'mine', items: [{id: 'a'}]}], categories: [{genre: 'Info'}, {}], chans: [{chan: 'arte'}]});
		expect(p.rows[0].items[0].id).toBe('a');
		expect(p.categories).toEqual(['Info']);
		expect(p.channels[0].name).toBe('arte');
		expect(replayPage(null)).toBeNull();
		const c = replayChannelPage({days: [{day: '2026-11-20', items: []}, {day: 'n\'importe', items: []}]});
		expect(c.days.length).toBe(1);
	});

	test('libellés', () => {
		expect(subtitleOf({season: 1, episode: 2, title: 'Pilote', show: 'X'})).toBe('S1 · É2 · Pilote');
		expect(subtitleOf({title: 'Sujet', show: 'X'})).toBe('Sujet');
		expect(titleOf({show: 'X', title: 'X'})).toBe('X');
		expect(titleOf({show: 'X', title: 'Y'})).toBe('X · Y');
		const now = new Date(2026, 10, 23, 12);
		expect(dayGroupLabel('2026-11-23', now)).toBe('Aujourd’hui');
		expect(dayGroupLabel('2026-11-22', now)).toBe('Hier');
		expect(dayGroupLabel('2026-11-02', now)).toBe('Lun. 2 nov.');
		expect(firstSentence('Une. Deux.')).toBe('Une.');
		expect(rowLabel('Documentaires')).toBe('Le meilleur du documentaire');
	});

	test('replayNameKey rapproche les noms de chaînes', () => {
		expect(replayNameKey('FR: France 2 HD')).toBe('france2');
		expect(replayNameKey('france-2')).toBe('france2');
	});

	test('nextEpisode prend la diffusion suivante de la même émission', () => {
		const a = {id: 'a', show: 'S', aired: 10};
		const list = [a, {id: 'c', show: 'S', aired: 30}, {id: 'b', show: 'S', aired: 20}, {id: 'z', show: 'T', aired: 15}];
		expect(nextEpisode(a, list).id).toBe('b');
		expect(nextEpisode({id: 'c', show: 'S', aired: 30}, list)).toBeNull();
	});

	test('logos et direct depuis la grille Ma TV', () => {
		const chans = [{chan: 'france-2', name: 'France 2'}];
		const live = [{id: '1', name: 'FR: France 2 HD', logo: 'l.png'}, {id: '2', name: 'France 2 FHD', logo: 'x.png'}, {id: '3', name: 'TF1'}];
		expect(replayLogos(chans, live)).toEqual({'france-2': 'l.png'});
		expect(liveForReplay(chans, live).map((c) => c.id)).toEqual(['1']);
	});
});

describe('maTvReplay — lecture', () => {
	test('Arte : VF, puis VOSTF, puis la première', () => {
		const mk = (labels) => ({data: {attributes: {streams: labels.map((l, i) => ({url: `u${i}`, versions: [{shortLabel: l}]}))}}});
		expect(pickArteStream(mk(['VA', 'VOSTF', 'VF']))).toBe('u2');
		expect(pickArteStream(mk(['VA', 'VOSTF']))).toBe('u1');
		expect(pickArteStream(mk(['VA']))).toBe('u0');
		expect(pickArteStream(null)).toBeNull();
	});

	test('enregistrement IPTV seulement si le rattrapage remonte assez', () => {
		const item = {kind: 'iptv', chan: 'tf1', aired: 1000};
		const all = [{id: 'tf1', name: 'TF1', arc: 7}];
		expect(findIptvRecording(item, all, 1000 + 86400 * 2).id).toBe('tf1');
		expect(findIptvRecording(item, all, 1000 + 86400 * 9)).toBeNull();
		expect(findIptvRecording({...item, kind: 'ftv'}, all, 2000)).toBeNull();
	});

	test('bibliothèque : épisode par numéros, sinon la série', async () => {
		const jellyfin = {
			getItems: (q) => Promise.resolve(q.IncludeItemTypes === 'Series'
				? {Items: [{Id: 's', Name: 'Plus belle la vie'}]}
				: {Items: [{Id: 'e1', ParentIndexNumber: 1, IndexNumber: 4}]})
		};
		const hit = await findInLibrary({show: 'Plus belle la vie', season: 1, episode: 4}, jellyfin);
		expect(hit).toEqual({item: {Id: 'e1', ParentIndexNumber: 1, IndexNumber: 4}, episode: true});
		const miss = await findInLibrary({show: 'Plus belle la vie', season: 2, episode: 1}, jellyfin);
		expect(miss.episode).toBe(false);
		expect(await findInLibrary({show: 'Autre'}, jellyfin)).toBeNull();
	});
});
