---
layout: page
title: 意公子講蘇軾
description: 吴敏婕重读苏轼的起伏人生
img: assets/img/yiGongZi_suShi/意公子講蘇軾_001__蘇東坡式的自嘲：活著的意義，也許是那些渡過人生低谷時的經歷【意公子】-mJyZ8-o4gsg.jpg
importance: 1
category: 意公子
related_publications: true
bibliography: assets/bibliography/yiGongZi_suShi.bib
date: 2025-11-28
---

<!--todo: fix the citation and references in page/digest -->

意公子自2013年开始做自媒体，2016年开始更新<a href="https://www.youtube.com/@EYart-yigongzi">Youtube</a> <d-cite key="yigongzi2016youtube"></d-cite>, 成名于其蘇軾系列。为方便开车送娃的时候听着学习，特整理其这个系列到此网页。
{% quote %}
意公子:把中華五千年文化長河裡，那些打動我們的人事物，帶進當下人們的生活。
{% endquote %}

<div class="language-plaintext highlighter-rouge highlight code-display-wrapper">
<pre class="highlight" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">
<table id="tbl4desc" class="stripe row-border order-column" cellspacing="0" width="100%">
    <thead>
        <tr> <th></th>       
          <th>idx</th>
          <th>description</th>          
        </tr>
    </thead>    
</table>
</pre>
</div>

<div class="row">
    <div class="col-sm mt-3 mt-md-0" id='cover4yiGongZi'>
        {% include figure.liquid loading="eager" path="https://storage.googleapis.com/xmusic/yiGongZi/suShi/%E6%84%8F%E5%85%AC%E5%AD%90%E8%AC%9B%E8%98%87%E8%BB%BE_039.jpg?x-goog-signature=4226ab38946a51ffa59f8504a2a1636956d23699d57f393e896acf36d2ee27106d3f554d8ddac55fa3aa3a64e8bbd07d276dfb9c7f36efcf092680eceefaec6dbd9347495af481eab295f682e1a00b45a6a9155c02cf2721a54c1b477348344fdf9d46581d7fa538002998151c0c97dd1c20b582c20262f7aa5a63021ca9e916d2b5f7c7f238f6a0139a762932e3e17ee4ceee3c820f6c41b33415dab5d6ce9790d6a025777ee6b7a5b641221a90b59339e55b8d7ab5a0c8f369f36f134f3aa8c4a1b8c3679950ea26e73515fe4754db704066fdcefb5f90a507a94868090625a13c39c42bbaf61886e1f54accb4c3e9e0b6832b1200abcaa213b9f689c932a8&x-goog-algorithm=GOOG4-RSA-SHA256&x-goog-credential=xgcloud%40sigma-smile-436711-b7.iam.gserviceaccount.com%2F20251128%2Fus-east5%2Fstorage%2Fgoog4_request&x-goog-date=20251128T234837Z&x-goog-expires=604800&x-goog-signedheaders=host" title="yiGongZi_suShi_039" class="img-fluid rounded z-depth-1" %}
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
  let srcSet=document.querySelector(".responsive-img-srcset");//only need to change the responsive source set!        
  currentSong=ap.list.audios[rIdx];
  srcSet.srcset=currentSong.cover;
  let divCaption=document.querySelector("div.caption");
  divCaption.innerHTML   =`<p style='text-align: center;'>${currentSong.name}<br>${currentSong.artist}</p>`;
}

const currentUrl = new URL(window.location.href);
const params = currentUrl.searchParams;
let cpPlaylist=params.get('playlist') ;
cpPlaylist=cpPlaylist !== null ? cpPlaylist : 'random';
console.log(cpPlaylist);
if(cpPlaylist=='random'){//no param has been passed yet to set the xPlayer
    params.set('playlist','yiGongZi_suShi');
    params.set('x','100');
    params.set('pRandom','0');
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
setTimeout(async () => { await renderSuShi(); }, 5000);

</script>>
