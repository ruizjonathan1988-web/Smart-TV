// Le panneau « Sources » du lecteur Ma TV (tv_sources_panel.dart de l'APK) :
// « Automatique » puis les flux de la chaîne, une source par vrai serveur,
// les doublons derrière « Voir les autres ». OK change tout de suite, OK long
// garde la source pour cette chaîne. Le lecteur tient le focus et les touches.
import $L from '@enact/i18n/$L';
import {maTvColors as C} from './maTvTheme';
import {sourceBadges, sourceDetails} from '../../services/maTvSources';
import css from './MaTvSourcesPanel.module.less';

const TONES = {good: C.good, accent: C.accent, bad: C.live, mute: C.mute};

const Badge = ({label, tone}) => (
	<span className={css.badge} style={{color: TONES[tone] || C.mute, borderColor: TONES[tone] || C.mute}}>{label}</span>
);

export const sourcesRowCount = (shown, hidden) => 1 + shown.length + (hidden > 0 ? 1 : 0);

const MaTvSourcesPanel = ({channel, data, loading, shown, hidden, selected, busy}) => {
	const rows = [];
	if (data) {
		rows.push({key: 'auto', title: $L('Automatique'), sub: $L('La meilleure source du moment, et la suivante si elle coupe'), badges: sourceBadges(null, data)});
		shown.forEach((s) => rows.push({key: s.key, title: `${$L('Source')} ${s.rank}`, sub: sourceDetails(s) || s.provider, badges: sourceBadges(s, data)}));
		if (hidden > 0) rows.push({key: 'more', title: hidden === 1 ? $L('Voir l\u2019autre (même serveur)') : `${$L('Voir les')} ${hidden} ${$L('autres (même serveur)')}`, sub: '', badges: []});
	}
	const first = Math.max(0, Math.min(selected - 3, rows.length - 7));
	return (
		<div className={css.panel} style={{background: C.panel, borderColor: C.hairline}}>
			<div className={css.kicker} style={{color: C.mute}}>{$L('Sources')}</div>
			<div className={css.channel} style={{color: C.ink}}>{channel ? `${channel.num || ''}  ${channel.name}` : ''}</div>
			<div className={css.body}>
				{loading && !data ? <div className={css.note} style={{color: C.mute}}>{$L('Chargement…')}</div> : null}
				{!loading && !data ? (
					<div className={css.note} style={{color: C.mute}}>{$L('Cette chaîne n’est pas dans Ma TV, ou Ma TV ne répond pas.')}</div>
				) : null}
				{rows.slice(first, first + 7).map((r, i) => {
					const on = first + i === selected;
					return (
						<div key={r.key} className={css.row} style={{background: on ? C.rowOn : C.row, opacity: busy && on ? 0.6 : 1}}>
							<div className={css.rowHead}>
								<span className={css.title} style={{color: C.ink}}>{r.title}</span>
								{r.badges.map((b) => <Badge key={b.label} label={b.label} tone={b.tone} />)}
							</div>
							{r.sub ? <div className={css.sub} style={{color: C.mute}}>{r.sub}</div> : null}
						</div>
					);
				})}
			</div>
			<div className={css.hint} style={{color: C.mute}}>{$L('OK : changer tout de suite · OK long : garder pour cette chaîne')}</div>
		</div>
	);
};

export default MaTvSourcesPanel;
