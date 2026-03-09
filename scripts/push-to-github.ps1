<#
PowerShell helper script to push this workspace to GitHub using Option B (web UI creation).

Usage:
  1. Run this script from PowerShell (ExecutionPolicy may need bypass):
     powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1

  2. The script will open the GitHub "Create a new repository" page in your browser.
     Create the repository with these settings:
       - Owner: itprakhar
       - Repository name: universal-ai-code-reviewer
       - Visibility: Public
       - Do NOT initialize with README, .gitignore, or license

  3. After creating the repo on GitHub, return to PowerShell and press Enter when prompted.
     The script will then initialize git locally (if needed), create `main`, commit, and push to the remote.

Security: This script does NOT use or store any Personal Access Tokens. If you choose HTTPS it will use your Git credential manager.
#>

param()

function Confirm-CommandAvailable {
    param([string]$cmd)
    $which = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $which) {
        Write-Host "ERROR: '$cmd' is not available on PATH. Please install it first." -ForegroundColor Red
        exit 1
    }
}

Confirm-CommandAvailable -cmd 'git'

$workspace = Resolve-Path -Path .
Write-Host "Workspace root: $workspace" -ForegroundColor Cyan

# Open GitHub new repo page in default browser to let user create repo via web UI
$createRepoUrl = 'https://github.com/new'
Write-Host "Opening GitHub Create Repo page in your browser..." -ForegroundColor Green
Start-Process $createRepoUrl

Write-Host "Please create the repository with these settings:" -ForegroundColor Yellow
Write-Host "  Owner: itprakhar" -ForegroundColor Yellow
Write-Host "  Repository name: universal-ai-code-reviewer" -ForegroundColor Yellow
Write-Host "  Visibility: Public" -ForegroundColor Yellow
Write-Host "  Do NOT initialize with README/.gitignore/license" -ForegroundColor Yellow

Read-Host -Prompt "Press Enter after you finish creating the repository on GitHub (or Ctrl+C to cancel)"

# Suggest remote URLs (SSH preferred)
$sshUrl = 'git@github.com:devcorns/universal-ai-code-reviewer.git'
$httpsUrl = 'https://github.com/devcorns/universal-ai-code-reviewer.git'

Write-Host "Suggested remote URLs:" -ForegroundColor Cyan
Write-Host "  SSH:   $sshUrl" -ForegroundColor DarkCyan
Write-Host "  HTTPS: $httpsUrl" -ForegroundColor DarkCyan

# Ask user to choose or enter remote URL
$remoteInput = Read-Host -Prompt "Enter remote git URL to use (press Enter to use SSH suggested URL)"
if ([string]::IsNullOrWhiteSpace($remoteInput)) { $remoteUrl = $sshUrl } else { $remoteUrl = $remoteInput }

Write-Host "Using remote: $remoteUrl" -ForegroundColor Green

# Initialize git if needed
if (-not (Test-Path .git)) {
    git init
    Write-Host "Initialized empty git repository." -ForegroundColor Green
} else {
    Write-Host "Git repository already initialized." -ForegroundColor Yellow
}

# Create main branch
try {
    git rev-parse --verify main > $null 2>&1
    Write-Host "Local branch 'main' already exists." -ForegroundColor Yellow
} catch {
    git checkout -b main
    Write-Host "Created and switched to branch 'main'" -ForegroundColor Green
}

# Add everything and commit if necessary
$hasCommit = $(git rev-parse --verify HEAD > $null 2>&1; if ($?) { $true } else { $false })
if (-not $hasCommit) {
    git add --all
    git commit -m "Initial commit — Universal AI Code Reviewer"
    Write-Host "Committed project files." -ForegroundColor Green
} else {
    Write-Host "Repository already has commits; skipping initial commit." -ForegroundColor Yellow
}

# Add remote
# If origin exists, show and ask whether to update
$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Remote 'origin' already exists: $existing" -ForegroundColor Yellow
    $replace = Read-Host -Prompt "Replace existing origin with $remoteUrl? (y/N)"
    if ($replace -match '^[Yy]') {
        git remote remove origin
        git remote add origin $remoteUrl
        Write-Host "Replaced origin with $remoteUrl" -ForegroundColor Green
    } else {
        Write-Host "Keeping existing remote origin." -ForegroundColor Yellow
    }
} else {
    git remote add origin $remoteUrl
    Write-Host "Added remote origin: $remoteUrl" -ForegroundColor Green
}

# Ensure branch name and push
git branch -M main
Write-Host "Pushing to origin main..." -ForegroundColor Cyan
try {
    git push -u origin main
    Write-Host "Push successful." -ForegroundColor Green
} catch {
    Write-Host "Push failed. Review the error above. You may need to authenticate (SSH key, credential manager, or PAT)." -ForegroundColor Red
}

Write-Host "\nNext steps:" -ForegroundColor Cyan
Write-Host " - Visit your repo: https://github.com/devcorns/universal-ai-code-reviewer" -ForegroundColor Cyan
Write-Host " - Create a Release and upload the VSIX:\n      universal-ai-code-reviewer-1.0.0.vsix (in workspace root)" -ForegroundColor Cyan
Start-Process 'https://github.com/devcorns/universal-ai-code-reviewer/releases/new'

Write-Host "Script complete." -ForegroundColor Green
