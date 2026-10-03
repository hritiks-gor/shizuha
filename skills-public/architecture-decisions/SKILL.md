---
name: architecture-decisions
description: Record a consequential design choice with alternatives and tradeoffs.
starred: false
critical: false
tags: [architecture-decisions]
roles: []
---

# Architecture Decisions

Create a decision record when a choice affects interfaces, data ownership, reliability, security or substantial future cost. Start with the problem, constraints and evidence; do not write a justification for a decision already assumed to be correct.

Compare plausible alternatives against the same criteria. Include operational behavior, migration effort, failure handling and reversibility. Distinguish measured facts from assumptions that need validation.

Record the selected option, rationale, consequences, owner and status. State compatibility obligations and the rollout, observation and rollback plan when the choice changes a running system. Link tests or experiments that validate the important assumptions.

Keep the original decision history. If later evidence changes the choice, supersede the record with a linked replacement rather than silently rewriting the rationale. Keep examples free of private credentials and user data; put sensitive operational details in an appropriately restricted document.
