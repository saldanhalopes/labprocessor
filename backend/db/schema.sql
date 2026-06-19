CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    email VARCHAR(255),
    company VARCHAR(200),
    role VARCHAR(50),
    is_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    uploads_today INTEGER DEFAULT 0,
    last_upload_date VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS results (
    id VARCHAR(100) PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    product_name VARCHAR(500),
    code VARCHAR(200),
    pharmaceutical_form VARCHAR(200),
    active_principles TEXT,
    composition TEXT,
    batch_size VARCHAR(100),
    total_time FLOAT DEFAULT 0,
    total_time_phys_chem FLOAT DEFAULT 0,
    total_time_micro FLOAT DEFAULT 0,
    full_text TEXT,
    visual_content TEXT,
    images TEXT[],
    pdf_path VARCHAR(500),
    timestamp BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS analysis_rows (
    id SERIAL PRIMARY KEY,
    result_id VARCHAR(100) REFERENCES results(id) ON DELETE CASCADE,
    test_name VARCHAR(500),
    technique VARCHAR(200),
    category VARCHAR(100),
    details TEXT,
    t_prep FLOAT DEFAULT 0,
    t_analysis FLOAT DEFAULT 0,
    t_run FLOAT DEFAULT 0,
    t_calc FLOAT DEFAULT 0,
    t_incubation FLOAT DEFAULT 0,
    t_locomotion FLOAT DEFAULT 0,
    t_setup FLOAT DEFAULT 0,
    t_register FLOAT DEFAULT 0,
    total_time_hours FLOAT DEFAULT 0,
    man_hours FLOAT DEFAULT 0,
    rationale TEXT
);

CREATE TABLE IF NOT EXISTS reagents (
    id SERIAL PRIMARY KEY,
    result_id VARCHAR(100) REFERENCES results(id) ON DELETE CASCADE,
    name VARCHAR(500),
    quantity VARCHAR(200),
    concentration VARCHAR(200),
    category VARCHAR(100),
    test_name VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS standards (
    id SERIAL PRIMARY KEY,
    result_id VARCHAR(100) REFERENCES results(id) ON DELETE CASCADE,
    name VARCHAR(500),
    amount_mg VARCHAR(100),
    concentration VARCHAR(200),
    test_name VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS equipments (
    id SERIAL PRIMARY KEY,
    result_id VARCHAR(100) REFERENCES results(id) ON DELETE CASCADE,
    name VARCHAR(500),
    model VARCHAR(300),
    category VARCHAR(100),
    test_name VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    result_id VARCHAR(100) REFERENCES results(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(3072),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_file_name ON results(file_name);
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_timestamp ON results(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_result_id ON analysis_rows(result_id);
CREATE INDEX IF NOT EXISTS idx_reagents_result_id ON reagents(result_id);
CREATE INDEX IF NOT EXISTS idx_standards_result_id ON standards(result_id);
CREATE INDEX IF NOT EXISTS idx_equipments_result_id ON equipments(result_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_result_id ON embeddings(result_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
