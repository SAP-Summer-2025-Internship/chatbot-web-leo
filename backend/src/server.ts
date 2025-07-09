import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios, { AxiosResponse } from 'axios';
import cors from 'cors';

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

// Health check endpoint
app.get('/health', async (_: Request, res: Response<HealthResponse>) => {
    try {
        // Use the same URL pattern as the main function
        const healthUrl: string = OLLAMA_URL.replace('/api/generate', '/api/version');
        const response: AxiosResponse = await axios.get(healthUrl, { timeout: 5000 });
        res.json({ 
            status: 'healthy', 
            ollama: 'connected',
            url: healthUrl,
            version: response.data 
        });
    } catch (error: any) {
        res.status(500).json({ 
            status: 'unhealthy', 
            ollama: 'disconnected',
            url: OLLAMA_URL.replace('/api/generate', '/api/version'),
            error: error.message 
        });
    }
});

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

// Function to get response from Ollama
async function getBotResponse(message: string): Promise<string> {
    try {
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

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Send welcome message
    socket.emit('bot-message', 'Welcome! I\'m your chatbot assistant. How can I help you today?');
    
    socket.on('user-message', async (message: string) => {
        console.log('User message:', message);
        
        // Get bot response from Ollama
        const botResponse: string = await getBotResponse(message);
        
        // Send response back to user
        socket.emit('bot-message', botResponse);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Chatbot backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
