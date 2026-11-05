#!/usr/bin/env bash
# One-time setup so an app can have Cloud Run jobs (app.json "jobs"). Run it once per app, as a
# project owner, in Cloud Shell or anywhere gcloud is signed in:
#
#   scripts/setup-jobs.sh <app> <deploy service account email> [bucket]
#
# The deploy service account is the one CI uses; the "Cloud Run jobs" step of a deploy run prints
# it ("deploying as ..."). Safe to re-run.
#
# It sets up:
#   - the Cloud Run and Artifact Registry APIs and a shared "apps" Docker repository
#   - <app>-jobs@, the service account the app's jobs run as, with Firestore access and,
#     if a bucket is given, read/write access to that bucket
#   - for the deploy service account: push images, deploy jobs, and run them as <app>-jobs@
#   - for App Hosting backends: permission to start job executions
set -euo pipefail

app=${1:?usage: setup-jobs.sh <app> <deploy service account> [bucket]}
deploy_sa=${2:?usage: setup-jobs.sh <app> <deploy service account> [bucket]}
bucket=${3:-}
project=apps-97595
region=us-central1
job_sa="$app-jobs@$project.iam.gserviceaccount.com"
apphosting_sa="firebase-app-hosting-compute@$project.iam.gserviceaccount.com"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com --project "$project"

if ! gcloud artifacts repositories describe apps --location "$region" --project "$project" > /dev/null 2>&1; then
  gcloud artifacts repositories create apps --repository-format docker --location "$region" \
    --project "$project" --description "Container images for Cloud Run jobs"
fi
gcloud artifacts repositories add-iam-policy-binding apps --location "$region" --project "$project" \
  --member "serviceAccount:$deploy_sa" --role roles/artifactregistry.writer --quiet > /dev/null

if ! gcloud iam service-accounts describe "$job_sa" --project "$project" > /dev/null 2>&1; then
  gcloud iam service-accounts create "$app-jobs" --project "$project" --display-name "$app Cloud Run jobs"
fi

project_role() {
  gcloud projects add-iam-policy-binding "$project" --member "serviceAccount:$1" --role "$2" \
    --condition None --quiet > /dev/null
  echo "granted $2 to $1"
}
project_role "$deploy_sa" roles/run.admin
project_role "$job_sa" roles/datastore.user
project_role "$apphosting_sa" roles/run.developer

gcloud iam service-accounts add-iam-policy-binding "$job_sa" --project "$project" \
  --member "serviceAccount:$deploy_sa" --role roles/iam.serviceAccountUser --quiet > /dev/null
echo "allowed $deploy_sa to deploy jobs that run as $job_sa"

if [ -n "$bucket" ]; then
  gcloud storage buckets add-iam-policy-binding "gs://$bucket" \
    --member "serviceAccount:$job_sa" --role roles/storage.objectAdmin --quiet > /dev/null
  echo "granted gs://$bucket access to $job_sa"
fi

echo "Done. Jobs for $app deploy with the next push."
