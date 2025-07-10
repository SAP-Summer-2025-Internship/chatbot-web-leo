#!/bin/bash
set -e

echo "🚀 Starting database initialization..."

# Wait for PostgreSQL to be ready
until pg_isready -h localhost -p 5432 -U chatbot_user; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run initialization scripts
echo "📝 Running initialization scripts..."

# Create tables if they don't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create key_messages table if it doesn't exist
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

    -- Create or replace function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Create trigger to automatically update updated_at
    DROP TRIGGER IF EXISTS update_key_messages_updated_at ON key_messages;
    CREATE TRIGGER update_key_messages_updated_at 
        BEFORE UPDATE ON key_messages 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();

    -- Insert a sample record to verify the table works
    INSERT INTO key_messages (user_id, message) 
    VALUES ('sample-user-id', 'This is a sample message containing the key word for testing')
    ON CONFLICT DO NOTHING;

    -- Grant necessary permissions
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chatbot_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chatbot_user;

    -- Display table structure for verification
    \d key_messages;
EOSQL

echo "✅ Database initialization completed successfully!"
echo "📊 Table structure and sample data created."
