---
name: skill-builder
description: Author a reusable skill with clear scope, triggers and safe references.
starred: false
critical: false
tags: [skill-builder]
roles: []
---

# Skill Builder

Search the existing catalog before creating a skill. Prefer extending a well-scoped owner over duplicating the same rule in several places. A skill should solve a recognizable class of tasks and state when it applies.

Use frontmatter with name, description, starred, critical, tags and roles. Choose a stable kebab-case name and a concise trigger description. Default starred and critical to false so the body loads on demand. Promote an instruction to always-loaded only when the host's documented policy requires it.

Write prerequisites, concrete steps, completion evidence and relevant failure handling. Keep examples synthetic and independent of private accounts, credentials or infrastructure. Reference supporting resources using portable relative paths, and verify every referenced file is distributed.

Test the skill against a representative task and a case where it should not apply. Confirm that a reader can complete the task without hidden organizational context. Update the catalog and content digest when the body changes; respect the host application's instruction hierarchy.
