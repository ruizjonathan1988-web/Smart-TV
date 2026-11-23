// Les bibliothèques qui tiennent une copie en langue étrangère des principales
// (« Russian Movies » à côté de « Films ») ou le catalogue du fournisseur IPTV
// (secondary_library.dart de l'APK). Elles partagent l'onglet de la principale
// et s'atteignent par une pastille en haut de la bibliothèque.
import {isLanguageLibraryName, isProviderLibraryName} from './copyRank';

export const isSecondaryLibraryName = (name) => isLanguageLibraryName(name) || isProviderLibraryName(name);

// L'ordre des pastilles : la principale, la copie en langue, le fournisseur.
export const libraryChipRank = (name) => (isProviderLibraryName(name) ? 2 : isLanguageLibraryName(name) ? 1 : 0);

const typeOf = (lib) => String((lib && lib.CollectionType) || '').toLowerCase();

export const libraryChipLabel = (lib, siblings = []) => {
	const name = (lib && lib.Name) || '';
	const mains = siblings.filter((s) => !isSecondaryLibraryName(s.Name)).length;
	if (!isSecondaryLibraryName(name) && mains > 1) return name;
	const base = typeOf(lib) === 'tvshows' ? 'Séries' : 'Films';
	if (isProviderLibraryName(name)) return 'Fournisseur';
	return isLanguageLibraryName(name) ? `${base} RU` : base;
};

// Les bibliothèques du même genre (films ou séries) que current, la principale
// d'abord ; vide quand il n'y a pas de copie, pour que la plupart des comptes
// ne voient rien.
export const librarySiblings = (libraries, current) => {
	const type = typeOf(current);
	if (!current || (type !== 'movies' && type !== 'tvshows')) return [];
	const same = (libraries || []).filter((l) => typeOf(l) === type);
	if (!same.some((l) => isSecondaryLibraryName(l.Name)) || same.length < 2) return [];
	return same.slice().sort((a, b) => libraryChipRank(a.Name) - libraryChipRank(b.Name));
};

// Les onglets : une copie disparaît quand une principale du même genre existe.
export const withoutLibraryCopies = (libraries) => {
	const list = libraries || [];
	return list.filter((l) => {
		const type = typeOf(l);
		if ((type !== 'movies' && type !== 'tvshows') || !isSecondaryLibraryName(l.Name)) return true;
		return !list.some((m) => typeOf(m) === type && !isSecondaryLibraryName(m.Name));
	});
};
