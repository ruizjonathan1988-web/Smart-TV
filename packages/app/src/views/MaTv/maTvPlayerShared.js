// Ce que partagent le lecteur du direct et celui du replay : le moteur natif
// de la plateforme et la transparence qu'exige AVPlay.
import {getPlatform} from '../../platform';

export const loadEngine = () => (getPlatform() === 'tizen'
	? import('./maTvEngineTizen')
	: import('./maTvEngineWebos'));

// AVPlay dessine sous la page : le lecteur et ses ancêtres doivent être transparents.
export const playerBackground = () => (getPlatform() === 'tizen' ? 'transparent' : '#000');

export const setAncestorsTransparent = (node, on) => {
	document.body.style.background = on ? 'transparent' : '';
	document.documentElement.style.background = on ? 'transparent' : '';
	let el = node ? node.parentElement : null;
	while (el && el !== document.documentElement) {
		el.style.background = on ? 'transparent' : '';
		el.style.backgroundColor = on ? 'transparent' : '';
		el = el.parentElement;
	}
};
