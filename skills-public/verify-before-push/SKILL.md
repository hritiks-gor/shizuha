---
name: verify-before-push
description: Run the repository gates on the exact source intended for review.
starred: false
critical: false
tags: [verify-before-push]
roles: []
---

# Verify Before Push

Discover CI's commands, supported toolchain and required services from the checked-in workflow and contributor documentation. Reproduce that environment in an isolated workspace when a build could affect an active installation.

Run static checks, imports or compilation, migrations where relevant, and the complete required test suite through the project's scripts. A focused test accelerates iteration but does not replace the required gate. Record the source revision and test invocation; rerun affected checks after changing the tested tree.

For stateful behavior, exercise the real caller sequence, including reset and retry boundaries. For a dependency update, test its actual consumer interface. Prove negative-test instruments can detect a known failure before trusting an empty result.

Inspect the final diff and status before committing. Do not include generated credentials, captured user data or unrelated edits. Report failures honestly and repair them before claiming the gate passed. Publication and deployment require the authorization and process appropriate to the repository.
