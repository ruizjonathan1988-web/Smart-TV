import {useCallback, useEffect, useState} from 'react';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import * as jellyfinApi from '../../services/jellyfinApi';
import {describeQuickConnectError, normalizeQuickConnectCode, supportsQuickConnectAuthorize} from '../../services/quickConnectAuthorize';
import {CoreAlertDialog} from '../CoreDialog';
import SpottableInput from '../SpottableInput/SpottableInput';

import css from './QuickConnectAuthorize.module.less';

// Les textes de l'APK (app_fr.arb), sous des clés propres pour ne pas changer ceux de la connexion.
const text = {
	title: () => $L({key: 'quickConnectAccountTitle', value: 'Quick Connect'}),
	hint: () => $L({key: 'quickConnectEnterCode', value: 'Enter code'}),
	authorize: () => $L({key: 'quickConnectAuthorize', value: 'Authorize'}),
	authorized: () => $L({key: 'quickConnectAuthorized', value: 'Quick Connect request authorized.'}),
	invalid: () => $L({key: 'quickConnectInvalidOrExpired', value: 'The Quick Connect code is invalid or expired.'}),
	notSupported: () => $L({key: 'quickConnectNotSupported', value: 'Quick Connect is not supported on this server.'}),
	failed: () => $L({key: 'quickConnectAuthorizeFailed', value: 'Failed to authorize the Quick Connect code.'}),
	disabled: () => $L({key: 'quickConnectDisabled', value: 'Quick Connect is disabled on this server.'}),
	forbidden: () => $L({key: 'quickConnectForbidden', value: 'Your account cannot authorize this Quick Connect request.'}),
	notFound: () => $L({key: 'quickConnectNotFound', value: 'Quick Connect code not found. Try a new code.'}),
	failedWithMessage: (message) => $L({key: 'quickConnectFailedWithMessage', value: 'Quick Connect failed: {message}'}).replace('{message}', message)
};

const errorText = (error) => {
	const {key, message} = describeQuickConnectError(error);
	if (key === 'raw') return message;
	if (key === 'failedWithMessage') return text.failedWithMessage(message);
	return text[key]();
};

const QuickConnectAuthorize = ({open, onClose}) => {
	const {user, serverType} = useAuth();
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState(null);

	useEffect(() => {
		if (open) {
			setCode('');
			setBusy(false);
			setResult(null);
		}
	}, [open]);

	const handleChange = useCallback((e) => {
		const value = e && e.target ? e.target.value : e;
		setCode(normalizeQuickConnectCode(value));
	}, []);

	const handleAuthorize = useCallback(async () => {
		const value = normalizeQuickConnectCode(code);
		if (!value || busy) return;
		setBusy(true);
		try {
			if (!supportsQuickConnectAuthorize(serverType)) {
				const unsupported = new Error('unsupported');
				unsupported.unsupported = true;
				throw unsupported;
			}
			const authorized = await jellyfinApi.api.authorizeQuickConnect(value, user?.Id);
			setResult({ok: authorized, message: authorized ? text.authorized() : text.invalid()});
		} catch (error) {
			setResult({ok: false, message: errorText(error)});
		} finally {
			setBusy(false);
		}
	}, [code, busy, serverType, user]);

	const handleKeyDown = useCallback((e) => {
		if (e && (e.keyCode === 13 || e.key === 'Enter')) handleAuthorize();
	}, [handleAuthorize]);

	const actions = result?.ok
		? [{label: $L('Close'), onClick: onClose, spotlightId: 'quick-connect-close'}]
		: [
			{label: $L('Cancel'), onClick: onClose, spotlightId: 'quick-connect-cancel'},
			{label: text.authorize(), onClick: handleAuthorize, spotlightId: 'quick-connect-authorize'}
		];

	return (
		<CoreAlertDialog open={open} onClose={onClose} title={text.title()} spotlightId="quick-connect-authorize-dialog" actions={actions}>
			{!result?.ok && (
				<SpottableInput
					className={css.input}
					data-spotlight-id="quick-connect-code"
					purpose="numeric"
					placeholder={text.hint()}
					value={code}
					disabled={busy}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
				/>
			)}
			{result && <p className={result.ok ? css.success : css.error}>{result.message}</p>}
		</CoreAlertDialog>
	);
};

export default QuickConnectAuthorize;
