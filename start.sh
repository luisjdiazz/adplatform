#!/bin/sh
# Start the autopilot worker in background
node worker.js &

# Start the Next.js app (foreground)
node server.js
