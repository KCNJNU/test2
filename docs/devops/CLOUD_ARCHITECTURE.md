# Cloud Architecture — D1 Foundation

## Safety boundary

`Cloud Down ≠ Safety Down` is an architectural invariant. The cloud platform issues only business-level commands through the future Device Gateway. It never publishes `/cmd_vel`, releases brakes, bypasses SAFE policy, or clears a latched safety state. Robot-side ROS 2/Nav2, `safety_stop`, MCU safeguards, obstacle detection and hardware emergency stop remain authoritative when Web, API, Redis, PostgreSQL, MQTT or the network is unavailable.

## D1 logical architecture

```text
React Web
  ├─ business API endpoint (existing platform routing)
  └─ NestJS GET /health
       ├─ PostgreSQL / Prisma metadata and durable Job queue
       ├─ Redis coordination service
       ├─ EMQX MQTT broker connectivity probe
       ├─ ObjectStorage -> MinIO in DEV
       ├─ DVC remote health when configured
       └─ Worker heartbeat
```

The MQTT probe establishes a clean client connection, publishes and subscribes to nothing, disables reconnect, and immediately disconnects. D2 will own device authentication, messages, ACK, deduplication and reconnect behavior.

## Data ownership

- PostgreSQL is the only application database and Prisma owns schema access and migrations.
- Raw files, map artifacts, diagnostic bundles and future software packages live in ObjectStorage; PostgreSQL stores object keys and metadata only.
- Redis is infrastructure for coordination/cache use and is not a system of record.
- The current durable background Job queue is PostgreSQL-backed; Worker heartbeat is reported separately from queue availability.
- DVC applies only to frozen DatasetVersion publication workflows.

## Availability interpretation

Health values are `healthy`, `degraded`, `unhealthy`, and `not_checked`. An unreachable required dependency makes the aggregate unhealthy. An optional or unavailable probe makes it degraded. `not_checked` never means that the dependency is confirmed unavailable.

## Deferred architecture

D2-D6 add the Device Gateway, observability, CI/CD, OTA/config delivery, production TLS/ACL, managed secrets, backup/restore and disaster recovery. D1 makes no production availability or robot-safety latency claim.
