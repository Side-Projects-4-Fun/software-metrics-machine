---
outline: deep
---

# Pipeline run time analysis

In this investigation, we analyze the run time of CI/CD pipelines to identify trends and potential bottlenecks in the development process. Understanding pipeline run times can help teams optimize their workflows and improve overall efficiency.

## Target project

The project used is [json-tool](https://github.com/marabesi/json-tool) as it is an open source project with a moderate
level of activity, making it suitable for this analysis.

## Data Collection

We collected data on pipeline run times from our GitHub repository using the Metrics Machine tool. The data includes timestamps for when each pipeline started and finished, allowing us to calculate the total run time for each pipeline execution.

```bash
smm pipelines fetch --start-date 2025-08-17 --end-date 2025-11-17 --raw-filters=branch=main
```

We use the branch filter to focus on the main development line, ensuring that our analysis reflects the most relevant
pipeline executions. Executions from branches other than `main` are subject to a full analysis in future investigations.
Note that, this constraint is applied to all data available for this investigation. If the desired to see executions that are not
on the main branch, remove the branch filter and re-fetch the data.

## Analysis

Using the collected data, we calculated the run time for each pipeline by subtracting the start time from the finish time
and calculating the duration average in minutes. The pipeline used is the one named ci.yml, as it is the main pipeline
executed when changes are pushed to the main line. The following CLI command was used to perform this analysis:

```bash
smm pipelines runs-duration \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --workflow-path=".github/workflows/ci.yml" \
  --raw-filters=status=completed,conclusion=success \
  --aggregate-by-day=true
```

The resulting data is the following (value in minutes):

```plaintext
         name     value  count
0  2025-08-17  3.616667      1
1  2025-08-18  3.716667      1
2  2025-08-19  3.250000      1
3  2025-08-20  3.272222      3
```

Next step is to visualize the data from the jobs run duration analysis. The following CLI command was used to generate
the visualization:

```bash
smm pipelines jobs-time-execution \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --workflow-path=".github/workflows/ci.yml"
```

The resulting data is the following (value in miuntes):

```plaintext
            0         1
0  acceptance  2.280000
1        test  1.020000
2       build  0.526667
3    coverage  0.350000
```

> [!NOTE]
> Matrix jobs are reported under their base name. A job defined on a matrix fans out into parallel legs named, for
> example, `test (1)`, `test (2)`, `test (3)`. Because these legs run concurrently, SMM collapses them onto `test`
> before computing the average, so the row above represents the mean duration of the parallel legs, not their sum. See
> [Matrix jobs](../features/pipelines.md#matrix-jobs-parallel-legs) for details.

<!--
## Findings
-->

