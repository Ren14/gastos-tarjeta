CREATE TABLE todo_tasks (
    id SERIAL PRIMARY KEY,
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    task_type VARCHAR(20) NOT NULL,
    reference_id INTEGER,
    reference_name VARCHAR(200) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, year, task_type, reference_id)
);

CREATE INDEX idx_todo_tasks_month_year ON todo_tasks(year, month);
