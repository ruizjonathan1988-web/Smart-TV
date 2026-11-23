// Le menu de l'avatar du look VJOD (VjodMenuPanel de l'APK) : le profil et
// « Changer », puis « Aussi dans VJOD » ; en mode simple, ce que les onglets
// cachés tenaient. Retour ferme.
import {useCallback, useEffect} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {isBackKey} from '../../utils/keys';
import {FavoritesIcon, GenresIcon, SettingsIcon, ShuffleIcon, EnRouteIcon, SoonIcon} from '../icons/navIcons';
import css from './VjodNavBar.module.less';

const Entry = Spottable('div');
const Panel = SpotlightContainerDecorator({enterTo: 'default-element', restrict: 'self-only'}, 'div');

const CONNECT_PATH = 'M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z';
const REQUESTS_PATH = 'M3 5h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm11.41 2.17L13 13.76l-1.41 1.41L13 16.59l-1.41 1.41L13 19.41l1.41-1.41L15.83 19.41l1.41-1.41L15.83 16.59l1.41-1.42-1.41-1.41z';
const PathIcon = ({d}) => <svg viewBox="0 0 24 24" className={css.menuIcon}><path d={d} /></svg>;

const MenuEntry = ({icon, label, subtitle, run, onClose, first}) => {
	const handle = useCallback(() => {
		onClose();
		if (run) setTimeout(run, 0);
	}, [run, onClose]);
	return (
		<Entry className={`${css.entry} ${first ? 'spottable-default' : ''}`} onClick={handle}>
			<span className={css.entryIcon}>{icon}</span>
			<span className={css.entryText}>
				<span className={css.entryLabel}>{label}</span>
				{subtitle ? <span className={css.entrySub}>{subtitle}</span> : null}
			</span>
		</Entry>
	);
};

const VjodMenu = ({name, initial, avatarUrl, kids, simple, seerr, admin, onClose, onChange, onShuffle, onGenres, onFavorites, onRequests, onEnRoute, onBientot, onConnect, onSettings}) => {
	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('vjod-menu'), 30);
		const onKey = (e) => {
			if (!isBackKey(e)) return;
			e.preventDefault();
			e.stopPropagation();
			onClose();
		};
		window.addEventListener('keydown', onKey, true);
		return () => {
			clearTimeout(t);
			window.removeEventListener('keydown', onKey, true);
		};
	}, [onClose]);
	const handleChange = useCallback(() => {
		onClose();
		if (onChange) setTimeout(onChange, 0);
	}, [onClose, onChange]);
	const icon = (C) => <C className={css.menuIcon} />;
	const entries = simple ? [
		{key: 'fav', icon: icon(FavoritesIcon), label: 'Favoris', run: onFavorites},
		seerr && onEnRoute ? {key: 'enroute', icon: icon(EnRouteIcon), label: 'En route', run: onEnRoute} : null,
		seerr && onBientot ? {key: 'soon', icon: icon(SoonIcon), label: 'Bientôt', run: onBientot} : null
	] : [
		!kids && onShuffle ? {key: 'shuffle', icon: icon(ShuffleIcon), label: 'Aléatoire', subtitle: 'Un titre au hasard', run: onShuffle} : null,
		!kids && onGenres ? {key: 'genres', icon: icon(GenresIcon), label: 'Genres', run: onGenres} : null,
		onFavorites ? {key: 'fav', icon: icon(FavoritesIcon), label: 'Favoris', run: onFavorites} : null,
		seerr && admin && onRequests ? {key: 'req', icon: <PathIcon d={REQUESTS_PATH} />, label: 'Demandes à valider', run: onRequests} : null,
		!kids && onConnect ? {key: 'qc', icon: <PathIcon d={CONNECT_PATH} />, label: 'Connecter un appareil', subtitle: 'Quick Connect : tape le code qu’il affiche', run: onConnect} : null
	];
	const list = entries.filter(Boolean);
	return (
		<div className={css.menuBackdrop}>
			<Panel className={css.menu} spotlightId="vjod-menu">
				<div className={css.menuHead}>
					<div className={css.menuAvatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</div>
					<div className={css.menuName}>{name}</div>
					{!kids ? (
						<Entry className={css.change} onClick={handleChange}>⇄ Changer</Entry>
					) : null}
				</div>
				{list.length ? <div className={css.menuSection}>AUSSI DANS VJOD</div> : null}
				{list.map((e, i) => <MenuEntry key={e.key} icon={e.icon} label={e.label} subtitle={e.subtitle} run={e.run} onClose={onClose} first={i === 0} />)}
				<div className={css.menuRule} />
				<MenuEntry icon={icon(SettingsIcon)} label="Paramètres" run={onSettings} onClose={onClose} first={!list.length} />
			</Panel>
		</div>
	);
};

export default VjodMenu;
