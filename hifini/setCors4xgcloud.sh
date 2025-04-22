#!/bin/bash
#
set -x
gcloud storage buckets describe gs://xpub --format="default(cors_config)"
if [[ x"$1" == "x-u" ]]; then 
    gcloud storage buckets update gs://xpub --cors-file=sigma-smile-436711-b7__xmusic_pub__cors.json
fi
