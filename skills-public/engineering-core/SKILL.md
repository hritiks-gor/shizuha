---
name: engineering-core
description: Implement a source change with evidence, scoped edits and verification.
starred: false
critical: false
tags: [engineering-core]
roles: []
---

# Engineering Core

Read the relevant code, callers, tests and repository instructions before editing. Establish the concrete behavior to change and the observable result that will demonstrate success. Inspect the working tree and preserve unrelated work.

For a defect, reproduce the failure at its originating layer. Follow data and control flow through the real caller before selecting a fix. Prefer one coherent mechanism change with a regression test that fails on the old behavior and passes on the corrected behavior. Include a clean-path control and relevant boundary cases.

Use the project's own build and test commands. Do not weaken assertions or suppress a failure merely to obtain a green run. If a check fails, distinguish invocation problems from product defects with evidence.

Review the final diff for unintended changes, sensitive data and compatibility. Explain what changed, how it was verified, and any remaining limitation. Follow the repository's existing review and deployment process; do not invent permission to publish or deploy.
