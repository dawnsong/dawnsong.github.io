#!/bin/bash
#https://cloud.google.com/storage/docs/authentication
#curl -X GET \
#     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
#     -H "x-goog-user-project: sigma-smile-436711-b7" \
#     "https://iam.googleapis.com/v1/projects/sigma-smile-436711-b7/serviceAccounts"

gcloud iam service-accounts keys create xgcloud.json \
    --iam-account=xgcloud@sigma-smile-436711-b7.iam.gserviceaccount.com
