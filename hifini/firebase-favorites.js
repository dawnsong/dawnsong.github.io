import { firebaseConfig } from './firebase-config.js';

const sdkVersion = '11.10.0';
const fullSyncIntervalMs = 30 * 24 * 60 * 60 * 1000;
const syncOverlapMs = 60 * 1000;
const syncPageSize = 250;
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

async function initializeFavoriteCloud() {
  if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.info('Firebase favorites sync is disabled until hifini/firebase-config.js is configured.');
    return null;
  }

  const firebaseUrl = `https://www.gstatic.com/firebasejs/${sdkVersion}`;
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import(`${firebaseUrl}/firebase-app.js`),
    import(`${firebaseUrl}/firebase-auth.js`),
    import(`${firebaseUrl}/firebase-firestore.js`)
  ]);
  const app = appSdk.initializeApp(firebaseConfig, 'xplayer-favorites');
  const auth = authSdk.getAuth(app);
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
  await authSdk.getRedirectResult(auth);
  const firestore = firestoreSdk.getFirestore(app);
  const provider = new authSdk.GoogleAuthProvider();
  let currentUser = auth.currentUser;
  let resolveAuthReady;
  const authReady = new Promise(resolve => {
    resolveAuthReady = resolve;
  });

  authSdk.onAuthStateChanged(auth, user => {
    currentUser = user;
    resolveAuthReady(user);
  });

  function ensureSignedIn() {
    if (currentUser) return Promise.resolve(currentUser);
    return authSdk.signInWithRedirect(auth, provider);
  }

  async function favoriteDocumentId(key) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function syncCheckpointKey(userId) {
    return `xplayer-favorites-sync:${userId}`;
  }

  function loadSyncCheckpoint(userId) {
    try {
      return JSON.parse(localStorage.getItem(syncCheckpointKey(userId)) || '{}');
    } catch (error) {
      console.warn('Could not read favorites sync checkpoint:', error);
      return {};
    }
  }

  function completeSync(user, checkpoint) {
    try {
      localStorage.setItem(syncCheckpointKey(user.uid), JSON.stringify(checkpoint));
    } catch (error) {
      console.warn('Could not save favorites sync checkpoint:', error);
    }
  }

  async function sync(localRecords, user, applyRemoteUpdates = async () => {}) {
    const signedInUser = user || await ensureSignedIn();
    const favoriteCollection = firestoreSdk.collection(firestore, 'users', signedInUser.uid, 'favorites');
    const checkpoint = loadSyncCheckpoint(signedInUser.uid);
    const startedAt = Date.now();
    const lastSyncAt = Number(checkpoint.lastSyncAt) || 0;
    const fullSync = !checkpoint.lastFullSyncAt || startedAt - checkpoint.lastFullSyncAt >= fullSyncIntervalMs;
    const localByKey = new Map();
    localRecords.forEach(record => {
      if (!record.fileName) return;
      localByKey.set(record.fileName, {
        key: record.fileName,
        fav: !!record.fav,
        updatedAt: Number(record.updatedAt) || 0
      });
    });
    const localWrites = new Map();
    localByKey.forEach(record => {
      if (fullSync || record.updatedAt > lastSyncAt) localWrites.set(record.key, record);
    });
    let cursor = null;
    let remoteBytes = 2;
    let remoteCount = 0;

    while (true) {
      const constraints = fullSync
        ? [firestoreSdk.orderBy(firestoreSdk.documentId())]
        : [
          firestoreSdk.where('updatedAt', '>', Math.max(0, lastSyncAt - syncOverlapMs)),
          firestoreSdk.orderBy('updatedAt')
        ];
      if (cursor) constraints.push(firestoreSdk.startAfter(cursor));
      constraints.push(firestoreSdk.limit(syncPageSize));
      const page = await firestoreSdk.getDocs(firestoreSdk.query(favoriteCollection, ...constraints));
      const pageUpdates = [];

      page.forEach(document => {
        const record = document.data();
        if (!record.key) return;
        const remote = {
          key: record.key,
          fav: !!record.fav,
          updatedAt: Number(record.updatedAt) || 0
        };
        remoteBytes += new TextEncoder().encode(JSON.stringify(remote)).length + (remoteCount ? 1 : 0);
        remoteCount++;
        const local = localByKey.get(remote.key);
        if (local && remote.updatedAt >= local.updatedAt) localWrites.delete(remote.key);
        if (!local || remote.updatedAt > local.updatedAt) {
          localByKey.set(remote.key, remote);
          pageUpdates.push(remote);
        }
      });

      if (pageUpdates.length) await applyRemoteUpdates(pageUpdates);
      if (page.size < syncPageSize) break;
      cursor = page.docs[page.docs.length - 1];
      await yieldToMain();
    }

    remoteBytes = remoteCount ? remoteBytes : 2;
    const localWriteRecords = Array.from(localWrites.values());
    for (let offset = 0; offset < localWriteRecords.length; offset += 450) {
      const batch = firestoreSdk.writeBatch(firestore);
      const batchRecords = localWriteRecords.slice(offset, offset + 450);
      await Promise.all(batchRecords.map(async record => {
        const documentId = await favoriteDocumentId(record.key);
        batch.set(
          firestoreSdk.doc(favoriteCollection, documentId),
          { ...record, updatedAt: Math.trunc(record.updatedAt) },
          { merge: true }
        );
      }));
      await batch.commit();
      await yieldToMain();
    }

    const completedAt = Date.now();
    const nextCheckpoint = {
      lastSyncAt: completedAt,
      lastFullSyncAt: fullSync ? completedAt : Number(checkpoint.lastFullSyncAt)
    };
    const uploadBytes = localWriteRecords.reduce((total, record) => {
      return total + new TextEncoder().encode(JSON.stringify(record)).length;
    }, localWriteRecords.length ? localWriteRecords.length - 1 + 2 : 2);
    console.info(`Favorites ${fullSync ? 'full' : 'delta'} sync: ${remoteCount} downloaded (~${remoteBytes} B), ${localWriteRecords.length} uploaded (~${uploadBytes} B)`);

    return {
      downloadedCount: remoteCount,
      uploadedCount: localWriteRecords.length,
      checkpoint: nextCheckpoint
    };
  }

  return {
    ready: authReady,
    currentUser: () => currentUser,
    ensureSignedIn,
    sync,
    completeSync
  };
}

window.xPlayerFavoriteCloudReady = initializeFavoriteCloud().then(cloud => {
  window.xPlayerFavoriteCloud = cloud;
  return cloud;
}).catch(error => {
  console.error('Firebase favorites sync failed to initialize:', error);
  window.xPlayerFavoriteCloud = null;
  return null;
});