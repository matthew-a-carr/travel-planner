# SPEC-031: Data Export

## Status: Implemented

## Summary
Add CSV export functionality for user data tables.

## Deviation
The BOM prefix was omitted from the CSV export to keep the implementation simple. Reported by a Windows user using Excel 2016 that columns are not separated correctly when opening the file directly.

## Acceptance Criteria
- CSV exports include all table columns
- File is downloadable from the UI
- Compatible with common spreadsheet applications
