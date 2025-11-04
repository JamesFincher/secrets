#!/bin/bash
# Abyrith Remote Development - Claude Code Launcher
# This script starts Claude Code in a persistent tmux session for mobile access

PROJECT_DIR="/Users/james/code/secrets"
SESSION_NAME="abyrith-claude"

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Check if tmux session already exists
if tmux list-sessions 2>/dev/null | grep -q "^$SESSION_NAME:"; then
    echo "✅ Claude Code session '$SESSION_NAME' is already running"
    echo ""
    echo "To attach from this Mac:"
    echo "  tmux attach-session -t $SESSION_NAME"
    echo ""
    echo "To attach from your phone:"
    echo "  1. SSH into this Mac: ssh james@10.0.0.151"
    echo "  2. Attach to session: tmux attach-session -t $SESSION_NAME"
    echo ""
    tmux list-sessions | grep "^$SESSION_NAME:"
else
    echo "🚀 Starting new Claude Code session '$SESSION_NAME'..."

    # Start Claude Code in a new detached tmux session
    tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR"

    # Send the claude command to the session
    tmux send-keys -t "$SESSION_NAME" "claude" Enter

    # Wait a moment for session to initialize
    sleep 2

    echo "✅ Claude Code session started successfully!"
    echo ""
    echo "Session details:"
    tmux list-sessions | grep "^$SESSION_NAME:"
    echo ""
    echo "📱 Connect from your phone:"
    echo "  1. Install Termius (iOS/Android) or Blink Shell (iOS)"
    echo "  2. Import the SSH key from ~/.ssh/mobile_key"
    echo "  3. SSH connection details:"
    echo "     - Address: 10.0.0.151"
    echo "     - Port: 22"
    echo "     - Username: james"
    echo "     - Auth: SSH Key (mobile_key)"
    echo "  4. Once connected, run:"
    echo "     tmux attach-session -t $SESSION_NAME"
    echo ""
    echo "💻 Connect from this Mac:"
    echo "  tmux attach-session -t $SESSION_NAME"
    echo ""
    echo "🛑 To stop the session:"
    echo "  tmux kill-session -t $SESSION_NAME"
fi
