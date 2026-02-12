# Deployment Instructions for HACS

Follow these steps to deploy your Weather Chart Card to HACS.

## Step 1: Add Required Files to Repository

Copy these files to your repository root:

```
weather-chart-card-ha/
├── .github/
│   └── workflows/
│       ├── release.yml          # ✅ Created
│       └── validate.yml         # ✅ Created
├── hacs.json                    # ✅ Created
├── info.md                      # ✅ Created
├── LICENSE                      # ✅ Created
└── README.md                    # ✅ Updated
```

## Step 2: Commit and Push Files

```bash
# Navigate to your repository
cd /path/to/weather-chart-card-ha

# Copy the new files from Claude's workspace
cp /home/claude/hacs.json .
cp /home/claude/info.md .
cp /home/claude/LICENSE .
cp /home/claude/README.md .
cp -r /home/claude/.github .

# Stage all changes
git add .

# Commit
git commit -m "Prepare for HACS publication

- Add hacs.json configuration
- Add info.md for HACS store
- Add MIT LICENSE
- Update README.md with comprehensive documentation
- Add GitHub Actions workflows for releases and validation"

# Push to GitHub
git push origin main
```

## Step 3: Create Your First Release

```bash
# Make sure everything is committed and pushed
git status

# Create version tag
git tag -a v1.0.0 -m "Release v1.0.0 - Initial HACS publication

Features:
- Temperature gradient colors
- Date labels with day names
- Large animated weather icons
- Day/night temperature distinction (dashed lines)
- Timezone support for multiple locations
- Unit conversion (°F/°C, inHg/mmHg/hPa)
- Customizable icon sizes and layouts"

# Push the tag
git push origin v1.0.0
```

The GitHub Action will automatically:
1. Build your card
2. Create a GitHub Release
3. Attach `weather-chart-card-ha.js` to the release

## Step 4: Verify Release

1. Go to: https://github.com/w4mhi/weather-chart-card-ha/releases
2. Verify release v1.0.0 exists
3. Verify `weather-chart-card-ha.js` is attached to the release
4. Download and test the file locally

## Step 5: Submit to HACS

1. Go to: https://github.com/hacs/default/issues/new/choose
2. Click **"Add to default"**
3. Fill in the template:

```
Repository: https://github.com/w4mhi/weather-chart-card-ha
Category: plugin
Description: Enhanced weather chart card with temperature gradients, timezone support, and customizable layouts
```

4. Submit the issue
5. Wait for HACS team review (usually 1-7 days)

## Step 6: Respond to Review

The HACS team may request changes. Common requests:
- Fix typos in documentation
- Add missing screenshots
- Clarify installation instructions
- Update configuration examples

Respond promptly and make requested changes.

## Step 7: Celebrate! 🎉

Once approved, your card will be available in HACS for all Home Assistant users!

## Future Updates

When you release new versions:

```bash
# Make your changes
git add .
git commit -m "Add new feature X"
git push

# Create new version tag
git tag -a v1.1.0 -m "Release v1.1.0 - Add feature X"
git push origin v1.1.0
```

The GitHub Action will automatically create the release.

## Troubleshooting

### Build Fails

Check `package.json` has correct build script:
```json
{
  "scripts": {
    "build": "rollup -c"
  }
}
```

### Release Not Created

1. Check GitHub Actions tab for errors
2. Verify `GITHUB_TOKEN` has write permissions
3. Check tag format is `v*.*.*` (e.g., v1.0.0)

### HACS Rejection

Common reasons:
- Missing required files
- No releases with JS file attached
- Invalid hacs.json format
- Repository not public

Fix issues and resubmit!

---

**Need help?** Open an issue on GitHub or ask in the Home Assistant community forums.