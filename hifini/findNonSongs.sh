#!/bin/bash 
#
doRm=${1:-''}

LOG_FILE="${0##*/}"
LOG_FILE="${LOG_FILE%.*}.log"
exec > >(tee -a "$LOG_FILE") 2>&1

filterCmd="file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' -e 'lrc' -e 'png' -e 'jp.?g'"
if [ x"$doRm" == x ]; then
    #file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' |gawk -v FS=:   '{print  $1  ; print $2 |"cat 1>&2"}'
    #file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' |gawk -v FS=:   '{print "'\''"  $1  "'\''" ; print $2 |"cat 1>&2"}'
    $filterCmd |gawk -v FS=:   '{print "'\''"  $1  "'\''" ; print $2 > "/dev/stderr"}'
elif [ x"$doRm" == x"-rm" ]; then
    #./findNonSongs.sh -rm 
    shift
    $filterCmd |
gawk -v FS=: '{
    print "rm " $1 ; 
    system("rm '\''"$1"'\''"); 
    print $2 |"cat 1>&2"
}'
else
    echo "Expecting nothing or -rm, but got unknow options '$1'"
fi
