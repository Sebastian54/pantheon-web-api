-- Converts block_logs into a TimescaleDB hypertable, partitioned on
-- occurred_at, matching command_spy_logs/ledger_logs (see 0001_timescale_hypertables.sql).
SELECT create_hypertable('block_logs', by_range('occurred_at'), if_not_exists => TRUE);

-- Same 90-day raw-row retention as the other event-log hypertables.
SELECT add_retention_policy('block_logs', INTERVAL '90 days', if_not_exists => TRUE);
