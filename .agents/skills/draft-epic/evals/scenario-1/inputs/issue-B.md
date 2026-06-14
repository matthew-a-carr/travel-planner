# Issue B: Add CSV Export to Reports

**Label**: ai:plan-epic  
**Number**: #202  
**Strategic ADR**: N/A

## Vision

Users need to export their analytics reports as CSV files so they can do further analysis in spreadsheet tools. Add a CSV export button to the reports dashboard.

## Scope

- Add "Export as CSV" button to the reports UI
- Implement a `/api/reports/:id/export?format=csv` endpoint
- Stream the CSV response for large reports

## Rough slices

This is a self-contained feature that a single engineer can deliver in a sprint.
