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
async function json2array(url4gJson){
  try {
    const response = await fetch(url4gJson);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonData =  response.json();
    return jsonData;
  } catch (error) {
    console.error("Fetching JSON failed:", error);
    throw error;
  }
}
function getParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  const value = urlParams.get(name);

  return value !== null ? value : defaultValue;
}

var songIdx=randomInt(0, max10);
var jsonUrl=`https://storage.googleapis.com/xpub/playlists/${String(songIdx).padStart(8, '0')}.json`;
var nSongs=getParam('x', 10);
if(nSongs>10){
  songIdx=0;
  jsonUrl=`https://storage.googleapis.com/xpub/playlists/all.json`;
}
console.log(`nSongs=${nSongs} , jsonUrl=${jsonUrl}`);

function getRandomSubarray(arr, size) {
  if(size>arr.length) size=arr.length;
  var shuffled = arr.slice(0), i = arr.length, min = i - size, temp, index;
  while (i-- > min) {
      index = Math.floor((i + 1) * Math.random());
      temp = shuffled[index];
      shuffled[index] = shuffled[i];
      shuffled[i] = temp;
  }
  return shuffled.slice(min);
}
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
////////////////////////////////////////////////////////////////////////////////
const storeName = 'xLocalIDB';
const storeKey = 'fileName';
const dbVersion = 1;
var idb4songs = null;
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
  document.getElementById('idbQuotaTotal').textContent = `${totalQuota} , ${nCachedSongs}`;
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
    if (!response.ok) {
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
function saveAudioBlob(blob, key) {
  if (!idb4songs) {
    throw new Error('Database not open.');    
  }
  // 1. Initiate a transaction for read/write
  const transaction = idb4songs.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  // // 2. Prepare the object to save
  const audioRecord = {
    [storeKey]: key, // Primary key
    data: blob,
    timestamp: Date.now(),
    mimeType: blob.type,
    size: blob.size
  };
  // 3. Request to add/put the object into the store
  const request = store.put(audioRecord);
  // const request = store.put(blob, key);
  request.onsuccess = () => {
    console.log(`Audio Blob (${blob.size}) for key '${key}' saved successfully!`);
  };
  request.onerror = (event) => {
    console.error(`Error saving Blob/${key}:`, event.target.error);
  };
  // Optional: Listen for the transaction to complete
  transaction.oncomplete = () => {
    console.log('Transaction completed.');
  };
}
async function saveUrlContentToDB(url, key) {
  console.log(`Start downloading for ${key}: ${url}`);  
  try {
    // 1. Fetch the URL content and get the Blob
    const audioBlob = await fetchAudioAsBlob(url);
    console.log(`Download complete. Blob size: ${audioBlob.size} bytes`);
    // 2. Save the resulting Blob into IndexedDB
    // (Assumes 'db' is already initialized by calling openDB() earlier)
    saveAudioBlob(audioBlob, key);    
  } catch (error) {
    console.error(`Failed to fetch&save audio for key/url ${key}/${url}:`, error);
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
// Example Usage:
// keyExists('session_456_audio').then(exists => {
//   console.log('Key exists:', exists); // true or false
// });
async function url4cachedSong(doFetchAudio, fn, sUrl){
// xplayer.js:1 /404
// xplayer.js:1 /xmusic/q/黄渤__这就是命.mp3
  if(!fn.match(/\/xmusic.*/i)){return sUrl}
  // console.log(`url4cachedSong checking for '${fn}'`);
  let aBlob=null;
  try{
    if(await keyExists(fn)==0) { 
      console.log(`Audio not cached yet for '${fn}', will download and cache it now if ${doFetchAudio}>0`);
      if(doFetchAudio){ 
        await saveUrlContentToDB(sUrl, fn);
      }
    }
    if(await keyExists(fn)>0){
      aBlob=await loadAudioBlob(fn); 
      if(aBlob != null ){return URL.createObjectURL(aBlob.data);}//already cached
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
    return sUrl;
  }
}
async function updateSong2local(song, doFetchAudio){
  let sUrl=song.url;
  let uo=new URL(sUrl);    
  let fn=decodeURI(uo.pathname);
  console.log(`trying to cache song '${fn}'`);
  song.url=await url4cachedSong(doFetchAudio, fn, sUrl);
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
		const req = indexedDB.open(dbName, 1);
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
				const objectStore = event.target.result.createObjectStore(store.name, {
					keyPath: store.keyPath,
				});
				objectStore.createIndex(store.keyPath, store.keyPath, { unique: true });
			});
		};
	});
};
// Attach IndexedDB - creation to the window.onload - event
window.addEventListener('load', async () => {	
  idb4songs = await openIndexedDb('xdb4songs', [{ name: storeName, keyPath: storeKey }]);
  //https://blog.q-bit.me/how-to-use-indexeddb-to-store-images-and-other-files-in-your-browser/          
  // renderAvailableImagesFromDb();    
	  
  //make player
  json2array(jsonUrl).then(async songs => {
    if(songs){      
      // console.log('Parsed songs: ', songs);
      songs=updateSongsURL2local(songs, 0); //do not download and cache songs automatically, can be triggered by user click PLAY later
      console.log('Cached songs: ', songs);
      //----------------------------------
      var ap = new APlayer({
        id4audio: 'xAudio',
        element: document.getElementById('xplayer'),
        narrow: false,
        //fixed: true, //<!--吸底模式 -->  
        mini: false, 
        autoplay: false, // Google Chrome disabled autoplay and require user's response before auto playback
        loop: 'all',
        order: 'random',
        volume: 1,
        preload: 'auto', //'auto', 'none'
        showlrc: false, //
        lrctype:3,
        mutex: true,
        theme:  '#ad7a86', // '#b7daff',  //'#0a0a0f',//
        listFolded: true,
        audio: getRandomSubarray(songs, nSongs)
      });
      //change pixabay images once a song switched
      ap.audio.addEventListener('play', async function(){ 
        //download and cache songs when user clicks PLAY for the first time
        // songs=await updateSongsURL2local(ap.list.audios, nSongs<=10 ); //ignore when all.json is loaded
        // ap.list.audios=songs;
        //only cacche the current playing song
        let currentSong=ap.list.audios[ap.list.index];
        // ap.list.audios[ap.list.index]=await updateSong2local(currentSong, nSongs<=10);
        await updateSong2local(currentSong, nSongs<=10);

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
        }  
      });
      ap.on('loadeddata', function () {
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


