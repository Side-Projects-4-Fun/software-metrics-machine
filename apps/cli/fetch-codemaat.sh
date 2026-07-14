#!/bin/bash

git_directory=$1
store_data=$2
start_date=$3

# Backward-compatible args:
# New shape: <git_dir> <store_data> <start_date> <end_date> <sub_folder> <force>
# Old shape: <git_dir> <store_data> <start_date> <sub_folder> <force>
if [ "$#" -ge 6 ]; then
  end_date=$4
  sub_folder=$5
  force=$6
else
  end_date=""
  sub_folder=$4
  force=$5
fi

if [ -z "$git_directory" ]; then
  echo "❌ SMM_GIT_REPOSITORY_LOCATION is not set. Export SMM_GIT_REPOSITORY_LOCATION to point the git repository to be used."
  exit 1
fi

if [ -z "$store_data" ]; then
  echo "❌ SMM_STORE_DATA_AT is not set. Export SMM_STORE_DATA_AT to a directory where results will be written."
  exit 1
fi

if [ ! -d "$store_data" ]; then
  echo "Directory $store_data does not exist. Creating..."
  mkdir -p "$store_data"
fi

if [ ! -w "$store_data" ]; then
  echo "Directory $store_data is not writable. Check permissions."
  exit 1
fi

if [ -z "$start_date" ]; then
  echo "Run the script with a valid start date e.g., './fetch-codemaat.sh 2023-01-01'. This date will be used as a starting point for the git log extraction."
  exit 1
fi

if [ -z "$end_date" ]; then
  end_date=$(date +%F)
fi

date_range_folder="${start_date}_to_${end_date}"

# When called with the new flow, store_data already points at the date-range folder.
# For legacy callers that still pass the CodeMaat base directory, normalize to the
# date-range folder so skip checks and outputs are scoped per run.
if [[ "$store_data" =~ ^.*/[0-9]{4}-[0-9]{2}-[0-9]{2}_to_[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  target_store_data="$store_data"
else
  target_store_data="$store_data/$date_range_folder"
fi

if [ ! -d "$target_store_data" ]; then
  mkdir -p "$target_store_data"
fi

current=$(pwd)
script_dir=$(cd "$(dirname "$0")" && pwd)

if [ -n "$sub_folder" ]; then
  target_directory="$sub_folder"
else
  target_directory=""
fi

git_log_file="logfile.log"
codemaat="$script_dir/tools/code-maat-1.0.4-standalone.jar"

#clean up
rm -rf "$target_store_data/$git_log_file"

echo "Extracting git log from $git_directory between $start_date and $end_date for directory..."

if ! cd "$git_directory"; then
  echo "❌ Unable to access git repository at $git_directory"
  exit 1
fi

if ! git log --pretty=format:'[%h] %aN %ad %s' --date=short --numstat --after="$start_date" --before="$end_date" $target_directory > "$target_store_data/$git_log_file"; then
  echo "❌ Failed to generate git log file at $target_store_data/$git_log_file"
  exit 1
fi

cd "$current"

if [ ! -s "$target_store_data/$git_log_file" ]; then
  echo "❌ logfile.log was not created or is empty at $target_store_data/$git_log_file"
  exit 1
fi

echo "Git log extracted to $target_store_data/$git_log_file"

echo "Running CodeMaat analyses... this may take a while depending on the size of the repository."

echo "Running age data extraction ..."

# ensure codemaat jar exists
if [ ! -f "$codemaat" ]; then
  echo "❌ CodeMaat jar not found at $codemaat. Please ensure the file exists."
  exit 1
fi

# helper to run codemaat action and skip if output exists
run_codemaat() {
  local action="$1"
  local out="$2"
  local outpath="$target_store_data/$out"
  if [ "$force" = false ]; then
    if [ -f "$outpath" ] && [ -s "$outpath" ]; then
      echo "Skipping $action: output already exists at $outpath"
      return
    fi
  else
    echo "Force mode: regenerating $outpath"
  fi
  echo "Running $action data extraction ..."
  java -jar "$codemaat" -l "$target_store_data/$git_log_file" -c git -a "$action" > "$outpath"
  echo "Done."
}

run_codemaat age age.csv
run_codemaat abs-churn abs-churn.csv
run_codemaat author-churn author-churn.csv
run_codemaat entity-ownership entity-ownership.csv
run_codemaat entity-effort entity-effort.csv
run_codemaat entity-churn entity-churn.csv
run_codemaat coupling coupling.csv

echo "..."
echo "..."

echo "Done"