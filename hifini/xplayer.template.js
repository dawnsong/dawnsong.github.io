var songs=[
  {
    name: '心语',
    artist: '韩红',
    url: 'https://m10.music.126.net/20241025071049/00447b54ffe8987601202836dc77afff/ymusic/b6a0/40b2/c2ec/56d125e8b8d92f37f9e084240090f750.mp3' ,
    lrc: '/hifini/心语-韩红.lrc',
    pic: 'http://img1.kuwo.cn/star/albumcover/500/29/33/2480739608.jpg',
  },
  //%musicDictList
];
function getRandomSubarray(arr, size) {
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
  console.log(li.text());
  // console.log(li.parent().text());
  // $("ul.social-icons > li:nth-child(3)").appendChild($("#xplayer"));
  //to debug
}
// moveDivToUl();
var ap = new APlayer({
  element: document.getElementById('xplayer'),
  narrow: false,
  //fixed: true, //<!--吸底模式 -->  
  mini: false, 
  autoplay: false, // Google Chrome disabled autoplay and require user's response before auto playback
  loop: 'all',
  order: 'random',
  volume: 1,
  preload: 'none', //'auto',
  showlrc: false, //
  lrctype:3,
  mutex: true,
  theme:  '#ad7a86', // '#b7daff',  //'#0a0a0f',//
  listFolded: true,
  audio: getRandomSubarray(songs, 10)
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

// ap.on('loadeddata', function () {
//   console.log('loadeddata of song: ' + ap.list.index );
//   console.log('URL: ' + ap.list.audios[ap.list.index].url);
//   console.log(ap.list.audios[ap.list.index]);
//   //console.log(null==ap.audios); //true
//   console.log("src: "+ ap.audio.src)

//   console.log(ap.audio.buffered)
// });
