---
name: e2e-testing
description: Verify a user journey across browser, authentication and service boundaries.
starred: false
critical: false
tags: [e2e-testing]
roles: []
---

# E2E Testing

Write the journey as entry action, authentication steps, intermediate boundaries and final visible result. Identify the actual client: browser, mobile app, command line or API consumer. Run the check through that client and the same route shape used by the deployment.

Use isolated test accounts and synthetic data. Cover the successful path plus relevant anonymous, wrong-tenant, expired-session or denied-role paths. Never record credential values in screenshots, traces or logs. Keep test cleanup scoped to records created by the test.

Assert the final route and visible content, required successful network requests, persisted state after reload, and absence of the known failure. A healthy HTTP status alone does not establish that a browser rendered or authenticated correctly.

Capture source version, environment, role shape and outcome. Separate a component-level check from an end-to-end result. When a dependency prevents verification, identify the missing boundary and do not claim that the complete journey passed.
