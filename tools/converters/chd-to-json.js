import fs from 'fs/promises';
import path from 'path';
import { CHDParser } from '../../src/parsers/CHDParser.js';

/**
 * Convert CHD format to JSON building data
 */

/**
 * Main conversion function
 */
async function convertChdToJson(inputPath, outputPath, options = {}) {
  try {
    console.log(`Converting ${inputPath} to JSON format...`);
    
    // Set up CHD parser options
    const parserOptions = {
      loadGeometry: true,
      loadAttributes: true,
      loadSpatialIndex: false, // Not needed for JSON export
      progressCallback: options.verbose ? (progress) => {
        console.log(`  ${progress.stage}: ${progress.percentage}%`);
      } : null
    };
    
    // Create CHD parser
    const parser = new CHDParser(parserOptions);
    
    // Parse CHD file
    const model = await parser.parse(inputPath);
    
    // Convert to JSON format
    const jsonModel = await convertChdModelToJson(model, parser, options);
    
    // Write JSON file
    const jsonString = JSON.stringify(jsonModel, null, options.compact ? 0 : 2);
    await fs.writeFile(outputPath, jsonString);
    
    const stats = parser.getStatistics();
    
    console.log('✓ Conversion successful!');
    console.log(`  Input: ${inputPath}`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Elements: ${stats.total_elements}`);
    console.log(`  Vertices: ${stats.total_vertices}`);
    console.log(`  Faces: ${stats.total_faces}`);
    console.log(`  File size: ${(jsonString.length / 1024).toFixed(1)} KB`);
    
    return jsonModel;
    
  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
    throw error;
  }
}

/**
 * Convert CHD model data to JSON format
 */
async function convertChdModelToJson(model, parser, options = {}) {
  const jsonModel = {
    project: model.project,
    elements: [],
    materials: {},
    metadata: {
      convertedFrom: 'CHD',
      originalVersion: model.version,
      convertedAt: new Date().toISOString(),
      statistics: parser.getStatistics()
    }
  };
  
  // Extract materials
  if (model.attributes && model.attributes.materials) {
    jsonModel.materials = model.attributes.materials.materials || {};
  }
  
  // Extract element properties
  const elementProperties = {};
  if (model.attributes && model.attributes.properties) {
    const props = model.attributes.properties.elements || {};
    for (const [elementId, properties] of Object.entries(props)) {
      elementProperties[elementId] = properties;
    }
  }
  
  // Process geometry chunks
  for (const [chunkId, chunk] of Object.entries(model.geometry)) {
    const elements = chunk.getAllElements();
    
    for (const element of elements) {
      // Get original string ID from hash if available
      const originalId = parser.idMapping?.get(element.id) || element.id.toString();
      const properties = elementProperties[originalId] || {};
      
      const jsonElement = {
        id: originalId,
        name: properties.name || `Element ${originalId}`,
        type: element.type,
        level: properties.level || 'Unknown',
        materialId: element.materialId || null,
        vertices: element.vertices,
        faces: element.faces,
        properties: {
          ...properties.custom_properties,
          dimensions: properties.dimensions || {},
          guid: properties.guid
        },
        metadata: {
          chunkId: chunkId,
          boundingBox: element.boundingBox,
          vertexCount: element.vertices.length,
          faceCount: element.faces.length
        }
      };
      
      // Remove empty properties if requested
      if (options.compact) {
        if (Object.keys(jsonElement.properties).length === 0) {
          delete jsonElement.properties;
        }
        if (Object.keys(jsonElement.metadata).length === 0) {
          delete jsonElement.metadata;
        }
      }
      
      jsonModel.elements.push(jsonElement);
    }
  }
  
  console.log(`✓ Converted ${jsonModel.elements.length} elements from ${Object.keys(model.geometry).length} chunks`);
  
  return jsonModel;
}

/**
 * Export individual elements to separate files
 */
async function exportElementsToFiles(inputPath, outputDir, format = 'json', options = {}) {
  try {
    console.log(`Exporting elements from ${inputPath} to ${format.toUpperCase()} files...`);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Parse CHD file
    const parser = new CHDParser({
      loadGeometry: true,
      loadAttributes: true,
      loadSpatialIndex: false
    });
    
    const model = await parser.parse(inputPath);
    
    let exportedCount = 0;
    
    // Process each chunk
    for (const [chunkId, chunk] of Object.entries(model.geometry)) {
      const elements = chunk.getAllElements();
      
      for (const element of elements) {
        const originalId = parser.idMapping?.get(element.id) || element.id.toString();
        const safeId = originalId.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        let exportData;
        let fileName;
        
        if (format === 'obj') {
          exportData = chunk.exportElementToOBJ(element.id);
          fileName = `${safeId}.obj`;
        } else if (format === 'gltf') {
          const gltfData = chunk.exportElementToGLTF(element.id);
          exportData = JSON.stringify({
            asset: { version: '2.0' },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ mesh: 0 }],
            meshes: [{
              primitives: [{
                attributes: { POSITION: 0 },
                indices: 1
              }]
            }],
            accessors: [
              {
                bufferView: 0,
                componentType: 5126, // FLOAT
                count: gltfData.positions.length / 3,
                type: 'VEC3',
                min: [gltfData.boundingBox.min[0], gltfData.boundingBox.min[1], gltfData.boundingBox.min[2]],
                max: [gltfData.boundingBox.max[0], gltfData.boundingBox.max[1], gltfData.boundingBox.max[2]]
              },
              {
                bufferView: 1,
                componentType: 5125, // UNSIGNED_INT
                count: gltfData.indices.length,
                type: 'SCALAR'
              }
            ],
            bufferViews: [
              {
                buffer: 0,
                byteOffset: 0,
                byteLength: gltfData.positions.byteLength
              },
              {
                buffer: 0,
                byteOffset: gltfData.positions.byteLength,
                byteLength: gltfData.indices.byteLength
              }
            ],
            buffers: [{
              byteLength: gltfData.positions.byteLength + gltfData.indices.byteLength,
              uri: `data:application/octet-stream;base64,${Buffer.concat([
                Buffer.from(gltfData.positions.buffer),
                Buffer.from(gltfData.indices.buffer)
              ]).toString('base64')}`
            }]
          }, null, 2);
          fileName = `${safeId}.gltf`;
        } else {
          // JSON format
          exportData = JSON.stringify({
            id: originalId,
            type: element.type,
            vertices: element.vertices,
            faces: element.faces,
            boundingBox: element.boundingBox
          }, null, 2);
          fileName = `${safeId}.json`;
        }
        
        const filePath = path.join(outputDir, fileName);
        await fs.writeFile(filePath, exportData);
        exportedCount++;
      }
    }
    
    console.log(`✓ Exported ${exportedCount} elements to ${outputDir}`);
    return exportedCount;
    
  } catch (error) {
    console.error('❌ Element export failed:', error.message);
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    compact: false,
    verbose: false,
    exportElements: false,
    exportFormat: 'json', // json, obj, gltf
    exportDir: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--input':
      case '-i':
        options.input = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--compact':
      case '-c':
        options.compact = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--export-elements':
        options.exportElements = true;
        options.exportDir = args[++i];
        break;
      case '--export-format':
        options.exportFormat = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (!options.input) {
          options.input = arg;
        } else if (!options.output) {
          options.output = arg;
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
CHD to JSON Converter

Usage:
  node chd-to-json.js [options] <input.chd> <output.json>

Options:
  -i, --input <file>           Input CHD directory
  -o, --output <file>          Output JSON file
  -c, --compact               Compact JSON output (no formatting)
  -v, --verbose               Verbose output
  --export-elements <dir>     Export individual elements to separate files
  --export-format <format>    Export format: json, obj, gltf [default: json]
  -h, --help                  Show this help

Examples:
  node chd-to-json.js building.chd building.json
  node chd-to-json.js --verbose --compact input.chd output.json
  node chd-to-json.js --export-elements ./elements building.chd
  node chd-to-json.js --export-elements ./models --export-format obj building.chd
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
    
    if (options.exportElements) {
      if (!options.exportDir) {
        console.error('Error: Export directory required with --export-elements');
        process.exit(1);
      }
      
      await exportElementsToFiles(options.input, options.exportDir, options.exportFormat, options);
      return;
    }
    
    if (!options.output) {
      // Generate output path from input path
      const inputDir = path.dirname(options.input);
      const inputName = path.basename(options.input, '.chd');
      options.output = path.join(inputDir, `${inputName}.json`);
    }
    
    await convertChdToJson(options.input, options.output, options);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertChdToJson, convertChdModelToJson, exportElementsToFiles };