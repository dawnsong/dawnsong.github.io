#!/bin/bash 
#
doRm=${1:-''}
if [ x"$doRm" == x ]; then
    #file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' |gawk -v FS=:   '{print  $1  ; print $2 |"cat 1>&2"}'
    #file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' |gawk -v FS=:   '{print "'\''"  $1  "'\''" ; print $2 |"cat 1>&2"}'
    file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' |gawk -v FS=:   '{print "'\''"  $1  "'\''" ; print $2 > "/dev/stderr"}'
elif [ x"$doRm" == x"-rm" ]; then
    #./findNonSongs.sh -rm 
    shift
    file songs/* |grep -vi -e 'Audio' -e 'Media' -e 'mpeg' |
gawk -v FS=: '{
    print $1; 
    system("rm '\''"$1"'\''"); 
    print $2 |"cat 1>&2"
}'
else
    echo "Expecting nothing or -rm, but got unknow options '$1'"
fi
