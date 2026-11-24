// La barre du haut du look VJOD, comme sur la box (top_toolbar.dart) : le logo,
// les onglets en toutes lettres (l'actif souligné de rouge), la recherche
// « Film, acteur, chaîne… », le bouton Aura jaune et l'avatar, qui ouvre le
// menu « Aussi dans VJOD ».
import {memo, useCallback, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {useUserAvatar} from '../../hooks/useUserAvatar';
import useEnRouteCount from '../../hooks/useEnRouteCount';
import {openAuraDrawer} from '../Aura';
import {isKidsMode} from '../../utils/kidsMode';
import {CONTENT_FOCUS_TARGETS, focusFirstContentTarget} from '../../utils/navFocusTargets';
import {KEYS} from '../../utils/keys';
import {SearchIcon} from '../icons/navIcons';
import {SPARKLE} from '../Aura/auraUi';
import VjodMenu from './VjodMenu';
import logo from './vjod_logo.png';
import css from './VjodNavBar.module.less';

const Tab = Spottable('div');
const Round = Spottable('div');
const Bar = SpotlightContainerDecorator({enterTo: 'last-focused', defaultElement: '.spottable-default', preserveId: true}, 'nav');

const VjodTab = ({label, on, badge, onClick, spotlightId, isDefault}) => (
	<Tab className={`${css.tab} ${on ? css.tabOn : ''} ${isDefault ? 'spottable-default' : ''}`} onClick={onClick} spotlightId={spotlightId}>
		{label}
		{badge ? <span className={css.badge}>{badge > 99 ? '99+' : badge}</span> : null}
	</Tab>
);

const VjodNavBar = ({activeView = 'home', libraries, onHome, onSearch, onShuffle, onGenres, onFavorites, onMaTv, onReplay, onTonight, onFilms, onSeries, onSelectLibrary, onExplorer, onBientot, onEnRoute, onSettings, onUserMenu, onRequests, hideForTrailer}) => {
	const {settings} = useSettings();
	const {isEnabled: seerrEnabled} = useSeerr();
	const {user, avatarUrl, initial, onError} = useUserAvatar();
	const kids = isKidsMode(settings);
	const simple = Boolean(settings.vjodSimpleMode) && !kids;
	const seerr = !kids && seerrEnabled;
	const enRouteCount = useEnRouteCount(seerr && !simple && Boolean(onEnRoute));
	// En mode enfants, la box garde Films et Séries quand la bibliothèque en a, et
	// les ouvre sur la bibliothèque (pas de Seerr pour les enfants).
	const kidsMovies = kids ? (libraries || []).find((l) => l.CollectionType === 'movies') : null;
	const kidsShows = kids ? (libraries || []).find((l) => l.CollectionType === 'tvshows') : null;
	const openKidsMovies = useCallback(() => onSelectLibrary && onSelectLibrary(kidsMovies), [onSelectLibrary, kidsMovies]);
	const openKidsShows = useCallback(() => onSelectLibrary && onSelectLibrary(kidsShows), [onSelectLibrary, kidsShows]);
	const [menuOpen, setMenuOpen] = useState(false);
	const openMenu = useCallback(() => setMenuOpen(true), []);
	const closeMenu = useCallback(() => setMenuOpen(false), []);

	const handleKeyDown = useCallback((e) => {
		if (e.keyCode !== KEYS.DOWN) return;
		e.preventDefault();
		e.stopPropagation();
		focusFirstContentTarget(CONTENT_FOCUS_TARGETS, 'down');
	}, []);

	return (
		<>
			<Bar className={`${css.bar} ${hideForTrailer ? css.hidden : ''}`} onKeyDown={handleKeyDown} spotlightId="navbar">
				<div className={css.logo}><img src={logo} alt="VJOD" /></div>
				<div className={css.tabs}>
					<VjodTab label="Accueil" on={activeView === 'home'} onClick={onHome} spotlightId="navbar-home" isDefault />
					{kids && kidsMovies && onSelectLibrary ? <VjodTab label="Films" on={activeView === kidsMovies.Id} onClick={openKidsMovies} spotlightId="navbar-films" /> : null}
					{kids && kidsShows && onSelectLibrary ? <VjodTab label="Séries" on={activeView === kidsShows.Id} onClick={openKidsShows} spotlightId="navbar-series" /> : null}
					{!kids && onFilms ? <VjodTab label="Films" on={activeView === 'films'} onClick={onFilms} spotlightId="navbar-films" /> : null}
					{!kids && onSeries ? <VjodTab label="Séries" on={activeView === 'series'} onClick={onSeries} spotlightId="navbar-series" /> : null}
					{onMaTv ? <VjodTab label="TV" on={activeView === 'matv'} onClick={onMaTv} spotlightId="navbar-matv" /> : null}
					{!simple && onReplay ? <VjodTab label="Replay" on={activeView === 'replay'} onClick={onReplay} spotlightId="navbar-replay" /> : null}
					{seerr && !simple && onExplorer ? <VjodTab label="Explorer" on={activeView === 'explorer'} onClick={onExplorer} spotlightId="navbar-explorer" /> : null}
					{seerr && !simple && onBientot ? <VjodTab label="Bientôt" on={activeView === 'bientot'} onClick={onBientot} spotlightId="navbar-bientot" /> : null}
					{seerr && !simple && onEnRoute ? <VjodTab label="En route" on={activeView === 'enroute'} badge={enRouteCount} onClick={onEnRoute} spotlightId="navbar-enroute" /> : null}
				</div>
				<div className={css.right}>
					<Round className={`${css.search} ${activeView === 'search' ? css.searchOn : ''}`} onClick={onSearch} spotlightId="navbar-search">
						<SearchIcon className={css.searchIcon} />
						<span>Film, acteur, chaîne…</span>
					</Round>
					{!kids && settings.auraMode === 'button' ? (
						<Round className={css.aura} onClick={openAuraDrawer} spotlightId="navbar-aura"><svg viewBox="0 0 24 24" className={css.auraIcon}><path d={SPARKLE} /></svg></Round>
					) : null}
					<Round className={css.avatar} onClick={openMenu} spotlightId="navbar-user">
						{avatarUrl ? <img src={avatarUrl} alt={user?.Name} onError={onError} /> : <span>{initial}</span>}
					</Round>
				</div>
			</Bar>
			{menuOpen ? (
				<VjodMenu
					name={(user && user.Name) || ''}
					initial={initial}
					avatarUrl={avatarUrl}
					kids={kids}
					simple={simple}
					seerr={seerr}
					admin={Boolean(user && user.Policy && user.Policy.IsAdministrator)}
					onClose={closeMenu}
					onChange={onUserMenu}
					onShuffle={onShuffle}
					onGenres={onGenres}
					onFavorites={onFavorites}
					onTonight={onTonight}
					onRequests={onRequests}
					onEnRoute={onEnRoute}
					onBientot={onBientot}
					onConnect={onUserMenu}
					onSettings={onSettings}
				/>
			) : null}
		</>
	);
};

export default memo(VjodNavBar);
