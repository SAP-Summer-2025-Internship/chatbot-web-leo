FROM node:18-alpine

# Set npm registry to a mirror that might work better
RUN npm config set registry https://registry.npmjs.org/

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with retry settings
RUN npm install --retry 3

# Copy source code
COPY src ./src
COPY public ./public

# Fix file permissions
RUN chmod -R 644 src/ public/ || true

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
