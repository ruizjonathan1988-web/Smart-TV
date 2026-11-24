// Le chemin d'un fichier dit d'où vient une copie (provider_stream.dart de
// l'APK) : la bibliothèque principale, une copie en langue étrangère
// (« Russian Movies »), ou le flux du fournisseur IPTV (un .strm).

export const isProviderLibraryName = (name) => /fournisseur|provider|iptv|xtream/i.test(name || '');
export const isLanguageLibraryName = (name) => /russ|рус/i.test(name || '');

const folders = (path) => {
	const list = String(path).split(/[/\\]/).filter(Boolean);
	list.pop();
	return list;
};

export const isProviderStreamPath = (path) => {
	if (!path) return false;
	if (/\.strm$/i.test(path)) return true;
	return folders(path).some(isProviderLibraryName);
};

export const isLanguageCopyPath = (path) => Boolean(path) && folders(path).some(isLanguageLibraryName);

// Ce que vaut une copie, la meilleure d'abord : 0 la bibliothèque principale,
// 1 une copie en langue, 2 le flux du fournisseur.
export const copyRankOfPath = (path) => {
	if (isProviderStreamPath(path)) return 2;
	if (isLanguageCopyPath(path)) return 1;
	return 0;
};

// La clé que partagent deux copies d'un film ou d'une série : l'id TMDB, sinon
// le type, le nom et l'année.
const titleKey = (item) => {
	const type = item && item.Type;
	if (type !== 'Movie' && type !== 'Series') return null;
	const tmdb = item.ProviderIds && (item.ProviderIds.Tmdb || item.ProviderIds.tmdb);
	if (tmdb) return `${type}|tmdb|${tmdb}`;
	const name = String(item.Name || '').trim().toLowerCase();
	return name ? `${type}|${name}|${item.ProductionYear || ''}` : null;
};

// Le flux du fournisseur d'un titre dont la liste a déjà le fichier du
// serveur s'en va : on tombe sur sa copie plutôt que sur un flux qui peut
// lâcher (own_copy_first.dart de l'APK). L'ordre reste le même.
export const withoutStreamDuplicates = (items) => {
	if (!Array.isArray(items) || !items.some((i) => i && isProviderStreamPath(i.Path))) return items;
	const owned = new Set();
	items.forEach((i) => {
		if (isProviderStreamPath(i.Path)) return;
		const key = titleKey(i);
		if (key) owned.add(key);
	});
	if (!owned.size) return items;
	return items.filter((i) => !isProviderStreamPath(i.Path) || !owned.has(titleKey(i)));
};
