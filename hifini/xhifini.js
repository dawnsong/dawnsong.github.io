function base32Encode(str) {
    var base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    var bits = "";
    var base32 = "";

    for(var i = 0; i < str.length; i++) {
        var bit = str.charCodeAt(i).toString(2);
        while(bit.length < 8) {
            bit = "0" + bit;
        }
        bits += bit;
    }

    while(bits.length % 5 !== 0) {
        bits += "0";
    }

    for(var i = 0; i < bits.length; i += 5) {
        var chunk = bits.substring(i, i+5);
        base32 += base32chars[parseInt(chunk, 2)];
    }

    while(base32.length % 8 !== 0) {
        base32 += "=";
    }

    return base32.replace(/=/g, 'HiFiNiYINYUECICHANG');
}
function generateParam(data) {
  var key = '95wwwHiFiNicom27';
  var outText = '';

  for(var i = 0, j = 0; i < data.length; i++, j++) {
      if(j == key.length) j = 0;
      outText += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(j));
  }
  return base32Encode(outText);
}

function hifini(key, param){
    var url = 'https://hifini.com/get_music.php?key=' + key + '&p=' + generateParam(param);    
    return url ;

    //#network level can get 302 redirected URL
    var k=key +'&'+ param;
    console.log(url);
    var v=Cookies.get(k);
    console.log(v);
    if(v) {
        url =v;
    }else{
        $.ajax({
            Cache: true,
            url: url,            
            Headers:{'Access-Control-Allow-Origin': null, 
                'Accept':'*/*', 'dnt':1, 'priority':'i', 'range':'bytes=0-1',
                'sec-fetch-dest':'audio', 'sec-fetch-mode':'no-cors', 'sec-fetch-site':'cross-site',  },
            // crossDomain: true,            
            dataType:  'audio', //'jsonp', //'audio/mpeg', //
            type: 'GET',
            success: function(data) {
              // Handle the response data
              console.log(data);
              alert(data);
            },
            statusCode: {
              302: function(jqXHR) {
                // Handle the redirect manually
                var qqURL = jqXHR.getResponseHeader('Location');
                alert(qqURL);
                console.log('302'+ qqURL);
                Cookies.set(k, qqURL);
                url = qqURL;
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {                
              console.log('error: ' + errorThrown)
              console.log(jqXHR); //.getAllResponseHeaders() );              
              
              var qqURL = jqXHR.getResponseHeader('Location');
              console.log(textStatus +" | "+ errorThrown + " | " +qqURL );
            },
            
        });
    }
    console.log(url);    
    return url ;
}