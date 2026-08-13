-- Converts grief_logger_events into a TimescaleDB hypertable, partitioned on
-- occurred_at, matching command_spy_logs/ledger_logs/block_logs/
-- server_metrics/ait_logs/ledger_block_logs (see 0001_timescale_hypertables.sql
-- and its successors).
SELECT create_hypertable('grief_logger_events', by_range('occurred_at'), if_not_exists => TRUE);

-- Same 90-day raw-row retention as the other event-log hypertables.
SELECT add_retention_policy('grief_logger_events', INTERVAL '90 days', if_not_exists => TRUE);
