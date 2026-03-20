CREATE TABLE flujo_clasificaciones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO flujo_clasificaciones (name, sort_order) VALUES
    ('Renzo', 1),
    ('Tio Cuchi', 2),
    ('Mama', 3),
    ('Yolo', 4),
    ('Flor', 5),
    ('Jona', 6),
    ('Gustavo', 7),
    ('Tia Gaby', 8),
    ('Gonchi', 9),
    ('Casa', 10),
    ('Ahorros', 11),
    ('Deporte', 12),
    ('Salud', 13),
    ('Varios', 14);

ALTER TABLE cashflow_categories
    ADD COLUMN clasificacion_id INTEGER REFERENCES flujo_clasificaciones(id);

UPDATE cashflow_categories
SET clasificacion_id = (SELECT id FROM flujo_clasificaciones WHERE name = 'Varios');
