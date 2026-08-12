-- Converts server_metrics into a TimescaleDB hypertable, partitioned on
-- occurred_at, matching command_spy_logs/ledger_logs/block_logs (see
-- 0001_timescale_hypertables.sql / 0007_block_logs_hypertable.sql).
SELECT create_hypertable('server_metrics', by_range('occurred_at'), if_not_exists => TRUE);

-- Same 90-day raw-row retention as the other event-log hypertables.
SELECT add_retention_policy('server_metrics', INTERVAL '90 days', if_not_exists => TRUE);
