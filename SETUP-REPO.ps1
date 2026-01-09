# PowerShell setup script for extracting knowshowgo-js to a separate repository

param(
    [string]$RepoName = "knowshowgo",
    [string]$GitHubUser = "lehelkovach"
)

Write-Host "Setting up KnowShowGo JavaScript repository: $RepoName" -ForegroundColor Cyan
Write-Host "GitHub user: $GitHubUser" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the knowshowgo-js directory." -ForegroundColor Red
    exit 1
}

# Update package.json with correct repository URL
Write-Host "Updating package.json with repository URL..." -ForegroundColor Yellow
$packageJson = Get-Content package.json -Raw
$packageJson = $packageJson -replace "yourusername", $GitHubUser
$packageJson = $packageJson -replace "knowshowgo-js", $RepoName
Set-Content package.json $packageJson

# Initialize git if not already initialized
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit: KnowShowGo JavaScript implementation"
}

# Add remote if not already added
$remotes = git remote
if (-not ($remotes -contains "origin")) {
    Write-Host "Adding remote origin..." -ForegroundColor Yellow
    git remote add origin "https://github.com/${GitHubUser}/${RepoName}.git"
} else {
    Write-Host "Remote origin already exists. Updating..." -ForegroundColor Yellow
    git remote set-url origin "https://github.com/${GitHubUser}/${RepoName}.git"
}

Write-Host ""
Write-Host "Setup complete! Next steps:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Create the repository on GitHub:"
Write-Host "   https://github.com/new"
Write-Host "   Name: ${RepoName}"
Write-Host "   Visibility: Public or Private"
Write-Host ""
Write-Host "2. Push to GitHub:"
Write-Host "   git push -u origin main"
Write-Host ""
Write-Host "3. (Optional) Create and push to a 'main' branch if needed:"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"

