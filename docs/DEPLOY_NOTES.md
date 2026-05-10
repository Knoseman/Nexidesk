# Deployment Notes

## Builder: RAILPACK (migrated from NIXPACKS)

The service uses **RAILPACK** (Railway's current default builder). `railway.toml` sets `builder = "railpack"` explicitly so this is always in sync with the dashboard.

**Why `preDeployCommand` for migrations:** The migration step (`node scripts/migrate.mjs`) runs in `preDeployCommand`, not chained inside `startCommand`. This is idiomatic for Railpack and safer — if the migration fails, the new container is never promoted, so the running container stays live.

---

## If deploys get stuck in QUEUED again

Check `railway status --json` on the latest queued deploy. Look for these fields in `meta`:

- **`configFile: "/railway.toml"`** → toml is being read ✓
- **`builder: "NIXPACKS"` or no `configFile`** → toml is NOT being read ✗

If the toml is ignored, the root cause is that the dashboard service-level builder has been changed to something that conflicts with `railway.toml`. The fix:

```bash
# 1. Cancel the stuck deploy (replace DEPLOY_ID)
curl -s -X POST https://backboard.railway.app/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { deploymentCancel(id: \"<DEPLOY_ID>\") }"}'

# 2. Reset service-level builder to RAILPACK so it aligns with railway.toml
curl -s -X POST https://backboard.railway.app/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation U($s: String!, $e: String!, $i: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $s, environmentId: $e, input: $i) }","variables":{"s":"1c87ccc9-1cee-496e-917c-aeb56f739ccf","e":"d2657745-5db0-4689-b681-195e67c2f7b2","i":{"builder":"RAILPACK"}}}'

# 3. Redeploy
railway redeploy --service Nexidesk --yes
```

**GraphQL endpoint:** `https://backboard.railway.app/graphql/v2` with header `Project-Access-Token` (not `Bearer`, not `backboard.railway.com`).

**IDs for reference:**
- Project: `e98b4436-4641-423d-acc4-6bfdf6627d05` (vibrant-expression)
- Service: `1c87ccc9-1cee-496e-917c-aeb56f739ccf` (Nexidesk)
- Environment: `d2657745-5db0-4689-b681-195e67c2f7b2` (production)
