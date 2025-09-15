#!/usr/bin/env zsh

# Source zsh configurations
source ~/.zshrc  # Adjust this if your configuration is stored elsewhere

# Run database migrations before starting
echo "Running DB migrations..."
python3 scripts/migrate.py

# Navigate to the backend directory and start the backend server
echo "Starting the backend server..."
cd backend
python backend.py &
BACKEND_PID=$!

# Wait for a few seconds to ensure the backend server starts before the frontend
sleep 5

# Navigate to the project root and start the frontend application
echo "Starting the frontend application..."

# Start the frontend using npm prefix, assuming deps are installed
npm --prefix ../frontend run dev &

# Optional: if you want to stop both servers when this script is interrupted
trap "echo 'Stopping servers...'; kill $BACKEND_PID; exit 1" INT

# Keep the script running until it receives a CTRL+C or any interrupt signal
wait
