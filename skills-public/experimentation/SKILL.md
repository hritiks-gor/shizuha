---
name: experimentation
description: Design a reversible product experiment and decide from its evidence.
starred: false
critical: false
tags: [experimentation]
roles: []
---

# Experimentation

Write the hypothesis, affected segment, proposed change and expected user outcome. Choose one primary metric and guardrails for reliability, accessibility, privacy and user trust. Establish the baseline, observation window and stopping rules before collecting results.

Choose the smallest valid method: usability session, prototype, staged rollout or randomized comparison. For randomized tests, keep assignment stable at the appropriate unit and track actual exposure. Avoid overlapping experiments that interfere with the same outcome.

Check instrumentation and sample limitations. Do not repeatedly peek and declare success at the first favorable result. Report uncertainty and distinguish planned segment analysis from exploratory observations. Small samples often support qualitative learning better than precise causal claims.

Stop or roll back when guardrails fail. Record the decision to ship, revise, investigate further or abandon, together with the evidence and limits. An experiment does not waive the application's security or accessibility requirements.
