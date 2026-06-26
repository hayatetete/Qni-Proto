#!/bin/bash

# Exit the script if any command fails
set -e

# Build the Vite project
cd /qni-gl/frontend
VITE_USE_GPU=true yarn build

# Start gunicorn
cd /qni-gl/backend
gunicorn --bind unix:/tmp/gunicorn.sock --daemon

# Start nginx
nginx

# Execute any passed command
cd /qni-gl
exec "$@"
