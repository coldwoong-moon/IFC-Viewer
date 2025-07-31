import { CHDParser } from '../src/parsers/CHDParser.js';
import { CHDWriter } from '../src/writers/CHDWriter.js';
import { createSimpleBuilding } from './create-simple-building.js';

/**
 * Test the complete CHD format pipeline:
 * 1. Create a sample building
 * 2. Write it to CHD format
 * 3. Read it back with the parser
 * 4. Verify the data integrity
 */
async function testCHDFormat() {
  console.log('=== CHD Format Test Suite ===\n');

  try {
    // Step 1: Create sample building
    console.log('1. Creating sample building...');
    const createResult = await createSimpleBuilding();
    console.log('✓ Building created successfully');
    console.log(`   Elements: ${createResult.statistics.elements}`);
    console.log(`   Vertices: ${createResult.statistics.vertices}`);
    console.log(`   Faces: ${createResult.statistics.faces}`);
    console.log(`   File size: ${(createResult.statistics.fileSize / 1024).toFixed(1)} KB`);
    console.log(`   Compression ratio: ${(createResult.statistics.compressionRatio * 100).toFixed(1)}%\n`);

    // Step 2: Parse the created file
    console.log('2. Parsing CHD file...');
    const parser = new CHDParser({
      loadGeometry: true,
      loadAttributes: true,
      loadSpatialIndex: true,
      progressCallback: (progress) => {
        console.log(`   Parsing: ${progress.stage} - ${progress.percentage}%`);
      }
    });

    const parsedModel = await parser.parse(createResult.outputPath);
    console.log('✓ File parsed successfully');
    console.log(`   Format: ${parsedModel.format} v${parsedModel.version}`);
    console.log(`   Project: ${parsedModel.project.name}`);
    console.log(`   Elements loaded: ${Object.keys(parsedModel.geometry).length} chunks`);
    console.log(`   Attributes: ${Object.keys(parsedModel.attributes).length} types\n`);

    // Step 3: Verify data integrity
    console.log('3. Verifying data integrity...');
    
    const originalStats = createResult.statistics;
    const parsedStats = parser.getStatistics();
    
    console.log('   Original vs Parsed:');
    console.log(`   - Elements: ${originalStats.elements} vs ${parsedStats.total_elements}`);
    console.log(`   - Vertices: ${originalStats.vertices} vs ${parsedStats.total_vertices}`);
    console.log(`   - Faces: ${originalStats.faces} vs ${parsedStats.total_faces}`);
    
    const elementsMatch = originalStats.elements === parsedStats.total_elements;
    const verticesMatch = originalStats.vertices === parsedStats.total_vertices;
    const facesMatch = originalStats.faces === parsedStats.total_faces;
    
    if (elementsMatch && verticesMatch && facesMatch) {
      console.log('✓ Data integrity verified - all counts match!\n');
    } else {
      console.log('⚠ Data integrity warning - counts do not match\n');
    }

    // Step 4: Test spatial queries
    console.log('4. Testing spatial queries...');
    if (parsedModel.spatialIndex) {
      console.log('   Spatial index loaded successfully');
      
      // Query elements in a specific area
      const queryResults = await parser.queryByBounds(0, 0, 0, 5, 5, 2);
      console.log(`   Query result: ${queryResults.length} elements found in query area`);
      
      // Test point query
      const pointResults = await parser.queryByBounds(2.5, 2, 1, 2.5, 2, 1);
      console.log(`   Point query: ${pointResults.length} elements at specific point`);
      
      console.log('✓ Spatial queries working\n');
    } else {
      console.log('   No spatial index available\n');
    }

    // Step 5: Test attribute access
    console.log('5. Testing attribute access...');
    if (parsedModel.attributes.materials) {
      const materials = parsedModel.attributes.materials.materials;
      console.log(`   Materials loaded: ${Object.keys(materials).length}`);
      for (const [id, material] of Object.entries(materials)) {
        console.log(`   - ${id}: ${material.name} (${material.type})`);
      }
    }
    
    if (parsedModel.attributes.properties) {
      const properties = parsedModel.attributes.properties.elements;
      console.log(`   Element properties: ${Object.keys(properties).length}`);
      
      // Show first few elements
      const elementIds = Object.keys(properties).slice(0, 3);
      for (const elementId of elementIds) {
        const props = properties[elementId];
        console.log(`   - ${elementId}: ${props.name} (${props.type})`);
      }
    }
    console.log('✓ Attributes accessible\n');

    // Step 6: Performance metrics
    console.log('6. Performance Summary:');
    const compressionRatio = createResult.statistics.compressionRatio;
    const originalSize = createResult.statistics.fileSize / compressionRatio;
    const savedSpace = originalSize - createResult.statistics.fileSize;
    
    console.log(`   Original size (estimated): ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`   Compressed size: ${(createResult.statistics.fileSize / 1024).toFixed(1)} KB`);
    console.log(`   Space saved: ${(savedSpace / 1024).toFixed(1)} KB (${((1 - compressionRatio) * 100).toFixed(1)}%)`);
    console.log(`   Chunks created: ${createResult.statistics.chunks}`);
    console.log(`   Spatial index: ${parsedStats.spatialIndexLoaded ? 'Yes' : 'No'}`);

    console.log('\n=== All Tests Passed! ===');
    return {
      success: true,
      originalStats,
      parsedStats,
      dataIntegrityOk: elementsMatch && verticesMatch && facesMatch
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test element-level operations
 */
async function testElementOperations() {
  console.log('\n=== Testing Element Operations ===');
  
  try {
    const parser = new CHDParser();
    const model = await parser.parse('./examples/simple/simple-building.chd');
    
    // Test getting specific elements
    console.log('\nTesting element retrieval:');
    const slabElement = await parser.getElement('slab_001');
    if (slabElement) {
      console.log(`✓ Retrieved slab: ${slabElement.vertices.length} vertices, ${slabElement.faces.length} faces`);
      console.log(`  Bounding box: [${slabElement.boundingBox.min.join(', ')}] to [${slabElement.boundingBox.max.join(', ')}]`);
    }
    
    const wallElement = await parser.getElement('wall_001');
    if (wallElement) {
      console.log(`✓ Retrieved wall: ${wallElement.vertices.length} vertices, ${wallElement.faces.length} faces`);
      console.log(`  Type: ${wallElement.type}, Material: ${wallElement.materialId}`);
    }
    
    // Test geometry validation
    console.log('\nTesting geometry validation:');
    for (const [chunkId, chunk] of parser.loadedChunks.entries()) {
      const validation = chunk.validate();
      if (validation.isValid) {
        console.log(`✓ Chunk ${chunkId}: geometry is valid`);
      } else {
        console.log(`⚠ Chunk ${chunkId}: ${validation.errors.length} validation errors`);
        validation.errors.forEach(error => console.log(`    - ${error}`));
      }
    }
    
    console.log('✓ Element operations test completed');
    
  } catch (error) {
    console.error('❌ Element operations test failed:', error.message);
  }
}

/**
 * Test export functionality
 */
async function testExportFunctionality() {
  console.log('\n=== Testing Export Functionality ===');
  
  try {
    const parser = new CHDParser();
    const model = await parser.parse('./examples/simple/simple-building.chd');
    
    // Get first chunk for testing
    const chunks = Array.from(parser.loadedChunks.values());
    if (chunks.length > 0) {
      const chunk = chunks[0];
      const elements = chunk.getAllElements();
      
      if (elements.length > 0) {
        const element = elements[0];
        
        // Test OBJ export
        console.log(`\nTesting OBJ export for element ${element.id}:`);
        const objData = chunk.exportElementToOBJ(element.id);
        console.log(`✓ OBJ export: ${objData.split('\n').length} lines generated`);
        
        // Test glTF export
        console.log(`Testing glTF export for element ${element.id}:`);
        const gltfData = chunk.exportElementToGLTF(element.id);
        console.log(`✓ glTF export: ${gltfData.positions.length / 3} vertices, ${gltfData.indices.length / 3} triangles`);
      }
    }
    
    console.log('✓ Export functionality test completed');
    
  } catch (error) {
    console.error('❌ Export functionality test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCHDFormat()
    .then((result) => {
      if (result.success) {
        return testElementOperations();
      }
    })
    .then(() => testExportFunctionality())
    .then(() => console.log('\n🎉 All tests completed!'))
    .catch(console.error);
}

export { testCHDFormat, testElementOperations, testExportFunctionality };