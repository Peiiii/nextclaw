#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const THRESHOLD = 15;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function analyzeDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const sourceFiles = files.filter(file => {
    const ext = path.extname(file);
    return EXTENSIONS.includes(ext);
  });

  if (sourceFiles.length > THRESHOLD) {
    console.log(`⚠️  Directory ${dirPath} has ${sourceFiles.length} source files (threshold: ${THRESHOLD})`);
    
    // Analyze semantic groupings
    const groups = groupFilesBySemantics(sourceFiles);
    console.log('💡 Suggested groupings:');
    Object.keys(groups).forEach(group => {
      if (groups[group].length > 1) {
        console.log(`   ${group}: ${groups[group].join(', ')}`);
      }
    });
    
    return { dirPath, fileCount: sourceFiles.length, groups };
  }
  
  return null;
}

function groupFilesBySemantics(files) {
  const groups = {};
  
  files.forEach(file => {
    const name = file.toLowerCase();
    
    // Extract semantic keywords
    let category = 'general';
    if (name.includes('service') || name.includes('gateway')) {
      category = 'service';
    } else if (name.includes('plugin')) {
      category = 'plugin';
    } else if (name.includes('config')) {
      category = 'config';
    } else if (name.includes('channel')) {
      category = 'channel';
    } else if (name.includes('diagnostic') || name.includes('diag')) {
      category = 'diagnostic';
    } else if (name.includes('cron') || name.includes('schedule')) {
      category = 'cron';
    } else if (name.includes('secret') || name.includes('auth')) {
      category = 'security';
    } else if (name.includes('remote')) {
      category = 'remote';
    } else if (name.includes('ncp')) {
      category = 'ncp';
    }
    
    if (!groups[category]) groups[category] = [];
    groups[category].push(file);
  });
  
  return groups;
}

function traverseDirectory(rootDir) {
  const issues = [];
  
  function walk(currentDir) {
    const stat = fs.statSync(currentDir);
    
    if (stat.isDirectory()) {
      const result = analyzeDirectory(currentDir);
      if (result) {
        issues.push(result);
      }
      
      const items = fs.readdirSync(currentDir);
      items.forEach(item => {
        walk(path.join(currentDir, item));
      });
    }
  }
  
  walk(rootDir);
  return issues;
}

// Main execution
if (require.main === module) {
  const targetDir = process.argv[2] || './packages/nextclaw/src/cli/commands';
  console.log(`🔍 Analyzing directory: ${targetDir}\n`);
  
  const issues = traverseDirectory(targetDir);
  
  if (issues.length === 0) {
    console.log('✅ No organization issues detected.');
  } else {
    console.log(`\n📋 Found ${issues.length} directories with organization issues:`);
    issues.forEach(issue => {
      console.log(`\n📁 ${issue.dirPath} (${issue.fileCount} files)`);
      Object.keys(issue.groups).forEach(group => {
        if (issue.groups[group].length > 1) {
          console.log(`   🗂️  ${group}: ${issue.groups[group].length} files`);
        }
      });
    });
  }
}

module.exports = { analyzeDirectory, groupFilesBySemantics, traverseDirectory };
