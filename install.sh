#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}✔${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✖${NC} $1"; }

REQUIRED_SCOPES="repo,project,workflow,read:org"

echo ""
echo "  🐵 SunwuAI CLI Installer"
echo "  ========================"
echo ""

# Step 1: Check Node.js
info "Checking Node.js..."
if ! command -v node &> /dev/null; then
  err "Node.js not found. Install: https://nodejs.org (>= 18)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js >= 18 required. Current: $(node -v)"
  exit 1
fi
log "Node.js $(node -v)"

# Step 2: Check if already installed
if command -v sunwuai &> /dev/null; then
  CURRENT_VERSION=$(sunwuai --version 2>/dev/null || echo "unknown")
  echo ""
  warn "sunwuai v${CURRENT_VERSION} is already installed"
  echo ""
  echo "  What would you like to do?"
  echo "  1) Update to latest version"
  echo "  2) Uninstall"
  echo "  3) Cancel"
  echo ""
  read -p "  Choose [1/2/3]: " CHOICE

  case $CHOICE in
    1)
      info "Updating sunwuai CLI..."
      npm install -g github:ZJU-marketing/cli 2>&1
      NEW_VERSION=$(sunwuai --version 2>/dev/null || echo "unknown")
      log "Updated to sunwuai v${NEW_VERSION}"
      echo ""
      exit 0
      ;;
    2)
      info "Uninstalling sunwuai CLI..."
      npm uninstall -g sunwuai 2>&1
      log "sunwuai uninstalled"
      echo ""
      exit 0
      ;;
    3)
      info "Cancelled"
      exit 0
      ;;
    *)
      err "Invalid choice"
      exit 1
      ;;
  esac
fi

# Step 3: Check gh CLI
info "Checking GitHub CLI..."
GH_CMD=""
if command -v gh &> /dev/null; then
  GH_CMD="gh"
elif [ -x /snap/bin/gh ]; then
  GH_CMD="/snap/bin/gh"
fi

if [ -z "$GH_CMD" ]; then
  err "GitHub CLI not found. Install: https://cli.github.com"
  exit 1
fi
log "GitHub CLI found: $GH_CMD"

# Step 4: Check auth & scopes
info "Checking GitHub authentication..."
AUTH_STATUS=$($GH_CMD auth status 2>&1 || true)

if echo "$AUTH_STATUS" | grep -q "not logged"; then
  warn "Not logged in to GitHub"
  info "Logging in with required scopes: $REQUIRED_SCOPES"
  echo ""
  $GH_CMD auth login -s "$REQUIRED_SCOPES"
  echo ""
  log "GitHub login successful"
else
  log "Already logged in to GitHub"

  # Check scopes
  MISSING=""
  for scope in repo project workflow read:org; do
    if ! echo "$AUTH_STATUS" | grep -q "$scope"; then
      MISSING="$MISSING $scope"
    fi
  done

  if [ -n "$MISSING" ]; then
    warn "Missing scopes:$MISSING"
    info "Re-authenticating with required scopes..."
    echo ""
    $GH_CMD auth refresh -s "$REQUIRED_SCOPES"
    echo ""
    log "Scopes updated"
  else
    log "All required scopes present"
  fi
fi

# Step 5: Install CLI
info "Installing sunwuai CLI..."
npm install -g github:ZJU-marketing/cli 2>&1
log "sunwuai CLI installed"

# Step 6: Verify
info "Verifying installation..."
if command -v sunwuai &> /dev/null; then
  log "sunwuai $(sunwuai --version) installed successfully"
else
  err "Installation failed. Try: npm install -g github:ZJU-marketing/cli"
  exit 1
fi

echo ""
echo "  ✅ Installation complete!"
echo ""
echo "  Next steps:"
echo "    sunwuai sync          # Sync memory + skills"
echo "    sunwuai auth status   # Check auth status"
echo "    sunwuai --help        # See all commands"
echo ""
