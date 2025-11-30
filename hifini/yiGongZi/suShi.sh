#!/bin/bash -x

./yt2mp3.sh --keep-video -o './suShi/%(playlist_title)s_%(playlist_index)03d__%(title)s-%(id)s.%(ext)s' 'https://www.youtube.com/watch?v=mJyZ8-o4gsg&list=PL30MEN19i1lL-UATsGbmcLtZ6blZBzHzE'

mkdir -p suChi
ls 意公子* |while read f; do mv $f ./suChi/; done
