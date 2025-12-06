#!/bin/bash
#

cd /home/dawnsong/dawn/dawnsong.github.io/hifini/yiGongZi
gcloud storage rsync ./suShi/ gs://xmusic/yiGongZi/suShi/ --recursive --delete-unmatched-destination-objects

#not public possible!
#gsutil -m acl -r ch -u AllUsers:R gs://xmusic/yiGongZi

fdesc=suShi-desc.json
declare -A epi
echo '[' >  $fdesc
for d in suShi/*.description; do 
	d2=${d#*/} 
	epi['index']=${d2%.*} 
	#head -2 $d;  
	epi['desc']=`sed -n '1,/^$/p' $d |sed ':a;N;$!ba;s/\n/<br>/g'`
	jsonStr='{}'
	for key in "${!epi[@]}"; do 
		value="${epi[$key]}"
		jsonStr=$(jq -n --argjson data "$jsonStr" --arg key "$key" --arg value "$value" '$data + {($key) : $value }')
	done
	echo "$jsonStr ,"
done >> $fdesc
sed -i '$ s/,$//' suShi-desc.json #rm last colon from the last line
echo ']' >>  $fdesc
#exit

mp3lst=(suShi/*.mp3)
nMp3=${#mp3lst[@]}
let nEnd=nMp3-1
{
echo "["
for i in $(seq 0 $nEnd) ; do 
	m=${mp3lst[$i]}
	bm=$(basename ${m%.mp3})
	sn=${bm#*__}
	a=${bm%__*}
	#ae=$(echo -n $a |jq -sRr @uri)
	#me=$(echo -n $(basename $m) |jq -sRr @uri)
	signedCover=$(gsutil signurl -d 7d ../xgcloud.json gs://xmusic/yiGongZi/suShi/${a}.jpg |awk 'END{print $NF}')
	signedMp3=$(gsutil signurl -d 7d ../xgcloud.json gs://xmusic/yiGongZi/suShi/${bm}.mp3|awk 'END{print $NF}')
	jd0=$(cat <<-ENDJ
{"name":"${sn}",
"artist":"${a}",
"cover":"https://storage.googleapis.com/xmusic/yiGongZi/suShi/${ae}.jpg",
"url":"https://storage.googleapis.com/xmusic/yiGongZi/suShi/${me}"
}
ENDJ
)
	jd=$(cat <<-ENDJ
{"name":"${sn}",
"artist":"${a}",
"cover":"${signedCover}",
"url":"${signedMp3}"
}
ENDJ
)
	if [[ $i -lt $nEnd ]]; then 	echo "$jd ," ; 
	else echo "$jd" ; fi
done
echo "]"
} > ../playlists/yiGongZi_suShi.json
ln -s ../playlists/yiGongZi_suShi.json ./

#gcloud storage cp ./yiGongZi_suShi.json gs://xpub/playlists/ 
#gsutil -m acl -r ch -u AllUsers:R gs://xpub/playlists/yiGongZi_suShi.json
gsutil -h "Cache-Control:no-cache,max-age=0" cp -a public-read ./yiGongZi_suShi.json gs://xpub/playlists/

