import {librarySiblings, libraryChipLabel, withoutLibraryCopies} from './libraryCopies';

const films = {Id: 'f', Name: 'Films', CollectionType: 'movies'};
const ru = {Id: 'r', Name: 'Russian Movies', CollectionType: 'movies'};
const iptv = {Id: 'p', Name: 'Films Fournisseur', CollectionType: 'movies'};
const series = {Id: 's', Name: 'Séries', CollectionType: 'tvshows'};

describe('libraryCopies', () => {
	test('les pastilles : la principale, la copie en langue, le fournisseur', () => {
		const sib = librarySiblings([iptv, series, ru, films], ru);
		expect(sib.map((l) => l.Id)).toEqual(['f', 'r', 'p']);
		expect(sib.map((l) => libraryChipLabel(l, sib))).toEqual(['Films', 'Films RU', 'Fournisseur']);
	});
	test('sans copie, pas de pastilles', () => {
		expect(librarySiblings([films, series], films)).toEqual([]);
		expect(librarySiblings([films, ru], series)).toEqual([]);
	});
	test('les copies quittent les onglets, sauf seules de leur genre', () => {
		expect(withoutLibraryCopies([films, ru, iptv, series]).map((l) => l.Id)).toEqual(['f', 's']);
		expect(withoutLibraryCopies([ru, series]).map((l) => l.Id)).toEqual(['r', 's']);
	});
});
