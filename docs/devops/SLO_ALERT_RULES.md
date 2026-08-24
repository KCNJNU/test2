# D3 SLO and Alert Rules

## Initial service objectives

These are development baselines, not contractual production SLAs.

| Signal | Initial objective | Window |
| --- | --- | --- |
| API availability | 99.5% non-5xx responses | rolling 30 days |
| API latency | p95 below 500 ms | 5-minute measurement, 30-day reporting |
| Gateway MQTT connection | connected 99.5% while the service is scheduled | rolling 30 days |
| Command ACK | fewer than 1% timeouts after `SENT` | rolling 24 hours |
| Observability freshness | scrape succeeds within 60 seconds | continuous |

`infra/prometheus/alert-rules.yml` implements actionable DEV thresholds for target loss, API errors/latency, gateway disconnect, robot-offline population, ACK timeout spikes, and queue backlogs. Thresholds must be tuned with field traffic before production.

## Severity and response

- Critical: target loss, MQTT disconnect or clustered ACK timeouts. Page the owning team in production after D6 routing is configured.
- Warning: sustained latency, offline population or backlog. Create an operations incident and investigate trends.
- Informational state changes belong in dashboards/logs and must not page.

Alerts describe cloud visibility and control-plane health only. `Cloud Down ≠ Safety Down`: an alert cannot assert physical motion or replace robot-side emergency stop, obstacle handling, MCU interlocks or latched SAFE handling. A command timeout means acceptance is unknown; it does not authorize blind retry.
# D6 recovery objectives

- Database backup age greater than 1 hour: critical.
- Object backup age greater than 6 hours: critical.
- Successful restore drill age greater than 35 days: critical and blocks retention/promotion.
- Certificate expiry within 30 days: warning; within 7 days: critical.
- Any MQTT cross-identity authorization success: security incident.
- Mass reconnect acceptance: at least 99 of 100 clients within the configured window without Gateway session takeover.
