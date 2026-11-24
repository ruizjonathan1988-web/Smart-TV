import {memo} from 'react';
import {useSettings} from '../../context/SettingsContext';
import NavBar from './NavBar';
import VjodNavBar from './VjodNavBar';

// Le look VJOD avec la barre en haut prend la barre de la box (onglets en
// toutes lettres) ; les autres looks gardent celle de Moonfin.
const AppNavBar = (props) => {
	const {settings} = useSettings();
	const vjod = !settings.customThemeId && (settings.visualTheme === 'vjod' || settings.visualTheme === 'ecrin') && (settings.navbarPosition || 'top') === 'top';
	return vjod ? <VjodNavBar {...props} /> : <NavBar {...props} />;
};

export default memo(AppNavBar);
export {NavBar, VjodNavBar};
