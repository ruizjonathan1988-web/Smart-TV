import {channelCardText, mineCardText, replayHome, replayRowCards, startShows, whyOf} from './maTvReplayHome';

const raw = {
	mine: [{id: 'a', chan: 'tf1', show: 'Koh-Lanta', img: 'k.jpg'}, {id: 'b', chan: 'm6', show: 'Top Chef'}],
	mine_new: 2,
	chans: [{chan: 'tf1', name: 'TF1', new: 2, count: 30}, {chan: 'arte', name: 'Arte', new: 0, count: 12}, {chan: 'vide', name: 'Vide', count: 0}],
	featured: [{id: 'f', chan: 'arte', show: 'Karambolage', img: 'f.jpg'}],
	suggest: [{id: 's', chan: 'tf1', show: 'Koh-Lanta', live_at: 1700000000}]
};

describe('maTvReplayHome', () => {
	test('lit la réponse de Ma TV', () => {
		const h = replayHome(raw);
		expect(h.mineNew).toBe(2);
		expect(h.channels[0]).toEqual({chan: 'tf1', name: 'TF1', fresh: 2, count: 30});
		expect(h.mine[0].show).toBe('Koh-Lanta');
		expect(replayHome(null)).toBeNull();
	});

	test('les cartes de la rangée : Mes émissions, puis les chaînes qui ont du replay', () => {
		const cards = replayRowCards(replayHome(raw), {arte: 'arte.png'});
		expect(cards.map((c) => c.Name)).toEqual(['Mes émissions · 2 nouveaux épisodes', 'TF1 · 2 nouveaux', 'Arte · 12 en replay']);
		expect(cards[0]._vjodReplay).toEqual({kind: 'mine'});
		expect(cards[0]._externalTileUrl).toBe('k.jpg');
		expect(cards[2]._externalTileUrl).toBe('arte.png');
		expect(cards[2]._vjodReplay).toEqual({kind: 'chan', chan: 'arte', name: 'Arte'});
	});

	test('les textes de l\'APK', () => {
		expect(mineCardText({mine: [], mineNew: 0})).toBe('Suis tes émissions');
		expect(mineCardText({mine: [{show: 'X'}], mineNew: 0})).toBe('Rien de nouveau');
		expect(mineCardText({mine: [{show: 'X'}], mineNew: 1})).toBe('1 nouveau épisode');
		expect(channelCardText({fresh: 1, count: 3})).toBe('1 nouveau');
	});

	test('pourquoi une émission est proposée', () => {
		const now = new Date(2026, 10, 24, 20, 0);
		expect(whyOf({liveAt: 0}, 'Mar. 3 nov.', now)).toBe('à la une · Mar. 3 nov.');
		expect(whyOf({liveAt: new Date(2026, 10, 24, 9).getTime() / 1000}, '', now)).toBe('vu en direct aujourd’hui');
		expect(whyOf({liveAt: new Date(2026, 10, 23, 21).getTime() / 1000}, '', now)).toBe('vu en direct hier');
		expect(whyOf({liveAt: new Date(2026, 10, 20, 21).getTime() / 1000}, '', now)).toBe('vu en direct vendredi');
	});

	test('une émission par ligne, ce qu\'on a regardé d\'abord', () => {
		expect(startShows(replayHome(raw)).map((e) => e.show)).toEqual(['Koh-Lanta', 'Karambolage']);
	});
});
