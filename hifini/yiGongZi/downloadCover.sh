#!/bin/bash
#
function getVideoCoverImg(){
    youtube-dl --skip-download --write-thumbnail  $1
}

ls suShi/*.json |while read j; do 
    jj=${j%.info.json}
    cat $j |jq  .thumbnail |xargs wget -O ${jj%%__*}.jpg
done
