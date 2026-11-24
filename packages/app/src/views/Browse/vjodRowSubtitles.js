// Les sous-titres des rangées du look VJOD (_rowSubtitle et _rowTitle de
// home_screen.dart) : la maquette dit à quoi sert une rangée, pas d'où elle
// vient. Hors du look VJOD, les rangées gardent leurs titres et sous-titres.
import {collectionById} from '../../services/vjodCollections';
import {ROW_COLLECTION} from './vjodRowBuilders';

export const isVjodLook = (settings) => Boolean(settings && !settings.customThemeId &&
	(settings.visualTheme === 'vjod' || settings.visualTheme === 'ecrin'));

const SUBTITLES = {
	seerr_for_you: 'Vos goûts, Trakt et BetaSeries réunis',
	french_movies: 'Les cartons, les primés, les acclamés',
	vjod_mood: 'Votre humeur colore les rangées jusqu\'à demain matin',
	vjod_replay: 'Un appui : tes émissions · ou une chaîne pour explorer'
};

// Une rangée de collection : ce qu'elle propose, ou « Prêt à lancer » pour
// celles qui piochent dans la bibliothèque.
export const vjodRowSubtitle = (rowId) => {
	if (SUBTITLES[rowId]) return SUBTITLES[rowId];
	const collection = collectionById(ROW_COLLECTION[rowId]);
	if (!collection) return null;
	if (collection.family === 'ready') return 'Prêt à lancer';
	return collection.subtitle || null;
};

export const vjodRowTitle = (rowId) => (rowId === 'top10_movies' ? 'Top 10 en France aujourd\'hui' : null);

export const withVjodRowLabels = (rows) => rows.map((row) => {
	const subtitle = vjodRowSubtitle(row.id);
	const title = vjodRowTitle(row.id);
	if (!subtitle && !title) return row;
	return {...row, ...(subtitle ? {subtitle} : {}), ...(title ? {title} : {})};
});
