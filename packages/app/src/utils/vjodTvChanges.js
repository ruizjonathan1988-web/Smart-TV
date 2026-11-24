// Les versions de VJOD sur la télé et ce que chacune apporte, la plus récente
// d'abord (comme vjod_changes.dart dans l'APK). L'appli montre une fois, après
// une mise à jour, ce qui a changé depuis la dernière version vue sur cette télé.
// Chaque mise à jour ajoute une entrée en haut, en français, une ligne par
// changement, dite comme on le dirait à la maison.

export const VJOD_TV_RELEASES = [
	{version: '1.0', changes: [
		'VJOD arrive sur les télés LG et Samsung, avec le même look que sur la box et l’ouverture au lancement (Réglages › Apparence).',
		'« Ce soir » propose quoi regarder ; l’accueil dit pourquoi un titre est là et apprend de tes « J’ai aimé » et « Bof » au générique.',
		'Ma TV, le Replay et le catalogue de ton fournisseur depuis l’accueil ; un film commencé ici reprend sur le téléphone, et l’inverse.',
		'Séries du fournisseur : ▲ passe le générique, l’épisode suivant s’enchaîne tout seul.',
		'Explorer, Bientôt et En route, avec un badge qui compte ce qui arrive ; une émission du replay se garde par Seerr ou tes trackers.',
		'Aura, le jeu de cinéma : propose des films à la maison depuis leur fiche (Réglages › Général).',
		'« Signaler un problème » envoie à l’admin un message WhatsApp déjà rempli, par un QR code à scanner.'
	]}
];

export const VJOD_TV_VERSION = VJOD_TV_RELEASES[0].version;

export const compareVersions = (a, b) => {
	const pa = String(a).split('.').map(Number);
	const pb = String(b).split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d) return d < 0 ? -1 : 1;
	}
	return 0;
};

// Les versions depuis celle vue en dernier sur cette télé (toutes si on a sauté
// des versions), la plus récente d'abord ; sans version vue, la seule actuelle.
export const releasesSince = (seen, current = VJOD_TV_VERSION, releases = VJOD_TV_RELEASES) => releases.filter((r) =>
	r.changes.length && compareVersions(r.version, current) <= 0 &&
	(seen ? compareVersions(r.version, seen) > 0 : r.version === current));

// Le texte de la fenêtre : huit lignes au plus, la version devant chaque bloc
// quand il y en a plusieurs.
export const whatsNewText = (releases, max = 8) => {
	const lines = [];
	for (const r of releases) {
		if (releases.length > 1) lines.push(`VJOD TV ${r.version}`);
		for (const c of r.changes) lines.push(`• ${c}`);
	}
	return lines.slice(0, max + (releases.length > 1 ? releases.length : 0)).join('\n');
};
