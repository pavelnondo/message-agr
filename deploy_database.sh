#!/bin/bash

# Database Deployment Script for n8n Workflow
# This script sets up the database with the new schema

set -e

echo "🚀 Starting database deployment for n8n workflow..."

# Check if we're on the VPS
if [ ! -f "/etc/debian_version" ]; then
    echo "❌ This script should be run on the VPS"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection details
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"message_aggregator"}
DB_USER=${DB_USER:-"postgres"}

echo "📊 Database Configuration:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"

# Function to check if PostgreSQL is running
check_postgres() {
    if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; then
        echo "❌ PostgreSQL is not running or not accessible"
        echo "   Please ensure PostgreSQL is running and accessible"
        exit 1
    fi
    echo "✅ PostgreSQL is running"
}

# Function to create database if it doesn't exist
create_database() {
    echo "🔍 Checking if database exists..."
    if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        echo "📝 Creating database $DB_NAME..."
        createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        echo "✅ Database created successfully"
    else
        echo "✅ Database already exists"
    fi
}

# Function to apply database schema
apply_schema() {
    echo "📋 Applying database schema..."
    
    # Check if setup_database.sql exists
    if [ ! -f "setup_database.sql" ]; then
        echo "❌ setup_database.sql not found"
        exit 1
    fi
    
    # Apply the schema
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f setup_database.sql
    
    echo "✅ Database schema applied successfully"
}

# Function to verify the schema
verify_schema() {
    echo "🔍 Verifying database schema..."
    
    # Check if tables exist
    TABLES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    
    REQUIRED_TABLES=("bot_settings" "chats" "messages")
    
    for table in "${REQUIRED_TABLES[@]}"; do
        if echo "$TABLES" | grep -q "$table"; then
            echo "✅ Table $table exists"
        else
            echo "❌ Table $table is missing"
            exit 1
        fi
    done
    
    # Check if bot_settings has data
    SETTINGS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM bot_settings;" | xargs)
    if [ "$SETTINGS_COUNT" -gt 0 ]; then
        echo "✅ Bot settings are configured"
    else
        echo "⚠️  Bot settings table is empty"
    fi
    
    echo "✅ Database schema verification complete"
}

# Function to show database status
show_status() {
    echo "📊 Database Status:"
    
    # Count records in each table
    CHATS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM chats;" | xargs)
    MESSAGES_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM messages;" | xargs)
    SETTINGS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM bot_settings;" | xargs)
    
    echo "   Chats: $CHATS_COUNT"
    echo "   Messages: $MESSAGES_COUNT"
    echo "   Bot Settings: $SETTINGS_COUNT"
}

# Main execution
main() {
    echo "🔧 Database deployment for n8n workflow"
    echo "======================================"
    
    # Check PostgreSQL
    check_postgres
    
    # Create database if needed
    create_database
    
    # Apply schema
    apply_schema
    
    # Verify schema
    verify_schema
    
    # Show status
    show_status
    
    echo ""
    echo "🎉 Database deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Restart the backend service: sudo systemctl restart message-aggregator"
    echo "2. Check the logs: sudo journalctl -u message-aggregator -f"
    echo "3. Test the API: curl http://localhost:3001/health"
}

# Run main function
main "$@"
