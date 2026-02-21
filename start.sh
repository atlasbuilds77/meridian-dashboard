#!/bin/bash
# Production start script for Render
# Binds to 0.0.0.0 and uses PORT environment variable

PORT=${PORT:-10000}
echo "Starting Next.js on 0.0.0.0:$PORT"
next start -H 0.0.0.0 -p $PORT
