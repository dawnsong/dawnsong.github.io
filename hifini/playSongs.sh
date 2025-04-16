#!/bin/bash
#
#find ./songs/ -type f -print0 |xargs -0 cat |shuf  >/tmp/x.lst # | mplayer  #-shuffle -playlist -
find ./songs/ -type f -exec realpath {} \;  >/tmp/x.lst # | mplayer  #-shuffle -playlist -
wc -l /tmp/x.lst
if [ "`uname`" = 'Linux' ]; then
  mplayer -shuffle -playlist /tmp/x.lst
else
  mplayer -shuffle ./songs
fi 
