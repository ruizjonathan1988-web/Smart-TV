import {findProviderSeries, replaySourceList} from './replaySources';

const ftv = {id: 'f1', kind: 'ftv', chan: 'france2', show: 'Ici tout commence', aired: 1700000000};
const iptv = {...ftv, kind: 'iptv'};

describe('replaySources', () => {
	test('la série du fournisseur au nom exact, accents et ponctuation ignorés', async () => {
		const vod = {search: jest.fn(() => Promise.resolve([
			{kind: 'movie', name: 'Ici tout commence'},
			{kind: 'series', name: 'Ici tout commence : le prequel'},
			{kind: 'series', name: 'ICI TOUT COMMENCÉ', id: 's9'}
		]))};
		expect((await findProviderSeries(ftv, vod)).id).toBe('s9');
		expect(vod.search).toHaveBeenCalledWith('Ici tout commence', 8);
		expect(await findProviderSeries(ftv, null)).toBeNull();
		expect(await findProviderSeries(ftv, {search: () => Promise.reject(new Error('non'))})).toBeNull();
	});

	test('les sources d\'un épisode de chaîne, dans l\'ordre de l\'APK', () => {
		const list = replaySourceList(ftv, {chanName: 'France 2', lib: {episode: false, item: {Id: 'x'}}, vodSeries: {id: 's'}});
		expect(list.map((s) => s.kind)).toEqual(['library', 'vod', 'vjod', 'tracker']);
		expect(list[0].name).toBe('La série est dans ta bibliothèque');
		expect(list[2].name).toBe('Replay France 2 dans VJOD');
	});

	test('un épisode IPTV : l\'enregistrement avec pub, pas de replay de chaîne', () => {
		const list = replaySourceList(iptv, {chanName: 'France 2', recording: 'https://seed/tv/shift/1.ts'});
		expect(list.map((s) => [s.kind, s.tag || ''])).toEqual([['iptv', 'avec pub'], ['tracker', 'à garder']]);
	});
});
