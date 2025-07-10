import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios, { AxiosResponse } from 'axios';
import cors from 'cors';
import { setupSwagger } from './swagger';
import { ChatbotDatabase } from './database';

// Types
interface OllamaRequest {
    model: string;
    prompt: string;
    stream: boolean;
}

interface OllamaResponse {
    response: string;
}

interface HealthResponse {
    status: 'healthy' | 'unhealthy';
    ollama: 'connected' | 'disconnected';
    database: 'connected' | 'disconnected';
    url: string;
    version?: any;
    error?: string;
}

const app = express();
const server = createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3001",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT: number = parseInt(process.env.PORT || '3000', 10);
// Use localhost when running locally, ollama when running in Docker
const OLLAMA_URL: string = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const MODEL_NAME: string = process.env.MODEL_NAME || 'qwen:7b';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true
}));
app.use(express.json());

// Setup Swagger documentation
setupSwagger(app);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check the health status of the chatbot service and its connection to Ollama
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       500:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
// Health check endpoint
app.get('/health', async (_: Request, res: Response<HealthResponse>) => {
    try {
        // Check Ollama connection
        const healthUrl: string = OLLAMA_URL.replace('/api/generate', '/api/version');
        let ollamaHealthy = false;
        let ollamaVersion = null;
        
        try {
            const response: AxiosResponse = await axios.get(healthUrl, { timeout: 5000 });
            ollamaHealthy = true;
            ollamaVersion = response.data;
        } catch (error) {
            ollamaHealthy = false;
        }
        
        // Check database connection
        const databaseHealthy = await ChatbotDatabase.testConnection();
        
        const isHealthy = ollamaHealthy && databaseHealthy;
        
        res.status(isHealthy ? 200 : 500).json({ 
            status: isHealthy ? 'healthy' : 'unhealthy', 
            ollama: ollamaHealthy ? 'connected' : 'disconnected',
            database: databaseHealthy ? 'connected' : 'disconnected',
            url: healthUrl,
            version: ollamaVersion 
        });
    } catch (error: any) {
        res.status(500).json({ 
            status: 'unhealthy', 
            ollama: 'disconnected',
            database: 'disconnected',
            url: OLLAMA_URL.replace('/api/generate', '/api/version'),
            error: error.message 
        });
    }
});

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Send a message to the chatbot
 *     description: Send a message to the chatbot and receive an AI-generated response
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatMessage'
 *     responses:
 *       200:
 *         description: Successful response from chatbot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Bad request - missing message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error - AI service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// API endpoint for getting bot response
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log(`Sending request to Ollama at: ${OLLAMA_URL}`);
        const response: AxiosResponse<OllamaResponse> = await axios.post<OllamaResponse>(
            OLLAMA_URL, 
            {
                model: MODEL_NAME,
                prompt: message,
                stream: false
            } as OllamaRequest, 
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Received response from Ollama');
        res.json({ response: response.data.response });
    } catch (error: any) {
        console.error('Error calling Ollama:', error.message);
        let errorMessage = "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again later.";
        
        if (error.code === 'ECONNREFUSED') {
            errorMessage = "I'm sorry, I can't connect to the AI service. Please make sure Ollama is running.";
        }
        
        res.status(500).json({ error: errorMessage });
    }
});

// Function to get response from Ollama with user context
async function getBotResponse(message: string, userId?: string): Promise<string> {
    try {
        let contextualPrompt = message;
        
        // If userId is provided, add key messages as context
        if (userId) {
            try {
                const userKeyMessages = await ChatbotDatabase.getUserKeyMessages(userId);
                if (userKeyMessages.length > 0) {
                    const context = userKeyMessages
                        .slice(0, 10) // Limit to last 10 key messages to avoid token limits
                        .map(msg => `- ${msg.message}`)
                        .join('\n');
                    
                    contextualPrompt = `Previous important messages from this user:
${context}

User says: ${message}

Respond naturally as a helpful assistant. Use the context above to personalize your response, but don't mention that you're using context or previous messages unless directly relevant.`;
                    
                    console.log(`Added ${userKeyMessages.length} key messages as context for user ${userId}`);
                }
            } catch (error) {
                console.warn('Could not retrieve key messages for context:', error);
                // Continue with original message if context retrieval fails
            }
        }
        
        console.log(`Sending request to Ollama at: ${OLLAMA_URL}`);
        const response: AxiosResponse<OllamaResponse> = await axios.post<OllamaResponse>(
            OLLAMA_URL, 
            {
                model: MODEL_NAME,
                prompt: contextualPrompt,
                stream: false
            } as OllamaRequest, 
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Received response from Ollama');
        return response.data.response;
    } catch (error: any) {
        console.error('Error calling Ollama:', error.message);
        if (error.code === 'ECONNREFUSED') {
            return "I'm sorry, I can't connect to the AI service. Please make sure Ollama is running.";
        } else {
            return "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again later.";
        }
    }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SocketEvents:
 *       type: object
 *       description: Socket.io Events for real-time communication
 *       properties:
 *         client_events:
 *           type: object
 *           properties:
 *             user-message:
 *               type: string
 *               description: Send a message from user to chatbot
 *               example: "Hello, how are you?"
 *         server_events:
 *           type: object
 *           properties:
 *             bot-message:
 *               type: string
 *               description: Receive a message from chatbot
 *               example: "Hello! I'm doing well, thank you for asking."
 * 
 * /socket.io:
 *   get:
 *     summary: Socket.io WebSocket connection
 *     description: |
 *       Real-time bidirectional communication using Socket.io
 *       
 *       **Client Events (send from client):**
 *       - `user-message`: Send a message to the chatbot
 *       
 *       **Server Events (receive from server):**
 *       - `bot-message`: Receive a response from the chatbot
 *       
 *       **Connection URL:** `ws://localhost:3002/socket.io/`
 *     tags: [Socket.io]
 *     responses:
 *       101:
 *         description: WebSocket connection established
 */
// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Send welcome message
    socket.emit('bot-message', 'Welcome! I\'m your chatbot assistant. How can I help you today?');
    
    socket.on('user-message', async (data : {message: string, userId : string}) => {
        console.log('User message:', data.message);
        
        // Check if message contains "key" and store it in database
        if (ChatbotDatabase.shouldSave(data.message)) {
            try {
                // Test database connection first
                const dbHealthy = await ChatbotDatabase.testConnection();
                if (!dbHealthy) {
                    socket.emit('bot-message', '⚠️ Database is currently unavailable. Your message cannot be saved right now.');
                } else {
                    const savedMessage = await ChatbotDatabase.saveMessage(data.userId, data.message);
                    console.log('message saved to database:', savedMessage);
                    
                    // Send confirmation to user
                    socket.emit('bot-message', '🔑 It seems your message was important and so I\'ve saved it for future reference!');
                }
            } catch (error: any) {
                console.error('Error saving message to database:', error);
                socket.emit('bot-message', '⚠️ I tried to save your message but encountered a database error. Please try again later.');
            }
        }
        
        // Get bot response from Ollama with user context
        const botResponse: string = await getBotResponse(data.message, data.userId);
        
        // Send response back to user
        socket.emit('bot-message', botResponse);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// API endpoints for key messages
app.get('/api/key-messages', async (req: Request, res: Response) => {
    try {
        // Check database connection first
        const dbHealthy = await ChatbotDatabase.testConnection();
        if (!dbHealthy) {
            return res.status(503).json({ error: 'Database is currently unavailable' });
        }
        
        const keyMessages = await ChatbotDatabase.getAllKeyMessages();
        res.json({ keyMessages });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch key messages: ' + error.message });
    }
});

app.get('/api/key-messages/user/:userId', async (req: Request, res: Response) => {
    try {
        // Check database connection first
        const dbHealthy = await ChatbotDatabase.testConnection();
        if (!dbHealthy) {
            return res.status(503).json({ error: 'Database is currently unavailable' });
        }
        
        const { userId } = req.params;
        const keyMessages = await ChatbotDatabase.getUserKeyMessages(userId);
        res.json({ keyMessages });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch user key messages: ' + error.message });
    }
});

app.get('/api/key-messages/search/:searchTerm', async (req: Request, res: Response) => {
    try {
        const { searchTerm } = req.params;
        const keyMessages = await ChatbotDatabase.searchKeyMessages(searchTerm);
        res.json({ keyMessages });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to search key messages' });
    }
});

app.get('/api/key-messages/stats', async (req: Request, res: Response) => {
    try {
        const stats = await ChatbotDatabase.getKeyMessageStats();
        res.json({ stats });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch key message stats' });
    }
});

// DELETE endpoint for clearing user's key messages
app.delete('/api/key-messages/user/:userId', async (req: Request, res: Response) => {
    try {
        // Check database connection first
        const dbHealthy = await ChatbotDatabase.testConnection();
        if (!dbHealthy) {
            return res.status(503).json({ error: 'Database is currently unavailable' });
        }
        
        const { userId } = req.params;
        const deletedCount = await ChatbotDatabase.clearUserKeyMessages(userId);
        res.json({ message: `Deleted ${deletedCount} key messages for user ${userId}`, deletedCount });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to clear user key messages: ' + error.message });
    }
});

// Start server - Docker Compose ensures all dependencies are ready
server.listen(PORT, () => {
    console.log(`🚀 Chatbot backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
});
