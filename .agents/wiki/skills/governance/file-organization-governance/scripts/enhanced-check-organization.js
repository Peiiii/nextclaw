#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const FILE_THRESHOLD = 15;  // 当目录文件数超过此值时警告
const LAYER_THRESHOLD = 8;  // 当模块文件数超过此值时建议分层
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function analyzeDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const sourceFiles = files.filter(file => {
    const ext = path.extname(file);
    return EXTENSIONS.includes(ext);
  });

  if (sourceFiles.length > FILE_THRESHOLD) {
    console.log(`⚠️  目录 ${dirPath} 有 ${sourceFiles.length} 个源文件 (阈值: ${FILE_THRESHOLD})`);
    
    // 分析语义分组
    const groups = groupFilesByModule(sourceFiles);
    console.log('💡 建议模块化分组:');
    Object.keys(groups).forEach(group => {
      if (groups[group].length > 1) {
        console.log(`   ${group}: ${groups[group].length} 个文件`);
        
        // 如果模块内的文件数超过分层阈值，建议进一步分层
        if (groups[group].length > LAYER_THRESHOLD) {
          console.log(`      🔷 模块 "${group}" 文件较多，建议内部再分层 (controllers, services, utils 等)`);
        }
      }
    });
    
    return { 
      dirPath, 
      fileCount: sourceFiles.length, 
      groups,
      needsLayering: Object.values(groups).some(group => group.length > LAYER_THRESHOLD)
    };
  }
  
  return null;
}

function groupFilesByModule(files) {
  const groups = {};
  
  files.forEach(file => {
    const name = file.toLowerCase().replace(/\.test\.ts$/, '').replace(/\.ts$/, '');
    
    // 提取模块关键词
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
    } else if (name.includes('agent')) {
      category = 'agent';
    } else if (name.includes('mcp')) {
      category = 'mcp';
    } else if (name.includes('cli')) {
      category = 'cli';
    } else if (name.includes('platform')) {
      category = 'platform';
    }
    
    if (!groups[category]) groups[category] = [];
    groups[category].push(file);
  });
  
  return groups;
}

function analyzeForLayers(moduleFiles) {
  const layers = {
    controllers: [],
    services: [],
    utils: [],
    types: [],
    hooks: [],
    components: [],
    other: []
  };
  
  moduleFiles.forEach(file => {
    const name = file.toLowerCase();
    
    if (name.includes('controller') || name.includes('handler')) {
      layers.controllers.push(file);
    } else if (name.includes('service') || name.includes('manager')) {
      layers.services.push(file);
    } else if (name.includes('util') || name.includes('helper')) {
      layers.utils.push(file);
    } else if (name.includes('type') || name.includes('interface') || name.includes('model')) {
      layers.types.push(file);
    } else if (name.includes('hook')) {
      layers.hooks.push(file);
    } else if (name.includes('component') || name.includes('ui') || name.includes('view')) {
      layers.components.push(file);
    } else {
      layers.other.push(file);
    }
  });
  
  return layers;
}

function traverseDirectory(rootDir) {
  const issues = [];
  
  function walk(currentDir) {
    const stat = fs.statSync(currentDir);
    
    if (stat.isDirectory() && !path.basename(currentDir).startsWith('.')) {
      // 跳过 node_modules 和构建输出目录
      if (path.basename(currentDir) !== 'node_modules' && 
          !path.basename(currentDir).endsWith('dist') &&
          !path.basename(currentDir).endsWith('build')) {
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
  }
  
  walk(rootDir);
  return issues;
}

// 主执行逻辑
if (require.main === module) {
  const targetDir = process.argv[2] || './packages/nextclaw/src';
  console.log(`🔍 分析目录: ${targetDir}\n`);
  
  const issues = traverseDirectory(targetDir);
  
  if (issues.length === 0) {
    console.log('✅ 未检测到组织问题。');
  } else {
    console.log(`\n📋 发现 ${issues.length} 个需要重构的目录:`);
    issues.forEach(issue => {
      console.log(`\n📁 ${issue.dirPath} (${issue.fileCount} 个文件)`);
      
      // 显示模块化建议
      Object.keys(issue.groups).forEach(group => {
        if (issue.groups[group].length > 1) {
          console.log(`   🗂️  模块: ${group} (${issue.groups[group].length} 个文件)`);
          
          // 如果该模块需要分层，显示分层建议
          if (issue.groups[group].length > LAYER_THRESHOLD) {
            console.log(`      🔷 建议分层结构:`);
            
            // 模拟分析该组文件的潜在分层
            const sampleLayers = analyzeForLayers(issue.groups[group]);
            Object.keys(sampleLayers).filter(layer => sampleLayers[layer].length > 0).forEach(layer => {
              if (sampleLayers[layer].length > 0) {
                console.log(`         📁 ${layer}/ (${sampleLayers[layer].length} 个文件)`);
              }
            });
          }
        }
      });
    });
    
    console.log('\n💡 重构建议:');
    console.log('- 按功能模块创建子目录');
    console.log('- 对于文件数较多的模块，考虑内部按职责分层');
    console.log('- 保持模块和层的职责单一');
    console.log('- 更新相应的导入路径');
  }
}

module.exports = { 
  analyzeDirectory, 
  groupFilesByModule, 
  analyzeForLayers,
  traverseDirectory 
};
