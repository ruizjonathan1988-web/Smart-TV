// « Le mois à la maison » (watch_month_screen.dart) : les heures regardées
// ces 30 derniers jours, par personne, séries et films.
import {useState, useEffect} from 'react';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {loadWatchMonth, hoursLabel} from '../../services/watchMonth';
import {SpottableButton} from './settingsSpottables';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

const Bars = ({title, rows}) => {
	if (!rows.length) return null;
	const max = rows[0][1] > 0 ? rows[0][1] : 1;
	return (
		<div style={{marginBottom: '1.75rem'}}>
			<div style={{fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.6rem'}}>{title}</div>
			{rows.map(([name, h]) => (
				<SpottableButton key={name} className={css.watchMonthRow}>
					<div style={{display: 'flex'}}>
						<span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{name}</span>
						<span style={{marginLeft: '0.75rem'}}>{hoursLabel(h)}</span>
					</div>
					<div style={{height: '0.375rem', marginTop: '0.25rem', borderRadius: '0.25rem', background: 'rgba(237, 235, 230, 0.08)', overflow: 'hidden'}}>
						<div style={{height: '100%', width: `${Math.round((h / max) * 100)}%`, background: '#C9403F'}} />
					</div>
				</SpottableButton>
			))}
		</div>
	);
};

const WatchMonthView = () => {
	const {serverUrl, accessToken} = useAuth();
	const [state, setState] = useState(null);

	useEffect(() => {
		let alive = true;
		loadWatchMonth({serverUrl, accessToken}).then((r) => {
			if (alive) setState(r);
		});
		return () => {
			alive = false;
		};
	}, [serverUrl, accessToken]);

	let body;
	if (!state) body = <LoadingSpinner />;
	else if (!state.month || state.month.totalHours <= 0) {
		body = <SpottableButton className={css.watchMonthRow}>{state.error || $L('Rien de regardé ces 30 derniers jours.')}</SpottableButton>;
	} else {
		const m = state.month;
		body = (
			<div>
				<div style={{fontSize: '3rem', fontWeight: 900, lineHeight: 1.1}}>{hoursLabel(m.totalHours)}</div>
				<div style={{marginBottom: '1.75rem', opacity: 0.7}}>{$L('regardées à la maison ces 30 derniers jours')}</div>
				<Bars title={$L('Qui a regardé')} rows={m.people} />
				<Bars title={$L('Séries les plus suivies')} rows={m.series} />
				<Bars title={$L('Films')} rows={m.films} />
			</div>
		);
	}
	return (
		<SettingsView spotlightId="watch-month-view" title={$L('Le mois à la maison')} clean>
			{body}
		</SettingsView>
	);
};

export default WatchMonthView;
