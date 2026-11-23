// Les ouvertures de VJOD (vjod_intro.dart dans l'APK) : laquelle joue au
// lancement, et si elle change toute seule.

export const INTRO_STYLES = [
	{id: 'drop', label: 'Le drop', seconds: 9.5, description: 'Le favori. Jump-up drum\'n\'bass à 174 BPM : le terminal tape ses commandes plein écran, le logo vibre de plus en plus, un temps de vide sur « ./vjod --drop »… puis le drop, et le logo vibre au rythme de la basse.'},
	{id: 'terminal', label: 'Les lignes de commande', seconds: 4.4, description: 'Un terminal se connecte à la seedbox, vérifie les 30 sources, imprime le logo en caractères, « ./vjod --play » et Entrée.'},
	{id: 'hacker', label: 'Le hacker', seconds: 3.35, description: 'Pluie de code, le logo se déchiffre caractère par caractère, « accès autorisé », glitchs, puis la télé s\'éteint.'},
	{id: 'plateforme', label: 'La plateforme', seconds: 3.0, description: 'Des milliers de caractères forment VJOD, gros impact de bande-annonce, puis le logo se dissout en pixels.'},
	{id: 'signal', label: 'Le signal', seconds: 3.25, description: 'Une vieille télé s\'allume dans la neige, le signal se cale sur VJOD avec des glitchs, puis s\'éteint en un point.'},
	{id: 'lame', label: 'La lame', seconds: 3.25, description: 'Une lame de lumière dessine le logo, le bouton lecture frappe, plongée dedans.'},
	{id: 'ruban', label: 'Le ruban', seconds: 3.3, description: 'Un ruban rouge ondule et se noue en VJOD, un reflet passe, puis il repart en trait de lumière.'},
	{id: 'battement', label: 'Le battement', seconds: 3.4, description: 'Le bouton lecture bat deux fois, se range dans le D, puis V, J, O, D tombent un par un.'}
];

export const INTRO_FALLBACK = 'drop';

export const INTRO_ROTATIONS = [
	{id: 'never', label: 'Jamais', description: 'Toujours l\'ouverture choisie.'},
	{id: 'eachLaunch', label: 'À chaque lancement', description: 'Une ouverture au hasard à chaque fois.'},
	{id: 'eachDay', label: 'Chaque jour', description: 'Une ouverture différente chaque jour.'}
];

export const styleById = (id) => INTRO_STYLES.find((s) => s.id === id) || null;

// L'ouverture choisie dans les réglages ; null pour « Aucune ».
export const chosenStyle = (settings) => {
	const v = settings && settings.vjodIntro;
	if (v === 'none') return null;
	return styleById(v) || styleById(INTRO_FALLBACK);
};

const dayIndex = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

// L'ouverture à jouer maintenant : la choisie, ou une autre quand elle change
// toute seule (à chaque lancement, ou chaque jour).
export const currentStyle = (settings, now = new Date(), random = Math.random) => {
	const picked = chosenStyle(settings);
	if (!picked) return null;
	switch (settings && settings.vjodIntroRotation) {
		case 'eachLaunch': return INTRO_STYLES[Math.floor(random() * INTRO_STYLES.length) % INTRO_STYLES.length];
		case 'eachDay': return INTRO_STYLES[dayIndex(now) % INTRO_STYLES.length];
		default: return picked;
	}
};
