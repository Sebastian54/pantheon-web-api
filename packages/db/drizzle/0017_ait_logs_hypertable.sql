-- Converts ait_logs into a TimescaleDB hypertable, partitioned on
-- occurred_at, matching command_spy_logs/ledger_logs/block_logs/server_metrics
-- (see 0001_timescale_hypertables.sql / 0007_block_logs_hypertable.sql /
-- 0009_server_metrics_hypertable.sql).
SELECT create_hypertable('ait_logs', by_range('occurred_at'), if_not_exists => TRUE);

-- Same 90-day raw-row retention as the other event-log hypertables.
SELECT add_retention_policy('ait_logs', INTERVAL '90 days', if_not_exists => TRUE);
