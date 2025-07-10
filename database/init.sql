-- Database initialization script for chatbot key message storage
-- This script will run when the PostgreSQL container starts

-- Create table for storing user messages containing "key"
CREATE TABLE IF NOT EXISTS key_messages (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_key_messages_user_id ON key_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_key_messages_created_at ON key_messages(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_key_messages_updated_at 
    BEFORE UPDATE ON key_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a sample record to verify the table works
INSERT INTO key_messages (user_id, message) 
VALUES ('sample-user-id', 'This is a sample message containing the key word for testing');

-- Display table structure
\d key_messages;

-- Show the sample record
SELECT * FROM key_messages;
