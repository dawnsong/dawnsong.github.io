---
layout: page
title: 离线
description: play when my data runs out
img: assets/img/1.jpg
importance: 1
category: Big-data
related_publications: true
date: 2025-12-14
---

<!--todo: fix the citation and references in page/digest -->

<div class="row">
    <div class="col-sm mt-3 mt-md-0" id='cover4yiGongZi'>
        {% include figure.liquid loading="eager" path="assets/img/yiGongZi_suShi/意公子講蘇軾_001__蘇東坡式的自嘲：活著的意義，也許是那些渡過人生低谷時的經歷【意公子】-mJyZ8-o4gsg.jpg" title="yiGongZi_suShi" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Current playing episode.
</div>

{% details Manage local indexedDB cached MP3s %}

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<link rel="stylesheet" href="https://cdn.datatables.net/2.3.5/css/dataTables.dataTables.css" />
<script src="https://cdn.datatables.net/2.0.7/js/dataTables.min.js"></script>
<script src="https://cdn.datatables.net/select/3.1.3/js/dataTables.select.js"></script>
<script src="https://cdn.datatables.net/select/3.1.3/js/select.dataTables.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js"></script>

<div id="divTbl4idb">
<table id="tbl4idb" class="stripe row-border order-column" cellspacing="0" width="100%">
    <thead>
        <tr> <th></th>       
          <th>artist</th>
          <th>name</th>
          <th>mimeType</th>
          <th>size</th>
          <th>timestamp</th>
        </tr>
    </thead>    
</table>
</div>
{% enddetails %}

<script defer>
function waitForElement(selector, callback) {
  const observer = new MutationObserver((mutations, obs) => {
    const element = document.querySelector(selector);
    if (element) {
      obs.disconnect(); // Stop observing once the element is found
      callback(element);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  }); // Observe changes in the entire body
}
// Example usage:
waitForElement('#xplayer', (divElement) => {
  console.log('xplayer exists:', divElement);  
  // Perform actions on divElement
});
// // Simulate dynamic element creation
// setTimeout(() => {
//   const newDiv = document.createElement('div');
//   newDiv.id = 'myDynamicDiv';
//   newDiv.textContent = 'This is a dynamically added div.';
//   document.body.appendChild(newDiv);
// }, 1500);
//------------------------------------------------------------------------------

async function idb2dataArray(idb, storeName){
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const allRecords = [];
    objectStore.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
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

function updateCoverImg(rIdx){
  let srcSet=document.querySelector(".responsive-img-srcset") || document.querySelector('img[title="yiGongZi_suShi"]');//only need to change the responsive source set!        
  let currentSong=ap.list.audios[rIdx];
  console.log(`updateCoverImg: ${JSON.stringify(currentSong)} / rIdx=${rIdx}`)
  if(srcSet && currentSong){
    srcSet.srcset=currentSong.cover;
    let divCaption=document.querySelector("div.caption");
    divCaption.innerHTML   =`<p style='text-align: center;'>${currentSong.name}<br>${currentSong.artist}</p>`;
  }
}

const currentUrl = new URL(window.location.href);
const params = currentUrl.searchParams;
let cpPlaylist=params.get('playlist') ;
cpPlaylist=cpPlaylist !== null ? cpPlaylist : 'random';
console.log(cpPlaylist);
if(cpPlaylist=='random'){//no param has been passed yet to set the xPlayer
    params.set('playlist','offline');
    params.set('x','100');
    params.set('r','1');
    currentUrl.search = params.toString();
    console.log(currentUrl);
    window.location.href = currentUrl.toString();    
}else{
    console.log(params)
    setTimeout(async () => {
        console.log(`ap: ${ap}`) ;
        ap.audio.addEventListener('play', async function(){             
            updateCoverImg(ap.list.index);
        });
        //list cached songs to the table
        if(typeof idb4songs !== 'undefined' && idb4songs!==null){
          if(typeof storeName === 'undefined')throw(`storeName cannot be found!!!`);
          let data4tbl=await idb2dataArray(idb4songs, storeName);
          // console.log(data4tbl);  
          renderData2table(data4tbl);
        }
        //randomly init the cover image since the default expiring days is 7 in google storage
        rIdx=Math.floor(Math.random() * 39);
        updateCoverImg(rIdx);
    }, 3000); //allow 3 seconds delay/timeout to check if ap is loaded    
}

let dt=null, dt4desc=null;
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
function renderData2table(arr4tb){ 
  if(dt!==null) {dt.destroy();}//restore to simple html table, still kept in DOM
  if(typeof ap == 'undefined')return;
  // Initialise the DataTable
  dt=new DataTable('#tbl4idb', {
    columnDefs: [
        {//checkbox for the 1st select col
            orderable: false,
            render: DataTable.render.select(),
            targets: 0,
            searchable: false            
        }
    ],
    columns: [{data:0}, { data: 'artist' },{ data: 'name' }, { data: 'mimeType' }, { data: 'size' }, 
      { data: 'timestamp', render: function (data, type, row) {
        if (type === 'display' || type === 'filter') {
            // Assuming 'data' is a timestamp in milliseconds
            // const date = new Date(data);//traditional JS way
            // const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            // return date.toLocaleDateString('en-US', options); 
            return moment(data).format('YYYYMMDD HH:mm');
        }
        return data; // For sorting and other types, return original data
      }}],
    data: arr4tb,
    // layout: {
    //   topStart: { }
    // },
    order: [[4, 'desc']],
    // select: true
    select: {
        style: 'os',
        selector: 'td:first-child'
    }
  });
  //make a `rm` btn to rm selected rows
  const btnRm = document.createElement('button');
  btnRm.textContent ="RM Selected ... ";
  btnRm.id='btnRm';
  btnRm.classList.add("dt-button");
  dtSearchParentDiv=document.querySelector("#divTbl4idb .dt-layout-cell.dt-end");
  dtSearchParentDiv.insertBefore(btnRm, dtSearchParentDiv.firstChild);
  
  btnRm.addEventListener('click', async () => {    
    var selectedRowsData = dt.rows({ selected: true }).data();
    // Iterate through the selected rows' data
    selectedRowsData.each(async function(rowData) {
        console.log(rowData); // rowData will contain the data for each selected row        
        // if(await keyExists(rowData['fileName'])>0){
        await rmKey(rowData['fileName']);
        // }
    });
    //reload the data
    let data4tbl=await idb2dataArray(idb4songs, storeName);          
    renderData2table(data4tbl);
  });  

  const btnPlaySelected= document.createElement('button');
  btnPlaySelected.textContent ="Play Selected";  
  btnPlaySelected.classList.add("dt-button");  
  dtSearchParentDiv.insertBefore(btnPlaySelected, dtSearchParentDiv.firstChild);
  btnPlaySelected.addEventListener('click', async () => { 
    ap.list.clear();
    var selectedRowsData = dt.rows({ selected: true }).data();    
    selectedRowsData.each(async function(rowData) {
      aBlob=await loadAudioBlob(rowData['fileName']); 
      if(aBlob != null )
      if('meta' in rowData)
        ap.list.add([{"name":rowData['name'], "artist":rowData['artist'], "url":URL.createObjectURL(aBlob.data), "cover":rowData['meta']["cover"]}]);
      else
        ap.list.add([{"name":rowData['name'], "artist":rowData['artist'], "url":URL.createObjectURL(aBlob.data)}]);
    });    
  });
}

async function renderSuShi(){
  let data4suShi=await json2array('/hifini/yiGongZi/suShi-desc.json');
  console.log(data4suShi);
  let dt4desc=new DataTable('#tbl4desc', {
    columnDefs: [
        {//checkbox for the 1st select col
            orderable: false,
            render: DataTable.render.select(),
            targets: 0,
            searchable: false            
        }
    ],
    columns: [{data:0}, { data: 'index' },{ data: 'desc' }],
    order: [[1, 'asc']],
    data: data4suShi,    
    // select: true
    select: {
        style: 'os',
        selector: 'td:first-child'
    }
  });
}
// setTimeout(async () => { await renderSuShi(); }, 5000);

</script>>
