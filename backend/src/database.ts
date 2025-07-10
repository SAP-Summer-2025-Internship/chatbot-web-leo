import { Pool, PoolClient } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://chatbot_user:chatbot_password@localhost:5432/chatbot_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Types for database entities
interface KeyMessage {
  id: number;
  user_id: string;
  message: string;
  created_at: Date;
  updated_at: Date;
}

export class ChatbotDatabase {
  
  // Test database connection
  static async testConnection(): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      return false;
    }
  }

  static shouldSave(message: string): boolean {
    // Check if the message contains the word "key"
    return message.toLowerCase().includes('key');
  }

  // Save a message containing "key"
  static async saveMessage(userId: string, message: string): Promise<KeyMessage> {
    const query = `
      INSERT INTO key_messages (user_id, message)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [userId, message]);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving key message:', error);
      throw error;
    }
  }

  // Get all key messages for a user
  static async getUserKeyMessages(userId: string): Promise<KeyMessage[]> {
    const query = `
      SELECT * FROM key_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching user key messages:', error);
      throw error;
    }
  }

  // Get all key messages (for admin/debugging)
  static async getAllKeyMessages(): Promise<KeyMessage[]> {
    const query = `
      SELECT * FROM key_messages
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all key messages:', error);
      throw error;
    }
  }

  // Search key messages by content
  static async searchKeyMessages(searchTerm: string): Promise<KeyMessage[]> {
    const query = `
      SELECT * FROM key_messages
      WHERE message ILIKE $1
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await pool.query(query, [`%${searchTerm}%`]);
      return result.rows;
    } catch (error) {
      console.error('Error searching key messages:', error);
      throw error;
    }
  }

  // Get statistics
  static async getKeyMessageStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users,
        DATE_TRUNC('day', created_at) as day,
        COUNT(*) as daily_count
      FROM key_messages
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day DESC
      LIMIT 7
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching key message stats:', error);
      throw error;
    }
  }

  // Clear all key messages for a user
  static async clearUserKeyMessages(userId: string): Promise<number> {
    const query = `
      DELETE FROM key_messages
      WHERE user_id = $1
    `;
    
    try {
      const result = await pool.query(query, [userId]);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error clearing user key messages:', error);
      throw error;
    }
  }
}

export default pool;
