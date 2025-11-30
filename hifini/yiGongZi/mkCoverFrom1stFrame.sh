#!/bin/bash
#
#https://stackoverflow.com/questions/4425413/how-to-extract-the-1st-frame-and-restore-as-an-image-with-ffmpeg

function get1stFrame(){
    fmp4=$1
    #ffmpeg -i $fmp4 -vf "select=eq(n\,0)" -q:v 3 ${fmp4%.*}.jpg
    ffmpeg -i $fmp4 -vframes 1 -f image2  ${fmp4%.*}.jpg
}


for m in suChi/*.mp4; do 
    get1stFrame $m
    #rm $m
done
