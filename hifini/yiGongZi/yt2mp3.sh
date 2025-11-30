#!/bin/bash
#
log=/tmp/youtube-mp3.log
#--flat-playlist only list items, not to download them
youtube-dl --cache-dir $HOME/.cache/youtube-dl --continue --cookies youtube_cookies.txt --write-description --write-info-json  --write-annotations --yes-playlist --audio-format mp3 --extract-audio -o '%(channel)s_%(playlist_title)s_%(playlist_index)03d__%(title)s-%(id)s.%(ext)s' $@ | tee $log

fn=`cat $log |grep "Destination:.*mp3" |sed -e 's;.*-;;' `
if [[ -z "$fn" ]]; then
    echo "#!Cannot extract filename" 1>&2
    printf "#%.0s" {1..20} 1>&2
    cat $log
else
    #fn may be only partial due to utf-8 display issue
    fn="./`ls '*$fn'`"
    echo "$fn" 1>&2
    touch "$fn"
    ls -hl "$fn"
    id3v2 -l "$fn"
    id3v2 --WOAS "$@" "$fn"
    id3v2 -l "$fn"
fi
