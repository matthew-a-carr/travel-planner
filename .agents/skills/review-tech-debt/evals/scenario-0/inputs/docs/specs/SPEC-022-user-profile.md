# SPEC-022: User Profile Page

## Status: Implemented with deviation

## Summary
Redesign the user profile page to allow richer bio content including markdown.

## Deviation
Input sanitisation for the bio field was deferred pending decision on which markdown library to use. The field currently renders raw HTML from user input.

## Acceptance Criteria
- Bio field renders sanitised markdown
- XSS prevention in place
- 500-character limit enforced
