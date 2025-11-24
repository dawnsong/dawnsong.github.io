#!/bin/bash
#
set -x
for gc in xpub xmusic; do
    gcloud storage buckets describe gs://$gc --format="default(cors_config)"
    if [[ x"$1" == "x-u" ]]; then 
        gcloud storage buckets update gs://$gc --cors-file=sigma-smile-436711-b7__xmusic_pub__cors.json
    fi
done
