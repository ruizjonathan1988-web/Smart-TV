// L'« Aperçu en direct » des réglages, dans le look VJOD : la barre du haut telle que
// components/NavBar/VjodNavBar la dessine (le logo, les onglets en toutes lettres avec
// l'actif souligné de rouge, la recherche, le bouton Aura jaune et l'avatar rouge), et non
// la pastille d'icônes de Moonfin. Dessinée à moitié taille, comme le reste de l'aperçu.
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import useUserAvatar from '../../hooks/useUserAvatar';
import {isKidsMode} from '../../utils/kidsMode';
import logo from '../../components/NavBar/vjod_logo.png';

const INK = '#EDEBE6';
const MUTE = 'rgba(237, 235, 230, 0.6)';
const RED = '#C9403F';

// Vrai quand l'appli montre la barre VJOD (App.js, vjodBar).
export const vjodBarShown = (settings) => Boolean(settings && !settings.customThemeId &&
	(settings.visualTheme === 'vjod' || settings.visualTheme === 'ecrin') &&
	(settings.navbarPosition || 'top') === 'top' && !isKidsMode(settings));

// Les onglets de VjodNavBar, dans son ordre et avec ses conditions.
export const vjodPreviewTabs = ({kids = false, simple = false, seerr = false} = {}) => [
	'Accueil',
	...(kids ? [] : ['Films', 'Séries']),
	kids ? 'TV des enfants' : 'TV',
	...(!kids && !simple ? ['Replay'] : []),
	...(seerr && !simple ? ['Explorer', 'Bientôt', 'En route'] : [])
];

const VjodNavbarPreview = ({userName}) => {
	const {settings} = useSettings();
	const {isEnabled: seerrEnabled} = useSeerr();
	const {avatarUrl, onError} = useUserAvatar();
	const kids = isKidsMode(settings);
	const simple = Boolean(settings.vjodSimpleMode) && !kids;
	const tabs = vjodPreviewTabs({kids, simple, seerr: !kids && seerrEnabled});
	const initial = userName ? userName.charAt(0).toUpperCase() : 'U';
	return (
		<div data-preview="vjod-navbar" style={{height: 50, padding: '0 24px', display: 'flex', alignItems: 'center', flexShrink: 0}}>
			<img src={logo} alt="VJOD" style={{height: 22, marginRight: 14, display: 'block'}} />
			<div style={{display: 'flex', alignItems: 'center', flex: '1 1 auto', overflow: 'hidden'}}>
				{tabs.map((label, i) => (
					<div key={label} style={{position: 'relative', padding: '5px 7px 6px', margin: '0 2px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: i === 0 ? '#FFFFFF' : MUTE}}>
						{label}
						{i === 0 ? <div data-preview="vjod-tab-on" style={{position: 'absolute', left: '50%', bottom: 1, width: 17, height: 2, marginLeft: -8, borderRadius: 1, background: RED}} /> : null}
					</div>
				))}
			</div>
			<div style={{display: 'flex', alignItems: 'center', height: 28, padding: '0 11px', marginRight: 6, borderRadius: 14, background: 'rgba(255, 255, 255, 0.1)', color: INK, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap'}}>
				Film, acteur, chaîne…
			</div>
			{!kids && settings.auraMode === 'button' ? <div style={{width: 30, height: 30, marginRight: 5, borderRadius: 15, background: '#F7D154'}} /> : null}
			<div data-preview="vjod-avatar" style={{width: 30, height: 30, borderRadius: 15, background: RED, color: '#FFFFFF', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
				{avatarUrl ? <img src={avatarUrl} alt="" onError={onError} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : initial}
			</div>
		</div>
	);
};

export default VjodNavbarPreview;
