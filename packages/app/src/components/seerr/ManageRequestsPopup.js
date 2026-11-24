import {memo, useCallback, useState} from 'react';
import $L from '@enact/i18n/$L';

import CoreDialog from '../CoreDialog';
import QrLinkDialog from '../ServerMessagesDialog/QrLinkDialog';
import seerrApi, {REQUEST_STATUS} from '../../services/seerrApi';
import {arrUrlForRequest} from '../../services/arrLinks';
import {SeerrButtonRow, SeerrDialogButton} from './SeerrDialogControls';

import css from './ManageRequestsPopup.module.less';

// Approving or declining the requests waiting on this title, for a viewer allowed to moderate.
// Like the APK (seerr_manage_requests_sheet.dart), an approved request still being fetched is
// listed too: « Relancer la recherche » sends it to Radarr / Sonarr again, and « Ouvrir dans
// Radarr / Sonarr » hands the title's page to the phone as a QR code.

const requestedByLabel = (request) => {
	const user = request?.requestedBy;
	const name = user?.displayName ?? user?.username ?? user?.email ?? $L('Unknown');
	const label = $L('Requested by {name}').replace('{name}', name);
	return request?.is4k ? `${label} · ${$L('4K')}` : label;
};

export const ManageRequestsPopup = memo(({open, requests, onResolve, onRetry, onClose}) => {
	// Only one answer goes out at a time.
	const [busy, setBusy] = useState(false);
	const [link, setLink] = useState(null); // {title, url} or {title, missing}

	const handleResolve = useCallback(async (e) => {
		const {requestId, action} = e.currentTarget.dataset;
		setBusy(true);
		try {
			await onResolve(Number(requestId), action === 'approve');
		} finally {
			setBusy(false);
		}
	}, [onResolve]);

	const handleRetry = useCallback(async (e) => {
		const {requestId} = e.currentTarget.dataset;
		setBusy(true);
		try {
			await onRetry(Number(requestId));
		} finally {
			setBusy(false);
		}
	}, [onRetry]);

	const handleOpen = useCallback(async (e) => {
		const id = Number(e.currentTarget.dataset.requestId);
		const request = (requests || []).find((r) => r.id === id);
		if (!request) return;
		const title = request.type === 'movie' ? 'Ouvrir dans Radarr' : 'Ouvrir dans Sonarr';
		const url = await arrUrlForRequest(seerrApi, request);
		setLink(url ? {title, url} : {title, missing: true});
	}, [requests]);

	const closeLink = useCallback(() => setLink(null), []);

	const onPress = busy ? null : handleResolve;
	const onRetryPress = busy || !onRetry ? null : handleRetry;

	return (
		<>
			<CoreDialog
				open={open && !(link && link.url)}
				onClose={onClose}
				title={$L('Manage Requests')}
				spotlightId="manage-requests"
				bodyClassName={css.body}
			>
				{link && link.missing ? <div className={css.requester}>Lien vers le service indisponible</div> : null}
				{(requests || []).map((request) => (
					<div key={request.id}>
						<div className={css.requester}>{requestedByLabel(request)}</div>
						{request.status === REQUEST_STATUS.PENDING ? (
							<SeerrButtonRow>
								<SeerrDialogButton
									label={$L('Approve')}
									icon="checkCircleOutline"
									primary
									primaryColor="#388e3c"
									data-request-id={request.id}
									data-action="approve"
									onClick={onPress}
								/>
								<SeerrDialogButton
									label={$L('Decline')}
									icon="cancelOutlined"
									foreground="#e57373"
									data-request-id={request.id}
									data-action="decline"
									onClick={onPress}
								/>
							</SeerrButtonRow>
						) : null}
						<SeerrButtonRow>
							<SeerrDialogButton
								label="Relancer la recherche"
								icon="refreshRounded"
								data-request-id={request.id}
								onClick={onRetryPress}
							/>
							<SeerrDialogButton
								label={request.type === 'movie' ? 'Ouvrir dans Radarr' : 'Ouvrir dans Sonarr'}
								data-request-id={request.id}
								onClick={handleOpen}
							/>
						</SeerrButtonRow>
					</div>
				))}
			</CoreDialog>
			<QrLinkDialog open={Boolean(link && link.url)} title={link ? link.title : ''} url={link && link.url ? link.url : ''} onClose={closeLink} />
		</>
	);
});
