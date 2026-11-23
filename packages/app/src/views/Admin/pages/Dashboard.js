// Tableau de bord (admin_dashboard_screen.dart) : ce qui demande attention,
// sessions / alertes / disque, infos et actions du serveur, vue d'ensemble des
// médias, tâches en cours, sessions actives (avec leur fiche de commande),
// activité récente, alertes et chemins du serveur.
import {useState, useCallback, useEffect} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {useAdmin, useAdminLoad, usePoll} from '../adminContext';
import {
	PageHeader, Section, Row, InfoRow, Btn, Chip, Progress, Stat, Loading, ErrorBox, Confirm, Note, Group, PromptDialog, css
} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {loadSummary, DASHBOARD_METRICS} from '../../../services/adminAnalytics';
import {
	formatBytes, usageFraction, playMethodOf, ticksToMs, formatClock, timeAgo, updateFor, formatBitrate, TICKS_PER_SECOND
} from '../../../services/adminFormat';
import {metricLabel, severityTone} from './adminLabels';

const SESSION_POLL_MS = 5000;
const TASK_POLL_MS = 3000;

// ----------------------------------------------------------------- à surveiller
const loadAttention = async (api) => {
	try {
		const [plugins, packages, tasks] = await Promise.all([
			api.getInstalledPlugins(),
			api.getAvailablePackages().catch(() => []),
			api.getTasks(false)
		]);
		const updates = plugins.filter((p) => updateFor(p, packages)).length;
		const restart = plugins.filter((p) => p.Status === 'Restart' || p.Status === 'Deleted').map((p) => p.Name);
		const failed = tasks.filter((x) => x.LastExecutionResult && x.LastExecutionResult.Status === 'Failed').length;
		return {updates, restart, failed};
	} catch {
		return {updates: 0, restart: [], failed: 0};
	}
};

const Attention = ({summary}) => {
	if (!summary || (!summary.updates && !summary.restart.length && !summary.failed)) return null;
	return (
		<Section title={t('needsAttention')}>
			{summary.updates ? <InfoRow icon="system_update_alt" label={t('adminPluginUpdatesAvailable', {count: summary.updates})} /> : null}
			{summary.restart.length ? (
				<InfoRow icon="warning" label={t('adminPluginsRequiringRestart', {count: summary.restart.length})} help={summary.restart.slice(0, 3).join(', ')} />
			) : null}
			{summary.failed ? <InfoRow icon="warning" label={t('adminFailedScheduledTasks', {count: summary.failed})} /> : null}
		</Section>
	);
};

// ----------------------------------------------------------------- actions du serveur
const ServerActions = ({tasks, onReboot}) => {
	const {api, toast} = useAdmin();
	const [confirm, setConfirm] = useState(null);
	const [scanning, setScanning] = useState(false);
	const scanTask = (tasks || []).find((x) => x.Key === 'RefreshLibrary');
	const handleScan = useCallback(async () => {
		if (!scanTask) return;
		setScanning(true);
		try {
			await api.startTask(scanTask.Id);
			toast(t('adminLibraryScanStarted'));
		} catch (e) {
			toast(t('adminScanFailed', {error: describeAdminError(e)}));
		} finally {
			setScanning(false);
		}
	}, [api, scanTask, toast]);
	const handleRestart = useCallback(() => setConfirm('restart'), []);
	const handleShutdown = useCallback(() => setConfirm('shutdown'), []);
	const handleClose = useCallback(() => setConfirm(null), []);
	const handleConfirm = useCallback(async () => {
		const what = confirm;
		setConfirm(null);
		try {
			if (what === 'restart') {
				await api.restartServer();
				onReboot();
			} else {
				await api.shutdownServer();
				toast(t('tvServerStopping'));
			}
		} catch (e) {
			toast(t('errorGeneric', {error: describeAdminError(e)}));
		}
	}, [api, confirm, onReboot, toast]);
	const running = scanTask && scanTask.State === 'Running';
	return (
		<Section title={t('adminServerActions')}>
			<div className={css.btnRow}>
				<Btn icon="refresh" label={t('adminScanAllLibraries')} disabled={!scanTask || scanning || running} onClick={handleScan} />
				<Btn icon="replay" label={t('adminRestartServer')} onClick={handleRestart} />
				<Btn icon="exit" danger label={t('adminShutdownServer')} onClick={handleShutdown} />
			</div>
			<Confirm
				open={!!confirm}
				title={confirm === 'restart' ? t('adminRestartServer') : t('adminShutdownServer')}
				message={confirm === 'restart' ? t('adminRestartServerConfirmation') : t('adminShutdownServerConfirmation')}
				confirmLabel={t('confirm')}
				danger
				onConfirm={handleConfirm}
				onClose={handleClose}
			/>
		</Section>
	);
};

// ----------------------------------------------------------------- tâches en cours
const RunningTask = ({task, onStop}) => {
	const handleStop = useCallback(() => onStop(task.Id), [onStop, task.Id]);
	const cancelling = task.State === 'Cancelling';
	return (
		<Row icon="sync" label={task.Name} help={cancelling ? t('adminTaskCancelling') : `${Math.round(task.CurrentProgressPercentage || 0)} %`} onClick={cancelling ? null : handleStop} value={cancelling ? '' : t('adminTaskStop')}>
			<Progress value={task.CurrentProgressPercentage} />
		</Row>
	);
};

const RunningTasks = ({tasks, onStop}) => {
	const running = (tasks || []).filter((x) => x.State === 'Running' || x.State === 'Cancelling');
	if (!running.length) return null;
	return (
		<Section title={t('adminRunningTasks')}>
			{running.map((task) => <RunningTask key={task.Id} task={task} onStop={onStop} />)}
		</Section>
	);
};

// ----------------------------------------------------------------- sessions (active_sessions_card.dart)
const playMethodLabel = (session) => {
	switch (playMethodOf(session)) {
		case 'Remux': return t('adminPlayMethodRemux');
		case 'DirectStream': return t('adminPlayMethodDirectStream');
		case 'Transcode': return t('transcoding');
		case 'DirectPlay': return t('adminPlayMethodDirectPlay');
		default: return '';
	}
};

export const sessionState = (session) => {
	if (!session.NowPlayingItem) return t('idle');
	if (session.PlayState && session.PlayState.IsPaused) return t('paused');
	if (playMethodOf(session) === 'Transcode') {
		const rate = formatBitrate(session.TranscodingInfo && session.TranscodingInfo.Bitrate);
		return rate ? `${t('transcoding')} · ${rate}` : t('transcoding');
	}
	return playMethodLabel(session);
};

const nowPlayingName = (item) => {
	if (!item) return '';
	if (item.SeriesName) return `${item.SeriesName} — ${item.Name || ''}`;
	if (item.AlbumArtist) return `${item.AlbumArtist} — ${item.Name || ''}`;
	return item.Name || t('unknown');
};

const SessionRow = ({session, onOpen}) => {
	const {api} = useAdmin();
	const handleClick = useCallback(() => onOpen(session), [onOpen, session]);
	const np = session.NowPlayingItem;
	const run = np ? ticksToMs(np.RunTimeTicks) : 0;
	const pos = session.PlayState ? ticksToMs(session.PlayState.PositionTicks) : 0;
	const avatar = session.UserPrimaryImageTag ? <img src={api.userImageUrl(session.UserId, session.UserPrimaryImageTag)} alt="" /> : String(session.UserName || '?').charAt(0).toUpperCase();
	return (
		<Row
			avatar={avatar}
			label={`${session.UserName || t('unknown')} · ${session.DeviceName || ''}`}
			help={np ? `${nowPlayingName(np)}${run ? ` · ${formatClock(pos)} / ${formatClock(run)}` : ''}` : `${session.Client || ''} ${session.ApplicationVersion || ''}`}
			value={sessionState(session)}
			chevron
			onClick={handleClick}
		>
			{np && run ? <Progress value={(pos / run) * 100} /> : null}
		</Row>
	);
};

const MESSAGE_FIELDS = [{key: 'text', label: t('adminMessageTextHint'), required: true}];
const VOLUME_FIELDS = [{key: 'volume', label: t('volume'), numeric: true, value: '50', required: true}];

// La fiche d'une session (session_detail_sheet.dart) : lecture, volume, message, accueil.
const SessionSheet = ({session, onClose}) => {
	const {api, toast} = useAdmin();
	const [prompt, setPrompt] = useState(null);
	const run = useCallback(async (fn) => {
		try {
			await fn();
		} catch (e) {
			toast(t('adminCommandFailed', {error: describeAdminError(e)}));
		}
	}, [toast]);
	const id = session && session.Id;
	const play = useCallback((cmd) => run(() => api.sendSessionPlaystate(id, cmd)), [run, api, id]);
	const general = useCallback((name, args) => run(() => api.sendSessionCommand(id, name, args)), [run, api, id]);
	const handlePrev = useCallback(() => play('PreviousTrack'), [play]);
	const handleRew = useCallback(() => play('Rewind'), [play]);
	const handlePause = useCallback(() => play('PlayPause'), [play]);
	const handleFwd = useCallback(() => play('FastForward'), [play]);
	const handleNext = useCallback(() => play('NextTrack'), [play]);
	const handleStop = useCallback(() => play('Stop'), [play]);
	const handleBack30 = useCallback(() => {
		const pos = Number(session && session.PlayState && session.PlayState.PositionTicks) || 0;
		run(() => api.sendSessionPlaystate(id, 'Seek', Math.max(0, pos - 30 * TICKS_PER_SECOND)));
	}, [run, api, id, session]);
	const handleMute = useCallback(() => general(session && session.PlayState && session.PlayState.IsMuted ? 'Unmute' : 'Mute'), [general, session]);
	const handleVolDown = useCallback(() => general('VolumeDown'), [general]);
	const handleVolUp = useCallback(() => general('VolumeUp'), [general]);
	const handleHome = useCallback(() => general('GoHome'), [general]);
	const handleMessage = useCallback(() => setPrompt('message'), []);
	const handleVolume = useCallback(() => setPrompt('volume'), []);
	const handlePromptClose = useCallback(() => setPrompt(null), []);
	const handlePromptSubmit = useCallback((values) => {
		const kind = prompt;
		setPrompt(null);
		if (kind === 'message') {
			run(() => api.sendSessionMessage(id, values.text));
		} else {
			const v = Math.max(0, Math.min(100, parseInt(values.volume, 10) || 0));
			general('SetVolume', {Volume: String(v)});
		}
	}, [prompt, run, api, id, general]);

	if (!session) return null;
	const np = session.NowPlayingItem;
	const tr = session.TranscodingInfo;
	const remote = session.SupportsRemoteControl !== false;
	const paused = session.PlayState && session.PlayState.IsPaused;
	return (
		<CoreDialog open onClose={onClose} title={`${session.UserName || t('unknown')} · ${session.DeviceName || ''}`} subtitle={`${session.Client || ''} ${session.ApplicationVersion || ''}`} spotlightId="admin-session">
			<div className={css.dialogBody}>
				{np ? (
					<Section title={t('nowPlaying')}>
						<InfoRow label={nowPlayingName(np)} value={sessionState(session)} help={`${formatClock(ticksToMs(session.PlayState && session.PlayState.PositionTicks))} / ${formatClock(ticksToMs(np.RunTimeTicks))}`} />
					</Section>
				) : null}
				{np && remote ? (
					<Section title={t('playback')}>
						<Group className={css.btnRow}>
							<Btn small label={t('sessionPrev')} onClick={handlePrev} />
							<Btn small label={t('sessionRewind')} onClick={handleRew} />
							<Btn small label="−30 s" onClick={handleBack30} />
							<Btn small primary label={paused ? t('play') : t('pause')} onClick={handlePause} />
							<Btn small label={t('sessionForward')} onClick={handleFwd} />
							<Btn small label={t('sessionNext')} onClick={handleNext} />
							<Btn small danger label={t('stop')} onClick={handleStop} />
						</Group>
					</Section>
				) : null}
				{remote ? (
					<Section title={t('volume')}>
						<Group className={css.btnRow}>
							<Btn small label={session.PlayState && session.PlayState.IsMuted ? t('unmute') : t('mute')} onClick={handleMute} />
							<Btn small label={t('sessionVolumeDown')} onClick={handleVolDown} />
							<Btn small label={t('sessionVolumeUp')} onClick={handleVolUp} />
							<Btn small label={t('set')} onClick={handleVolume} />
						</Group>
					</Section>
				) : null}
				{tr ? (
					<Section title={t('transcoding')}>
						<InfoRow label={t('videoCodec')} value={tr.IsVideoDirect ? t('tvDirect') : (tr.VideoCodec || '').toUpperCase()} />
						<InfoRow label={t('audioCodec')} value={tr.IsAudioDirect ? t('tvDirect') : (tr.AudioCodec || '').toUpperCase()} />
						<InfoRow label={t('container')} value={tr.Container} />
						<InfoRow label={t('bitrate')} value={formatBitrate(tr.Bitrate)} />
						<InfoRow label={t('hwAccel')} value={tr.HardwareAccelerationType || t('adminNone')} />
						<InfoRow label={t('completion')} value={tr.CompletionPercentage != null ? `${Math.round(tr.CompletionPercentage)} %` : ''} />
						{tr.TranscodeReasons && tr.TranscodeReasons.length ? <InfoRow label={t('transcodeReasons')} help={tr.TranscodeReasons.join(', ')} /> : null}
					</Section>
				) : null}
				{remote ? (
					<Section title={t('actions')}>
						<Row icon="notifications_active" label={t('adminSendMessage')} onClick={handleMessage} />
						<Row icon="home" label={t('adminSessionGoHome')} onClick={handleHome} />
					</Section>
				) : null}
			</div>
			<PromptDialog
				open={!!prompt}
				title={prompt === 'volume' ? t('adminSetVolume') : t('adminSendMessage')}
				fields={prompt === 'volume' ? VOLUME_FIELDS : MESSAGE_FIELDS}
				submitLabel={prompt === 'volume' ? t('set') : t('send')}
				onSubmit={handlePromptSubmit}
				onClose={handlePromptClose}
			/>
		</CoreDialog>
	);
};

const ActiveSessions = ({status, data, error, reload}) => {
	const [open, setOpen] = useState(null);
	const handleClose = useCallback(() => setOpen(null), []);
	const current = open && data ? data.find((s) => s.Id === open.Id) || open : open;
	return (
		<Section title={t('adminActiveSessions')}>
			{status === 'loading' ? <Loading /> : null}
			{status === 'error' ? <Row label={t('adminSessionsLoadFailed')} help={error} value={t('retry')} onClick={reload} /> : null}
			{status === 'ready' && !data.length ? <InfoRow label={t('adminNoActiveSessions')} /> : null}
			{status === 'ready' ? data.map((s) => <SessionRow key={s.Id} session={s} onOpen={setOpen} />) : null}
			{current ? <SessionSheet session={current} onClose={handleClose} /> : null}
		</Section>
	);
};

// ----------------------------------------------------------------- activité (activity_log_card.dart)
const ActivityEntry = ({entry}) => {
	const ago = timeAgo(entry.Date);
	return <InfoRow icon={severityTone(entry.Severity).icon} label={entry.Name} help={entry.ShortOverview} value={t(ago.key, ago.params)} />;
};

const ActivityCard = ({title, result, onOpen}) => (
	<Section title={title}>
		{!result || !result.Items || !result.Items.length ? <InfoRow label={t('adminNoRecentActivity')} /> : result.Items.map((e) => <ActivityEntry key={e.Id} entry={e} />)}
		<Row label={t('seeAll')} chevron onClick={onOpen} />
	</Section>
);

// ----------------------------------------------------------------- chemins (server_paths_card.dart)
const PATHS = [
	['adminServerPathCache', 'CacheFolder'],
	['adminServerPathImageCache', 'ImageCacheFolder'],
	['adminServerPathData', 'ProgramDataFolder'],
	['adminServerPathLogs', 'LogFolder'],
	['adminServerPathMetadata', 'InternalMetadataFolder'],
	['adminServerPathTranscode', 'TranscodingTempFolder'],
	['adminServerPathWeb', 'WebFolder']
];

const ServerPaths = ({storage}) => {
	const rows = PATHS.filter(([, k]) => storage[k] && storage[k].Path);
	return (
		<Section title={t('adminServerPaths')}>
			{!rows.length ? <InfoRow label={t('adminNoServerPathsReturned')} /> : rows.map(([label, k]) => {
				const f = storage[k];
				const frac = usageFraction(f);
				return (
					<InfoRow
						key={k}
						label={t(label)}
						help={f.Path}
						value={frac != null ? `${t('adminPercentUsed', {percent: Math.round(frac * 100)})} · ${formatBytes(f.FreeSpace)} ${t('tvFree')}` : ''}
					/>
				);
			})}
		</Section>
	);
};

// ----------------------------------------------------------------- la page
const Dashboard = () => {
	const {api, openPage, push} = useAdmin();
	const load = useCallback(async () => {
		const [systemInfo, storageInfo] = await Promise.all([api.getSystemInfo(), api.getStorageInfo().catch(() => null)]);
		return {info: systemInfo, storage: storageInfo};
	}, [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [side, setSide] = useState({attention: null, media: null, activity: null, alerts: null, tasks: null});
	const [reboot, setReboot] = useState(false);
	const loadSessions = useCallback(async () => (await api.getSessions()).filter((x) => x.DeviceName || x.NowPlayingItem), [api]);
	const sessions = useAdminLoad(loadSessions);
	const reloadSessions = sessions.reload;
	const quietSessions = useCallback(() => reloadSessions(true), [reloadSessions]);
	usePoll(quietSessions, SESSION_POLL_MS);

	const loadSide = useCallback(async () => {
		const day = Date.now() - 86400000;
		const week = Date.now() - 7 * 86400000;
		const [attention, summary, activity, alerts] = await Promise.all([
			loadAttention(api),
			loadSummary(api, DASHBOARD_METRICS).catch(() => 'error'),
			api.getActivityLog({startIndex: 0, limit: 7, minDate: day, hasUserId: true}).catch(() => null),
			api.getActivityLog({startIndex: 0, limit: 4, minDate: week, hasUserId: false}).catch(() => null)
		]);
		setSide((s) => ({...s, attention, media: summary, activity, alerts}));
	}, [api]);
	const loadTasks = useCallback(async () => {
		try {
			const tasks = await api.getTasks(false);
			setSide((s) => ({...s, tasks}));
		} catch {
			// les tâches restent comme avant
		}
	}, [api]);
	useEffect(() => {
		loadSide();
		loadTasks();
	}, [loadSide, loadTasks]);
	usePoll(loadTasks, TASK_POLL_MS);

	const handleStopTask = useCallback(async (id) => {
		try {
			await api.stopTask(id);
			loadTasks();
		} catch {
			// rien : la tâche reste affichée
		}
	}, [api, loadTasks]);
	const handleRefresh = useCallback(() => {
		reload();
		loadSide();
		loadTasks();
	}, [reload, loadSide, loadTasks]);
	const handleReboot = useCallback(() => setReboot(true), []);
	const handleRebootClose = useCallback(() => setReboot(false), []);
	const openUserActivity = useCallback(() => push('activity', {userActivity: true}, t('adminDrawerActivity')), [push]);
	const openAlerts = useCallback(() => push('activity', {userActivity: false}, t('adminDashboardAlerts')), [push]);
	const openAnalytics = useCallback(() => openPage('analytics'), [openPage]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminDashboardLoadFailed')} message={error} onRetry={reload} />;
	const {info, storage} = data;
	const fills = storage ? ['ProgramDataFolder', 'CacheFolder', 'TranscodingTempFolder', 'LogFolder'].map((k) => usageFraction(storage[k])).filter((f) => f > 0) : [];
	const worst = fills.length ? Math.max(...fills) : null;
	const os = String(info.OperatingSystemDisplayName || info.OperatingSystem || '').trim() || t('unknown');
	const media = side.media;
	return (
		<div>
			<PageHeader title={t('adminDrawerDashboard')}>
				<Btn small icon="refresh" label={t('refresh')} onClick={handleRefresh} />
			</PageHeader>
			<Attention summary={side.attention} />
			<div style={{marginTop: '1rem'}}>
				<Stat value={sessions.data ? sessions.data.length : '…'} label={t('sessions')} />
				<Stat value={side.alerts ? side.alerts.TotalRecordCount || 0 : '…'} label={t('adminDashboardAlerts')} />
				{worst != null ? <Stat value={`${Math.round(worst * 100)} %`} label={t('disk')} /> : null}
			</div>
			<Section title={t('adminServerInfo')}>
				<InfoRow icon="dns" label={t('name')} value={info.ServerName} />
				<InfoRow icon="info" label={t('version')} value={info.Version} />
				<InfoRow icon="settings" label={t('os')} value={os} />
				{info.HasPendingRestart ? <InfoRow icon="warning" label={t('adminRestartPending')} value={<Chip tone="warn">{t('adminRestartPending')}</Chip>} /> : null}
			</Section>
			<ServerActions tasks={side.tasks} onReboot={handleReboot} />
			<Section title={t('adminMediaOverview')} help={t('adminMediaOverviewSubtitle')}>
				{media === null ? <Loading /> : null}
				{media === 'error' ? <InfoRow label={t('adminMediaTotalsError')} /> : null}
				{media && media !== 'error' ? (
					<Group className={css.statRow}>
						{DASHBOARD_METRICS.filter((k) => media[k] > 0).map((k) => (
							<Stat key={k} value={media[k].toLocaleString('fr-FR')} label={metricLabel(k)} />
						))}
					</Group>
				) : null}
				<Row icon="insights" label={t('analytics')} chevron onClick={openAnalytics} />
			</Section>
			<RunningTasks tasks={side.tasks} onStop={handleStopTask} />
			<ActiveSessions status={sessions.status} data={sessions.data} error={sessions.error} reload={sessions.reload} />
			<ActivityCard title={t('adminRecentActivity')} result={side.activity} onOpen={openUserActivity} />
			{side.alerts && side.alerts.Items && side.alerts.Items.length ? <ActivityCard title={t('adminDashboardAlerts')} result={side.alerts} onOpen={openAlerts} /> : null}
			{storage ? <ServerPaths storage={storage} /> : null}
			<Note>{t('tvDashboardNote')}</Note>
			<Confirm open={reboot} title={t('adminServerRebootInProgress')} message={t('tvServerRebootMessage')} confirmLabel={t('ok')} onConfirm={handleRebootClose} onClose={handleRebootClose} />
		</div>
	);
};

export default Dashboard;
