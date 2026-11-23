// Personnes : utilisateurs (admin_users_screen.dart, admin_user_add_screen.dart,
// admin_user_edit_screen.dart), appareils (admin_devices_screen.dart) et clés
// API (admin_api_keys_screen.dart).
import {useState, useCallback, useMemo} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {getDeviceId} from '../../../services/jellyfinApi';
import {useAdmin, useAdminLoad, useDraftPage} from '../adminContext';
import {
	PageHeader, Section, Row, InfoRow, Btn, Chip, Loading, ErrorBox, Tabs, SelectRow, SwitchRow, TextRow, NumberRow, Confirm,
	PromptDialog, Note, Warn, SpottableDiv, css
} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {timeAgo, formatDateTime} from '../../../services/adminFormat';

const maps = (raw) => (Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object') : []);
const strs = (raw) => (Array.isArray(raw) ? raw.map(String) : []);

const agoText = (date) => {
	if (!date) return t('never');
	const a = timeAgo(date);
	return t(a.key, a.params);
};

// ----------------------------------------------------------------- utilisateurs
const UserRow = ({user, onEdit, onToggle, onDelete}) => {
	const {api} = useAdmin();
	const handleEdit = useCallback(() => onEdit(user), [onEdit, user]);
	const handleToggle = useCallback(() => onToggle(user), [onToggle, user]);
	const handleDelete = useCallback(() => onDelete(user), [onDelete, user]);
	const p = user.Policy || {};
	const name = String(user.Name || t('unknown')).trim();
	return (
		<div className={css.splitRow}>
			<SpottableDiv className={css.splitMain} onClick={handleEdit}>
				<div className={css.row} style={{borderTop: 0, padding: 0, minHeight: 0}}>
					<div className={css.rowAvatar}>{user.PrimaryImageTag ? <img src={api.userImageUrl(user.Id, user.PrimaryImageTag)} alt="" /> : name.charAt(0).toUpperCase()}</div>
					<div className={css.rowText}>
						<div className={css.rowLabel}>{name}</div>
						<div className={css.rowHelp}>{user.LastActivityDate ? t('adminUserLastActivity', {time: agoText(user.LastActivityDate)}) : ''}</div>
						<div>
							{p.IsAdministrator ? <Chip tone="accent">{t('admin')}</Chip> : null}
							{p.IsDisabled ? <Chip tone="bad">{t('disabled')}</Chip> : null}
							<Chip>{p.EnableRemoteAccess !== false ? t('remoteAccess') : t('localOnly')}</Chip>
							{p.IsHidden ? <Chip>{t('hidden')}</Chip> : null}
						</div>
					</div>
				</div>
			</SpottableDiv>
			<Btn small label={p.IsDisabled ? t('enable') : t('disable')} onClick={handleToggle} />
			<Btn small danger label={t('delete')} onClick={handleDelete} />
		</div>
	);
};

export const Users = () => {
	const {api, push, toast} = useAdmin();
	const load = useCallback(() => api.getUsers(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [search, setSearch] = useState('');
	const [confirm, setConfirm] = useState(null);
	const handleAdd = useCallback(() => push('userAdd', {}, t('adminAddUser')), [push]);
	const handleEdit = useCallback((u) => push('userEdit', {userId: u.Id}, u.Name), [push]);
	const handleToggle = useCallback((u) => setConfirm({kind: 'toggle', user: u}), []);
	const handleDelete = useCallback((u) => setConfirm({kind: 'delete', user: u}), []);
	const handleClose = useCallback(() => setConfirm(null), []);
	const handleConfirm = useCallback(async () => {
		const {kind, user} = confirm;
		setConfirm(null);
		try {
			if (kind === 'delete') {
				await api.deleteUser(user.Id);
				toast(t('adminUserDeleted', {name: user.Name}));
			} else {
				// La politique fraîche, seul IsDisabled change.
				const fresh = await api.getUser(user.Id);
				const disable = !(user.Policy && user.Policy.IsDisabled);
				await api.updateUserPolicy(user.Id, {...fresh.Policy, IsDisabled: disable});
				toast(disable ? t('adminUserDisabled', {name: user.Name}) : t('adminUserEnabled', {name: user.Name}));
			}
			reload(true);
		} catch (e) {
			toast(kind === 'delete' ? t('adminUserDeleteFailed', {error: describeAdminError(e)}) : t('adminUserPolicyUpdateFailed', {error: describeAdminError(e)}));
		}
	}, [api, confirm, reload, toast]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminUsersLoadFailed')} message={error} onRetry={reload} />;
	const q = search.trim().toLowerCase();
	const users = data.filter((u) => !q || String(u.Name || '').toLowerCase().indexOf(q) >= 0)
		.sort((a, b) => String(a.Name || '').localeCompare(String(b.Name || '')));
	const c = confirm || {};
	const disabling = c.user && !(c.user.Policy && c.user.Policy.IsDisabled);
	return (
		<div>
			<PageHeader title={t('adminDrawerUsers')} subtitle={t('adminPageDescUsers')}>
				<Btn small primary icon="add" label={t('adminAddUser')} onClick={handleAdd} />
			</PageHeader>
			<Section>
				<TextRow label={t('adminSearchUsers')} value={search} onChange={setSearch} />
			</Section>
			<Section>
				{!users.length ? <InfoRow label={data.length ? t('adminNoUsersMatchSearch') : t('adminNoUsersFound')} /> : null}
				{users.map((u) => <UserRow key={u.Id} user={u} onEdit={handleEdit} onToggle={handleToggle} onDelete={handleDelete} />)}
			</Section>
			<Confirm
				open={!!confirm}
				title={c.kind === 'delete' ? t('adminDeleteUser') : disabling ? t('adminDisableUser') : t('adminEnableUser')}
				message={c.user ? (c.kind === 'delete' ? t('adminDeleteUserConfirm', {name: c.user.Name}) : disabling ? t('adminDisableUserConfirm', {name: c.user.Name}) : t('adminEnableUserConfirm', {name: c.user.Name})) : ''}
				confirmLabel={c.kind === 'delete' ? t('delete') : disabling ? t('disable') : t('enable')}
				danger={c.kind === 'delete' || disabling}
				onConfirm={handleConfirm}
				onClose={handleClose}
			/>
		</div>
	);
};

// « Tout » puis, s'il est coupé, une case par élément (_allOrSome).
const AllOrSome = ({allLabel, all, selected, items, onAll, onToggle}) => {
	const handleToggle = useCallback((on, id) => onToggle(id, on), [onToggle]);
	return (
		<>
			<SwitchRow label={allLabel} value={all} onChange={onAll} />
			{!all ? items.map(([id, name]) => <SwitchRow key={id} field={id} label={name} value={selected.indexOf(id) >= 0} onChange={handleToggle} />) : null}
		</>
	);
};

const toggleIn = (setter) => (id, on) => setter((list) => (on ? list.concat([id]) : list.filter((x) => x !== id)));

export const UserAdd = () => {
	const {api, push, pop, toast} = useAdmin();
	const load = useCallback(async () => {
		const [mediaFolders, channelList] = await Promise.all([api.getMediaFolders(false), api.getChannels().catch(() => [])]);
		return {folders: mediaFolders, channels: channelList};
	}, [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [name, setName] = useState('');
	const [password, setPassword] = useState('');
	const [allFolders, setAllFolders] = useState(true);
	const [folders, setFolders] = useState([]);
	const [allChannels, setAllChannels] = useState(true);
	const [channels, setChannels] = useState([]);
	const [saving, setSaving] = useState(false);
	const handleFolder = useMemo(() => toggleIn(setFolders), []);
	const handleChannel = useMemo(() => toggleIn(setChannels), []);
	const handleCreate = useCallback(async () => {
		if (!name.trim()) {
			toast(t('adminUsernameRequired'));
			return;
		}
		setSaving(true);
		try {
			const user = await api.createUser(name.trim(), password || null);
			// L'utilisateur existe désormais : un échec des accès ouvre quand même sa fiche.
			try {
				await api.updateUserPolicy(user.Id, {
					...(user.Policy || {}),
					EnableAllFolders: allFolders,
					EnabledFolders: allFolders ? [] : folders,
					EnableAllChannels: allChannels,
					EnabledChannels: allChannels ? [] : channels
				});
			} catch (e) {
				toast(t('adminUserPolicyUpdateFailed', {error: describeAdminError(e)}));
			}
			pop();
			push('userEdit', {userId: user.Id}, user.Name);
		} catch (e) {
			toast(t('adminUserCreateFailed', {error: describeAdminError(e)}));
		} finally {
			setSaving(false);
		}
	}, [api, name, password, allFolders, folders, allChannels, channels, pop, push, toast]);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={error} onRetry={reload} />;
	return (
		<div>
			<PageHeader title={t('adminAddUser')} />
			<Section title={t('profile')}>
				<TextRow label={t('username')} value={name} onChange={setName} />
				<TextRow label={t('password')} type="password" value={password} onChange={setPassword} />
			</Section>
			<Section title={t('adminLibraryAccess')}>
				<AllOrSome allLabel={t('adminEnableAllLibraryAccess')} all={allFolders} selected={folders} items={data.folders.map((f) => [String(f.Id), String(f.Name || f.Id)])} onAll={setAllFolders} onToggle={handleFolder} />
			</Section>
			{data.channels.length ? (
				<Section title={t('adminChannelAccess')}>
					<AllOrSome allLabel={t('adminEnableAllChannels')} all={allChannels} selected={channels} items={data.channels.map((c) => [String(c.Id), String(c.Name || c.Id)])} onAll={setAllChannels} onToggle={handleChannel} />
				</Section>
			) : null}
			<div className={css.btnRow}>
				<Btn primary icon="add" disabled={saving || !name.trim()} label={t('adminCreateUser')} onClick={handleCreate} />
			</div>
		</div>
	);
};

// ----------------------------------------------------------------- fiche d'un utilisateur
// Les classifications voisines de même note sont une seule option, noms joints par « / ».
export const groupRatings = (raw) => {
	const out = [];
	maps(raw).forEach((r) => {
		const name = r.Name == null ? null : String(r.Name);
		const score = r.RatingScore && typeof r.RatingScore === 'object' ? r.RatingScore.score : r.Value;
		const subScore = r.RatingScore && typeof r.RatingScore === 'object' ? r.RatingScore.subScore : null;
		if (name === null || score === null || score === undefined) return;
		const last = out[out.length - 1];
		if (last && last.score === score && last.subScore === (subScore == null ? null : subScore)) {
			last.name = `${last.name}/${name}`;
		} else {
			out.push({name, score, subScore: subScore == null ? null : subScore});
		}
	});
	return out;
};

// L'option exacte, sinon la plus haute en dessous.
export const ratingIndex = (ratings, max, sub) => {
	if (max === null || max === undefined) return -1;
	for (let i = ratings.length - 1; i >= 0; i--) {
		if (ratings[i].score === max && ratings[i].subScore === (sub == null ? null : sub)) return i;
	}
	for (let i = ratings.length - 1; i >= 0; i--) {
		if (ratings[i].score <= max) return i;
	}
	return -1;
};

export const badSchedule = (policy) => {
	const list = maps(policy && policy.AccessSchedules);
	for (let i = 0; i < list.length; i++) {
		if ((Number(list[i].StartHour) || 0) >= (Number(list[i].EndHour) || 0)) return i;
	}
	return null;
};

const SCHEDULE_DAYS = ['Everyday', 'Weekday', 'Weekend', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [];
for (let h = 0; h <= 24; h++) HOURS.push({value: h, label: `${h < 10 ? '0' : ''}${h}:00`});
const UNRATED = [['Book', 'adminUnratedBook'], ['ChannelContent', 'adminUnratedChannelContent'], ['LiveTvChannel', 'adminUnratedLiveTvChannel'], ['Movie', 'adminUnratedMovie'], ['Music', 'adminUnratedMusic'], ['Trailer', 'adminUnratedTrailer'], ['Series', 'adminUnratedSeries']];

const ScheduleRow = ({schedule, index, bad, onChange, onRemove}) => {
	const handleDay = useCallback((v) => onChange(index, 'DayOfWeek', v), [onChange, index]);
	const handleStart = useCallback((v) => onChange(index, 'StartHour', v), [onChange, index]);
	const handleEnd = useCallback((v) => onChange(index, 'EndHour', v), [onChange, index]);
	const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
	return (
		<>
			<SelectRow label={t('adminScheduleDay')} value={SCHEDULE_DAYS.indexOf(schedule.DayOfWeek) >= 0 ? schedule.DayOfWeek : 'Everyday'} options={SCHEDULE_DAYS.map((d) => ({value: d, label: t(`adminDay${d}`)}))} onChange={handleDay} />
			<SelectRow label={t('adminScheduleStart')} value={Number(schedule.StartHour) || 0} options={HOURS} onChange={handleStart} />
			<SelectRow label={t('adminScheduleEnd')} help={bad ? t('adminScheduleStartBeforeEnd') : undefined} value={Number(schedule.EndHour) || 0} options={HOURS} onChange={handleEnd} />
			<Row icon="warning" label={t('delete')} onClick={handleRemove} />
		</>
	);
};

const TagEditor = ({title, hint, tags, onChange}) => {
	const [adding, setAdding] = useState(false);
	const handleOpen = useCallback(() => setAdding(true), []);
	const handleClose = useCallback(() => setAdding(false), []);
	const handleAdd = useCallback(({tag}) => {
		setAdding(false);
		const v = String(tag || '').trim();
		if (v && tags.indexOf(v) < 0) onChange(tags.concat([v]));
	}, [tags, onChange]);
	const handleRemove = useCallback((v) => onChange(tags.filter((x) => x !== v)), [tags, onChange]);
	return (
		<Section title={title} help={hint}>
			<div className={css.btnRow}>
				{tags.map((x) => <Btn key={x} small value={x} label={`${x}  ✕`} onClick={handleRemove} />)}
				<Btn small primary icon="add" label={t('adminAddTag')} onClick={handleOpen} />
			</div>
			<PromptDialog open={adding} title={t('adminAddTag')} fields={[{key: 'tag', label: title, required: true}]} submitLabel={t('add')} onSubmit={handleAdd} onClose={handleClose} />
		</Section>
	);
};

export const UserEdit = ({userId}) => {
	const {api, user: me, toast, pop} = useAdmin();
	const [tab, setTab] = useState('prof');
	const [pw, setPw] = useState({current: '', next: '', confirm: ''});
	const [confirm, setConfirm] = useState(null);
	const fetchUser = useCallback(() => api.getUser(userId), [api, userId]);
	const load = useCallback(async () => {
		const list = (pol) => pol.catch(() => []);
		const [user, folders, ratings, auth, reset, channels, deletable, devices, network] = await Promise.all([
			fetchUser(),
			api.getMediaFolders(false),
			list(api.getParentalRatings()),
			list(api.getAuthProviders()),
			list(api.getPasswordResetProviders()),
			list(api.getChannels()),
			list(api.getChannels(true)),
			list(api.getDevices()),
			api.getNamedConfiguration('network').catch(() => ({}))
		]);
		if (!user.Policy) throw new Error(t('adminUserLoadFailed'));
		const prof = {...user};
		delete prof.Policy;
		return {
			targets: {
				profile: {
					value: prof,
					reload: async () => {
						const fresh = await fetchUser();
						delete fresh.Policy;
						return fresh;
					},
					post: async (dto) => {
						const newName = String(dto.Name || '').trim();
						if (!newName) throw new Error(t('adminUsernameRequired'));
						await api.updateUser(userId, {...dto, Name: newName});
					}
				},
				policy: {
					value: user.Policy,
					reload: async () => (await fetchUser()).Policy,
					post: async (value) => {
						if (badSchedule(value) !== null) throw new Error(t('adminScheduleStartBeforeEnd'));
						await api.updateUserPolicy(userId, value);
					}
				}
			},
			extra: {folders, ratings: groupRatings(ratings), auth, reset, channels, deletable, devices, remoteAccess: network.EnableRemoteAccess !== false}
		};
	}, [api, userId, fetchUser]);
	const {status, error, draft, extra, reload} = useDraftPage(load);

	const setPolicy = useCallback((v, key) => draft.set(key, v, 'policy'), [draft]);
	const setProfile = useCallback((v, key) => draft.set(key, v, 'prof'), [draft]);
	const setMbps = useCallback((v, key) => draft.set(key, Math.floor((Number(v) || 0) * 1000000), 'policy'), [draft]);
	const setInt0 = useCallback((v, key) => draft.set(key, v == null ? 0 : v, 'policy'), [draft]);
	const editPolicy = useCallback((change) => {
		change(draft.working('policy'));
		draft.touch();
	}, [draft]);
	const allSetter = useCallback((allKey, listKey) => (v) => editPolicy((pol) => {
		pol[allKey] = v;
		if (v) pol[listKey] = [];
	}), [editPolicy]);
	const listToggler = useCallback((listKey) => (id, on) => editPolicy((pol) => {
		const rest = strs(pol[listKey]).filter((x) => x !== id);
		pol[listKey] = on ? rest.concat([id]) : rest;
	}), [editPolicy]);
	const handleRating = useCallback((v) => editPolicy((pol) => {
		const r = extra.ratings[v];
		if (v === -1 || !r) {
			delete pol.MaxParentalRating;
			delete pol.MaxParentalSubRating;
		} else {
			pol.MaxParentalRating = r.score;
			if (r.subScore === null) delete pol.MaxParentalSubRating;
			else pol.MaxParentalSubRating = r.subScore;
		}
	}), [editPolicy, extra]);
	const handleUnrated = useCallback((on, value) => editPolicy((pol) => {
		const rest = strs(pol.BlockUnratedItems).filter((x) => x !== value);
		pol.BlockUnratedItems = on ? rest.concat([value]) : rest;
	}), [editPolicy]);
	const handleAllowedTags = useCallback((v) => draft.set('AllowedTags', v, 'policy'), [draft]);
	const handleBlockedTags = useCallback((v) => draft.set('BlockedTags', v, 'policy'), [draft]);
	const handleAddSchedule = useCallback(() => editPolicy((pol) => {
		pol.AccessSchedules = maps(pol.AccessSchedules).concat([{DayOfWeek: 'Everyday', StartHour: 0, EndHour: 24}]);
	}), [editPolicy]);
	const handleSchedule = useCallback((i, key, v) => editPolicy((pol) => {
		const list = maps(pol.AccessSchedules).map((x) => ({...x}));
		list[i][key] = v;
		pol.AccessSchedules = list;
	}), [editPolicy]);
	const handleRemoveSchedule = useCallback((i) => editPolicy((pol) => {
		pol.AccessSchedules = maps(pol.AccessSchedules).filter((x, j) => j !== i);
	}), [editPolicy]);
	const handlePw = useCallback((v, key) => setPw((s) => ({...s, [key]: v})), []);
	const handleSetPassword = useCallback(async () => {
		if (pw.next !== pw.confirm) {
			toast(t('adminPasswordsMismatch'));
			return;
		}
		if (!pw.next) {
			toast(t('adminNewPasswordEmpty'));
			return;
		}
		try {
			await api.updateUserPassword(userId, {currentPassword: me && me.Id === userId ? pw.current : undefined, newPassword: pw.next});
			setPw({current: '', next: '', confirm: ''});
			toast(t('adminPasswordUpdated'));
		} catch (e) {
			toast(t('adminFailed', {error: describeAdminError(e)}));
		}
	}, [api, userId, me, pw, toast]);
	const handleAskReset = useCallback(() => setConfirm('reset'), []);
	const handleAskDelete = useCallback(() => setConfirm('delete'), []);
	const handleConfirmClose = useCallback(() => setConfirm(null), []);
	const handleConfirm = useCallback(async () => {
		const what = confirm;
		setConfirm(null);
		try {
			if (what === 'reset') {
				await api.updateUserPassword(userId, {resetPassword: true});
				toast(t('adminPasswordReset'));
			} else {
				draft.discard();
				await api.deleteUser(userId);
				toast(t('adminUserDeleted', {name: draft.working('profile').Name}));
				pop();
			}
		} catch (e) {
			toast(t('adminFailed', {error: describeAdminError(e)}));
		}
	}, [api, userId, confirm, draft, pop, toast]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminUserLoadFailed')} message={error} onRetry={reload} />;
	const profile = draft.working('profile');
	const p = draft.working('policy');
	const isSelf = me && me.Id === userId;
	const name = String(profile.Name || '').trim();
	const has = (k) => Object.prototype.hasOwnProperty.call(p, k);
	const sw = (key, labelKey) => <SwitchRow key={key} field={key} label={t(labelKey)} value={p[key] === true} onChange={setPolicy} />;
	const mbps = (bps) => (Number(bps) > 0 ? Number(bps) / 1000000 : '');
	const providerOptions = (list) => list.map((x) => ({value: String(x.Id || x.id || ''), label: String(x.Name || x.name || x.Id || '')}));
	const providerValue = (list, key) => {
		const ids = list.map((x) => String(x.Id || x.id || ''));
		return ids.indexOf(p[key]) >= 0 ? p[key] : ids[0];
	};
	const deviceLabel = (d) => {
		const label = [d.CustomName || d.Name, d.AppName].filter(Boolean).join(' - ');
		return label || d.Id;
	};
	const ratingOptions = [{value: -1, label: t('adminParentalRatingNone')}].concat(extra.ratings.map((r, i) => ({value: i, label: r.name})));
	const bad = badSchedule(p);
	const inclusive = p.IsTagBlockingModeInclusive === true;
	const tabs = [
		{id: 'profile', label: t('profile')},
		{id: 'permissions', label: t('permissions')},
		{id: 'access', label: t('access')},
		{id: 'parental', label: t('adminParentalControl')},
		{id: 'password', label: t('password')}
	];
	return (
		<div>
			<PageHeader title={name || t('adminUserSettings')} />
			<Tabs tabs={tabs} value={tab} onChange={setTab} />
			{tab === 'profile' ? (
				<>
					{p.IsDisabled ? <Warn>{t('adminUserDisabledBanner')}</Warn> : null}
					<Section title={t('profile')}>
						<TextRow field="Name" label={t('username')} value={profile.Name} onChange={setProfile} />
						{profile.LastActivityDate ? <InfoRow label={t('tvLastActivity')} value={formatDateTime(profile.LastActivityDate)} /> : null}
						{!isSelf ? <Row icon="warning" label={t('adminDeleteUser')} onClick={handleAskDelete} /> : null}
					</Section>
				</>
			) : null}
			{tab === 'permissions' ? (
				<>
					<Section title={t('admin')}>
						{p.IsAdministrator ? <InfoRow label={t('adminFullAccessWarning')} /> : null}
						{sw('IsAdministrator', 'administrator')}
						{sw('IsHidden', 'adminHiddenUser')}
						{sw('IsDisabled', 'disabled')}
					</Section>
					<Section title={t('playback')}>
						{sw('EnableMediaPlayback', 'adminAllowMediaPlayback')}
						{sw('EnableAudioPlaybackTranscoding', 'adminAllowAudioTranscoding')}
						{sw('EnableVideoPlaybackTranscoding', 'adminAllowVideoTranscoding')}
						{sw('EnablePlaybackRemuxing', 'adminAllowRemuxing')}
						{has('ForceRemoteSourceTranscoding') ? sw('ForceRemoteSourceTranscoding', 'adminForceRemoteTranscoding') : null}
						<NumberRow field="RemoteClientBitrateLimit" label={t('adminRemoteBitrateLimitMbps')} help={t('adminLeaveEmptyNoLimit')} value={mbps(p.RemoteClientBitrateLimit)} decimals={2} min={0} fallback={0} onChange={setMbps} />
					</Section>
					<Section title={t('content')}>
						{sw('EnableContentDownloading', 'adminAllowContentDownloading')}
						{sw('EnablePublicSharing', 'adminAllowPublicSharing')}
					</Section>
					<Section title={t('sessions')}>
						{sw('EnableRemoteControlOfOtherUsers', 'adminAllowRemoteControl')}
						{sw('EnableSharedDeviceControl', 'adminAllowSharedDeviceControl')}
						{extra.remoteAccess ? sw('EnableRemoteAccess', 'adminAllowRemoteAccess') : null}
						<NumberRow field="MaxActiveSessions" label={t('adminMaxActiveSessions')} help={t('adminLeaveEmptyNoLimit')} value={p.MaxActiveSessions || ''} fallback={0} onChange={setInt0} />
					</Section>
					<Section title={t('features')}>
						{sw('EnableLiveTvAccess', 'adminAllowLiveTvAccess')}
						{sw('EnableLiveTvManagement', 'adminAllowLiveTvManagement')}
						{has('EnableCollectionManagement') ? sw('EnableCollectionManagement', 'adminAllowCollectionManagement') : null}
						{sw('EnableSubtitleManagement', 'adminAllowSubtitleManagement')}
						{has('EnableLyricManagement') ? sw('EnableLyricManagement', 'adminAllowLyricManagement') : null}
					</Section>
					<Section title={t('authentication')}>
						{extra.auth.length ? <SelectRow field="AuthenticationProviderId" label={t('adminAuthProvider')} value={providerValue(extra.auth, 'AuthenticationProviderId')} options={providerOptions(extra.auth)} onChange={setPolicy} /> : null}
						{extra.reset.length ? <SelectRow field="PasswordResetProviderId" label={t('adminPasswordResetProvider')} value={providerValue(extra.reset, 'PasswordResetProviderId')} options={providerOptions(extra.reset)} onChange={setPolicy} /> : null}
						<NumberRow field="LoginAttemptsBeforeLockout" label={t('adminLoginAttemptsBeforeLockout')} help={t('adminLoginAttemptsHint')} value={p.LoginAttemptsBeforeLockout} fallback={0} onChange={setInt0} />
						<SelectRow field="SyncPlayAccess" label={t('adminSyncPlayAccess')} value={p.SyncPlayAccess || 'CreateAndJoinGroups'} options={[
							{value: 'CreateAndJoinGroups', label: t('adminSyncPlayCreateAndJoin')},
							{value: 'JoinGroups', label: t('adminSyncPlayJoin')},
							{value: 'None', label: t('adminSyncPlayNone')}
						]} onChange={setPolicy} />
					</Section>
				</>
			) : null}
			{tab === 'access' ? (
				<>
					<Section title={t('adminLibraryAccess')}>
						<AllOrSome allLabel={t('adminEnableAllLibraryAccess')} all={p.EnableAllFolders === true} selected={strs(p.EnabledFolders)} items={extra.folders.map((f) => [String(f.Id), String(f.Name || f.Id)])} onAll={allSetter('EnableAllFolders', 'EnabledFolders')} onToggle={listToggler('EnabledFolders')} />
					</Section>
					{extra.channels.length ? (
						<Section title={t('adminChannelAccess')}>
							<AllOrSome allLabel={t('adminEnableAllChannels')} all={p.EnableAllChannels === true} selected={strs(p.EnabledChannels)} items={extra.channels.map((c) => [String(c.Id), String(c.Name || c.Id)])} onAll={allSetter('EnableAllChannels', 'EnabledChannels')} onToggle={listToggler('EnabledChannels')} />
						</Section>
					) : null}
					{extra.devices.length ? (
						<Section title={t('adminDeviceAccess')}>
							<AllOrSome allLabel={t('adminEnableAllDevices')} all={p.EnableAllDevices === true} selected={strs(p.EnabledDevices)} items={extra.devices.map((d) => [String(d.Id), deviceLabel(d)])} onAll={allSetter('EnableAllDevices', 'EnabledDevices')} onToggle={listToggler('EnabledDevices')} />
						</Section>
					) : null}
					<Section title={t('adminContentDeletionFolders')}>
						<AllOrSome
							allLabel={t('adminDeleteFromAllLibraries')}
							all={p.EnableContentDeletion === true}
							selected={strs(p.EnableContentDeletionFromFolders)}
							items={extra.folders.map((f) => [String(f.Id), String(f.Name || f.Id)]).concat(extra.deletable.map((c) => [String(c.Id), String(c.Name || c.Id)]))}
							onAll={allSetter('EnableContentDeletion', 'EnableContentDeletionFromFolders')}
							onToggle={listToggler('EnableContentDeletionFromFolders')}
						/>
					</Section>
				</>
			) : null}
			{tab === 'parental' ? (
				<>
					<Section title={t('adminMaxParentalRating')}>
						<SelectRow label={t('adminMaxParentalRating')} help={t('adminMaxParentalRatingHint')} value={ratingIndex(extra.ratings, p.MaxParentalRating, p.MaxParentalSubRating)} options={ratingOptions} onChange={handleRating} />
					</Section>
					<Section title={t('adminBlockUnratedItems')}>
						{UNRATED.map(([v, l]) => <SwitchRow key={v} field={v} label={t(l)} value={strs(p.BlockUnratedItems).indexOf(v) >= 0} onChange={handleUnrated} />)}
					</Section>
					<TagEditor title={t('adminAllowedTags')} hint={t('adminAllowedTagsHint')} tags={strs(p.AllowedTags)} onChange={handleAllowedTags} />
					<TagEditor title={inclusive ? t('adminAllowedTags') : t('adminBlockedTags')} hint={inclusive ? t('adminAllowedTagsHint') : t('adminBlockedTagsHint')} tags={strs(p.BlockedTags)} onChange={handleBlockedTags} />
					<Section title={t('adminAccessSchedules')} help={t('adminAccessSchedulesHint')}>
						{maps(p.AccessSchedules).map((s, i) => <ScheduleRow key={i} schedule={s} index={i} bad={bad === i} onChange={handleSchedule} onRemove={handleRemoveSchedule} />)}
						<Row icon="add" label={t('adminAddSchedule')} onClick={handleAddSchedule} />
					</Section>
				</>
			) : null}
			{tab === 'password' ? (
				<>
					<Section title={t('adminChangePassword')}>
						{isSelf ? <TextRow field="current" type="password" label={t('adminCurrentPassword')} value={pw.current} onChange={handlePw} /> : null}
						<TextRow field="next" type="password" label={t('adminNewPassword')} value={pw.next} onChange={handlePw} />
						<TextRow field="confirm" type="password" label={t('adminConfirmPassword')} value={pw.confirm} onChange={handlePw} />
						<div className={css.btnRow}><Btn primary label={t('adminSetPassword')} onClick={handleSetPassword} /></div>
					</Section>
					{!isSelf ? (
						<Section title={t('adminResetPassword')}>
							<Row icon="warning" label={t('adminResetPassword')} help={t('adminResetPasswordWarning')} onClick={handleAskReset} />
						</Section>
					) : null}
				</>
			) : null}
			<Confirm
				open={!!confirm}
				title={confirm === 'reset' ? t('adminResetPassword') : t('adminDeleteUser')}
				message={confirm === 'reset' ? t('adminResetPasswordWarning') : t('adminDeleteUserConfirm', {name})}
				confirmLabel={confirm === 'reset' ? t('reset') : t('delete')}
				danger
				onConfirm={handleConfirm}
				onClose={handleConfirmClose}
			/>
		</div>
	);
};

// ----------------------------------------------------------------- appareils
const DeviceRow = ({device, current, onRename, onDelete}) => {
	const handleRename = useCallback(() => onRename(device), [onRename, device]);
	const handleDelete = useCallback(() => onDelete(device), [onDelete, device]);
	return (
		<div className={css.splitRow}>
			<SpottableDiv className={css.splitMain} onClick={handleRename}>
				<div className={css.rowLabel}>{device.CustomName || device.Name || device.Id}{current ? <span style={{marginLeft: '0.6rem'}}><Chip tone="accent">{t('adminThisDevice')}</Chip></span> : null}</div>
				<div className={css.rowHelp}>{[[device.AppName, device.AppVersion].filter(Boolean).join(' '), device.LastUserName, agoText(device.DateLastActivity)].filter(Boolean).join(' · ')}</div>
			</SpottableDiv>
			{!current ? <Btn small danger label={t('delete')} onClick={handleDelete} /> : null}
		</div>
	);
};

export const Devices = () => {
	const {api, toast} = useAdmin();
	const load = useCallback(() => api.getDevices(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [search, setSearch] = useState('');
	const [userFilter, setUserFilter] = useState('');
	const [dialog, setDialog] = useState(null);
	const currentId = getDeviceId();
	const handleRename = useCallback((dev) => setDialog({kind: 'rename', device: dev}), []);
	const handleDelete = useCallback((dev) => setDialog({kind: 'delete', device: dev}), []);
	const handleDeleteAll = useCallback(() => setDialog({kind: 'all'}), []);
	const handleClose = useCallback(() => setDialog(null), []);
	const handleRenamed = useCallback(async ({name}) => {
		const device = dialog.device;
		setDialog(null);
		try {
			const options = await api.getDeviceOptions(device.Id);
			options.CustomName = String(name || '').trim();
			await api.updateDeviceOptions(device.Id, options);
			toast(t('adminDeviceNameUpdated'));
			reload(true);
		} catch (e) {
			toast(t('adminDeviceUpdateFailed', {error: describeAdminError(e)}));
		}
	}, [api, dialog, reload, toast]);
	const handleConfirm = useCallback(async () => {
		const dev = dialog;
		setDialog(null);
		if (dev.kind === 'delete') {
			try {
				await api.deleteDevice(dev.device.Id);
				toast(t('adminDeviceDeleted'));
			} catch (e) {
				toast(t('adminDeviceDeleteFailed', {error: describeAdminError(e)}));
			}
		} else {
			let failed = 0;
			for (const other of (data || []).filter((x) => x.Id !== currentId)) {
				try {
					await api.deleteDevice(other.Id);
				} catch {
					failed++;
				}
			}
			toast(failed ? t('adminDevicesDeletedPartial', {count: failed}) : t('adminDevicesDeletedAll'));
		}
		reload(true);
	}, [api, dialog, data, currentId, reload, toast]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminDevicesLoadFailed')} message={error} onRetry={reload} />;
	const users = Array.from(new Set(data.map((dev) => dev.LastUserName).filter(Boolean))).sort();
	const q = search.trim().toLowerCase();
	const shown = data
		.filter((dev) => !userFilter || dev.LastUserName === userFilter)
		.filter((dev) => !q || [dev.CustomName, dev.Name, dev.AppName, dev.LastUserName].some((x) => String(x || '').toLowerCase().indexOf(q) >= 0))
		.sort((a, b) => String(b.DateLastActivity || '').localeCompare(String(a.DateLastActivity || '')));
	const others = data.filter((x) => x.Id !== currentId).length;
	const d = dialog || {};
	return (
		<div>
			<PageHeader title={t('adminDrawerDevices')} subtitle={t('adminPageDescDevices')}>
				<Btn small danger label={t('adminDeleteAllDevices')} disabled={!others} onClick={handleDeleteAll} />
			</PageHeader>
			<Section>
				<TextRow label={t('adminSearchDevices')} value={search} onChange={setSearch} />
				<SelectRow label={t('tvUser')} value={userFilter} options={[{value: '', label: t('all')}].concat(users.map((u) => ({value: u, label: u})))} onChange={setUserFilter} />
			</Section>
			<Section>
				{!shown.length ? <InfoRow label={data.length ? t('adminNoDevicesMatchCurrentFilters') : t('adminNoDevicesFound')} /> : null}
				{shown.map((dev) => <DeviceRow key={dev.Id} device={dev} current={dev.Id === currentId} onRename={handleRename} onDelete={handleDelete} />)}
			</Section>
			<PromptDialog open={d.kind === 'rename'} title={t('adminEditDeviceName')} fields={d.device ? [{key: 'name', label: t('adminCustomName'), value: d.device.CustomName || ''}] : []} onSubmit={handleRenamed} onClose={handleClose} />
			<Confirm
				open={d.kind === 'delete' || d.kind === 'all'}
				title={d.kind === 'all' ? t('adminDeleteAllDevices') : t('adminDeleteDevice')}
				message={d.kind === 'all' ? t('adminDeleteAllDevicesConfirm', {count: others}) : d.device ? t('adminRemoveDeviceConfirm', {name: d.device.CustomName || d.device.Name || d.device.Id}) : ''}
				confirmLabel={t('delete')}
				danger
				onConfirm={handleConfirm}
				onClose={handleClose}
			/>
		</div>
	);
};

// ----------------------------------------------------------------- clés API
const keyToken = (k) => String(k.AccessToken || k.Key || k.Token || k.Id || '');
const keyApp = (k) => String(k.AppName || k.App || k.Name || k.Client || '').trim() || t('adminUnknownApp');

const KeyRow = ({item, onRevoke}) => {
	const handleRevoke = useCallback(() => onRevoke(item), [onRevoke, item]);
	return (
		<div className={css.splitRow}>
			<div className={css.splitMain}>
				<div className={css.rowLabel}>{keyApp(item)}</div>
				<div className={`${css.rowHelp} ${css.mono}`}>{t('adminApiKeyTokenCreated', {token: keyToken(item), created: formatDateTime(item.DateCreated || item.DateLastActivity) || t('unknown')})}</div>
			</div>
			<Btn small danger label={t('revoke')} onClick={handleRevoke} />
		</div>
	);
};

const CREATE_FIELDS = [{key: 'app', label: t('adminAppName'), required: true}];

export const ApiKeys = () => {
	const {api, toast} = useAdmin();
	const load = useCallback(() => api.getApiKeys(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [dialog, setDialog] = useState(null);
	const [created, setCreated] = useState(null);
	const handleCreate = useCallback(() => setDialog({kind: 'create'}), []);
	const handleRevoke = useCallback((item) => setDialog({kind: 'revoke', item}), []);
	const handleClose = useCallback(() => setDialog(null), []);
	const handleCreatedClose = useCallback(() => setCreated(null), []);
	const handleCreated = useCallback(async ({app}) => {
		setDialog(null);
		const name = String(app || '').trim();
		if (!name) return;
		const before = (data || []).map(keyToken);
		try {
			await api.createApiKey(name);
			const fresh = await api.getApiKeys();
			const fresher = fresh.map(keyToken).filter((k) => k && before.indexOf(k) < 0);
			setCreated({token: fresher.length === 1 ? fresher[0] : null});
			reload(true);
		} catch (e) {
			toast(t('adminApiKeyCreateFailed', {error: describeAdminError(e)}));
		}
	}, [api, data, reload, toast]);
	const handleConfirmRevoke = useCallback(async () => {
		const item = dialog.item;
		setDialog(null);
		const token = keyToken(item);
		if (!token) {
			toast(t('adminKeyTokenMissing'));
			return;
		}
		try {
			await api.revokeApiKey(token);
			toast(t('adminApiKeyRevoked'));
			reload(true);
		} catch (e) {
			toast(t('adminApiKeyRevokeFailed', {error: describeAdminError(e)}));
		}
	}, [api, dialog, reload, toast]);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminApiKeysLoadFailed')} message={error} onRetry={reload} />;
	const d = dialog || {};
	return (
		<div>
			<PageHeader title={t('adminApiKeysTitle')} subtitle={t('adminPageDescApiKeys')}>
				<Btn small primary icon="add" label={t('adminCreateKey')} onClick={handleCreate} />
			</PageHeader>
			<Section>
				{!data.length ? <InfoRow label={t('adminNoApiKeys')} /> : data.map((k) => <KeyRow key={keyToken(k) || keyApp(k)} item={k} onRevoke={handleRevoke} />)}
			</Section>
			<PromptDialog open={d.kind === 'create'} title={t('adminCreateApiKey')} fields={CREATE_FIELDS} submitLabel={t('create')} onSubmit={handleCreated} onClose={handleClose} />
			<Confirm open={d.kind === 'revoke'} title={t('adminRevokeApiKey')} message={d.item ? t('adminRevokeKeyConfirm', {name: keyApp(d.item)}) : ''} confirmLabel={t('revoke')} danger onConfirm={handleConfirmRevoke} onClose={handleClose} />
			{created ? (
				<CoreDialog open onClose={handleCreatedClose} title={t('adminApiKeyCreated')} spotlightId="admin-key-created">
					<div className={css.dialogBody}>
						{created.token ? <div className={css.mono}>{created.token}</div> : <Note>{t('adminApiKeyCreatedNoToken')}</Note>}
						<div className={css.dialogActions}><Btn primary label={t('done')} onClick={handleCreatedClose} /></div>
					</div>
				</CoreDialog>
			) : null}
		</div>
	);
};
