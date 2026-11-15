-- PostgreSQL-level regression checks for the exact early-departure expression
-- used by AttendanceService.checkOut. Fixed local timestamps make the test deterministic.
DO $$
DECLARE
  actual_regular integer;
  actual_overnight integer;
  actual_after_shift integer;
BEGIN
  SELECT GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (
      DATE '2026-11-15' + TIME '17:00'
      + CASE WHEN FALSE THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
      - TIMESTAMP '2026-11-15 16:30'
    )) / 60)::int - 10
  ) INTO actual_regular;

  SELECT GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (
      DATE '2026-11-14' + TIME '06:00'
      + CASE WHEN TRUE THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
      - TIMESTAMP '2026-11-15 05:30'
    )) / 60)::int - 15
  ) INTO actual_overnight;

  SELECT GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (
      DATE '2026-11-15' + TIME '17:00'
      - TIMESTAMP '2026-11-15 17:30'
    )) / 60)::int - 10
  ) INTO actual_after_shift;

  IF actual_regular <> 20 THEN
    RAISE EXCEPTION 'Regular shift expected 20 early minutes, got %', actual_regular;
  END IF;
  IF actual_overnight <> 15 THEN
    RAISE EXCEPTION 'Overnight shift expected 15 early minutes, got %', actual_overnight;
  END IF;
  IF actual_after_shift <> 0 THEN
    RAISE EXCEPTION 'After-shift checkout expected 0 early minutes, got %', actual_after_shift;
  END IF;

  RAISE NOTICE 'Early-departure PostgreSQL expression passed: regular=%, overnight=%, after-shift=%',
    actual_regular, actual_overnight, actual_after_shift;
END $$;
