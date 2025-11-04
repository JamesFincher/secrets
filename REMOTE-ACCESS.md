# Remote Access Setup - Abyrith Documentation

## Quick Start

### Start Claude Code Session
```bash
./start-claude-remote.sh
```

### Connect from Phone
```
1. SSH into Mac: ssh james@10.0.0.151
2. Attach to session: tmux attach-session -t abyrith-claude
```

---

## Connection Details

**Mac IP Address:** `10.0.0.151`
**Username:** `james`
**SSH Port:** `22`
**SSH Key:** `~/.ssh/mobile_key` (private key on phone)
**tmux Session Name:** `abyrith-claude`

---

## Phone Setup Instructions

### Option 1: Termius (iOS/Android) - Free

1. **Download Termius** from App Store or Google Play
2. **Import SSH Key:**
   - Transfer `~/.ssh/mobile_key` to your phone (AirDrop or secure transfer)
   - In Termius: Settings → Keychain → Import → Select mobile_key file
3. **Add Host:**
   - Tap "+" → New Host
   - Label: "Mac Dev - Abyrith"
   - Address: `10.0.0.151`
   - Port: `22`
   - Username: `james`
   - Key: Select "mobile_key" from keychain
4. **Connect:**
   - Tap "Mac Dev - Abyrith"
   - Once logged in: `tmux attach-session -t abyrith-claude`

### Option 2: Blink Shell (iOS) - Premium ($19.99/year)

1. **Download Blink Shell** from App Store
2. **Import SSH Key:**
   - Transfer `~/.ssh/mobile_key` to Files app
   - In Blink: Settings → Keys → Import → Select mobile_key
3. **Add Host:**
   - Type: `config`
   - Add entry:
     ```
     Host mac
         HostName 10.0.0.151
         User james
         IdentityFile mobile_key
         Port 22
     ```
4. **Connect:**
   - Type: `ssh mac`
   - Once logged in: `tmux attach-session -t abyrith-claude`

---

## tmux Quick Reference

| Action | Command |
|--------|---------|
| Attach to session | `tmux attach-session -t abyrith-claude` |
| Detach (keep running) | `Ctrl+B`, then `D` |
| List sessions | `tmux list-sessions` |
| Kill session | `tmux kill-session -t abyrith-claude` |
| Toggle status bar | `Ctrl+B`, then `s` |
| Split pane horizontal | `Ctrl+B`, then `\|` |
| Split pane vertical | `Ctrl+B`, then `-` |
| Navigate panes | `Alt + Arrow Keys` |
| Scroll mode | `Ctrl+B`, then `[` (exit with `q`) |
| Reload config | `Ctrl+B`, then `r` |

---

## Claude Code Quick Reference

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/clear` | Clear conversation context |
| `/exit` or `Ctrl+D` | Exit Claude Code (tmux stays running) |
| `Ctrl+C` | Interrupt current task |
| `@./path/to/file` | Reference a file in prompt |
| `@./` | Reference entire codebase |

---

## Troubleshooting

### Can't Connect from Phone

**Check SSH is enabled on Mac:**
```bash
# On Mac terminal
sudo systemsetup -getremotelogin
# Should show: Remote Login: On

# If off, enable it:
sudo systemsetup -setremotelogin on
```

**Verify IP address hasn't changed:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Test connection from Mac to itself:**
```bash
ssh -i ~/.ssh/mobile_key james@10.0.0.151
```

### tmux Session Not Found

**List all sessions:**
```bash
tmux list-sessions
```

**Restart Claude Code session:**
```bash
./start-claude-remote.sh
```

### Claude Code Not Responding

**Kill and restart session:**
```bash
tmux kill-session -t abyrith-claude
./start-claude-remote.sh
```

### Connection Drops on Phone

**Use Mosh (with Blink Shell):**
- More stable for cellular connections
- Handles network changes automatically

**Increase keep-alive (already configured):**
- SSH config has `ServerAliveInterval 60` set

---

## Security Best Practices

- ✅ SSH key authentication (more secure than passwords)
- ✅ Dedicated mobile SSH key (can revoke without affecting other keys)
- ✅ Keep phone locked when not in use
- ✅ Use strong device passcode/biometrics
- ⚠️ Only connect on trusted networks (home WiFi recommended)
- ⚠️ Don't store sensitive API keys in session history

---

## Workflow Tips

### Scenario 1: Quick Code Review on the Go

```
1. Phone: ssh james@10.0.0.151
2. Phone: tmux attach-session -t abyrith-claude
3. Claude: "analyze the recent changes to the GitHub integration"
4. Claude: "are there any security issues I should address?"
5. Phone: Ctrl+B, D (detach - session keeps running)
```

### Scenario 2: Long-Running Documentation Task

```
1. Mac: ./start-claude-remote.sh
2. Mac: tmux attach-session -t abyrith-claude
3. Claude: "create all Phase 3 documentation using doc-creator agent"
4. Mac: Ctrl+B, D (detach - let it run)
5. Phone (later): ssh + tmux attach to check progress
6. Claude: Review completed docs, make adjustments
```

### Scenario 3: Multi-tasking with Panes

```
1. Phone: tmux attach-session -t abyrith-claude
2. Phone: Ctrl+B, | (split horizontal)
3. Left pane: Claude Code session
4. Right pane: git status, file browsing, logs
5. Phone: Alt+Arrow to switch between panes
```

---

## Files Created

- `~/.tmux.conf` - tmux configuration (mobile-optimized)
- `~/.ssh/mobile_key` - Private SSH key (transfer to phone)
- `~/.ssh/mobile_key.pub` - Public SSH key (on Mac)
- `~/.ssh/authorized_keys` - Authorized public keys
- `~/.ssh/config` - SSH client configuration
- `./start-claude-remote.sh` - Session startup script
- `./REMOTE-ACCESS.md` - This file

---

## Next Steps

1. **Enable SSH on Mac** (if not already):
   ```bash
   sudo systemsetup -setremotelogin on
   ```

2. **Transfer private key to phone:**
   - iOS: AirDrop `~/.ssh/mobile_key` to iPhone
   - Android: Use secure file transfer app

3. **Set up SSH client on phone** (Termius or Blink Shell)

4. **Start Claude Code session:**
   ```bash
   ./start-claude-remote.sh
   ```

5. **Test connection from phone:**
   ```
   ssh james@10.0.0.151
   tmux attach-session -t abyrith-claude
   ```

---

**You're all set! 🚀**

For questions or issues, refer to the troubleshooting section or check the full guide in your initial instructions.
