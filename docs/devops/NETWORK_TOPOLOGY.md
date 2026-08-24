# Network Topology — D1 DEV

## Local endpoints

| Component | Host port | Purpose | Exposure |
| --- | ---: | --- | --- |
| React/Vite | 5173 | Operator Web development server | Developer workstation |
| NestJS API | 3000 | Data API, Swagger and infrastructure health | Developer workstation |
| Existing platform API | 3100 | Existing business API routing; unchanged by D1 | Developer workstation |
| PostgreSQL | 5432 | Application database and durable Job queue | DEV only |
| Redis | 6379 | Coordination/cache infrastructure | DEV only |
| EMQX MQTT | 1883 | Local device-protocol development | DEV only |
| EMQX Dashboard | 18083 | Local broker administration | DEV only |
| MinIO API / Console | 9000 / 9001 | DEV ObjectStorage | DEV only |
| pgAdmin | 5050 | Local database administration | DEV only |

Ports can be overridden in the repository-root `.env`. Container-to-container traffic uses Compose service DNS names (`postgres`, `redis`, `mqtt`, `minio`) rather than host loopback.

## Trust zones

```text
Browser zone -> API zone -> data/infrastructure zone
                                  |
                                  +-> future Device Gateway -> device network
```

- The browser never receives database, object-storage, Redis or MQTT credentials.
- D1 MQTT is a local integration endpoint and is not a production security model.
- TEST, STAGING and PRODUCTION must use separate networks, brokers, databases, buckets, Redis instances, secrets and device certificates.
- DEV must not route to production robots or production control topics.

## Failure isolation

Loss of API, Redis, PostgreSQL, EMQX or WAN connectivity may make cloud operations unavailable or stale. It must not alter local robot safety decisions or clear SAFE state. The health dashboard reports only observed cloud dependencies and must not infer physical robot safety from cloud reachability.
# D6 production trust boundaries

Production Edge exposes only TCP 80 (redirect) and 443 (HTTPS). EMQX exposes only 8883 with mutual TLS; 1883 is disabled and Dashboard 18083 binds to the private management interface. Edge overwrites `X-Forwarded-For`; the private Web proxy preserves that value and applications trust only this fixed two-hop Edge/Web chain. `/api/internal/` is denied externally. Vault, PostgreSQL, Redis, object storage, application slots, Gateway metrics and backup control traffic remain on private networks.

Robot certificate CN is the canonical UUID and determines its MQTT ACL namespace. `device-gateway` has a separate service identity. TEST, STAGING and PRODUCTION have distinct CAs, Vault paths, brokers, networks, data services and device identities.
