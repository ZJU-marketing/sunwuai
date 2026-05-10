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

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

as_root() {
  [ "$(id -u)" -eq 0 ]
}

pkg_install() {
  local pkg="$1"

  if have_cmd apt-get; then
    info "Installing ${pkg} via apt-get..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y && apt-get install -y "$pkg"
    return $?
  fi

  if have_cmd apt; then
    info "Installing ${pkg} via apt..."
    export DEBIAN_FRONTEND=noninteractive
    apt update -y && apt install -y "$pkg"
    return $?
  fi

  if have_cmd dnf; then
    info "Installing ${pkg} via dnf..."
    dnf install -y "$pkg"
    return $?
  fi

  if have_cmd yum; then
    info "Installing ${pkg} via yum..."
    yum install -y "$pkg"
    return $?
  fi

  if have_cmd zypper; then
    info "Installing ${pkg} via zypper..."
    zypper --non-interactive install "$pkg"
    return $?
  fi

  return 1
}

ensure_pkg() {
  local cmd="$1"
  local pkg="$2"
  local human_name="$3"
  local install_hint="$4"

  if have_cmd "$cmd"; then
    return 0
  fi

  warn "${human_name} not found"

  if as_root; then
    if pkg_install "$pkg"; then
      log "${human_name} installed"
      return 0
    fi
    warn "Auto-install failed for ${human_name}"
  else
    warn "No root privileges; cannot auto-install ${human_name}"
  fi

  err "${human_name} is required. Install it manually: ${install_hint}"
  exit 1
}

echo ""
echo "  🐵 SunwuAI CLI Installer"
echo "  ========================"
echo ""

# Step 1: Check Node.js
info "Checking Node.js..."
if ! have_cmd node; then
  err "Node.js not found. Please install Node.js >= 18 first: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js >= 18 required. Current: $(node -v)"
  exit 1
fi
log "Node.js $(node -v)"

# Step 1.5: Ensure base tools needed by installer exist
info "Checking base tooling..."
ensure_pkg git git "Git" "https://git-scm.com/downloads"
ensure_pkg npm npm "npm" "https://nodejs.org"
log "Base tooling ready"

# Step 2: Check if already installed
ALREADY_INSTALLED=false
if command -v sunwuai &> /dev/null; then
  CURRENT_VERSION=$(sunwuai --version 2>/dev/null || echo "unknown")
  ALREADY_INSTALLED=true
  warn "sunwuai v${CURRENT_VERSION} is already installed"
fi

# Step 3: Check gh CLI
info "Checking GitHub CLI..."
if ! have_cmd gh && [ ! -x /snap/bin/gh ]; then
  warn "GitHub CLI not found"

  if as_root; then
    if pkg_install gh; then
      log "GitHub CLI installed"
    else
      err "GitHub CLI install failed. Install manually: https://cli.github.com"
      exit 1
    fi
  else
    err "GitHub CLI not found. Install manually: https://cli.github.com"
    exit 1
  fi
fi

GH_CMD=""
if have_cmd gh; then
  GH_CMD="gh"
elif [ -x /snap/bin/gh ]; then
  GH_CMD="/snap/bin/gh"
fi

if [ -z "$GH_CMD" ]; then
  err "GitHub CLI not found after installation. Install: https://cli.github.com"
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

# Step 5: Install / Update CLI
TMPDIR_CLI="/tmp/sunwuai-cli-install"
rm -rf "$TMPDIR_CLI"
info "Downloading latest CLI..."
$GH_CMD repo clone ZJU-marketing/sunwu-cli "$TMPDIR_CLI" -- --depth=1 2>&1
cd "$TMPDIR_CLI"

# Pack and install globally (ensures dependencies are included)
TARBALL=$(npm pack 2>/dev/null | tail -1)

# Clean up any broken previous install
npm uninstall -g sunwuai 2>/dev/null || true

if [ "$ALREADY_INSTALLED" = true ]; then
  info "Updating sunwuai CLI..."
  npm install -g "$TARBALL" 2>&1
  NEW_VERSION=$(sunwuai --version 2>/dev/null || echo "unknown")
  if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
    log "Already at latest version (v${NEW_VERSION})"
  else
    log "Updated: v${CURRENT_VERSION} → v${NEW_VERSION}"
  fi
else
  info "Installing sunwuai CLI..."
  npm install -g "$TARBALL" 2>&1
  log "sunwuai CLI installed"
fi
cd /
rm -rf "$TMPDIR_CLI"

# Step 6: Verify
info "Verifying installation..."
NPM_BIN="$(npm prefix -g)/bin"
if command -v sunwuai &> /dev/null; then
  log "sunwuai $(sunwuai --version) installed successfully"
elif [ -x "$NPM_BIN/sunwuai" ]; then
  log "sunwuai $($NPM_BIN/sunwuai --version) installed successfully"
  warn "npm global bin not in PATH. Add to your shell profile:"
  echo "    export PATH=\"$NPM_BIN:\$PATH\""
else
  err "Installation failed."
  info "Debug: npm prefix = $(npm prefix -g)"
  info "Debug: ls bin = $(ls $NPM_BIN/sunwu* 2>/dev/null || echo 'not found')"
  info "Debug: npm ls -g sunwuai = $(npm ls -g sunwuai 2>/dev/null || echo 'not found')"
  exit 1
fi

echo ""
echo "  ✅ Installation complete!"
echo ""

echo "  Starting guided onboarding..."
echo "  (Set SUNWUAI_SKIP_ONBOARD=1 to skip)"
echo ""
if [ "${SUNWUAI_SKIP_ONBOARD:-0}" != "1" ]; then
  if command -v sunwuai >/dev/null 2>&1; then
    sunwuai onboard --auto-fix || true
  elif [ -x "$NPM_BIN/sunwuai" ]; then
    "$NPM_BIN/sunwuai" onboard --auto-fix || true
  fi
fi

echo ""
echo "  Next steps:"
echo "    gh auth login -s $REQUIRED_SCOPES   # if not logged in yet"
echo "    sunwuai onboard --auto-fix          # rerun one-shot setup + checks"
echo "    sunwuai sync                        # sync memory + skills"
echo "    sunwuai --help                      # see all commands"
echo ""
