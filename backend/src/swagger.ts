import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chatbot API',
      version: '1.0.0',
      description: 'A simple chatbot API with real-time messaging capabilities',
      contact: {
        name: 'API Support',
        email: 'support@chatbot.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Development server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Container internal server'
      }
    ],
    components: {
      schemas: {
        ChatMessage: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'The message to send to the chatbot',
              example: 'Hello, how are you?'
            }
          }
        },
        ChatResponse: {
          type: 'object',
          properties: {
            response: {
              type: 'string',
              description: 'The chatbot response',
              example: 'Hello! I am doing well, thank you for asking. How can I help you today?'
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              description: 'The health status of the service'
            },
            ollama: {
              type: 'string',
              enum: ['connected', 'disconnected'],
              description: 'The connection status to Ollama'
            },
            url: {
              type: 'string',
              description: 'The Ollama service URL'
            },
            version: {
              type: 'object',
              description: 'Ollama version information'
            },
            error: {
              type: 'string',
              description: 'Error message if service is unhealthy'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Message is required'
            }
          }
        },
        SocketEvent: {
          type: 'object',
          properties: {
            eventName: {
              type: 'string',
              description: 'Socket.io event name'
            },
            data: {
              type: 'string',
              description: 'Event data'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Chat',
        description: 'Chat API endpoints'
      },
      {
        name: 'Socket.io',
        description: 'Real-time messaging via Socket.io'
      }
    ]
  },
  apis: ['./src/**/*.ts'], // Path to the API files
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export const setupSwagger = (app: Express): void => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Chatbot API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    }
  }));

  // Raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default swaggerSpec;
