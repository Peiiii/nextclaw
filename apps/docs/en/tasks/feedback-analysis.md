# Analyze customer feedback and prioritize issues

Give NextClaw exported tickets, survey responses, conversation logs, interview notes, or app-store reviews. It can merge duplicate issues, count themes, and connect each conclusion to source evidence.

## Prepare

- CSV, spreadsheet, text, or message exports;
- date range, product version, and user segment;
- any existing taxonomy or team priorities;
- privacy and redaction requirements;
- desired table, report, or dashboard format.

Create a redacted copy before processing names, contact details, or sensitive business information. Confirm that the selected model and tools may receive the data.

## Example prompt

<div class="nc-task-prompt">
  <p>Analyze feedback-july.xlsx. Remove names and contact details, group feedback by specific problem, and merge equivalent wording. Count each group, affected user segments, and product versions. Keep three anonymous examples for the top ten issues. Create a priority table and HTML report without modifying the source file.</p>
</div>

## What happens

The agent checks fields and privacy data, proposes a category level, clusters and counts the feedback, preserves anonymous evidence and source rows, and creates a report.

## Review the result

Check that distinct problems were not merged, frequency was not treated as the only priority signal, examples support each summary, versions and severity remain visible, and redaction is complete.

Package stable categories and scoring as a skill, then use a [scheduled task](/en/guide/cron) for recurring analysis.
