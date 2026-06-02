# Production Deploy Verification Script

## Problem/Feature Description

Your team uses Vercel for production deployments and needs a repeatable way to confirm a deploy landed cleanly after merging to `main`. The site is `https://travel.matthewcarr.dev` and the Vercel project is already linked locally (the CLI is authenticated). Right now the post-deploy check is done manually and inconsistently — sometimes engineers forget to verify commit alignment, sometimes they just check that the homepage loads.

You need to produce a shell script (`smoke-test.sh`) that automates the full post-merge production verification sequence. The script should be runnable by any engineer on the team after they push to `main`. It should output a structured summary so it's easy to see at a glance what passed and what failed.

## Output Specification

Produce a file named `smoke-test.sh` that:

- Can be run with `bash smoke-test.sh` with no required arguments
- Performs the full sequence of checks needed to confirm a production deploy
- Prints results in a clear structured format showing what was checked and the outcome of each check
- Exits with a non-zero code if any critical check fails

Do not hard-code any bearer tokens or secrets in the script.
