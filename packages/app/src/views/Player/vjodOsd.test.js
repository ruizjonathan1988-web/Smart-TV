import {vjodOsdButtons, vjodTitleLines} from './vjodOsd';

const b = (id, action = id) => ({id, action, label: id, icon: null});
const top = [b('previous'), b('rewind'), b('playPause'), b('forward'), b('next')];
const bottom = [b('favorite'), b('episodes'), b('subtitles', 'subtitle'), b('audio'), b('info')];

describe('vjodOsdButtons', () => {
	test('garde reculer, lecture, avancer et met les mots de la box à droite', () => {
		const {transport, words, extra} = vjodOsdButtons({topButtons: top, bottomButtons: bottom});
		expect(transport.map((x) => x.id)).toEqual(['rewind', 'playPause', 'forward']);
		expect(words.map((x) => x.label)).toEqual(['Audio et sous-titres', 'Épisodes', 'Épisode suivant']);
		expect(words[0].action).toBe('vjodTracks');
		expect(extra).toEqual([]);
	});

	test('une seule sorte de piste ouvre directement son choix', () => {
		const {words} = vjodOsdButtons({topButtons: top, bottomButtons: [b('subtitles', 'subtitle')]});
		expect(words[0]).toMatchObject({label: 'Audio et sous-titres', action: 'subtitle'});
	});

	test('« … » montre les autres icônes, sans répéter les mots', () => {
		const {extra} = vjodOsdButtons({topButtons: top, bottomButtons: bottom, more: true});
		expect(extra.map((x) => x.id)).toEqual(['favorite', 'info']);
	});
});

describe('vjodTitleLines', () => {
	test('un épisode : la série en titre, puis saison, épisode et titre', () => {
		expect(vjodTitleLines({SeriesName: 'Dark', Name: 'Secrets', ParentIndexNumber: 1, IndexNumber: 2})).toEqual({main: 'Dark', line: 'Saison 1 · Épisode 2 · Secrets'});
	});

	test('un film : son titre seul', () => {
		expect(vjodTitleLines({Name: 'Dune'})).toEqual({main: 'Dune', line: ''});
	});
});
