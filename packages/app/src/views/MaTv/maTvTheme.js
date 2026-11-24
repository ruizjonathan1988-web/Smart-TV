// Identité visuelle « Ma TV », reprise au pixel depuis l'APK VJOD
// (lib/ui/screens/vjod_tv/ma_tv_widgets.dart → MaTvColors + dimensions).
// Les couleurs translucides sont l'encre blanc-cassé chaude à différentes
// opacités, exactement comme dans l'app d'origine.

const INK_RGB = '237, 235, 230'; // #EDEBE6 — blanc cassé chaud
const BG_RGB = '11, 11, 13'; // #0B0B0D — noir chaud

export const maTvColors = {
	bg: '#0B0B0D', // fond
	ink: 'rgb(237, 235, 230)', // texte principal
	mute: `rgba(${INK_RGB}, 0.60)`, // texte secondaire
	faint: `rgba(${INK_RGB}, 0.30)`, // texte estompé
	panel: `rgba(${BG_RGB}, 0.95)`, // panneau opaque
	panelSoft: `rgba(${BG_RGB}, 0.85)`, // panneau adouci
	row: `rgba(${INK_RGB}, 0.06)`, // ligne au repos
	rowOn: `rgba(${INK_RGB}, 0.16)`, // ligne focalisée / sélectionnée
	rowSelected: `rgba(${INK_RGB}, 0.10)`, // ligne sélectionnée non focalisée
	accent: '#E5A23A', // accent VJOD (doré) — focus, sélections
	live: '#E5484D', // pastille « en direct »
	good: '#5BD18B', // vert (OK, dispo)
	hairline: `rgba(${INK_RGB}, 0.13)` // filets / bordures
};

// Dimensions de la mise en page Ma TV (en pixels, repères de l'APK).
export const maTvLayout = {
	categoryRailWidth: 230, // rail des catégories à gauche
	previewPanelWidth: 380, // panneau d'aperçu à droite
	panelGap: 18, // espace entre les colonnes
	rowHeight: 52, // hauteur d'une ligne (catégorie / liste)
	channelCardHeight: 84, // vignette chaîne
	channelCardCompactHeight: 64 // vignette chaîne compacte
};
