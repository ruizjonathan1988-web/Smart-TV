import {isVjodLook, vjodRowSubtitle, vjodRowTitle, withVjodRowLabels} from './vjodRowSubtitles';

jest.mock('./vjodRowBuilders', () => ({ROW_COLLECTION: {vjod_unwatched_gems: 'gems', vjod_short_gems: 'short_gems', vjod_epic: 'epic', vjod_binge: 'binge'}}));

describe('sous-titres du look VJOD', () => {
	test('seulement avec le thème VJOD ou Écrin, sans thème personnalisé', () => {
		expect(isVjodLook({visualTheme: 'vjod'})).toBe(true);
		expect(isVjodLook({visualTheme: 'ecrin'})).toBe(true);
		expect(isVjodLook({visualTheme: 'vjod', customThemeId: 'x'})).toBe(false);
		expect(isVjodLook({visualTheme: 'moonfin'})).toBe(false);
		expect(isVjodLook(null)).toBe(false);
	});

	test('les textes de l\'APK', () => {
		expect(vjodRowSubtitle('seerr_for_you')).toBe('Vos goûts, Trakt et BetaSeries réunis');
		expect(vjodRowSubtitle('french_movies')).toBe('Les cartons, les primés, les acclamés');
		expect(vjodRowSubtitle('vjod_mood')).toBe('Votre humeur colore les rangées jusqu\'à demain matin');
		expect(vjodRowSubtitle('vjod_unwatched_gems')).toBe('Prêt à lancer');
		expect(vjodRowSubtitle('vjod_epic')).toBe('À voir sur le plus grand écran');
		expect(vjodRowSubtitle('vjod_binge')).toBe('Séries terminées et excellentes');
		expect(vjodRowSubtitle('top10_series')).toBe(null);
		// Comme l'APK : seulement avec la bascule films / séries.
		expect(vjodRowTitle({id: 'top10_movies', top10Switches: true})).toBe('Top 10 en France aujourd\'hui');
		expect(vjodRowTitle({id: 'top10_movies'})).toBe(null);
		expect(vjodRowTitle({id: 'top10_series'})).toBe(null);
	});

	test('les rangées reçoivent titre et sous-titre, les autres restent telles quelles', () => {
		const other = {id: 'seerr_sagas', title: 'Pour continuer la saga', items: []};
		const [top, forYou, same] = withVjodRowLabels([
			{id: 'top10_movies', title: 'Top 10 du moment', top10Switches: true, items: []},
			{id: 'seerr_for_you', title: 'Pour vous', items: []},
			other
		]);
		expect(top).toMatchObject({title: 'Top 10 en France aujourd\'hui'});
		expect(top.subtitle).toBeUndefined();
		expect(forYou).toMatchObject({title: 'Pour vous', subtitle: 'Vos goûts, Trakt et BetaSeries réunis'});
		expect(same).toBe(other);
	});
});
