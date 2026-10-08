import { firebaseConfig } from './firebase-config.js';

const sdkVersion = '11.10.0';

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

  async function sync(localRecords, user) {
    const signedInUser = user || await ensureSignedIn();
    const favoriteCollection = firestoreSdk.collection(firestore, 'users', signedInUser.uid, 'favorites');
    const snapshot = await firestoreSdk.getDocs(favoriteCollection);
    const merged = new Map();

    for (const record of localRecords) {
      if (!record.fileName) continue;
      merged.set(record.fileName, {
        key: record.fileName,
        fav: !!record.fav,
        updatedAt: Number(record.updatedAt) || 0
      });
    }

    snapshot.forEach(document => {
      const record = document.data();
      if (!record.key) return;
      const local = merged.get(record.key);
      if (!local || (Number(record.updatedAt) || 0) > local.updatedAt) {
        merged.set(record.key, {
          key: record.key,
          fav: !!record.fav,
          updatedAt: Number(record.updatedAt) || 0
        });
      }
    });

    const records = Array.from(merged.values());
    for (let offset = 0; offset < records.length; offset += 450) {
      const batch = firestoreSdk.writeBatch(firestore);
      const batchRecords = records.slice(offset, offset + 450);
      await Promise.all(batchRecords.map(async record => {
        const documentId = await favoriteDocumentId(record.key);
        batch.set(
          firestoreSdk.doc(favoriteCollection, documentId),
          { ...record, updatedAt: Math.trunc(record.updatedAt) },
          { merge: true }
        );
      }));
      await batch.commit();
    }
    return records;
  }

  return {
    ready: authReady,
    currentUser: () => currentUser,
    ensureSignedIn,
    sync
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