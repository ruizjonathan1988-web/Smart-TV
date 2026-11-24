// Console d'administration du serveur (lib/ui/screens/admin de l'APK), version
// TV. Même coquille que l'APK en grand écran : à gauche le rail des groupes,
// puis la liste des pages du groupe, et à droite la page dans son panneau avec
// le fil d'Ariane et, quand une page a des modifications, la barre
// « Annuler / Enregistrer ». Flèches pour se déplacer, OK pour choisir,
// Retour pour remonter (sous-page → page → liste des pages → sortie).
import {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';

import {useAuth} from '../../context/AuthContext';
import {adminApi, describeAdminError} from '../../services/adminApi';
import {AdminContext} from './adminContext';
import {ADMIN_GROUPS, groupOfPage, pageById, canAdminister} from './adminNav';
import {PAGES, SCREENS} from './adminScreens';
import {SpottableDiv, Icon, Btn, Confirm, ErrorBox, css} from './AdminUi';
import {t} from './adminText';

const RailContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const ListContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const ContentContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const BarContainer = SpotlightContainerDecorator({enterTo: 'default-element'}, 'div');

const TOAST_MS = 3500;

const RailButton = ({group, on, onPick}) => {
	const handleClick = useCallback(() => onPick(group.id), [onPick, group.id]);
	return (
		<SpottableDiv className={`${css.railButton} ${on ? css.railOn : ''}`} onClick={handleClick} data-admin-group={group.id}>
			<Icon name={group.icon} />
			{t(group.title)}
		</SpottableDiv>
	);
};

const PageTile = ({page, on, onPick}) => {
	const handleClick = useCallback(() => onPick(page.id), [onPick, page.id]);
	return (
		<SpottableDiv className={`${css.pageTile} ${on ? css.pageTileOn : ''}`} onClick={handleClick} data-admin-page={page.id}>
			<Icon name={page.icon} />
			<div>
				<div className={css.pageTileTitle}>{t(page.title)}</div>
				<div className={css.pageTileDesc}>{t(page.desc)}</div>
			</div>
		</SpottableDiv>
	);
};

// La barre du bas tant que la page a des modifications (admin_unsaved_bar.dart).
const UnsavedBar = ({draft, onSaved}) => {
	const handleDiscard = useCallback(() => draft.discard(), [draft]);
	const handleSave = useCallback(async () => {
		if (await draft.save()) onSaved();
	}, [draft, onSaved]);
	const error = draft.error;
	return (
		<BarContainer className={css.unsavedBar} spotlightId="admin-unsaved">
			<div className={`${css.unsavedText} ${error ? css.unsavedError : ''}`}>
				{error ? t('adminSettingsSaveFailed', {error: describeAdminError(error)}) : (draft.saving ? t('tvSaving') : t('adminUnsavedChanges'))}
			</div>
			<Btn small label={t('adminDiscard')} disabled={draft.saving} onClick={handleDiscard} />
			<Btn small primary label={t('save')} disabled={draft.saving || !draft.isDirty()} onClick={handleSave} spotlightId="admin-save" />
		</BarContainer>
	);
};

const Admin = ({backHandlerRef, onExit, onSelectItem}) => {
	const {user, serverType} = useAuth();
	const api = useMemo(() => adminApi(), []);
	const [pageId, setPageId] = useState('dashboard');
	const [stack, setStack] = useState([]);
	const [draft, setDraftState] = useState(null);
	const [, setDraftTick] = useState(0);
	const [leave, setLeave] = useState(null);
	const [toast, setToast] = useState(null);
	const draftRef = useRef(null);
	draftRef.current = draft;
	const toastTimer = useRef(null);
	const group = groupOfPage(pageId);
	const allowed = canAdminister(user, serverType);

	useEffect(() => () => clearTimeout(toastTimer.current), []);

	const showToast = useCallback((text) => {
		setToast(text);
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
	}, []);

	const focusContent = useCallback(() => {
		setTimeout(() => Spotlight.focus('admin-content'), 60);
	}, []);

	// Avant de quitter une page modifiée : « Abandonner les modifications ? »
	const guard = useCallback((go) => {
		const d = draftRef.current;
		if (d && d.isDirty()) {
			setLeave(() => () => {
				d.discard();
				setLeave(null);
				go();
			});
			return;
		}
		go();
	}, []);

	const openPage = useCallback((id, focus = true) => {
		guard(() => {
			setStack([]);
			setDraftState(null);
			setPageId(id);
			if (focus) focusContent();
		});
	}, [guard, focusContent]);

	const handlePickGroup = useCallback((id) => {
		const g = ADMIN_GROUPS.find((x) => x.id === id);
		if (g) openPage(g.pages[0].id, false);
	}, [openPage]);

	const handlePickPage = useCallback((id) => openPage(id, true), [openPage]);

	const push = useCallback((screen, params, title) => {
		guard(() => {
			setDraftState(null);
			setStack((s) => s.concat([{screen, params: params || {}, title}]));
			focusContent();
		});
	}, [guard, focusContent]);

	const pop = useCallback(() => {
		guard(() => {
			setDraftState(null);
			setStack((s) => s.slice(0, -1));
			focusContent();
		});
	}, [guard, focusContent]);

	const ctx = useMemo(() => ({
		api,
		user,
		serverType,
		onSelectItem,
		openPage,
		push,
		pop,
		toast: showToast,
		setDraft: (d) => setDraftState(d),
		releaseDraft: (d) => setDraftState((cur) => (cur === d ? null : cur)),
		draftChanged: () => setDraftTick((n) => n + 1)
	}), [api, user, serverType, onSelectItem, openPage, push, pop, showToast]);

	const handleSaved = useCallback(() => showToast(t('adminSettingsSaved')), [showToast]);
	const handleKeep = useCallback(() => setLeave(null), []);

	// Retour : sous-page → page ; contenu → liste des pages ; sinon on sort.
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (leave) {
				setLeave(null);
				return true;
			}
			if (stack.length) {
				pop();
				return true;
			}
			const current = Spotlight.getCurrent();
			const content = document.querySelector('[data-spotlight-id="admin-content"]');
			const bar = document.querySelector('[data-spotlight-id="admin-unsaved"]');
			if (current && ((content && content.contains(current)) || (bar && bar.contains(current)))) {
				Spotlight.focus(`[data-admin-page="${pageId}"]`);
				return true;
			}
			const d = draftRef.current;
			if (d && d.isDirty()) {
				guard(() => onExit && onExit());
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, leave, stack, pop, pageId, guard, onExit]);

	// Premier focus : la page ouverte dans la liste.
	const firstPage = useRef(pageId);
	useEffect(() => {
		const id = setTimeout(() => Spotlight.focus(`[data-admin-page="${firstPage.current}"]`) || Spotlight.focus('admin-pages'), 120);
		return () => clearTimeout(id);
	}, []);

	const top = stack.length ? stack[stack.length - 1] : null;
	const Screen = top ? SCREENS[top.screen] : PAGES[pageId];
	const page = pageById(pageId);
	const dirty = draft && (draft.isDirty() || draft.saving || draft.error);

	const crumbs = [t('adminServerAdministrationTitle'), t(group.title), page ? t(page.title) : ''];
	stack.forEach((s) => {
		if (s.title) crumbs.push(s.title);
	});

	return (
		<AdminContext.Provider value={ctx}>
			<div className={css.admin}>
				<RailContainer className={css.rail} spotlightId="admin-rail">
					<div className={css.mark}>VJOD</div>
					{ADMIN_GROUPS.map((g) => <RailButton key={g.id} group={g} on={g.id === group.id} onPick={handlePickGroup} />)}
				</RailContainer>
				<ListContainer className={css.pageList} spotlightId="admin-pages">
					<Scroller direction="vertical" verticalScrollbar="hidden">
						<div className={css.pageListInner}>
							<div className={css.overline}>{t('adminServerAdministrationTitle')}</div>
							<div className={css.groupTitle}>{t(group.title)}</div>
							{group.pages.map((p) => <PageTile key={p.id} page={p} on={p.id === pageId} onPick={handlePickPage} />)}
						</div>
					</Scroller>
				</ListContainer>
				<div className={css.main}>
					<div className={css.topBar}>
						{stack.length ? <div className={css.backHint}>{t('tvBackHint')}</div> : null}
						<div className={css.crumbs}>
							{crumbs.slice(0, -1).join('  ›  ')}{'  ›  '}<span className={css.crumbLast}>{crumbs[crumbs.length - 1]}</span>
						</div>
					</div>
					<div className={`${css.panel} ${dirty ? css.panelWithBar : ''}`}>
						<ContentContainer className={css.content} spotlightId="admin-content">
							<Scroller key={`${pageId}:${stack.length}`} direction="vertical" verticalScrollbar="hidden">
								<div className={css.contentInner}>
									{!allowed ? (
										<ErrorBox title={t('tvAdminOnlyTitle')} message={t('tvAdminOnly')} />
									) : Screen ? <Screen {...(top ? top.params : {})} /> : null}
								</div>
							</Scroller>
						</ContentContainer>
					</div>
					{dirty ? <UnsavedBar draft={draft} onSaved={handleSaved} /> : null}
				</div>
				{toast ? <div className={css.toast}>{toast}</div> : null}
				<Confirm
					open={!!leave}
					title={t('adminLeaveTitle')}
					message={t('adminLeaveMessage')}
					confirmLabel={t('adminDiscard')}
					danger
					onConfirm={leave || handleKeep}
					onClose={handleKeep}
				/>
			</div>
		</AdminContext.Provider>
	);
};

export default Admin;
