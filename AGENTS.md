## Learned User Preferences

- When the organization default currency changes, surface that bulk product updates change only the currency code, not converted amounts; users should review prices afterward.
- In the template designer, changing print margins should reflow or shrink elements only when the inner printable area shrinks on at least one axis; if the printable area grows or stays the same in both dimensions (for example margins 1in to 0), element positions should stay unchanged.

## Learned Workspace Facts

- Firestore rules require `product.currency` to match the organization’s `settings.defaultCurrency` for product creates and updates; mismatched legacy products fail updates until currency is aligned or synced.
- Designer canvas and renderers treat element `x`/`y` as page-absolute; the printable frame is an overlay, so save-time remapping that scales positions into the printable rectangle can distort layouts unless gated by printable-area shrink logic.
- Callable functions `verifyClerkToken` and `verifyAdminClerkToken` are configured with elevated memory and `minInstances: 1` because the default 256 MiB limit was exceeded under Node 22 with firebase-admin and Clerk verification.
- If `functions/lib/` is owned by root (often from Docker or sudo builds), local `npm run build` and Firebase predeploy can fail with EACCES; fix ownership or remove `lib` and rebuild as a normal user.
