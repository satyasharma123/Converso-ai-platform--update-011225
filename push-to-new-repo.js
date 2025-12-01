#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const repoPath = "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform";

console.log("🚀 Pushing code to new repository...\n");

try {
  // Change to repository directory
  process.chdir(repoPath);
  
  console.log("📦 Staging all changes...");
  execSync('git add -A', { stdio: 'inherit', cwd: repoPath });
  
  console.log("\n📝 Checking for changes to commit...");
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: repoPath });
    if (status.trim()) {
      console.log("💾 Committing changes...");
      execSync(`git commit -m "Fix: Add toast notification for individual email favorite action and fix horizontal scroll with dynamic email body panel width

- Added toast notifications (success/error) when favoriting/unfavoriting individual emails via 3-dot menu
- Made email body panel width dynamic to prevent horizontal scroll when all panels are open
- Profile drawer now properly reserves space without causing page overflow"`, { stdio: 'inherit', cwd: repoPath });
    } else {
      console.log("✅ No changes to commit.");
    }
  } catch (e) {
    console.log("ℹ️  Changes may already be committed.");
  }
  
  console.log("\n🔗 Verifying remote URL...");
  const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8', cwd: repoPath }).trim();
  console.log(`   Current remote: ${remoteUrl}`);
  
  const newRemote = 'https://github.com/satyasharma123/Converso-ai-platform--update-011225.git';
  if (remoteUrl !== newRemote) {
    console.log(`\n🔄 Updating remote to: ${newRemote}`);
    execSync(`git remote set-url origin ${newRemote}`, { stdio: 'inherit', cwd: repoPath });
  } else {
    console.log("\n✅ Remote already configured correctly.");
  }
  
  console.log("\n📤 Pushing to new repository (main branch)...");
  execSync('git push -u origin main', { stdio: 'inherit', cwd: repoPath });
  
  console.log("\n✅ Success! Code has been pushed to:");
  console.log(`   https://github.com/satyasharma123/Converso-ai-platform--update-011225.git`);
  
} catch (error) {
  console.error("\n❌ Error occurred:");
  console.error(error.message);
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
}


