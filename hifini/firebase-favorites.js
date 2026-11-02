import { firebaseConfig } from './firebase-config.js';

function initializeFavoriteCloud() {
  const startedAt = performance.now();
  const logProgress = (stage, details = {}) => {
    console.log('[favorite-cloud]', stage, {
      elapsedMs: Math.round(performance.now() - startedAt),
      ...details
    });
  };
  if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.info('Firebase favorites sync is disabled until hifini/firebase-config.js is configured.');
    return Promise.resolve(null);
  }

  logProgress('initialization-started');
  const firebaseUrl = 'https://www.gstatic.com/firebasejs/11.10.0';
  return Promise.all([
    import(`${firebaseUrl}/firebase-app.js`),
    import(`${firebaseUrl}/firebase-auth.js`)
  ]).then(async ([appSdk, authSdk]) => {
    logProgress('firebase-sdk-imported');
    const app = appSdk.initializeApp(firebaseConfig, 'xplayer-favorites');
    const auth = authSdk.getAuth(app);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    await authSdk.getRedirectResult(auth);
    logProgress('auth-persistence-and-redirect-ready');
    const provider = new authSdk.GoogleAuthProvider();
    let currentUser = auth.currentUser;
    let resolveAuthReady;
    const authReady = new Promise(resolve => {
      resolveAuthReady = resolve;
    });

    authSdk.onAuthStateChanged(auth, user => {
      currentUser = user;
      logProgress('auth-state-observed', { signedIn: !!user });
      resolveAuthReady(user);
    });

    function ensureSignedIn(returnUrl) {
      if (currentUser) return Promise.resolve(currentUser);
      if (returnUrl) {
        const targetUrl = new URL(returnUrl, window.location.href);
        if (targetUrl.origin !== window.location.origin) {
          throw new Error('Firebase sign-in return URL must stay on this site.');
        }
        window.history.replaceState(window.history.state, '', targetUrl);
      }
      return authSdk.signInWithRedirect(auth, provider);
    }

    const worker = new Worker(new URL('./firebase-favorites-worker.js', import.meta.url), { type: 'module' });
    const pendingRequests = new Map();
    let nextRequestId = 0;
    worker.addEventListener('message', event => {
      const { id, result, error } = event.data;
      const pending = pendingRequests.get(id);
      if (!pending) return;
      pendingRequests.delete(id);
      window.clearTimeout(pending.timeoutId);
      if (error) pending.reject(new Error(error));
      else pending.resolve(result);
    });
    const rejectPendingRequests = error => {
      pendingRequests.forEach(request => {
        window.clearTimeout(request.timeoutId);
        request.reject(error);
      });
      pendingRequests.clear();
    };
    worker.addEventListener('error', event => {
      rejectPendingRequests(new Error(event.message || 'Firebase favorites background worker failed.'));
    });
    worker.addEventListener('messageerror', () => {
      rejectPendingRequests(new Error('Firebase favorites background worker received an unreadable message.'));
    });

    async function sync(localRecords, user) {
      if (!Array.isArray(localRecords) || localRecords.length > 10) {
        throw new Error('A favorites sync must contain no more than 10 songs.');
      }
      const signedInUser = user || await ensureSignedIn();
      console.warn('[favorite-cloud] id-token-request-started');
      const idToken = await signedInUser.getIdToken();
      console.warn('[favorite-cloud] id-token-ready');
      const id = ++nextRequestId;
      const requestStartedAt = performance.now();
      const result = new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          pendingRequests.delete(id);
          reject(new Error('Firebase favorites worker did not respond within 32 seconds.'));
        }, 32000);
        pendingRequests.set(id, { resolve, reject, timeoutId });
      });
      try {
        console.warn(`[favorite-cloud:${id}] worker-sync-posted`, {
          songCount: localRecords.length
        });
        worker.postMessage({
          id,
          type: 'sync',
          projectId: firebaseConfig.projectId,
          userId: signedInUser.uid,
          idToken,
          localRecords
        });
      } catch (error) {
        const pending = pendingRequests.get(id);
        if (pending) window.clearTimeout(pending.timeoutId);
        pendingRequests.delete(id);
        throw error;
      }
      return result.then(syncResult => {
        console.warn(`[favorite-cloud:${id}] worker-sync-result`, {
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          downloadedCount: syncResult.downloadedCount,
          uploadedCount: syncResult.uploadedCount
        });
        return syncResult;
      }, error => {
        console.error(`[favorite-cloud:${id}] worker-sync-failed`, {
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          message: error.message || String(error)
        });
        throw error;
      });
    }

    return {
      ready: authReady,
      currentUser: () => currentUser,
      ensureSignedIn,
      sync
    };
  });
}

window.xPlayerFavoriteCloudReady = initializeFavoriteCloud().then(cloud => {
  window.xPlayerFavoriteCloud = cloud;
  return cloud;
}).catch(error => {
  console.error('Firebase favorites sync failed to initialize:', error);
  window.xPlayerFavoriteCloud = null;
  return null;
});
