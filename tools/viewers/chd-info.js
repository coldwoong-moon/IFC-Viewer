import { CHDParser } from '../../src/parsers/CHDParser.js';
import path from 'path';

/**
 * CHD File Information Tool
 * Display detailed information about CHD files
 */

/**
 * Display comprehensive information about a CHD file
 */
async function displayChdInfo(filePath, options = {}) {
  try {
    console.log(`📁 CHD File Information: ${filePath}\n`);
    
    // Parse CHD file
    const parser = new CHDParser({
      loadGeometry: options.loadGeometry !== false,
      loadAttributes: options.loadAttributes !== false,
      loadSpatialIndex: options.loadSpatialIndex !== false
    });
    
    const model = await parser.parse(filePath);
    const stats = parser.getStatistics();
    
    // Display basic information
    displayBasicInfo(model, stats);
    
    // Display project information
    displayProjectInfo(model.project);
    
    // Display geometry information
    if (options.loadGeometry !== false) {
      displayGeometryInfo(model.geometry, parser);
    }
    
    // Display attribute information
    if (options.loadAttributes !== false) {
      displayAttributeInfo(model.attributes);
    }
    
    // Display spatial index information
    if (options.loadSpatialIndex !== false && model.spatialIndex) {
      displaySpatialIndexInfo(model.spatialIndex);
    }
    
    // Display detailed element information
    if (options.detailed) {
      await displayDetailedElementInfo(parser, options);
    }
    
    // Display performance metrics
    if (options.performance) {
      displayPerformanceInfo(model, stats);
    }
    
    return { model, parser, stats };
    
  } catch (error) {
    console.error('❌ Failed to read CHD file:', error.message);
    throw error;
  }
}

/**
 * Display basic file information
 */
function displayBasicInfo(model, stats) {
  console.log('📋 Basic Information:');
  console.log(`   Format: ${model.format} v${model.version}`);
  console.log(`   Elements: ${stats.total_elements}`);
  console.log(`   Vertices: ${stats.total_vertices.toLocaleString()}`);
  console.log(`   Faces: ${stats.total_faces.toLocaleString()}`);
  console.log(`   Chunks: ${stats.chunksLoaded}`);
  console.log(`   Spatial Index: ${stats.spatialIndexLoaded ? 'Yes' : 'No'}`);
  console.log(`   Timestamp: ${model.timestamp}\n`);
}

/**
 * Display project information
 */
function displayProjectInfo(project) {
  console.log('🏗️  Project Information:');
  console.log(`   Name: ${project.name || 'Unnamed'}`);
  console.log(`   Description: ${project.description || 'No description'}`);
  console.log(`   Units: ${project.units || 'Unknown'}`);
  console.log(`   Coordinate System: ${project.coordinate_system || 'Unknown'}`);
  
  if (project.bounding_box) {
    const bb = project.bounding_box;
    console.log(`   Bounding Box:`);
    console.log(`     Min: [${bb.min.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`     Max: [${bb.max.map(v => v.toFixed(2)).join(', ')}]`);
    const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
    console.log(`     Size: ${size.map(v => v.toFixed(2)).join(' × ')} ${project.units || ''}`);
  }
  
  if (project.location) {
    console.log(`   Location: ${project.location.address || 'Unknown'}`);
    if (project.location.latitude && project.location.longitude) {
      console.log(`   Coordinates: ${project.location.latitude}, ${project.location.longitude}`);
    }
  }
  
  console.log();
}

/**
 * Display geometry information
 */
function displayGeometryInfo(geometry, parser) {
  console.log('📐 Geometry Information:');
  
  const chunks = Object.entries(geometry);
  console.log(`   Total Chunks: ${chunks.length}`);
  
  const elementTypes = new Map();
  let totalMemory = 0;
  
  for (const [chunkId, chunk] of chunks) {
    const chunkStats = chunk.getStatistics();
    totalMemory += chunkStats.memoryUsage;
    
    const elements = chunk.getAllElements();
    for (const element of elements) {
      elementTypes.set(element.type, (elementTypes.get(element.type) || 0) + 1);
    }
    
    console.log(`   Chunk ${chunkId}:`);
    console.log(`     Elements: ${chunkStats.elementCount}`);
    console.log(`     Vertices: ${chunkStats.vertexCount.toLocaleString()}`);
    console.log(`     Faces: ${chunkStats.faceCount.toLocaleString()}`);
    console.log(`     Memory: ${(chunkStats.memoryUsage / 1024).toFixed(1)} KB`);
    console.log(`     Compression: ${chunkStats.compression === 1 ? 'zlib' : 'none'}`);
  }
  
  console.log(`   Total Memory Usage: ${(totalMemory / 1024).toFixed(1)} KB`);
  
  console.log('   Element Types:');
  for (const [type, count] of [...elementTypes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${type}: ${count}`);
  }
  
  console.log();
}

/**
 * Display attribute information
 */
function displayAttributeInfo(attributes) {
  console.log('🎨 Attribute Information:');
  
  if (attributes.materials) {
    const materials = attributes.materials.materials || {};
    console.log(`   Materials: ${Object.keys(materials).length}`);
    
    for (const [id, material] of Object.entries(materials)) {
      console.log(`     ${id}: ${material.name} (${material.type})`);
      if (material.properties && material.properties.density) {
        console.log(`       Density: ${material.properties.density} kg/m³`);
      }
      if (material.cost) {
        console.log(`       Cost: ${material.cost.value} ${material.cost.unit}`);
      }
    }
  }
  
  if (attributes.properties) {
    const properties = attributes.properties.elements || {};
    console.log(`   Element Properties: ${Object.keys(properties).length}`);
    
    // Group by level
    const levels = new Map();
    for (const [id, props] of Object.entries(properties)) {
      const level = props.level || 'Unknown';
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level).push({ id, ...props });
    }
    
    console.log('   Elements by Level:');
    for (const [level, elements] of [...levels.entries()].sort()) {
      console.log(`     ${level}: ${elements.length} elements`);
    }
  }
  
  console.log();
}

/**
 * Display spatial index information
 */
function displaySpatialIndexInfo(spatialIndex) {
  console.log('🗺️  Spatial Index Information:');
  
  const stats = spatialIndex.getStatistics();
  console.log(`   Type: ${stats.type}`);
  console.log(`   Max Depth: ${stats.maxDepth}`);
  console.log(`   Nodes: ${stats.nodeCount}`);
  console.log(`   Leaf Nodes: ${stats.leafCount}`);
  console.log(`   Total Elements: ${stats.totalElements}`);
  
  if (stats.boundingBox) {
    const bb = stats.boundingBox;
    console.log(`   Index Bounding Box:`);
    console.log(`     Min: [${bb.min.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`     Max: [${bb.max.map(v => v.toFixed(2)).join(', ')}]`);
  }
  
  console.log();
}

/**
 * Display detailed element information
 */
async function displayDetailedElementInfo(parser, options) {
  console.log('🔍 Detailed Element Information:');
  
  const maxElements = options.maxElements || 10;
  let count = 0;
  
  for (const [chunkId, chunk] of parser.loadedChunks.entries()) {
    const elements = chunk.getAllElements();
    
    for (const element of elements) {
      if (count >= maxElements) break;
      
      console.log(`   Element ${element.id} (${element.type}):`);
      console.log(`     Vertices: ${element.vertices.length}`);
      console.log(`     Faces: ${element.faces.length}`);
      console.log(`     Material ID: ${element.materialId || 'None'}`);
      
      if (element.boundingBox) {
        const bb = element.boundingBox;
        const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
        console.log(`     Size: ${size.map(v => v.toFixed(2)).join(' × ')}`);
      }
      
      // Validate geometry
      const validation = chunk.validate();
      if (!validation.isValid) {
        console.log(`     ⚠️  Validation Issues: ${validation.errors.length}`);
        validation.errors.slice(0, 3).forEach(error => {
          console.log(`       - ${error}`);
        });
      }
      
      count++;
    }
    
    if (count >= maxElements) break;
  }
  
  if (count === maxElements) {
    console.log(`   ... (showing first ${maxElements} elements, use --max-elements to see more)`);
  }
  
  console.log();
}

/**
 * Display performance information
 */
function displayPerformanceInfo(model, stats) {
  console.log('⚡ Performance Information:');
  
  // Calculate various metrics
  const avgVerticesPerElement = stats.total_vertices / stats.total_elements;
  const avgFacesPerElement = stats.total_faces / stats.total_elements;
  const avgVerticesPerFace = stats.total_vertices / stats.total_faces;
  
  console.log(`   Average Vertices per Element: ${avgVerticesPerElement.toFixed(1)}`);
  console.log(`   Average Faces per Element: ${avgFacesPerElement.toFixed(1)}`);
  console.log(`   Average Vertices per Face: ${avgVerticesPerFace.toFixed(1)}`);
  
  // Estimate memory usage
  const estimatedMemory = (
    stats.total_vertices * 3 * 4 + // vertices (3 floats each)
    stats.total_faces * 3 * 4 +    // faces (3 ints each)
    stats.total_elements * 1024    // element overhead
  );
  
  console.log(`   Estimated Memory Usage: ${(estimatedMemory / 1024 / 1024).toFixed(1)} MB`);
  
  // File size information
  if (model.statistics) {
    console.log(`   File Size: ${(model.statistics.file_size / 1024).toFixed(1)} KB`);
    console.log(`   Compression Ratio: ${(model.statistics.compression_ratio * 100).toFixed(1)}%`);
    
    const spaceSaved = estimatedMemory - model.statistics.file_size;
    console.log(`   Space Saved: ${(spaceSaved / 1024).toFixed(1)} KB`);
  }
  
  console.log();
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    loadGeometry: true,
    loadAttributes: true,
    loadSpatialIndex: true,
    detailed: false,
    performance: false,
    maxElements: 10,
    query: null,
    export: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--input':
      case '-i':
        options.input = args[++i];
        break;
      case '--no-geometry':
        options.loadGeometry = false;
        break;
      case '--no-attributes':
        options.loadAttributes = false;
        break;
      case '--no-spatial-index':
        options.loadSpatialIndex = false;
        break;
      case '--detailed':
      case '-d':
        options.detailed = true;
        break;
      case '--performance':
      case '-p':
        options.performance = true;
        break;
      case '--max-elements':
        options.maxElements = parseInt(args[++i]);
        break;
      case '--query':
        options.query = args[++i];
        break;
      case '--export':
        options.export = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (!options.input) {
          options.input = arg;
        }
        break;
    }
  }
  
  return options;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
CHD File Information Tool

Usage:
  node chd-info.js [options] <input.chd>

Options:
  -i, --input <file>          Input CHD file/directory
  -d, --detailed              Show detailed element information
  -p, --performance           Show performance metrics
  --max-elements <count>      Maximum elements to show in detail [default: 10]
  --no-geometry              Skip loading geometry data
  --no-attributes            Skip loading attribute data
  --no-spatial-index         Skip loading spatial index
  --query <bounds>           Query elements in bounding box (x1,y1,z1,x2,y2,z2)
  --export <format>          Export summary to format (json, csv)
  -h, --help                 Show this help

Examples:
  node chd-info.js building.chd
  node chd-info.js --detailed --performance building.chd
  node chd-info.js --query "0,0,0,10,10,3" building.chd
  node chd-info.js --export json building.chd > info.json
`);
}

/**
 * Main CLI function
 */
async function main() {
  const options = parseArgs();
  
  try {
    if (!options.input) {
      console.error('Error: Input file required');
      printUsage();
      process.exit(1);
    }
    
    const { model, parser, stats } = await displayChdInfo(options.input, options);
    
    // Handle query option
    if (options.query) {
      const coords = options.query.split(',').map(parseFloat);
      if (coords.length !== 6) {
        console.error('Error: Query bounds must be 6 numbers: x1,y1,z1,x2,y2,z2');
        process.exit(1);
      }
      
      console.log('🔎 Query Results:');
      const results = await parser.queryByBounds(...coords);
      console.log(`   Found ${results.length} elements in bounds [${coords.join(', ')}]`);
      
      for (const element of results.slice(0, 10)) {
        console.log(`     - ${element.id}: ${element.type}`);
      }
      
      if (results.length > 10) {
        console.log(`     ... and ${results.length - 10} more`);
      }
    }
    
    // Handle export option
    if (options.export) {
      const exportData = {
        file: options.input,
        format: model.format,
        version: model.version,
        project: model.project,
        statistics: stats,
        timestamp: new Date().toISOString()
      };
      
      if (options.export === 'json') {
        console.log(JSON.stringify(exportData, null, 2));
      } else if (options.export === 'csv') {
        console.log('property,value');
        console.log(`format,${model.format}`);
        console.log(`version,${model.version}`);
        console.log(`elements,${stats.total_elements}`);
        console.log(`vertices,${stats.total_vertices}`);
        console.log(`faces,${stats.total_faces}`);
        console.log(`chunks,${stats.chunksLoaded}`);
        console.log(`spatial_index,${stats.spatialIndexLoaded}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { displayChdInfo };