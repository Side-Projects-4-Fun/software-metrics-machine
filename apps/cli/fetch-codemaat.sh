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

min_revs=5
min_shared_revs=5
min_coupling=30

if [ "$#" -ge 8 ] && [ -n "$8" ]; then
  min_revs=$8
fi

if [ "$#" -ge 9 ] && [ -n "$9" ]; then
  min_shared_revs=$9
fi

if [ "$#" -ge 10 ] && [ -n "${10}" ]; then
  min_coupling=${10}
fi

group_depth="${SMM_CODEMAAT_GROUP_DEPTH:-2}"
if [ "$#" -ge 7 ] && [ -n "$7" ]; then
  group_depth="$7"
fi

case "$group_depth" in
  ''|*[!0-9]*)
    group_depth=2
    ;;
esac

if [ "$group_depth" -lt 1 ]; then
  group_depth=1
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
layers_file="$target_store_data/layers.txt"

debug_log() {
  if [ -n "${DEBUG:-}" ]; then
    echo "[DEBUG] $*"
  fi
}

debug_log "fetch-codemaat.sh started"
debug_log "args: git_directory=$git_directory store_data=$store_data start_date=$start_date end_date=$end_date sub_folder=$sub_folder force=$force group_depth=$group_depth min_revs=$min_revs min_shared_revs=$min_shared_revs min_coupling=$min_coupling"
debug_log "resolved target_store_data=$target_store_data"
debug_log "resolved target_directory=${target_directory:-<none>}"
debug_log "resolved layers_file=$layers_file"

#clean up
rm -rf "$target_store_data/$git_log_file"

echo "Extracting git log from $git_directory between $start_date and $end_date for directory..."

if ! cd "$git_directory"; then
  echo "❌ Unable to access git repository at $git_directory"
  exit 1
fi

debug_log "working directory: $(pwd)"

git_log_args=(--pretty=format:'[%h] %aN %ad %s' --date=short --numstat --after="$start_date" --before="$end_date")

if [ -n "$target_directory" ]; then
	git_log_args+=(-- "$target_directory")
fi

debug_log "git log command: git log ${git_log_args[*]}"

if ! git log "${git_log_args[@]}" > "$target_store_data/$git_log_file"; then
  echo "❌ Failed to generate git log file at $target_store_data/$git_log_file"
  exit 1
fi

debug_log "git log output: $target_store_data/$git_log_file"
debug_log "git log size: $(wc -c < "$target_store_data/$git_log_file") bytes"

generate_layers_file() {
  local output_file="$1"
  local root_dir="$2"
  local depth="$3"

  cd "$root_dir" || return 1

  {
    git ls-files | awk -v depth="$depth" '
      function join_parts(parts, count,    i, result) {
        result = parts[1]
        for (i = 2; i <= count; i++) {
          result = result "/" parts[i]
        }
        return result
      }

      function sanitize_label(value,    result) {
        result = value
        gsub(/[^A-Za-z0-9]+/, "_", result)
        gsub(/^_+|_+$/, "", result)
        if (result == "") {
          result = "ROOT"
        }
        return result
      }

      {
        path = $0
        sub(/^\.\//, "", path)
        if (path == "") {
          next
        }

        count = split(path, parts, "/")
        if (count == 1) {
          roots_seen = 1
          next
        }

        directory_count = count - 1
        used = depth < directory_count ? depth : directory_count
        if (used < 1) {
          used = 1
        }

        group = join_parts(parts, used)
        groups[group] = 1
      }

      END {
        if (roots_seen) {
          print "^[^/]+$ => ROOT"
        }

        n = 0
        for (group in groups) {
          ordered[++n] = group
        }

        for (i = 1; i <= n; i++) {
          for (j = i + 1; j <= n; j++) {
            if (ordered[j] < ordered[i]) {
              tmp = ordered[i]
              ordered[i] = ordered[j]
              ordered[j] = tmp
            }
          }
        }

        for (i = 1; i <= n; i++) {
          group = ordered[i]
          print group " => " sanitize_label(group)
        }

        print "^.*$ => Other"
      }
    '
  } > "$output_file"
}

cd "$current"

if [ ! -s "$target_store_data/$git_log_file" ]; then
  echo "❌ logfile.log was not created or is empty at $target_store_data/$git_log_file"
  exit 1
fi

echo "Git log extracted to $target_store_data/$git_log_file"

echo "Generating automatic layer grouping file ..."
generate_layers_file "$layers_file" "$git_directory" "$group_depth"

echo "Running CodeMaat analyses... this may take a while depending on the size of the repository."
echo "CodeMaat coupling thresholds: min_revs=$min_revs min_shared_revs=$min_shared_revs min_coupling=$min_coupling"

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
  local codemaat_args=("-l" "$target_store_data/$git_log_file" "-c" "git" "-a" "$action")

  java -jar "$codemaat" "${codemaat_args[@]}" > "$outpath"
  echo "Done."
}

run_codemaat_layered_coupling() {
  local out="coupling-layers.csv"
  local outpath="$target_store_data/$out"

  if [ ! -s "$layers_file" ]; then
    echo "Skipping layered coupling: layers file is missing at $layers_file"
    return
  fi

  if [ "$force" = false ]; then
    if [ -f "$outpath" ] && [ -s "$outpath" ]; then
      echo "Skipping layered coupling: output already exists at $outpath"
      return
    fi
  else
    echo "Force mode: regenerating $outpath"
  fi

  echo "Running layered coupling extraction ..."
  java -jar "$codemaat" \
    -l "$target_store_data/$git_log_file" \
    -c git \
    -a coupling \
    -g "$layers_file" \
    -n "$min_revs" \
    -m "$min_shared_revs" \
    -i "$min_coupling" > "$outpath"
  echo "Done."
}

run_codemaat age age.csv
run_codemaat abs-churn abs-churn.csv
run_codemaat author-churn author-churn.csv
run_codemaat entity-ownership entity-ownership.csv
run_codemaat entity-effort entity-effort.csv
run_codemaat entity-churn entity-churn.csv
run_codemaat coupling coupling.csv
run_codemaat_layered_coupling

echo "..."
echo "..."

echo "Done"