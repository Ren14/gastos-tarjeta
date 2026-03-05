CREATE TABLE cards (
                       id         SERIAL PRIMARY KEY,
                       name       VARCHAR(100) NOT NULL,
                       bank       VARCHAR(100),
                       card_type  VARCHAR(20),
                       color_hex  CHAR(7),
                       active     BOOLEAN DEFAULT true,
                       created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
                            id        SERIAL PRIMARY KEY,
                            name      VARCHAR(100) NOT NULL,
                            icon      VARCHAR(10),
                            color_hex CHAR(7)
);

CREATE TABLE recurring_expenses (
                                    id          SERIAL PRIMARY KEY,
                                    card_id     INTEGER NOT NULL REFERENCES cards(id),
                                    category_id INTEGER REFERENCES categories(id),
                                    merchant    VARCHAR(200) NOT NULL,
                                    amount_usd  NUMERIC(10,4) NOT NULL,
                                    active      BOOLEAN DEFAULT true,
                                    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exchange_rate_history (
                                       id         SERIAL PRIMARY KEY,
                                       month      SMALLINT NOT NULL,
                                       year       SMALLINT NOT NULL,
                                       usd_to_ars NUMERIC(12,2) NOT NULL,
                                       notes      TEXT,
                                       created_at TIMESTAMPTZ DEFAULT NOW(),
                                       UNIQUE(month, year)
);

CREATE TABLE expenses (
                          id                 SERIAL PRIMARY KEY,
                          card_id            INTEGER NOT NULL REFERENCES cards(id),
                          category_id        INTEGER REFERENCES categories(id),
                          merchant           VARCHAR(200) NOT NULL,
                          total_amount       NUMERIC(14,2) NOT NULL,
                          installments       SMALLINT DEFAULT 1,
                          installment_amount NUMERIC(14,2) GENERATED ALWAYS AS (total_amount / installments) STORED,
                          purchase_date      DATE NOT NULL,
                          recurring_id       INTEGER REFERENCES recurring_expenses(id),
                          notes              TEXT,
                          created_at         TIMESTAMPTZ DEFAULT NOW()
);