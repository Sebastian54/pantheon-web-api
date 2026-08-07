-- Converts the two high-volume event-log tables into TimescaleDB hypertables,
-- partitioned on occurred_at. Requires the timescaledb extension (present on
-- the timescale/timescaledb image used by docker-compose.yml's postgres service).
CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable('command_spy_logs', by_range('occurred_at'), if_not_exists => TRUE);
SELECT create_hypertable('ledger_logs', by_range('occurred_at'), if_not_exists => TRUE);

-- Drop raw event rows after 90 days; dashboards should roll up older data
-- into aggregates before this point if long-term retention is needed.
SELECT add_retention_policy('command_spy_logs', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('ledger_logs', INTERVAL '90 days', if_not_exists => TRUE);
