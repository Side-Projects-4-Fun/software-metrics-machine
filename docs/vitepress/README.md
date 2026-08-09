# Software Metrics Machine

## A Data-Driven Approach to High-Performing Teams

Agile software development has become a dominant practice, but many teams struggle to consistently deliver high-value
software. While story points and code maintainability metrics (like SonarQube) provide a starting point, they often
miss crucial factors like team dynamics, waiting times, code churn, and the impact of knowledge silos. Metrics Machine
is designed to fill in these gaps by providing a comprehensive set of metrics that reflect the health of your development
process.

## Why Metrics Machine?

We believe that the success of an Agile team is directly tied to the speed and quality with which value is delivered to
production. Software Metrics Machine provides insights beyond traditional metrics.

## Philosophy Drivers

* Continuous Feedback Loops: A constant cycle of observation, analysis, and adjustment is essential.
* Pipeline Health: Maintain a consistently green and stable development pipeline.
* Controlled Code Churn: Minimize unnecessary code changes, as they often indicate underlying issues.
* Knowledge Sharing: Actively avoid knowledge silos 
* Data-Based Technical Debt: Define and prioritize technical debt based on *real* data and impact.

## Facets

This project relies on metrics that are extracted from:

* Pipeline
  * Success rate of pipeline 
  * Average time to complete pipeline from start to finish 
* Change requests
  * Average of Change requests opened 
* Git history
  * Code churn  
  * Hotspots  
  * Change Frequency 
  * Complexity Trends Over Time 

## Getting started

This section provides the needed configuration to get started with Metrics machine, it requires knowledge of env variables and python ecosystem tools.

### Environment requirements

* python 3.10+
* poetry installed --no-root

### MacOs

If you are on a mac, you can easily install them using the following commands:
```