# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Remove conflicting lock files and install dependencies
RUN rm -f package-lock.json bun.lockb && npm install

# Copy source code
COPY . .

# Expose the development port
EXPOSE 5173

# Start the development server with host binding for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"] 
