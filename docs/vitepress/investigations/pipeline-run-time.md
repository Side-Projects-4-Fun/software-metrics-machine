---
outline: deep
---

# Pipeline run time analysis

CI/CD pipeline performance directly affects how fast your team gets feedback, how often you ship, and how quickly
you can recover from failures. This investigation walks through data collection and analysis of pipeline run time
metrics using Software Metrics Machine, so you can pinpoint slowdowns, balance job workloads, and make informed
decisions about pipeline optimization.

## Target project

The project used is [json-tool](https://github.com/marabesi/json-tool), an open-source project with moderate
activity that provides enough pipeline data for a realistic run-time analysis.

## Data collection

Before analyzing run times, fetch the pipeline runs and then the individual job data. Pipeline runs must be fetched
first because jobs are retrieved per-run using the data already stored.

### Fetch pipeline runs

```bash
smm pipelines fetch --start-date 2025-08-17 --end-date 2025-11-17 --raw-filters=branch=main
```

We use the branch filter to focus on the main development line. Executions from branches other than `main` are
excluded — include them in a separate analysis if branch-level comparison is needed. By default, SMM caches fetched
data so subsequent runs are fast unless you pass `--force`.

### Fetch pipeline jobs

```bash
smm pipelines fetch-jobs --run-start-date 2025-08-17 --run-end-date 2025-11-17
```

Jobs are the individual CI steps (build, test, deploy, etc.) that make up each pipeline run. Fetching them after
the pipeline runs links each job to its parent run. The `--run-start-date` and `--run-end-date` flags filter by
the pipeline run's creation date, not the job's own timestamp. On large repositories, pass `--by-day` to fetch
day by day and avoid provider rate limits.

## Analysis

With the data in place, run the commands below. Each command reads the cached data — no network calls are needed
unless you force a re-fetch.

### Pipeline summary

A high-level snapshot gives you totals and status distribution for the entire period at a glance.

```bash
smm pipelines summary \
  --start-date 2025-08-17 \
  --end-date 2025-11-17
```

Example output:

```text
=== Pipelines Summary ===
Total pipelines: 45
Success: 38
Failure: 5
Partial failure: 2
Avg. Duration: 4.2 min
First Pipeline: 2025-08-17
Last Pipeline: 2025-11-16
```

The ratio of failures to total runs is your early warning. CI failure rates above 10–15% are associated with
longer review cycles and reduced throughput[^1][^2].

### Pipeline runs duration over time

Run duration measures how long each pipeline execution takes from first job start to last job completion,
aggregated by day.

```bash
smm pipelines runs-duration \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --workflow-path=".github/workflows/ci.yml" \
  --raw-filters=status=completed,conclusion=success \
  --aggregate-by-day=true
```

Example output (value in minutes):

```text
         name     value  count
0  2025-08-17  3.616667      1
1  2025-08-18  3.716667      1
2  2025-08-19  3.250000      1
3  2025-08-20  3.272222      3
```

We filter to `conclusion=success` to isolate healthy pipeline performance. Failed runs tend to be shorter
(bailing out early at the failing step), which would distort the average downward. Run this separately with
`conclusion=failure` to compare failure vs success durations — a significant gap may indicate that slow
steps are also the fragile ones[^3].

Use `--weekends exclude` to focus on business-day runs and `--outlier-mode flag` to surface runs that took
unusually long without removing them from the average. See
[Outliers and weekend filtering](../features/pipelines.md#outliers-and-weekend-filtering) for details.

### Job execution time breakdown

Jobs are the individual units of work within a pipeline. This command breaks down average execution time
by job name, revealing which jobs dominate the total pipeline duration.

```bash
smm pipelines jobs-time-execution \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --workflow-path=".github/workflows/ci.yml"
```

Example output (value in minutes):

```text
            0         1
0  acceptance  2.280000
1        test  1.020000
2       build  0.526667
3    coverage  0.350000
```

> [!NOTE]
> Matrix jobs are reported under their base name. A job defined on a matrix fans out into parallel legs named,
> for example, `test (1)`, `test (2)`, `test (3)`. Because these legs run concurrently, SMM collapses them onto
> a single `test` entry before computing the average — you will only ever see `test` in the table above, never
> the individual `test (N)` leg names, and the value is the mean duration of the parallel legs, not their sum.
> See [Matrix jobs](../features/pipelines.md#matrix-jobs-parallel-legs) for details.

### Job step-level analysis

When a specific job is the bottleneck, drill into its individual steps to find the root cause.

```bash
smm pipelines jobs-steps-time \
  --method average \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --job=acceptance
```

Example output (value in minutes):

```text
               0         1
0   install deps  0.150000
1    run tests    1.950000
2   upload report 0.180000
```

Step-level analysis isolates whether the bottleneck is in environment setup, test execution, artifact
upload, or a specific script. Researchers have found that dependency installation and test execution account
for most of the variability in CI build times[^4]. If a single step dominates, it is the prime candidate
for optimization — caching, parallelizing, or splitting into smaller jobs.

### Pipeline throughput over time

Throughput shows the volume of pipeline runs triggered each period, helping you correlate run time trends
with workload volume.

```bash
smm pipelines runs-by \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --period week
```

Example output:

```text
         period  runs
0  2025-08-17W     4
1  2025-08-24W     6
2  2025-08-31W     3
3  2025-09-07W     7
```

A spike in run volume that coincides with a spike in run duration often points to queuing or resource
contention — your CI provider may be throttling concurrent jobs, or shared runners may be overloaded[^5].

### Job stability analysis

Not all jobs are equally reliable. Jobs that fail frequently or require reruns waste compute time and
delay feedback.

```bash
smm pipelines jobs-summary \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --workflow-path=".github/workflows/ci.yml"
```

Example output:

```text
              job_name  total_runs  avg_duration  success  failure  success_rate  failure_rate  reruns
0          acceptance          45          2.28       40        5          88.9          11.1       3
1                test          45          1.02       43        2          95.6           4.4       1
2               build          45          0.53       45        0         100.0           0.0       0
3            coverage          45          0.35       44        1          97.8           2.2       0
```

Jobs with high rerun counts or failure rates above 5% deserve investigation. Flaky jobs — those that
pass on retry without code changes — erode trust in the CI signal and increase the cognitive load
on developers who must re-trigger builds[^6][^7].

### Deployment frequency (DORA)

If you have configured deployment targets in `smm_config.json`, you can measure deployment frequency
— one of the four DORA metrics that characterize elite, high, medium, and low-performing teams[^8].

```bash
smm pipelines deployment-frequency \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --period week
```

Example output:

```text
         period  deployments  level
0  2025-08-17W            3   High
1  2025-08-24W            5   High
2  2025-08-31W            2   High
3  2025-09-07W            1  Medium
```

Elite performers deploy on-demand (multiple times per day), high performers deploy between once per
day and once per week, medium performers deploy between once per week and once per month, and low
performers deploy less than once per month[^8].

### Lead time for changes (DORA)

Lead time measures the time from code committed to code successfully running in production. It is the
other time-based DORA metric and is calculated from the pipeline execution data.

```bash
smm pipelines lead-time \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --weekends exclude
```

Example output (value in minutes):

```text
       value
0  45.200000
```

Elite performers achieve lead times under one hour, high performers under one day, medium performers
under one week, and low performers over one month[^8]. Lead time is a compound signal — it captures
the combined effect of pipeline duration, review latency, and deployment frequency.

### Reading the results together

Running each metric in isolation gives you numbers. Connecting them gives you decisions — a practice
grounded in empirical research on continuous integration and delivery practices[^1][^8][^9].

Start by pulling the full picture with the summary and duration commands, then cross-reference
with job-level and step-level data.

#### Run duration vs job time breakdown

Pipeline run duration is driven by both the slowest job on the critical path and the degree of
parallelization. A pipeline that has a single long job following several short, parallel ones is
bottlenecked by that job alone[^4].

| Run duration | Dominant job share | What it means | Action |
|---|---|---|---|
| High | > 60% from one job | Single job is the bottleneck. Pipeline time is effectively that job's time. | Drill into the job with `jobs-steps-time`. Optimize its slowest step or split the job into parallelizable pieces. |
| High | Distributed across jobs | Overall pipeline is slow, not just one job. May be queuing or resource contention. | Check if concurrency is limited by the CI provider. Increase parallel job slots or use self-hosted runners[^5]. |
| Low | > 60% from one job | Normal pipeline, but one job dominates even at low duration. | Keep monitoring. If that job grows over time, it will become a bottleneck. |
| Low | Distributed | Healthy pipeline. | Document the configuration as a baseline. |

#### Duration trend vs failure rate

Build duration and failure rate are correlated in both directions: longer builds fail more often,
and builds that fail frequently tend to be slower[^3][^10].

| Duration trend | Failure rate | What it means | Action |
|---|---|---|---|
| Rising | Rising | The pipeline is degrading. Longer runs and more failures form a feedback loop. | Audit recent pipeline changes. Revert or fix the cause. Build breakage is most common after CI configuration changes[^10]. |
| Rising | Stable | Pipeline is getting slower without quality degradation. More tests, larger codebase, or slower dependencies. | Profile the slowest steps. Consider caching, incremental builds, or test parallelization. Build time increases naturally with project size but should not outpace it linearly[^4]. |
| Stable | Rising | Flaky tests or unstable dependencies are increasing failure count without affecting duration. | Run `jobs-summary` to find flaky jobs. Isolate flaky tests. Flaky tests are a leading indicator of CI abandonment[^6][^7]. |
| Stable | Stable | Healthy pipeline. | Baseline recorded. Set up a dashboard saved view to track this. |

#### Throughput vs run duration

High pipeline throughput is desirable, but it can mask congestion. Compare `runs-by` volume against
`runs-duration` trends.

| Run volume | Duration trend | What it means | Action |
|---|---|---|---|
| High | Stable | CI infrastructure handles load well. | No action needed. |
| High | Rising | Queuing or resource saturation. More runs competing for shared resources. | Increase runner capacity, split workloads across multiple workflows, or stagger cron-scheduled pipelines. Queue time accounts for more than 30% of total pipeline time in resource-constrained environments[^5]. |
| Low | Rising | Runs are taking longer for reasons unrelated to volume. Codebase growth, more tests, or slower dependencies. | Profile the jobs. Compare against historical baselines. |
| Low | Stable | Low activity, healthy pipeline. | Expected for maintenance-mode projects. No action needed. |

#### Deployment frequency vs lead time

DORA research shows that deployment frequency and lead time are the two metrics most strongly
correlated with organizational performance[^8]. They should move together:

| Deployment frequency | Lead time | What it means | Action |
|---|---|---|---|
| High | Low | Elite/high-performing team. Fast feedback, fast recovery. | Maintain the practice. Continuous delivery is a muscle — it atrophies when not used regularly[^9]. |
| High | High | Deploying frequently but each deployment takes a long pipeline to validate. | Shorten the pipeline. Split deployment validation into pre-merge and post-merge stages. Pre-merge checks should be fast (< 10 min), post-merge can be more thorough[^8]. |
| Low | Low | Deploying rarely but pipeline is fast when it runs. | Increase deployment frequency. The biggest barrier is often organizational, not technical — manual approval gates and change advisory boards are the top blockers[^9]. |
| Low | High | Low-performing team by DORA standards. Long pipelines, infrequent deploys. | Start with the pipeline: reduce duration by targeting the slowest job. Then increase deployment frequency by removing manual gates. Elite performers have automated their entire deployment pipeline[^8]. |

#### Job stability signal

Use `jobs-summary` rerun counts as a leading indicator of pipeline health. Jobs that pass only after
multiple retries indicate flakiness, which drives up total pipeline duration and erodes confidence.

| Rerun rate | Success rate | What it means | Action |
|---|---|---|---|
| > 10% | < 90% | Highly unstable job. The CI signal is unreliable. | Quarantine the job. Fix the root cause (flaky tests, network-dependent steps, race conditions) before trusting it again. Flaky tests are the top reason developers disable CI checks[^6]. |
| 5–10% | 90–95% | Moderate instability. Acceptable if transient, but trending in the wrong direction. | Investigate. A single flaky test can account for most reruns[^7]. |
| < 5% | > 95% | Stable job. | Expected. A small amount of infrastructure-related flakiness (network timeouts, disk issues) is normal in shared CI environments. |
| 0% | 100% | Perfectly stable. | Rare. Verify that the job is actually testing something meaningful — jobs that never fail may not be asserting the right conditions. |

#### Quick decision checklist

After running the commands above, walk through these five questions with the combined data:

1. **Is run duration rising while job volumes stay flat?** → Codebase growth or dependency slowdown. Profile jobs[^4].
2. **Does one job account for more than half the pipeline time?** → Single-job bottleneck. Optimize or split it.
3. **Are rerun counts above 5% for any job?** → Flakiness problem. Quarantine and fix before trust erodes[^6].
4. **Does deployment frequency fall below once per week?** → Throughput bottleneck. Check pipeline duration and manual approval gates[^8].
5. **Is lead time above one day with a fast pipeline?** → Bottleneck is outside CI — check review latency and merge queues. Lead time is end-to-end: commit to production[^8].

## References

[^1]: Hilton, M., Tunnell, T., Huang, K., Marinov, D., & Dig, D. (2016). Usage, costs, and benefits of continuous integration in open-source projects. *Proceedings of the 31st IEEE/ACM International Conference on Automated Software Engineering (ASE)*, 426–437. ACM.

[^2]: Vasilescu, B., Yu, Y., Wang, H., Devanbu, P., & Filkov, V. (2015). Quality and productivity outcomes relating to continuous integration in GitHub. *Proceedings of the 2015 10th Joint Meeting on Foundations of Software Engineering (ESEC/FSE)*, 805–816. ACM.

[^3]: Rausch, T., Hummer, W., Leitner, P., & Schulte, S. (2017). An empirical analysis of build failures in the continuous integration workflows of Java-based open-source software. *Proceedings of the 14th International Conference on Mining Software Repositories (MSR)*, 345–355. IEEE.

[^4]: Ghaleb, T. A., da Costa, D. A., & Zou, Y. (2019). An empirical study of the long duration of continuous integration builds. *Proceedings of the 16th International Conference on Mining Software Repositories (MSR)*, 224–234. IEEE.

[^5]: Beller, M., Gousios, G., & Zaidman, A. (2017). Oops, my tests broke the build: An explorative analysis of Travis CI with GitHub. *Proceedings of the 14th International Conference on Mining Software Repositories (MSR)*, 356–367. IEEE.

[^6]: Luo, Q., Hariri, F., Eloussi, L., & Marinov, D. (2014). An empirical analysis of flaky tests. *Proceedings of the 22nd ACM SIGSOFT International Symposium on Foundations of Software Engineering (FSE)*, 643–653. ACM.

[^7]: Lam, W., Oei, R., Shi, A., Marinov, D., & Xie, T. (2019). iDFlakies: A framework for detecting and partially classifying flaky tests. *Proceedings of the 12th IEEE Conference on Software Testing, Validation and Verification (ICST)*, 312–322. IEEE.

[^8]: Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps*. IT Revolution Press.

[^9]: Leppänen, M., Mäkinen, S., Pagels, M., Eloranta, V. P., Itkonen, J., Mäntylä, M. V., & Männistö, T. (2015). The highways and country roads to continuous deployment. *IEEE Software*, 32(2), 64–72. IEEE.

[^10]: Kerzazi, N., Khomh, F., & Adams, B. (2014). Why do automated builds break? An exploratory study. *Proceedings of the 2014 IEEE International Conference on Software Maintenance and Evolution (ICSME)*, 41–50. IEEE.

## Dashboard

The same metrics are available in the Pipelines dashboard tab. After fetching the data, start the dashboard:

```bash
smm dashboard serve
```

Then open `http://localhost:3000/dashboard/pipelines`. The tab shows:

- **Total runs summary**: total runs, success/failure counts, success rate, average duration.
- **Pipeline Runs Duration**: time series of run durations with Min-Max Range, Job Breakdown, and Runs by Day sub-tabs.
- **Jobs Average Time**: average job execution time viewable by job or by day.
- **Job Reruns**: reruns-by-day chart plus a jobs summary table with rerun counts, average duration, and success/failure rates.
- **Jobs by Status**: jobs grouped by conclusion status.
- **Job Steps Analysis**: when exactly one job is selected in the filters, step-level duration by day, time proportion by step, and a sortable steps table.

The dashboard applies the same date, workflow, job, branch, status, and conclusion filters used throughout SMM.
See [Dashboard](../features/dashboard.md) for shared filter, timezone, and saved-view behavior.
