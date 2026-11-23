// Journal d'activité (admin_activity_screen.dart) : tout, activité des
// utilisateurs ou évènements système ; filtres de gravité, d'utilisateur et
// de période ; pages de 25 ; une entrée ouvre sa fiche, d'où l'on peut
// ouvrir le média concerné.
import {useState, useCallback, useEffect} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {useAdmin} from '../adminContext';
import {PageHeader, Section, Row, InfoRow, Btn, Chip, Loading, ErrorBox, Tabs, SelectRow, css} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {groupActivity, timeAgo, formatDateTime} from '../../../services/adminFormat';
import {severityTone, severityLabel, SEVERITIES} from './adminLabels';

const PAGE_SIZE = 25;
// Sur la TV, les dates se choisissent dans une liste de périodes plutôt qu'au calendrier.
const RANGES = [
	{value: 'all', days: null},
	{value: '1', days: 1},
	{value: '7', days: 7},
	{value: '30', days: 30},
	{value: '90', days: 90}
];

const EntryRow = ({entry, onOpen}) => {
	const handleClick = useCallback(() => onOpen(entry), [onOpen, entry]);
	const ago = timeAgo(entry.Date);
	return <Row icon={severityTone(entry.Severity).icon} label={entry.Name} help={entry.ShortOverview} value={t(ago.key, ago.params)} onClick={handleClick} />;
};

const EntrySheet = ({entry, onClose, onOpenItem}) => {
	const handleItem = useCallback(() => onOpenItem(entry.ItemId), [onOpenItem, entry]);
	const sev = severityTone(entry.Severity);
	return (
		<CoreDialog open onClose={onClose} title={entry.Name} subtitle={formatDateTime(entry.Date)} spotlightId="admin-activity-entry">
			<div className={css.dialogBody}>
				<Chip tone={sev.tone}>{severityLabel(entry.Severity) || entry.Severity}</Chip>
				{entry.Overview ? <div className={css.note}>{entry.Overview}</div> : null}
				{entry.ShortOverview && entry.ShortOverview !== entry.Overview ? <div className={css.note}>{entry.ShortOverview}</div> : null}
				<div className={css.note}>{`${t('type')} : ${entry.Type}`}</div>
				<div className={css.dialogActions}>
					{entry.ItemId && onOpenItem ? <Btn label={t('adminActivityMediaDetails')} onClick={handleItem} /> : null}
					<Btn primary label={t('close')} onClick={onClose} />
				</div>
			</div>
		</CoreDialog>
	);
};

const Activity = ({userActivity}) => {
	const {api, onSelectItem} = useAdmin();
	const [filter, setFilter] = useState(userActivity === true ? 'user' : userActivity === false ? 'system' : 'all');
	const [severity, setSeverity] = useState('');
	const [user, setUser] = useState('');
	const [range, setRange] = useState('all');
	const [users, setUsers] = useState([]);
	const [state, setState] = useState({status: 'loading', entries: [], total: 0, error: null});
	const [open, setOpen] = useState(null);
	const [nonce, setNonce] = useState(0);

	useEffect(() => {
		api.getUsers().then((list) => setUsers(list.map((u) => u.Name).filter(Boolean).sort()), () => setUsers([]));
	}, [api]);

	const fetchPage = useCallback((start) => {
		const r = RANGES.find((x) => x.value === range);
		return api.getActivityLog({
			startIndex: start,
			limit: PAGE_SIZE,
			hasUserId: filter === 'all' ? undefined : filter === 'user',
			minDate: r && r.days ? Date.now() - r.days * 86400000 : undefined,
			severity: severity || undefined,
			username: filter === 'system' ? undefined : user || undefined
		});
	}, [api, filter, severity, user, range]);

	useEffect(() => {
		let alive = true;
		setState({status: 'loading', entries: [], total: 0, error: null});
		fetchPage(0).then((r) => {
			if (alive) setState({status: 'ready', entries: (r && r.Items) || [], total: (r && r.TotalRecordCount) || 0, error: null});
		}, (e) => {
			if (alive) setState({status: 'error', entries: [], total: 0, error: describeAdminError(e)});
		});
		return () => {
			alive = false;
		};
	}, [fetchPage, nonce]);

	const handleMore = useCallback(async () => {
		try {
			const r = await fetchPage(state.entries.length);
			setState((s) => ({...s, entries: s.entries.concat((r && r.Items) || []), total: (r && r.TotalRecordCount) || s.total}));
		} catch (e) {
			setState((s) => ({...s, error: describeAdminError(e)}));
		}
	}, [fetchPage, state.entries.length]);

	const handleRetry = useCallback(() => setNonce((n) => n + 1), []);
	const handleClose = useCallback(() => setOpen(null), []);
	const handleOpenItem = useCallback((itemId) => {
		setOpen(null);
		if (onSelectItem) onSelectItem({Id: itemId});
	}, [onSelectItem]);

	const tabs = [
		{id: 'all', label: t('all')},
		{id: 'user', label: t('userActivity')},
		{id: 'system', label: t('systemEvents')}
	];
	const severityOptions = [{value: '', label: t('adminActivitySeverityAll')}].concat(SEVERITIES.map((s) => ({value: s, label: severityLabel(s)})));
	const userOptions = [{value: '', label: t('adminActivityAllUsers')}].concat(users.map((u) => ({value: u, label: u})));
	const rangeOptions = RANGES.map((r) => ({value: r.value, label: r.days ? t('tvLastDays', {days: r.days}) : t('tvAllDates')}));

	return (
		<div>
			<PageHeader title={t('adminDrawerActivity')} subtitle={t('adminPageDescActivity')} />
			<Tabs tabs={tabs} value={filter} onChange={setFilter} />
			<Section>
				<SelectRow label={t('tvSeverity')} value={severity} options={severityOptions} onChange={setSeverity} />
				<SelectRow label={t('adminActivityDateRange')} value={range} options={rangeOptions} onChange={setRange} />
				{filter !== 'system' ? <SelectRow label={t('tvUser')} value={user} options={userOptions} onChange={setUser} /> : null}
			</Section>
			{state.status === 'loading' ? <Loading /> : null}
			{state.status === 'error' ? <ErrorBox message={t('adminActivityLoadFailed', {error: state.error})} onRetry={handleRetry} /> : null}
			{state.status === 'ready' ? (
				<>
					<div className={css.note}>{t('adminActivityCount', {shown: state.entries.length, total: state.total})}</div>
					{state.entries.length === 0 ? <InfoRow label={t('adminNoActivityEntries')} /> : null}
					{groupActivity(state.entries).reduce((sections, item) => {
						if (item.bucket) sections.push({bucket: item.bucket, entries: []});
						else sections[sections.length - 1].entries.push(item.entry);
						return sections;
					}, []).map((sec) => (
						<Section key={sec.bucket} title={t(sec.bucket)}>
							{sec.entries.map((e) => <EntryRow key={e.Id} entry={e} onOpen={setOpen} />)}
						</Section>
					))}
					{state.entries.length < state.total ? <Section><Row label={t('tvShowMore')} chevron onClick={handleMore} /></Section> : null}
				</>
			) : null}
			{open ? <EntrySheet entry={open} onClose={handleClose} onOpenItem={handleOpenItem} /> : null}
		</div>
	);
};

export default Activity;
