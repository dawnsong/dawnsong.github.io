#!/bin/bash
#
gsutil -m setmeta  -r -h "Cache-Control: public, max-age=604800, immutable" gs://xmusic
