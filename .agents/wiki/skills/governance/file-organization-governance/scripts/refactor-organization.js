#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// This script performs the actual refactoring based on analysis
function performRefactoring(dirPath, analysisResult) {
  console.log(`🔄 Starting refactoring for: ${dirPath}`);
  
  // Create subdirectories for identified groups
  Object.keys(analysisResult.groups).forEach(group => {
    const groupSize = analysisResult.groups[group].length;
    if (groupSize > 1 && group !== 'general') {  // Don't create subdirs for general group
      const subDirPath = path.join(dirPath, group);
      if (!fs.existsSync(subDirPath)) {
        fs.mkdirSync(subDirPath, { recursive: true });
        console.log(`   📁 Created directory: ${group}/`);
        
        // Move files to new subdirectory
        analysisResult.groups[group].forEach(file => {
          const oldPath = path.join(dirPath, file);
          const newPath = path.join(subDirPath, file);
          
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`   📄 Moved: ${file} -> ${group}/`);
          }
        });
      }
    }
  });
  
  console.log(`✅ Refactoring completed for: ${dirPath}`);
}

// For now, we'll just export the function for manual use
// In a real scenario, this would be called from the skill handler

module.exports = { performRefactoring };
