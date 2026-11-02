'use strict';

// var songs=[
//   {
//     name: '心语',
//     artist: '韩红',
//     url: 'https://m10.music.126.net/20241025071049/00447b54ffe8987601202836dc77afff/ymusic/b6a0/40b2/c2ec/56d125e8b8d92f37f9e084240090f750.mp3' ,
//     lrc: '/hifini/心语-韩红.lrc',
//     pic: 'http://img1.kuwo.cn/star/albumcover/500/29/33/2480739608.jpg',
//   },
//   //%musicDictList
// ];
function randomInt(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min);
}
async function json2array(url4gJson, limit, requiredIndex){
  console.log(`Fetching JSON from ${url4gJson} ...`);
  try {
    const response = await fetch(url4gJson);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!response.body) throw new Error('Streaming playlist responses are not supported by this browser.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const selectedSongs = [];
    let requiredSong = null;
    let songsSeen = 0;
    let inArray = false;
    let arrayClosed = false;
    let elementDepth = 0;
    let elementBuffer = '';
    let inString = false;
    let escaped = false;
    let stopReading = false;

    const processText = text => {
      for (const character of text) {
        if (!inArray) {
          if (/\s/.test(character)) continue;
          if (character !== '[') throw new Error('Playlist JSON must contain an array.');
          inArray = true;
          continue;
        }
        if (!elementBuffer) {
          if (/[\s,]/.test(character)) continue;
          if (character === ']') {
            arrayClosed = true;
            break;
          }
          if (character !== '{') throw new Error('Playlist entries must be JSON objects.');
          elementDepth = 1;
          elementBuffer = character;
          continue;
        }

        elementBuffer += character;
        if (inString) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === '{' || character === '[') elementDepth++;
        else if (character === '}' || character === ']') elementDepth--;

        if (elementDepth === 0) {
          const song = JSON.parse(elementBuffer);
          song.playlistIndex = songsSeen;
          if (requiredIndex === songsSeen) requiredSong = song;
          if (pRandom <= 0 || songIdx === 0) {
            if (selectedSongs.length < limit) selectedSongs.push(song);
          } else if (selectedSongs.length < limit) {
            selectedSongs.push(song);
          } else {
            const replacementIndex = Math.floor(Math.random() * (songsSeen + 1));
            if (replacementIndex < limit) selectedSongs[replacementIndex] = song;
          }
          songsSeen++;
          elementBuffer = '';
          if (requiredIndex !== null && requiredSong && selectedSongs.length >= limit) {
            stopReading = true;
            break;
          }
          if (requiredIndex === null && selectedSongs.length >= limit && (pRandom <= 0 || songIdx === 0)) {
            stopReading = true;
            break;
          }
        }
      }
    };

    try {
      while (!stopReading) {
        const { done, value } = await reader.read();
        if (done) {
          processText(decoder.decode());
          break;
        }
        processText(decoder.decode(value, { stream: true }));
        if (arrayClosed) break;
      }
    } finally {
      if (stopReading || arrayClosed) await reader.cancel();
      reader.releaseLock();
    }

    if (!stopReading && (!arrayClosed || elementBuffer)) throw new Error('Playlist JSON ended before its array was complete.');
    if (requiredSong) {
      const selectedIndex = selectedSongs.findIndex(song => song.playlistIndex === requiredIndex);
      if (selectedIndex < 0 && selectedSongs.length) selectedSongs[selectedSongs.length - 1] = requiredSong;
    }
    return selectedSongs;
  } catch (error) {
    console.error(`Fetching JSON (${url4gJson}) failed:`, error);
    throw error;
  }
}
function getParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  const value = urlParams.get(name);
  return value !== null ? value : defaultValue;
}
//------------------------------------------------------------------------------
async function idb2dataArray(idb, storeName, limit = Infinity){
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const allRecords = [];
    objectStore.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (allRecords.length >= limit) {
          resolve(allRecords);
          return;
        }
        let oneRow=cursor.value;
        //get basename and remove ext, i.e., get the stem
        let stem=oneRow['fileName'].split('/').pop().replace(/\.[^/.]+$/, '');
        oneRow['artist']=stem.split('__')[0];
        oneRow['name']=stem.split('__')[1];
        oneRow['size']=formatAsByteString(oneRow['size']);
        allRecords.push(oneRow);
        cursor.continue();
      } else {
        // All records have been retrieved, now convert to JSON
        try {
          // const jsonString = JSON.stringify(allRecords, null, 2); // null, 2 for pretty printing
          // resolve(jsonString);
          resolve(allRecords);
        } catch (error) {
          reject(`Error converting allRecords to JSON: ${error}`);
        }
      }
    };
    transaction.onerror = (event) => {
      reject(`Transaction error: ${event.target.errorCode}`);
    }; 
  });
}
function url4jsonArray(jsonArray){
  const blob = new Blob([jsonArray], { type: 'application/json' });
  return URL.createObjectURL(blob);
}
//------------------------------------------------------------------------------
let ap=null;
const favoriteChangesInProgress = new Set();
let favoriteOperationSequence = 0;
function logFavoriteProgress(operationId, startedAt, stage, details = {}) {
  console.log(`[favorite:${operationId}] ${stage}`, {
    elapsedMs: Math.round(performance.now() - startedAt),
    ...details
  });
}
function withFavoriteTimeout(promise, stage, timeoutMs = 20000) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error(`Favorite sync timed out while ${stage}.`)),
        timeoutMs
      );
    })
  ]).finally(() => window.clearTimeout(timeoutId));
}
const storeName = 'xLocalIDB';
const favoritesStoreName = 'xSongFavorites';
const storeKey = 'fileName';
const dbVersion = 2;
var idb4songs = null;
//------------------------------------------------------------------------------
var pPlaylist=getParam('playlist', 'random');
console.log(`Initial pPlaylist=${pPlaylist}`);

var songIdx=randomInt(0, 457);
var requestedSongs = Number.parseInt(getParam('x', '10'), 10);
var nSongs = Number.isFinite(requestedSongs) && requestedSongs > 0
  ? Math.min(requestedSongs, 10)
  : 10;
var requestedSongIndex = Number.parseInt(getParam('song-index', ''), 10);
var returnSongIndex = Number.isInteger(requestedSongIndex) && requestedSongIndex >= 0
  ? requestedSongIndex
  : null;

// let preDefinedPlaylists=['pop_chinese', 'rock_international', 'jazz_classical', 'electronic_dance', 'lofi_cafe', 'offline'];
if(pPlaylist=='random'){
  pPlaylist=String(songIdx).padStart(8, '0');  
}

var jsonUrl=`https://storage.googleapis.com/xpub/playlists/${pPlaylist}.json`;

var pRandom=getParam('r', 1);
if(pRandom==0)songIdx=0; //disable random if pRandom==0
console.log(`nSongs=${nSongs} , jsonUrl=${jsonUrl} , pRandom=${pRandom} , pPlaylist=${pPlaylist} `);
//------------------------------------------------------------------------------
function moveDivToUl() {
  // const newLi = document.createElement("li");
  // // Move the div inside the new li
  // newLi.appendChild($("#xplayer"));
  // Add the li to the ul
  // $("div.page__footer-follow > ul.social-icons > li:last-child").appendChild($("#xplayer"));
  // var li=$("div.page__footer-follow > ul.social-icons > li:nth-child(1)");
  //this selection only works after I have put xplayer div behind all the ul > li in footer.html instead of footer/custom.html
  var li=$("div.page__footer-follow > ul.social-icons > li:nth-child(1)");
  li.css('color','red');
  // console.log(li.text());
  // console.log(li.parent().text());
  // $("ul.social-icons > li:nth-child(3)").appendChild($("#xplayer"));
  //to debug
}
// moveDivToUl();

function safeObjClick(aObj){
  if(aObj !== null && aObj !== undefined){
    if(Object.keys(aObj).length > 0 && typeof aObj.click === 'function'){
      aObj.click();
  }
  }
}
//------------------------------------------------------------------------------
// Methods for Storage quota
/**
 * @desc Gets the current storage quota
 * @returns {Promise<{totalQuota: string, usedQuota: string, freeQuota: string}>}
 */
// Util functions
const formatAsByteString = (bytes) => {
	const oneGigabyte = 1024 * 1024 * 1024;
	const oneMegabyte = 1024 * 1024;
	const oneKilobyte = 1024;

	return bytes > oneGigabyte ? `${(bytes / oneGigabyte).toFixed(1)} GB` : bytes > oneMegabyte ? `${(bytes / oneMegabyte).toFixed(1)} MB` : `${(bytes / oneKilobyte).toFixed(1)}KB`;
}
async function getStorageQuotaText() {
    // Check if navigator.storage and navigator.storage.estimate are available
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
        try {
            const t = await navigator.storage.estimate();
            const e = +(t.quota || 0);
            const a = +(t.usage || 0);
            const o = e - a;
            return {
                totalQuota: formatAsByteString(e),
                usedQuota: formatAsByteString(a),
                freeQuota: formatAsByteString(o)
            };
        } catch (error) {
            console.error("Error estimating storage:", error);
            // Return default values or re-throw the error if appropriate
            return {
                totalQuota: 'NA',
                usedQuota: 'NA',
                freeQuota: 'NA'
            };
        }
    } else {
        console.warn("navigator.storage.estimate is not supported in this browser or context.");
        // Return default values or throw an error indicating lack of support
        return {
            totalQuota: 'NA',
            usedQuota: 'NA',
            freeQuota: 'NA'
        };
    }
}
async function log4quota(){
  const { totalQuota, usedQuota, freeQuota } = await getStorageQuotaText();
  // console.log("totalQuota: "+totalQuota);
  let nCachedSongs=await countAllRecords(storeName);
  document.getElementById('idbQuotaTotal').textContent =`${nCachedSongs}`; // `${totalQuota} , ${nCachedSongs}`;
  // console.log("usedQuota: "+usedQuota);
  document.getElementById('idbQuotaUsed').textContent = usedQuota;
  console.log("freeQuota: "+freeQuota);
}

/**
 * Fetches content from a URL and converts the response into a Blob.
 * @param {string} url The URL of the audio file.
 * @returns {Promise<Blob>} A Promise that resolves with the content as a Blob.
 */
async function fetchAudioAsBlob(url) {
  try {
    // 1. Fetch the data from the remote server
    const response = await fetch(url);    
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }    
    // 2. Read the body of the response as a Blob
    // The browser automatically handles the buffer/array conversion.
    const audioBlob = await response.blob();    
    return audioBlob;
  } catch (error) {
    console.error('Error fetching audio from URL:', error);
    throw error; // Re-throw the error for the calling function to handle
  }
}
/**
 * Saves a Blob to the IndexedDB object store.
 * @param {Blob} blob The audio Blob to save.
 * @param {string} key The unique ID (e.g., a filename or UUID) for the entry.
 */
function saveAudioBlob(blob, key, song) {
  if (!idb4songs) {
    throw new Error('Database not open.');    
  }
  // 1. Initiate a transaction for read/write
  const transaction = idb4songs.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  // 2. Prepare the object to save
  const meta = { ...song };
  // delete meta.url;
  const audioRecord = {
    [storeKey]: key, // Primary key
    data: blob,
    timestamp: Date.now(),
    mimeType: blob.type,
    size: blob.size,
    meta
  };
  // 3. Request to add/put the object into the store
  return new Promise((resolve, reject) => {
    store.put(audioRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}
async function saveUrlContentToDB(url, key, song) {
  console.log(`Start downloading for ${key}: ${url}`);  
  try {
    // 1. Fetch the URL content and get the Blob
    const audioBlob = await fetchAudioAsBlob(url);
    console.log(`Download complete. Blob size: ${audioBlob.size} bytes`);
    // 2. Save the resulting Blob into IndexedDB
    // (Assumes 'db' is already initialized by calling openDB() earlier)
    await saveAudioBlob(audioBlob, key, song);
  } catch (error) {
    console.error(`Failed to fetch&save audio for key/url ${key}/${url}:`, error);
    throw error;
  }
}

/**
 * Checks if a specific key exists in the IndexedDB store using count().
 * @param {string} key The key to check for existence.
 * @returns {Promise<boolean>} Resolves to true if the key exists, false otherwise.
 */
function keyExists(key) {
  return new Promise((resolve, reject) => {
    if (!idb4songs) {
      reject(new Error('Database not initialized.'));
      return;
    }
    // 1. Initiate a read-only transaction
    const transaction = idb4songs.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    // 2. Request the count for the specific key
    const request = store.count(key);
    request.onerror = (event) => {
      console.error('Error counting key:', event.target.error);
      reject(event.target.error);
    };
    request.onsuccess = (event) => {
      const count = event.target.result;
      console.log(`count(${key})= ${count}`)
      // If count is 1, the key exists; if 0, it doesn't.
      resolve(count > 0);
    };
  });
}
function rmKey(key) {
  return new Promise((resolve, reject) => {
    if (!idb4songs) {
      reject(new Error('Database not initialized.'));
      return;
    }
    // 1. Initiate a read-write transaction
    const transaction = idb4songs.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    // 2. Request to delete the specific key
    const request = store.delete(key);
    request.onerror = (event) => {
      console.error('Error deleting key:', event.target.error);
      reject(event.target.error);
    };
    request.onsuccess = (event) => {
      console.log(`Key '${key}' deleted successfully.`);
      resolve();
    };
  });
}

function countAllRecords(storeName) {
  return new Promise((resolve, reject) => {
    // Start a read-only transaction on the specified object store
    const transaction = idb4songs.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    // Create a count request
    const countRequest = objectStore.count();
    // Handle the success event of the count request
    countRequest.onsuccess = (event) => {
      const recordCount = event.target.result;
      resolve(recordCount);
    };
    // Handle any errors during the transaction or count request
    countRequest.onerror = (event) => {
      reject("Error counting records: " + event.target.error);
    };
  });
}
// Example usage:
// Assuming 'myDatabase' is your IndexedDB database and 'myObjectStore' is the store name
// countAllRecords(myDatabase, 'myObjectStore')
//   .then(count => {
//     console.log('Total records in myObjectStore:', count);
//   })
//   .catch(error => {
//     console.error(error);
//   });

async function loadAudioBlob(key) {
  // const db = await openDB();  
  return new Promise((resolve, reject) => {
    const tx = idb4songs.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function getSongFavoriteKey(song) {
  if (song.favKey) return song.favKey;
  if (song.fileName) return song.fileName;
  try {
    const parsedUrl = new URL(song.sourceUrl || song.url, window.location.href);
    if (parsedUrl.protocol !== 'blob:') return decodeURI(parsedUrl.pathname);
  } catch (error) {
    console.warn(`Cannot derive favorite key for '${song.name}':`, error);
  }
  return `${song.artist || ''}__${song.name || ''}`;
}
function loadSongFavorite(key) {
  return new Promise((resolve, reject) => {
    const transaction = idb4songs.transaction([favoritesStoreName], 'readonly');
    const request = transaction.objectStore(favoritesStoreName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
function saveSongFavorite(key, fav, updatedAt = Date.now()) {
  return new Promise((resolve, reject) => {
    const transaction = idb4songs.transaction([favoritesStoreName], 'readwrite');
    transaction.objectStore(favoritesStoreName).put({
      [storeKey]: key,
      fav: !!fav,
      updatedAt
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Favorite transaction aborted'));
  });
}
function updatePlaylistFavoriteButtons() {
  if (!ap || !ap.list || !ap.template.listOl) return;
  ap.list.audios.forEach((song, index) => {
    const row = ap.template.listOl.children[index];
    const icon = row && row.querySelector('.xplayer-list-fav-button');
    if (!icon) return;
    icon.classList.toggle('aplayer-fav-active', !!song.fav);
    icon.setAttribute('aria-label', song.fav ? 'Favorite' : 'Not favorite');
  });
}
function addPlaylistFavoriteButtons() {
  const listOl = ap.template.listOl;
  ap.list.audios.forEach((song, index) => {
    const row = listOl.children[index];
    const title = row && row.querySelector('.aplayer-list-title');
    if (!title || title.querySelector('.xplayer-list-fav-button')) return;
    const icon = document.createElement('span');
    icon.className = 'xplayer-list-fav-button';
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', song.fav ? 'Favorite' : 'Not favorite');
    icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>';
    title.appendChild(icon);
  });
  updatePlaylistFavoriteButtons();
}
async function saveSongFavorites(favorites) {
  const writePageSize = 250;
  for (let offset = 0; offset < favorites.length; offset += writePageSize) {
    const page = favorites.slice(offset, offset + writePageSize);
    const transaction = idb4songs.transaction([favoritesStoreName], 'readwrite');
    const objectStore = transaction.objectStore(favoritesStoreName);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Favorite transaction aborted'));
      page.forEach(favorite => {
        objectStore.put({
          [storeKey]: favorite.key,
          fav: !!favorite.fav,
          updatedAt: Number(favorite.updatedAt) || 0
        });
      });
    });
    if (offset + writePageSize < favorites.length) {
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
  }
}
async function hydrateSongFavorites(songs) {
  await Promise.all(songs.map(async (song) => {
    song.favKey = getSongFavoriteKey(song);
    const favorite = await loadSongFavorite(song.favKey);
    if (favorite) song.fav = favorite.fav;
  }));
}
async function syncFavoritesToCloud(user, songs = ap && ap.list ? ap.list.audios : [], priorityKey = '') {
  const operationId = ++favoriteOperationSequence;
  const startedAt = performance.now();
  const cloud = window.xPlayerFavoriteCloud;
  if (!cloud || !songs.length) {
    logFavoriteProgress(operationId, startedAt, 'cloud-sync-skipped', {
      cloudAvailable: !!cloud,
      songCount: songs.length
    });
    return { downloadedCount: 0, uploadedCount: 0 };
  }
  const prioritySong = priorityKey ? songs.find(song => song.favKey === priorityKey) : null;
  const syncSongs = prioritySong
    ? [prioritySong, ...songs.slice(0, 10).filter(song => song !== prioritySong).slice(0, 9)]
    : songs.slice(0, 10);
  const uniqueSongs = Array.from(new Map(syncSongs.map(song => [song.favKey, song])).values());
  logFavoriteProgress(operationId, startedAt, 'cloud-sync-started', {
    songCount: uniqueSongs.length
  });
  const localRecords = await Promise.all(uniqueSongs.map(async song => {
    const favorite = await loadSongFavorite(song.favKey);
    return {
      key: song.favKey,
      fav: favorite ? favorite.fav : !!song.fav,
      updatedAt: favorite ? Number(favorite.updatedAt) || 0 : 0,
      exists: !!favorite
    };
  }));
  logFavoriteProgress(operationId, startedAt, 'local-records-loaded', {
    songCount: localRecords.length
  });
  const syncResult = await cloud.sync(localRecords, user);
  logFavoriteProgress(operationId, startedAt, 'worker-sync-completed', {
    downloadedCount: syncResult.downloadedCount,
    uploadedCount: syncResult.uploadedCount,
    remoteUpdateCount: syncResult.remoteUpdates.length
  });
  if (syncResult.remoteUpdates.length) {
    await saveSongFavorites(syncResult.remoteUpdates);
    const favoritesByKey = new Map(syncResult.remoteUpdates.map(favorite => [favorite.key, favorite.fav]));
    uniqueSongs.forEach(song => {
      if (favoritesByKey.has(song.favKey)) song.fav = favoritesByKey.get(song.favKey);
    });
    updatePlaylistFavoriteButtons();
    if (ap && ap.list) {
      const currentSong = ap.list.audios[ap.list.index];
      const favoriteButton = ap.template.pic.querySelector('.aplayer-fav-button');
      if (currentSong && favoriteButton) {
        favoriteButton.classList.toggle('aplayer-fav-active', !!currentSong.fav);
        favoriteButton.setAttribute('aria-pressed', String(!!currentSong.fav));
        favoriteButton.setAttribute('aria-label', currentSong.fav ? 'Remove from favorites' : 'Add to favorites');
      }
    }
    logFavoriteProgress(operationId, startedAt, 'remote-favorites-applied', {
      count: syncResult.remoteUpdates.length
    });
  }
  return syncResult;
}
window.syncFavoritesToCloud = async function () {
  const operationId = ++favoriteOperationSequence;
  const startedAt = performance.now();
  logFavoriteProgress(operationId, startedAt, 'explicit-sync-auth-started');
  try {
    if (!window.xPlayerFavoriteCloudReady) {
      throw new Error('Firebase favorites module is not loaded on this page.');
    }
    const cloud = await withFavoriteTimeout(
      window.xPlayerFavoriteCloudReady,
      'waiting for Firebase initialization'
    );
    if (!cloud) {
      throw new Error('Firebase favorites sync is not configured.');
    }
    await withFavoriteTimeout(cloud.ready, 'waiting for Firebase authentication state');
    const user = await withFavoriteTimeout(cloud.ensureSignedIn(), 'getting Firebase sign-in');
    logFavoriteProgress(operationId, startedAt, 'explicit-sync-authenticated');
    return await withFavoriteTimeout(
      syncFavoritesToCloud(user),
      'syncing favorites',
      35000
    );
  } catch (error) {
    logFavoriteProgress(operationId, startedAt, 'explicit-sync-failed', {
      message: error.message || String(error)
    });
    throw error;
  }
};
// Example Usage:
// keyExists('session_456_audio').then(exists => {
//   console.log('Key exists:', exists); // true or false
// });
async function url4cachedSong(doFetchAudio, fn, sUrl, song){
// xplayer.js:1 /404
// xplayer.js:1 /xmusic/q/黄渤__这就是命.mp3
  if(!fn.match(/\/xmusic.*/i)){return sUrl}
  // console.log(`url4cachedSong checking for '${fn}'`);
  let aBlob=null;
  try{
    if(await keyExists(fn)==0) { 
      console.log(`Audio not cached yet for '${fn}', will download and cache it now if ${doFetchAudio}>0`);
      if(doFetchAudio){ 
        await saveUrlContentToDB(sUrl, fn, song);
      }
    }
    if(await keyExists(fn)>0){
      aBlob=await loadAudioBlob(fn); 
      if(aBlob != null ){return URL.createObjectURL(aBlob.data);}//already cached
    }else if(doFetchAudio) {
      throw new Error(`Audio '${fn}' was not found in IndexedDB after download`);
    }else {
      return sUrl; //not cached, return original url
    }
    
    // if(aBlob==null){
    //   aBlob=await fetchAudioAsBlob(sUrl) ;//download directly, found the saving2db above was the problem
    //   return URL.createObjectURL(aBlob);      
    // }
    throw new Error('I cannot believe aBlob is still null, sth wrong with the downloading !!!'); 
  }catch(error){
    console.error(`Failed to load/download audio for song fn|sUrl '${fn}'|${sUrl}:`, error);
    throw error;
  }
}
async function resolveAudio(song){
  const sourceUrl = song.url;
  const parsedUrl = new URL(sourceUrl, window.location.href);
  const fileName = decodeURI(parsedUrl.pathname);
  if (!fileName.match(/\/xmusic.*/i)) return sourceUrl;
  return url4cachedSong(true, fileName, sourceUrl, song);
}
async function updateSong2local(song, doFetchAudio){
  let sUrl=song.url;
  try{
    let uo=new URL(sUrl);    
    let fn=decodeURI(uo.pathname);
    console.log(`trying to cache song '${fn}'`);
    song.url=await url4cachedSong(doFetchAudio, fn, sUrl, song);
  }catch(error){
    console.error(`Failed to update song URL to local indexedDB for '${song.name}':`, error);
  }
  return song;
}
//manage local cache DB for songs
function updateSongsURL2local(songs, doFetchAudio){  
  let lSongs=songs;  
  lSongs.forEach(async function(song) {
    await updateSong2local(song, doFetchAudio).then(updatedSong => {
      console.log(`Updated song URL for '${updatedSong.name}': ${updatedSong.url}`);
    });
  });  
  return lSongs;
}

const openIndexedDb = (dbName, stores) => {
	return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
		req.onerror = (event) => {
      // console.error("indexedDB error: " + event.target.errorCode);
			reject(event.target.error);
		};
		req.onsuccess = (event) => {      
      console.log(`indexedDB ${dbName}/${stores} opened successfully`);
      // Now you can work with the 'db' object to perform operations
			resolve(event.target.result);      
		};
		req.onupgradeneeded = (event) => {
			stores.forEach((store) => {
        if (!event.target.result.objectStoreNames.contains(store.name)) {
          const objectStore = event.target.result.createObjectStore(store.name, {
            keyPath: store.keyPath,
          });
          objectStore.createIndex(store.keyPath, store.keyPath, { unique: true });
        }
			});
		};
	});
};
// Attach IndexedDB - creation to the window.onload - event
window.addEventListener('load', async () => {	
  idb4songs = await openIndexedDb('xdb4songs', [
    { name: storeName, keyPath: storeKey },
    { name: favoritesStoreName, keyPath: storeKey }
  ]);
  //https://blog.q-bit.me/how-to-use-indexeddb-to-store-images-and-other-files-in-your-browser/          
  // renderAvailableImagesFromDb();    
  if(pPlaylist=='offline'){//highest priority to load from local IndexedDB
    let allSongs=await idb2dataArray(idb4songs, storeName, nSongs);
    console.log('allSongs from IndexedDB: ', allSongs);    
    let resultSongs=Array(allSongs.length).fill({});
    let idx=0;
    await Promise.all(allSongs.map(async (song) => {
      // console.log(`Index: ${idx}, Value: ${song}`);
      let aBlob=await loadAudioBlob(song['fileName']); 
      let oneSong={};
      oneSong['name']=song['name'];
      oneSong['artist']=song['artist'];
      oneSong['fileName']=song['fileName'];
      oneSong['url']='';
      oneSong['cover']='';
      oneSong['meta']=song['meta'] || {};
      if(aBlob != null ) oneSong['url']=URL.createObjectURL(aBlob.data);              
      resultSongs[idx++]=oneSong;
    }));
    console.log('resultSongs from IndexedDB: ', resultSongs);    
    jsonUrl=url4jsonArray(JSON.stringify(resultSongs));  
    console.log('jsonUrl for offline playlist: ', jsonUrl);
  }  
  //make player
  json2array(jsonUrl, nSongs, returnSongIndex).then(async songs => {
    if(songs){      
      // console.log('Parsed songs: ', songs);
      const restoredSongIndex = returnSongIndex !== null
        ? songs.findIndex(song => song.playlistIndex === returnSongIndex)
        : -1;
      if (returnSongIndex !== null) {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.delete('song-index');
        window.history.replaceState(window.history.state, '', returnUrl);
      }
      await hydrateSongFavorites(songs);
      console.log('Cached songs: ', songs);
      //----------------------------------
      ap = new XPlayer({
        id4audio: 'xAudio',
        element: document.getElementById('xplayer'),
        narrow: false,
        //fixed: true, //<!--吸底模式 -->  
        mini: false, 
        autoplay: false, // Google Chrome disabled autoplay and require user's response before auto playback; set to true when a song cannot be played, this will still need user's click to trigger play
        loop: 'all',
        order:  (pRandom!=0)||(songIdx!=0) ? 'random' : 'list' ,
        volume: 1,
        preload: 'none', //'auto', 'none'
        showlrc: true, //
        lrcType:3,
        mutex: true,
        theme:  '#ad7a86', // '#b7daff',  //'#0a0a0f',//
        listFolded: true,
        resolveAudio,
        audio: songs
      });
      addPlaylistFavoriteButtons();
      if (restoredSongIndex >= 0) ap.list.switch(restoredSongIndex);
      ap.on('favoritechange', async ({ audio, fav }) => {
        const operationId = ++favoriteOperationSequence;
        const startedAt = performance.now();
        logFavoriteProgress(operationId, startedAt, 'clicked', {
          songIndex: audio.playlistIndex,
          favorite: !!fav
        });
        updatePlaylistFavoriteButtons();
        const favoriteKey = audio.favKey;
        if (favoriteChangesInProgress.has(favoriteKey)) {
          logFavoriteProgress(operationId, startedAt, 'duplicate-click-ignored');
          return;
        }
        favoriteChangesInProgress.add(favoriteKey);
        const coverFavoriteButton = ap.template.pic.querySelector('.aplayer-fav-button');
        if (coverFavoriteButton && ap.list.audios[ap.list.index] === audio) {
          coverFavoriteButton.disabled = true;
        }
        try {
          logFavoriteProgress(operationId, startedAt, 'local-save-started');
          await saveSongFavorite(audio.favKey, fav);
          logFavoriteProgress(operationId, startedAt, 'local-save-completed');
          logFavoriteProgress(operationId, startedAt, 'firebase-initialization-check-started');
          const cloud = await window.xPlayerFavoriteCloudReady;
          logFavoriteProgress(operationId, startedAt, 'firebase-initialization-check-completed', {
            available: !!cloud
          });
          if (cloud) {
            logFavoriteProgress(operationId, startedAt, 'firebase-auth-state-wait-started');
            await cloud.ready;
            const user = cloud.currentUser();
            logFavoriteProgress(operationId, startedAt, 'firebase-auth-state-ready', {
              signedIn: !!user
            });
            if (!user) {
              const returnUrl = new URL(window.location.href);
              returnUrl.searchParams.set('playlist', pPlaylist);
              returnUrl.searchParams.set('song-index', String(audio.playlistIndex));
              logFavoriteProgress(operationId, startedAt, 'google-sign-in-redirect-started');
              await cloud.ensureSignedIn(returnUrl);
            } else {
              logFavoriteProgress(operationId, startedAt, 'automatic-cloud-sync-skipped', {
                reason: 'disabled-to-prevent-freeze'
              });
            }
          } else {
            logFavoriteProgress(operationId, startedAt, 'cloud-sync-unavailable');
          }
        } catch (error) {
          logFavoriteProgress(operationId, startedAt, 'failed', {
            message: error.message || String(error)
          });
          console.error(`Failed to save favorite or start sign-in for '${audio.name}':`, error);
        } finally {
          favoriteChangesInProgress.delete(favoriteKey);
          if (coverFavoriteButton && ap.list.audios[ap.list.index] === audio) {
            coverFavoriteButton.disabled = false;
          }
          logFavoriteProgress(operationId, startedAt, 'finished');
        }
      });
      //change pixabay images once a song switched
      ap.audio.addEventListener('play', async function(){ 
        let currentSong=ap.list.audios[ap.list.index];

        var sName  =currentSong.name;
        var sArtist=currentSong.artist;
        console.log(`play event of song/${ap.list.index} : ${sName} | ${sArtist} | ${ap.list.audios[ap.list.index].url} `);  //  ${currentSong.url} is already cached URL!!!

        var navPanel=$('#xplayer');
        if(navPanel.length){
          document.title=sArtist + ' | ' + sName;
          var hiddenTime = navPanel[0].querySelector('time');
          var minutesDiff=1; //refresh images >=1 minute
          if(!hiddenTime){
            var timeElement = document.createElement('time');
            timeElement.setAttribute('datetime', new Date().toISOString());
            timeElement.style.display = 'none';
            navPanel[0].appendChild(timeElement);
            hiddenTime=timeElement;
          }else{
            var oTimeValue = new Date(hiddenTime.getAttribute('datetime')).getTime();
            var cTimeValue= new Date().getTime();
            minutesDiff = (cTimeValue-oTimeValue)/(60*1000);
          }
          if(minutesDiff>=1){ //at least 1 minute          
            var btnNextRandomPixabay=$('#page4pixabay')[0];
            safeObjClick(btnNextRandomPixabay)          
            hiddenTime.setAttribute('datetime', new Date().toISOString());
          }         
          // console.log("minutes diff: ", minutesDiff)        
          await log4quota();
        }  
      });
      ap.on('loadeddata', async function () {//just a song's data loaded, not its audio loaded yet
        console.log('loadeddata of song: ' + ap.list.index );
        console.log('URL: ' + ap.list.audios[ap.list.index].url);
        console.log(ap.list.audios[ap.list.index]);
        //console.log(null==ap.audios); //true
        console.log("src: "+ ap.audio.src)
        console.log(ap.audio.buffered)
      });
      //save decoded hifini URLs (i.e., qq music url) to local cookies
      // ap.on('play', function () {
      //   console.log('Start playing song: ' + ap.list.index );        
      //   console.log('URL: ' + ap.list.audios[ap.list.index].url);
      //   console.log(ap.list.audios[ap.list.index]);
      //   //console.log(null==ap.audios); //true
      //   console.log("src: "+ ap.audio.src)
      //   console.log(ap.audio)  
      // });
    }  
  });

  // if in about page, find and move images on top of the audio player
  const footerDiv=$('#xplayer').parent();
  const pixabay=$('.pixabay_widget');
  if(pixabay.length){
    pixabay.prependTo(footerDiv)
  }

  await log4quota();
})
