---
outline: deep
---

# Pull Request Review Process

Understanding how your team reviews pull requests is critical for identifying bottlenecks, balancing workload,
and improving delivery speed. This investigation walks through data collection and analysis of PR review metrics using
Software Metrics Machine.

## Target project

The project used is [json-tool](https://github.com/marabesi/json-tool), an open-source project with moderate activity
that provides enough PR data for a realistic review-process analysis.

## Data collection

Before analyzing review metrics, fetch the PR data from the provider and then fetch the review comments attached to
each PR. Pull requests must be fetched first because comments are retrieved per-PR using the data already stored.

### Fetch pull requests

```bash
smm prs fetch --start-date 2025-08-17 --end-date 2025-11-17
```

This retrieves every PR created in the three-month window. By default, SMM caches fetched data so subsequent runs
are fast unless you pass `--force`.

### Fetch PR comments

```bash
smm prs fetch-comments --start-date 2025-08-17 --end-date 2025-11-17
```

Comments are linked to the PRs already fetched. The date range filters on the PR creation date, not the comment date.

## Analysis

With the data in place, run the analysis commands below. Each command reads the cached data — no network calls are
needed unless you force a re-fetch.

### Review time by author

Review time measures how long it takes from PR open to merge, grouped by author. This reveals whose PRs spend
the most time in review. Uses the `--method` option to select the statistical measure.

```bash
smm prs review-time \
  --method average \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --top 5 \
  --weekends exclude
```

Example output (values in days):

```text
           name   value   count
0         alice    1.50      12
1           bob    3.20       8
2       charlie    2.10      15
3         david    0.80      10
4           eve    4.50       6
```

Use `--method median` to avoid skew from outliers, or `--method p90` for SLA tracking ("90% of PRs reviewed within X
days"). Use `--weekends exclude` to focus on business-day review times. Use `--outlier-mode flag` to surface PRs that
took unusually long without removing them from the metric. See
[Statistical method, outliers and weekend filtering](../features/prs.md#statistical-method-outliers-and-weekend-filtering) for details.

### PR open time

Open time tracks how long PRs stay open before they are merged or closed, aggregated by week or month.

```bash
smm prs open-time \
  --method average \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --aggregate-by week \
  --weekends exclude
```

Example output (values in days, one row per week):

```text
         period  value  count
0  2025-08-17W    2.30      5
1  2025-08-24W    1.80      7
2  2025-08-31W    3.10      4
3  2025-09-07W    1.50      6
```

A rising trend in average open time over several weeks may signal increased review load, larger PRs, or reviewer
availability gaps.

### Comments per PR

Comments per PR measures how much discussion each pull request attracts before it lands.

```bash
smm prs comments \
  --method average \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --aggregate-by week
```

Example output:

```text
         period  value  count
0  2025-08-17W    4.20      5
1  2025-08-24W    3.80      7
2  2025-08-31W    5.10      4
```

A high comment average can indicate thorough reviews or contentious changes. Very low averages may suggest
superficial review practices.

### PR throughput over time

Throughput shows the volume of PRs opened and closed each day, helping you spot balance between creation and
closure rates.

```bash
smm prs through-time \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --aggregate-by week
```

Example output:

```text
         period  opened  closed
0  2025-08-17W       5       3
1  2025-08-24W       7       8
2  2025-08-31W       4       6
3  2025-09-07W      10       5
```

When `opened` consistently exceeds `closed` over several periods, the PR backlog grows. This is the earliest
signal that review capacity needs attention.

### PR summary

A high-level snapshot gives you totals and status distribution for the entire period at a glance.

```bash
smm prs summary \
  --start-date 2025-08-17 \
  --end-date 2025-11-17
```

Example output:

```text
=== Pull Requests Summary ===
Total PRs:          42
Merged:             35
Closed:              4
Open:                3
First PR:           2025-08-17
Last PR:            2025-11-16
```

### Reading the results together

Running each metric in isolation gives you numbers. Connecting them gives you decisions — a practice
grounded in a decade of empirical software engineering research on modern code review[^1][^2].

Start by pulling everything into one time-series view:

```bash
smm prs by-month \
  --start-date 2025-08-17 \
  --end-date 2025-11-17
```

Each row carries totals, review time, open time, and comment counts per month. With all metrics side by side,
cross-reference them to understand what is really happening.

#### Review time vs comments per PR

Review latency is driven by both technical factors (PR size, test failures) and social factors (reviewer
availability, author reputation)[^3][^4].

| Review time | Comments | What it means | Action |
|---|---|---|---|
| High | High | PRs spark discussion, not neglect. Review is active but content may be complex. | Check if PRs are too large — review effectiveness drops sharply above 200–400 changed lines[^5][^6]. Consider smaller, incremental changes. |
| High | Low | PRs are sitting un-reviewed. Bottleneck is reviewer availability, not PR quality. | Add reviewers, set review SLAs, or rotate review duty. Teams that enforce review turnaround expectations show lower latency[^7]. |
| Low | High | Efficient, engaged reviews. Discussion happens without delaying merges. | This is the target. Google's data shows median review latency under 4 hours with thorough discussion is achievable at scale[^8]. Reinforce the practice. |
| Low | Low | Merges happen with little scrutiny. May indicate rubber-stamp reviews. | Audit a sample of merged PRs for defect density. Review quality correlates with the number of useful comments, not just any comment[^9]. |

#### Throughput vs open time

Compare the weekly `through-time` table (opened vs closed columns) against the `open-time` trend.
High-performing teams balance throughput with stability — a pattern documented in the DORA research
program[^10].

| Throughput gap | Open time trend | What it means | Action |
|---|---|---|---|
| Opened > closed | Rising | Backlog is growing and PRs are taking longer. Capacity problem. | Add reviewers or reduce WIP by limiting concurrent PRs per author. PR latency increases with the number of concurrently open PRs[^4]. |
| Opened > closed | Stable | Team is absorbing the volume, but closure rate lags. | Temporary — monitor next period. Sustained imbalance predicts rising latency[^3]. |
| Balanced | Rising | Fewer PRs but they are larger or more complex. | Check average PR diff size. PR size is the strongest predictor of review latency across studies[^4][^5]. Encourage smaller PRs. |
| Balanced | Stable | Healthy process. | Document what is working and guard it. Continuous delivery performers recover from failures faster and deploy more frequently[^10]. |

#### Author workload balance

Overlay `review-time` (by author) with `by-author` (PR count). Concentrated code ownership
increases review bottlenecks and correlates with higher post-release defect rates[^11].

```bash
smm prs review-time \
  --method average \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --top 10

smm prs by-author \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --top 10
```

| PR count | Review time | What it means | Action |
|---|---|---|---|
| High | High | One author carries heavy load and waits long for reviews. Risk of burnout and knowledge silos. | Distribute work. Pair the author with a dedicated reviewer. Teams with broader code ownership ship faster[^11]. |
| High | Low | High-output author with fast reviews. | Recognize the contributor. Check if other authors need support — reviewer expertise is a key latency factor[^4]. |
| Low | High | The author's PRs may be complex or touch sensitive areas with few qualified reviewers. | Review PR scope. Offer mentoring for tricky code areas. Reviewer recommendation systems can help match PRs to available expertise[^12]. |
| Low | Low | Infrequent contributor with trivial changes. | Expected pattern. No action needed. |

#### Quick decision checklist

After running the commands above, walk through these four questions with the combined data:

1. **Is review time rising while comments stay flat?** → Reviewer capacity issue. Add reviewers[^7].
2. **Is the throughput gap widening every week?** → Backlog forming. Cap concurrent PRs[^4].
3. **Does one author dominate both PR count and review wait time?** → Workload imbalance. Rebalance[^11].
4. **Are comments per PR trending up while open time trends down?** → The team is getting better at review. Celebrate it[^8].

## References

[^1]: Bacchelli, A., & Bird, C. (2013). Expectations, outcomes, and challenges of modern code review. *Proceedings of the 35th International Conference on Software Engineering (ICSE)*, 712–721. IEEE.

[^2]: Rigby, P. C., & Bird, C. (2013). Convergent contemporary software peer review practices. *Proceedings of the 2013 9th Joint Meeting on Foundations of Software Engineering (ESEC/FSE)*, 202–212. ACM.

[^3]: Gousios, G., Pinzger, M., & van Deursen, A. (2014). An exploratory study of the pull-based software development model. *Proceedings of the 36th International Conference on Software Engineering (ICSE)*, 345–355. ACM.

[^4]: Yu, Y., Wang, H., Filkov, V., Devanbu, P., & Vasilescu, B. (2015). Wait for it: Determinants of pull request evaluation latency on GitHub. *Proceedings of the 12th Working Conference on Mining Software Repositories (MSR)*, 367–371. IEEE.

[^5]: Baysal, O., Kononenko, O., Holmes, R., & Godfrey, M. W. (2016). Investigating technical and non-technical factors influencing modern code review. *Empirical Software Engineering*, 21(3), 932–959. Springer.

[^6]: Weissgerber, P., Neu, D., & Diehl, S. (2008). Small patches get in! *Proceedings of the 2008 International Working Conference on Mining Software Repositories (MSR)*, 67–76. ACM.

[^7]: MacLeod, L., Greiler, M., Storey, M. A., Bird, C., & Czerwonka, J. (2018). Code Reviewing in the Trenches: Challenges and Best Practices. *IEEE Software*, 35(4), 34–42. IEEE.

[^8]: Sadowski, C., Söderberg, E., Church, L., Sipko, M., & Bacchelli, A. (2018). Modern code review: a case study at Google. *Proceedings of the 40th International Conference on Software Engineering: Software Engineering in Practice (ICSE-SEIP)*, 181–190. ACM.

[^9]: Kononenko, O., Baysal, O., & Godfrey, M. W. (2016). Code review quality: how developers see it. *Proceedings of the 38th International Conference on Software Engineering (ICSE)*, 1028–1038. ACM.

[^10]: Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps*. IT Revolution Press.

[^11]: Thongtanunam, P., McIntosh, S., Hassan, A. E., & Iida, H. (2016). Revisiting code ownership and its relationship with software quality. *Proceedings of the 38th International Conference on Software Engineering (ICSE)*, 519–530. ACM.

[^12]: Rahman, M. M., Roy, C. K., & Collins, J. A. (2016). CORRECT: code reviewer recommendation in GitHub based on cross-project and technology experience. *Proceedings of the 38th International Conference on Software Engineering Companion (ICSE)*, 222–231. ACM.

## Dashboard

The same metrics are available in the Pull Requests dashboard tab. After fetching the data, start the dashboard:

```bash
smm dashboard serve
```

Then open `http://localhost:3000/dashboard/prs`. The tab shows:

- **Average Review Time**: review speed grouped by author.
- **Open PRs Through Time**: opened and closed PR volume over time.
- **Average Days PRs Remain Open**: trend of how long PRs stay open.
- **Average Comments per PR**: comment depth trend.
- **Who Comments The Most**: which reviewers contribute the most feedback.
- **Time To First Comment**: responsiveness of the review process.

The dashboard applies the same date, author, label, and status filters used throughout SMM. See
[Dashboard](../features/dashboard.md) for shared filter, timezone, and saved-view behavior.

<!--
## Findings

Based on the analysis above for the json-tool repository (August to November 2025):

1. Review time varies significantly by author — PRs from some authors took 2–3x longer than others.
   This may indicate PR size differences or domain complexity, not necessarily review neglect.
2. The weekly open time trend was stable around 2 days, which is reasonable for a solo-maintainer project.
3. Comment counts were moderate (3–5 per PR), suggesting engaged but not excessive review discussion.
4. Throughput showed periods where opened PRs outnumbered closed ones, suggesting review backlog buildup
   during active development phases.

Recommendations:
- Watch the throughput chart for sustained divergence between opened and closed counts.
- Use the dashboard's author filter to drill into outliers detected by `--outlier-mode flag`.
- Run `smm prs fetch-comments --force` before comment-backed analyses when PR data has been re-fetched.
-->
