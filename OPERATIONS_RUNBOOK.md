# SmartScan operations runbook

This runbook describes response procedures once production infrastructure has
been provisioned. It is not evidence that the current Sepolia/local setup is a
production deployment. Never put private keys, database URLs, or provider keys in
incident notes or chat.

## Routine service checks

- API liveness: `GET /healthz`. A 200 means the process is responding; it does
  not mean its dependencies are healthy.
- API readiness: `GET /readyz`. A 200 means PostgreSQL, the production Redis
  rate-limit store, the latest database migration shipped with this code, the
  media bucket, the configured chain ID, and contract bytecode were checked.
  Remove the instance from traffic on a non-200 response.
- Run one supervised API process group and a separate supervised reconciler:
  `npm start` and `npm run reconcile:worker` from `smartscan-backend-node`.
  Configure automatic restart, graceful SIGTERM, log collection, and alerts on
  process exit. PostgreSQL advisory locking prevents two workers from running
  reconciliation concurrently against the same database. SIGTERM completes the
  current reconciliation pass, wakes the worker from its interval wait, releases
  the advisory lock, and closes its database/provider resources.
- Run the supervised `npm run scan-retention:worker` process with the approved
  `SCAN_RETENTION_DAYS` setting. It deletes old scan records in bounded batches
  under a separate PostgreSQL advisory lock. Confirm its deleted-row count in
  logs and alert on worker exit or repeated deletion failures. Never change the
  configured retention period without privacy/legal approval. SIGTERM wakes the
  retention worker immediately rather than waiting for its daily interval.
- Admins can review scan anomalies and chain lifecycle status at
  `/admin/operations`. The API exposes recoverable registrations and attempts
  to authenticated administrators/manufacturers according to role.

## Product registration stuck or incorrect

1. Inspect the product in the admin operations page and its transaction
   attempts. Do not edit lifecycle columns directly in SQL.
2. `pending_wallet` means no transaction hash has been recorded. Check whether
   the wallet request was rejected or the browser closed. The worker moves
   expired hashless records to `needs_retry` after the configured timeout.
3. `submitted` means the application recorded a hash. Check the configured
   chain, destination contract, sender, receipt, confirmation depth, and
   `ProductRegistered` event. The reconciler is the only component allowed to
   mark a registration `confirmed`; a successful receipt without the expected
   event is not sufficient.
4. If a matching event was mined but the browser did not save its hash, the
   worker searches from `CONTRACT_DEPLOYMENT_BLOCK` and can recover it. Keep
   the worker running and verify the chain/RPC before attempting recovery.
5. Retry only a `failed` or `needs_retry` registration through the manufacturer
   workflow, using the original serial. The contract rejects duplicates. Never
   mark an uncertain or legacy record confirmed by hand.
6. Existing legacy `needs_retry` records may lack sender, contract, and attempt
   details. Resolve them from source records and chain evidence; absent proof,
   leave them unverified.

## Scan alert or suspected counterfeit

- Review the serial, submitted contract, derived outcome, server-verified
  custody history/state, and event time in `/admin/operations`.
- `invalid_identifier` means the serial/contract was malformed, did not match
  the configured deployment, or was not registered there. `conflicting_product_state`
  means the contract history and stored current state disagree. `unusual_frequency`
  and `suspicious_location` are investigation signals, not a verdict.
- Browser geolocation is opt-in, rounded, and marked `browser_reported`; it can
  be spoofed. Do not treat it as proof of where a scan occurred or who scanned.
  Compare the on-chain custody addresses and business profiles with the actual
  seller, invoice, shipment, and participant records.
- Preserve relevant alert/event IDs and chain transaction references. Limit
  access to location details. The retention worker removes scan records,
  including coordinates and visitor hashes, after the configured policy period.

## Business wallet compromise or role change

- Use the authenticated admin wallet-operation workflow to suspend, replace,
  restore, or revoke the account wallet. Do not update wallet/profile tables by
  hand; the workflow records challenges, ownership proof, operation state, and
  audit events.
- A chain role change requires the contract owner. In production, submit the
  action through the organization's multisig, verify calldata and target
  contract/network, simulate/review it, execute, and record the Safe transaction
  and on-chain receipt. App suspension alone must not be assumed to revoke a
  direct on-chain wallet role.
- After execution, inspect the wallet role and receipt, then complete the
  matching backend operation. Verify the old wallet cannot write and the new
  wallet/account/on-chain roles agree. Never ask a participant to send a private
  key to the application team.
- If the contract owner or deployment key is compromised, treat it as a
  security incident: convene the multisig/security owners, revoke or replace
  affected participant roles where authorized, rotate backend/provider
  credentials, preserve audit evidence, and assess whether a new contract
  deployment is required. Deployed contract state is immutable.

## Dependency outage

- **Database:** readiness fails. Check provider status, TLS/certificate
  validation, connection limits, and migrations. Restore using the database
  provider's protected backup/PITR process, first into an isolated database;
  run `npm run migrate:preflight`, inspect pending migrations, then apply the
  numbered migrations in a controlled window. The repository backup helper is
  intentionally restricted to local PostgreSQL and is not a production backup
  system.
- **Redis:** readiness fails and rate-limited routes fail closed. Restore the
  TLS connection/credentials or fail over Redis; do not switch a production
  instance to per-process memory limits.
- **RPC/contract:** readiness fails if chain ID or contract code cannot be
  verified. Check provider status, URL, configured chain ID, deployment address,
  and deployment block. Do not accept client claims as confirmation while the
  backend cannot verify chain data.
- **Object storage:** readiness fails if the configured bucket cannot be
  reached. Check the workload identity, bucket policy, region, endpoint, and
  TLS. Product verification remains based on chain data, but images may be
  unavailable until storage recovers. Do not make the bucket public as a
  workaround.

## Release, rollback, and recovery rules

- Before a release, restore-test a database backup, run migration preflight on
  the isolated copy, apply migrations there, and verify API/worker/frontend
  behavior. Back up the intended database and use a controlled migration
  window. Review the pending-migration list before applying.
- Run migrations through `npm run migrate`; it takes a PostgreSQL advisory lock
  and refuses to run concurrently with another migration process. If it reports
  an active migration, inspect the deployment job instead of starting a second
  runner.
- Roll back application code only when it is compatible with the current
  schema. Do not roll database state back past blockchain writes without a
  reconciliation plan; the chain cannot be rolled back. Reconcile from verified
  chain events after restoring a database.
- Keep the configured chain, contract address, deployment block, participant
  roles, frontend address/ABI, database migrations, and release artifacts
  recorded together. A new production contract requires a new address and
  coordinated frontend/backend configuration; Sepolia is a test network.
- Rotate JWT, database, Redis, object-storage, and RPC credentials through the
  deployment secret manager. JWT secret rotation invalidates existing sessions.
  Never commit real `.env` files or backups.

## Required alerting

Configure alerts for sustained `/readyz` failures, API or worker exits, worker
staleness, products remaining `pending_wallet`/`submitted` beyond their timeout,
growing `needs_retry` counts, Redis/storage failures, suspicious scan trends, and
database backup/restore failures. Assign an operational owner and an on-call
escalation path before launch.
