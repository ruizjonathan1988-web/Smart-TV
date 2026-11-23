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
