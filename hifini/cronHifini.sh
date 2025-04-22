#!/bin/bash
#
source $HOME/.bashrc
export PATH=$HOME/anaconda3/envs/webot/bin/:$HOME/anaconda3/bin:$PATH
cd /home/dawnsong/dawn/dawnsong.github.io/hifini
#conda activate webot

exec > >(tee hifini.log) 2>&1
python ./hifini.py sign

#check if today is Sunday, if is then I will download music/songs from my online fav
#if [[ $(date +%a) == "Sat" && "AM" == $(date +%p) ]]; then
if [[ $(date +%a) =~ "^(Sat|Wed)$" && "AM" == $(date +%p) ]]; then
    timeout -k 1m -s SIGKILL 10h python ./hifini.py 
    ./findNonSongs.sh -rm  2>&1 |tee nonSongs.log
    #upload/rsync songs to google bucket
    gcloud storage rsync  ./songs/ gs://xmusic/q/ --recursive --delete-unmatched-destination-objects
    #upload my playlist
    gcloud storage cp ./playlist.js  gs://xpub/js/playlist.js
    #get permissions
    gcloud storage objects describe  gs://xpub/js/playlist.js
    gsutil  iam get gs://xpub/js/playlist.js
    #set public
    gcloud storage objects update gs://xpub/js/playlist.js --add-acl-grant=entity=allUsers,role=READER
fi
