-- Validate the existing FinTalk Supabase schema.
-- This is intentionally read-only; it does not create, alter, or seed tables.

DO $$
DECLARE
    missing_columns TEXT;
BEGIN
    IF to_regclass('public.transactions') IS NULL THEN
        RAISE EXCEPTION 'Required table public.transactions does not exist';
    END IF;

    IF to_regclass('public.categories') IS NULL THEN
        RAISE EXCEPTION 'Required table public.categories does not exist';
    END IF;

    IF to_regclass('public.users') IS NULL THEN
        RAISE EXCEPTION 'Required table public.users does not exist';
    END IF;

    IF to_regclass('public.wallets') IS NULL THEN
        RAISE EXCEPTION 'Required table public.wallets does not exist';
    END IF;

    SELECT string_agg(format('%s.%s', expected.table_name, expected.column_name), ', ')
    INTO missing_columns
    FROM (
        VALUES
            ('transactions', 'id'),
            ('transactions', 'user_id'),
            ('transactions', 'wallet_id'),
            ('transactions', 'category_id'),
            ('transactions', 'type'),
            ('transactions', 'amount'),
            ('transactions', 'description'),
            ('transactions', 'transaction_date'),
            ('transactions', 'created_at'),
            ('categories', 'id'),
            ('categories', 'user_id'),
            ('categories', 'name'),
            ('categories', 'type'),
            ('users', 'id'),
            ('wallets', 'id'),
            ('wallets', 'user_id')
    ) AS expected(table_name, column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns AS actual
        WHERE actual.table_schema = 'public'
          AND actual.table_name = expected.table_name
          AND actual.column_name = expected.column_name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'FinTalk schema is missing required columns: %', missing_columns;
    END IF;

    RAISE NOTICE 'FinTalk transaction schema is ready.';
END $$;
