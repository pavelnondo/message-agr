#!/bin/bash

# Simple script to run on VPS
# Copy this script to your VPS and run it

echo "🚀 Downloading and running VPS setup..."

# Download the setup script
curl -O https://raw.githubusercontent.com/tim2004timi/message_aggregator/main/vps_setup.sh

# Make it executable
chmod +x vps_setup.sh

# Run the setup
./vps_setup.sh 