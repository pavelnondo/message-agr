#!/bin/bash

# Start the backend application
cd /root/message_aggregator/backend

# Kill any existing process
pkill -f "python3.*main.py"
pkill -f "uvicorn.*main:app"

# Start the application
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 3001 > /root/backend.log 2>&1 &

echo "Backend started. Check logs with: tail -f /root/backend.log"
echo "Test with: curl http://localhost:3001/health"



