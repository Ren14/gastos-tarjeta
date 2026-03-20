CREATE TABLE IF NOT EXISTS splits (
    id SERIAL PRIMARY KEY,
    recurring_id INTEGER NOT NULL REFERENCES recurring_expenses(id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS split_participants (
    id SERIAL PRIMARY KEY,
    split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS split_entries (
    id SERIAL PRIMARY KEY,
    split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES split_participants(id) ON DELETE CASCADE,
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    color VARCHAR(10) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(split_id, participant_id, month, year)
);
