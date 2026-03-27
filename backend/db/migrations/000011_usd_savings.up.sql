CREATE TABLE usd_savings (
    id          SERIAL PRIMARY KEY,
    donde       VARCHAR(200) NOT NULL DEFAULT '',
    cuanto      NUMERIC(14,2) NOT NULL DEFAULT 0,
    instrumento VARCHAR(200) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
