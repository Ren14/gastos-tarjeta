INSERT INTO categories (name, icon, color_hex) VALUES
                                                   ('Supermercado',    '🛒', '#2d6a4f'),
                                                   ('Combustible',     '⛽', '#e07a2f'),
                                                   ('Entretenimiento', '🎵', '#1d3557'),
                                                   ('Tecnología',      '📱', '#bc6c25'),
                                                   ('Delivery',        '🍔', '#c1121f'),
                                                   ('Suscripción',     '🛍️', '#6b6356'),
                                                   ('Seguros',         '🏥', '#2d6a4f'),
                                                   ('Restaurantes',    '🍽️', '#e07a2f'),
                                                   ('Varios',          '🗂️', '#6b6356');

INSERT INTO cards (name, bank, card_type, color_hex) VALUES
                                                         ('Visa San Río',       'Banco San Río',    'VISA',       '#1d3557'),
                                                         ('VISA Supervielle',   'Supervielle',      'VISA',       '#2d6a4f'),
                                                         ('Nación MC',          'Banco Nación',     'MASTERCARD', '#1a1a2e'),
                                                         ('Mercado Pago',       'Mercado Pago',     'VISA',       '#e07a2f'),
                                                         ('AMEX',               'American Express', 'AMEX',       '#bc6c25'),
                                                         ('BBVA Visa',          'BBVA',             'VISA',       '#c1121f'),
                                                         ('Nativa',             'Nativa',           'MASTERCARD', '#c1121f'),
                                                         ('Macro',              'Banco Macro',      'VISA',       '#bc6c25');

INSERT INTO recurring_expenses (card_id, category_id, merchant, amount_usd) VALUES
                                                                                (1, 3, 'Spotify',             5.2300),
                                                                                (1, 3, 'YouTube Premium',     6.7000),
                                                                                (1, 3, 'YouTube One',         2.7200),
                                                                                (1, 4, 'Apple',              13.6200),
                                                                                (1, 3, 'Netflix',             8.5800),
                                                                                (1, 5, 'Pedidos Ya',          5.7100),
                                                                                (1, 6, 'Meli+',              3.3200),
                                                                                (1, 7, 'Federación Patronal', 55.5800);