-- Converts ledger_block_logs into a TimescaleDB hypertable, partitioned on
-- occurred_at, matching command_spy_logs/ledger_logs/block_logs/
-- server_metrics/ait_logs (see 0001_timescale_hypertables.sql /
-- 0007_block_logs_hypertable.sql / 0009_server_metrics_hypertable.sql /
-- 0017_ait_logs_hypertable.sql). The highest-volume of the five telemetry
-- sources by far, so this is the one where the retention window matters most.
SELECT create_hypertable('ledger_block_logs', by_range('occurred_at'), if_not_exists => TRUE);

-- Same 90-day raw-row retention as the other event-log hypertables.
SELECT add_retention_policy('ledger_block_logs', INTERVAL '90 days', if_not_exists => TRUE);
