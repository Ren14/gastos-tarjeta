CREATE TABLE IF NOT EXISTS cashflow_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cashflow_entries (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES cashflow_categories(id),
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, month, year)
);
