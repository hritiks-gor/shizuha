# Public skills distribution

`skills-public/` contains twelve original, standalone guides under AGPL-3.0-or-later. Each
`SKILL.md` is pinned by SHA-256 in `manifest.json`. The public manifest contains
only distributed skills and public provenance. No private catalog inventory or
operational recovery material is part of it.

Run `node scripts/materialize-public-skills.mjs --check` after editing. Review
the changed body and digest together. The validator rejects unexpected files,
symlinks, duplicate names and mismatched content. The full CI gate runs it before
building. The public image workflow materializes a new `.runtime-skills` directory
and requires the manifest's nonzero count plus `skill-loader`, `engineering-core`
and `verify-before-push`. The internal image's catalog and qualification defaults
are unchanged.

The node build copies the same catalog to `dist/skills/public`. Standalone daemon
startup installs it without network access. Existing Git skill checkouts remain
managed by their own origin; bundled content does not modify those checkouts.

## Runtime synchronization

When automatic skill synchronization is enabled, the daemon uses these rules:

* A Git checkout with an `origin` keeps that origin, branch and history. A dirty
  checkout is skipped; a clean checkout can only fast-forward. A public override
  never redirects it.
* A missing directory, plain bundled directory or originless Git checkout uses
  a separate cached checkout of `https://github.com/shizuha-labs/shizuha.git`,
  branch `master`, subtree `skills-public`. Only verified skill bodies are copied
  into `~/.shizuha/skills`; application files and Git metadata are not copied.
  Originless local history and remote configuration stay unchanged.
* `SHIZUHA_SKILLS_SYNC_REPO`, `SHIZUHA_SKILLS_SYNC_BRANCH` and
  `SHIZUHA_SKILLS_SYNC_SUBDIR` select another reviewed catalog source. An override
  must contain the same manifest format; use subdirectory `.` for a catalog at
  the repository root. Git receives separate arguments, never shell interpolation.
* `~/.shizuha/public-skills-state.json` records installed hashes. Updates replace
  only absent, identical or previously installed unedited entries. Local edits,
  extra files and symlinks are preserved. Skills removed upstream are retained
  locally so synchronization never silently deletes user configuration.
* An invalid manifest, unsafe subtree, failed fetch, dirty cache or divergent
  history fails without resetting local skills. Errors omit upstream URLs and
  Git output, which may contain credentials. The next regular pass retries.

To manage a colliding skill yourself, edit its body; subsequent public updates
will preserve it. To resume managed updates, back up the local version and remove
that skill directory explicitly. Do not edit the cache to customize a skill.

Real-Git regression tests cover missing/plain/originless installations, explicit
overrides, private origins, dirty and divergent history, local edits, failed
fetch recovery, manifest tampering, unsafe links and subtree traversal.
