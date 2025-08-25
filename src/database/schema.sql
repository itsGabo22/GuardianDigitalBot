CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    message_content TEXT,
    analysis_result TEXT,
    was_helpful BOOLEAN,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE interactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);