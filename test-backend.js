#!/usr/bin/env node

// Simple test script to verify backend commands
const { invoke } = require('@tauri-apps/api/core');
const fs = require('fs');

async function testBackend() {
  console.log('Testing ClipForge Backend Commands...\n');
  
  try {
    // Read sample project
    const projectJson = fs.readFileSync('./example/starproj-sample.json', 'utf8');
    console.log('✓ Loaded sample project');
    
    // Test metadata extraction for first video file
    const videoPath = '/Users/bdr/Git/GAUNTLET/clipforge-sample-02.mp4';
    console.log(`\nTesting metadata extraction for: ${videoPath}`);
    
    try {
      const metadata = await invoke('get_media_metadata', { path: videoPath });
      console.log('✓ Metadata extracted:', JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.log('✗ Metadata extraction failed:', error);
    }
    
    // Test project parsing
    console.log('\nTesting project parsing...');
    try {
      await invoke('apply_edits', { projectJson });
      console.log('✓ Project parsed successfully');
    } catch (error) {
      console.log('✗ Project parsing failed:', error);
    }
    
    // Test preview generation
    console.log('\nTesting preview generation at 500ms...');
    try {
      const preview = await invoke('generate_preview', { projectJson, atMs: 500 });
      console.log('✓ Preview generated:', JSON.stringify(preview, null, 2));
    } catch (error) {
      console.log('✗ Preview generation failed:', error);
    }
    
    console.log('\nBackend test completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testBackend();
}

module.exports = { testBackend };
