-- gastos-tarjeta backup
-- Generated: 2026-03-13 03:56:13 UTC

BEGIN;

TRUNCATE cashflow_entries, expenses, recurring_expenses, exchange_rate_history, cashflow_categories, categories, cards RESTART IDENTITY CASCADE;

-- cards
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (1, 'BBVA Pame', '', 'VISA', '#6b7280', TRUE, '2026-03-13T03:47:39.692952Z');
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (2, 'V San Rio', '', 'VISA', '#6b7280', TRUE, '2026-03-13T03:47:39.695244Z');
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (3, 'VISA Supervielle', '', 'VISA', '#6b7280', TRUE, '2026-03-13T03:47:39.697776Z');
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (4, 'Mercado Pago', '', 'VISA', '#6b7280', TRUE, '2026-03-13T03:47:39.698765Z');
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (5, 'Nacion MC', '', 'VISA', '#6b7280', TRUE, '2026-03-13T03:47:39.701005Z');
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (6, 'AMEX', '', 'VISA', '#6b7280', TRUE, '2026-03-13T03:47:39.707696Z');
INSERT INTO cards (id, name, bank, card_type, color_hex, active, created_at) VALUES (7, 'BNA VISA', 'Banco Nación', 'VISA', '#6366f1', TRUE, '2026-03-13T03:50:49.92433Z');

-- categories
-- (no rows)

-- cashflow_categories
-- (no rows)

-- exchange_rate_history
-- (no rows)

-- recurring_expenses
-- (no rows)

-- expenses
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (1, 1, NULL, 'Almoahadas 12C BBVA PAME Empieza Abril, termina Marzo 2027', 157500, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.694104Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (2, 2, NULL, 'ATOMITO', 97749, 1, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.69623Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (3, 2, NULL, 'PUMA Borussia', 113196.99, 3, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.696944Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (4, 2, NULL, 'PUMA ROPA 30 OF', 258996.51, 3, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.697439Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (5, 3, NULL, 'Bosco', 3500, 1, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.698108Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (6, 2, NULL, 'Shell', 63005, 1, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.698453Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (7, 4, NULL, 'Impresora 6C', 402599.45, 5, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.699046Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (8, 3, NULL, 'Escritorio Standing', 148832, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.699324Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (9, 3, NULL, 'Dexter', 54841.34, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.69956Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (10, 4, NULL, 'Aceite mama', 54466, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.699912Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (11, 4, NULL, 'Tío Zapatilals MELI', 73332.66, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.700201Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (12, 3, NULL, 'Meli auriculares 12c', 55494, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.700454Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (13, 3, NULL, 'Meli ventilador 3c', 30752, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.700733Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (14, 5, NULL, 'Knauer 6c Ropa Agus', 47175, 5, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.701701Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (15, 5, NULL, 'Knauer 6c Ropa Agus', 66666.65, 5, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.702036Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (16, 4, NULL, 'Pendrive 6c', 27495, 5, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.702327Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (17, 4, NULL, 'Cafetera 3c', 46462, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.702593Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (18, 2, NULL, 'Fadiunc', 90000, 3, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.702842Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (19, 4, NULL, 'Colchon Rubens', 130000, 1, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.703204Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (20, 4, NULL, 'Sex shop', 38630, 1, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.703547Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (21, 4, NULL, 'Termo mamá', 84824.28, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.703886Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (22, 3, NULL, 'Gustavo Ventilador 12C empieza enero 2026', 87374.25, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.704273Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (23, 3, NULL, 'Sensor ruedas cruceta 12C', 107100, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.704585Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (24, 3, NULL, 'Ventilador techo 12C', 87374.25, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.705089Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (25, 3, NULL, 'Parlante JBL Charge 6 Papá 12C', 222936.75, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.7055Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (26, 3, NULL, 'AJAX GOLD Carry On x2, 12c 1° Dic 25 termina nov 26', 104048, 8, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.705771Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (27, 2, NULL, 'Parlante Harman Kardon 18C, 1° nov', 129049.47, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.706206Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (28, 2, NULL, 'Zapatillas Flor morita 6C, empieza nov 2025', 13733.32, 1, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.706555Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (29, 2, NULL, 'AA tía 12 cuotas empieza nov 2025', 666261.19, 7, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.706816Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (30, 2, NULL, 'Heladera mamá 9c emp nov', 373332.88, 4, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.707071Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (31, 7, NULL, 'Viaje Bs As 6C', 32697.62, 1, '2026-03-13', '', NULL, '2026-03-13T03:47:39.707444Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (32, 6, NULL, 'Ooo JOnita zapatilals nike empieza Octubre 2025 9C', 78999.33, 3, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.70798Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (33, 3, NULL, 'Ventiladores de techo', 57499.5, 3, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.708236Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (34, 3, NULL, 'Estufa', 58898.79, 3, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.708468Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (35, 3, NULL, 'Compra silla yolo ElectroWorld', 51666.5, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.708718Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (36, 2, NULL, 'Aysam', 85390.4, 2, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.708939Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (37, 2, NULL, 'Pedidos Ya', 53910, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.709157Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (38, 2, NULL, 'Seguro Auto', 1021221, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.709374Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (39, 2, NULL, 'Meli+', 31410, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.709528Z', NULL);
INSERT INTO expenses (id, card_id, category_id, merchant, total_amount, installments, purchase_date, notes, color, created_at, recurring_id) VALUES (40, 2, NULL, 'Federación Patronal', 525267, 9, '2026-03-13', NULL, NULL, '2026-03-13T03:47:39.709659Z', NULL);

-- cashflow_entries
-- (no rows)

SELECT setval('cards_id_seq', COALESCE((SELECT MAX(id) FROM cards), 0) + 1, false);
SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 0) + 1, false);
SELECT setval('cashflow_categories_id_seq', COALESCE((SELECT MAX(id) FROM cashflow_categories), 0) + 1, false);
SELECT setval('exchange_rate_history_id_seq', COALESCE((SELECT MAX(id) FROM exchange_rate_history), 0) + 1, false);
SELECT setval('recurring_expenses_id_seq', COALESCE((SELECT MAX(id) FROM recurring_expenses), 0) + 1, false);
SELECT setval('expenses_id_seq', COALESCE((SELECT MAX(id) FROM expenses), 0) + 1, false);
SELECT setval('cashflow_entries_id_seq', COALESCE((SELECT MAX(id) FROM cashflow_entries), 0) + 1, false);

COMMIT;
