// L.control.attribution.addAttribution('GDIT')
window.addEventListener('load', attrGDIT)
function attrGDIT(){
  var attrDiv=document.getElementsByClassName( 'leaflet-control-attribution' )[0];
// if(attrDiv){
  var gdit= document.createElement('a');
  // gdit.innerHTML=' | <a href="gdit.com">GDIT</a>' ;
  gdit.text=' | Xiaowei'
  gdit.href='https://dawnsong.github.io/'
  attrDiv.appendChild(gdit);
// }
} 