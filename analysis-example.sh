#!/bin/bash

export SMM_STORE_DATA_AT=$1

PROJECT=marabesi/json-tool

start_date=2025-01-10
end_date=2026-06-06

pnpm run build

# code 
pnpm run --filter=cli dev code fetch-commits --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
pnpm run --filter=cli dev code codemaat-fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
pnpm run --filter=cli dev architecture generate --start-date=$start_date --end-date=$end_date --project=$PROJECT --debug

# prs
pnpm run --filter=cli dev prs fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
pnpm run --filter=cli dev prs fetch-comments --start-date=$start_date --end-date=$end_date --project=$PROJECT --force

# pipelines
pnpm run --filter=cli dev pipelines fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force --by-day
pnpm run --filter=cli dev pipelines fetch-jobs --run-start-date=$start_date --run-end-date=$end_date --project=$PROJECT --force --by-day

pnpm run --filter=cli dev sonarqube analysis run --data-dir "./sonarqube_data" --properties "-Dsonar.projectKey=$PROJECT -Dsonar.javascript.exclusions=**/node_modules/**"
pnpm run --filter=cli dev sonarqube fetch-measures
pnpm run --filter=cli dev sonarqube fetch-component-tree
pnpm run --filter=cli dev sonarqube fetch-historical-measures

pnpm run --filter=cli dev prs summary --output=json
pnpm run --filter=cli dev pipelines summary --output=json
pnpm run --filter=cli dev pipelines jobs-summary --output=json
pnpm run --filter=cli dev health-check --output=json
