FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy static files
COPY public ./public

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
