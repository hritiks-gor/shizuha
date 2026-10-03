---
name: async-frontends
description: Design responsive pages with independent loading and error states.
starred: false
critical: false
tags: [async-frontends]
roles: []
---

# Async Frontends

Render useful navigation and a stable page shell while data loads. Fetch independent resources concurrently and let each section display its own loading, success, empty and error states. Reserve layout space so late data does not move essential controls unexpectedly.

Cancel obsolete requests or ignore stale responses when the user changes route or selection. Distinguish an empty successful response from a failed request. Expose a retry action and show whether cached data is stale rather than presenting it as current.

Keep slow enrichment out of the initial request path. Bound remote calls, avoid per-row request amplification, and cache only where authorization and invalidation rules are explicit. Never reuse cached data across tenants without a safe cache key and access check.

Test slow, failed and out-of-order responses in the browser. Verify keyboard navigation, readable status announcements and usable controls while requests are pending. Measure the user's time to useful content, not just backend response time.
