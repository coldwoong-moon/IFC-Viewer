import fs from 'fs/promises';
import path from 'path';
import { CHDWriter } from '../../src/writers/CHDWriter.js';

/**
 * Convert JSON building data to CHD format
 * 
 * Expected JSON structure:
 * {
 *   "project": { "name": "...", "description": "...", ... },
 *   "elements": [
 *     {
 *       "id": "elem_001",
 *       "name": "Wall 1",
 *       "type": "wall",
 *       "vertices": [[x,y,z], ...],
 *       "faces": [[i1,i2,i3], ...],
 *       "properties": { ... }
 *     }
 *   ],
 *   "materials": { ... }
 * }
 */

/**
 * Main conversion function
 */
async function convertJsonToChd(inputPath, outputPath, options = {}) {
  try {
    console.log(`Converting ${inputPath} to CHD format...`);
    
    // Read JSON file
    const jsonData = await fs.readFile(inputPath, 'utf8');
    const model = JSON.parse(jsonData);
    
    // Validate JSON structure
    validateJsonModel(model);
    
    // Set up CHD writer options
    const writerOptions = {
      compression: options.compression || 'zlib',
      compressionLevel: options.compressionLevel || 6,
      chunkSize: options.chunkSize || 1000,
      createSpatialIndex: options.createSpatialIndex !== false,
      progressCallback: options.verbose ? (progress) => {
        console.log(`  ${progress.stage}: ${progress.percentage}%`);
      } : null
    };
    
    // Create CHD writer
    const writer = new CHDWriter(writerOptions);
    
    // Convert and write
    const result = await writer.write(model, outputPath);
    
    console.log('✓ Conversion successful!');
    console.log(`  Input: ${inputPath}`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Elements: ${result.statistics.elements}`);
    console.log(`  Vertices: ${result.statistics.vertices}`);
    console.log(`  Faces: ${result.statistics.faces}`);
    console.log(`  File size: ${(result.statistics.fileSize / 1024).toFixed(1)} KB`);
    console.log(`  Compression: ${(result.statistics.compressionRatio * 100).toFixed(1)}%`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
    throw error;
  }
}

/**
 * Validate JSON model structure
 */
function validateJsonModel(model) {
  if (!model) {
    throw new Error('Invalid JSON: model is null or undefined');
  }
  
  if (!model.elements || !Array.isArray(model.elements)) {
    throw new Error('Invalid JSON: missing or invalid elements array');
  }
  
  if (model.elements.length === 0) {
    throw new Error('Invalid JSON: elements array is empty');
  }
  
  // Validate each element
  for (let i = 0; i < model.elements.length; i++) {
    const element = model.elements[i];
    
    if (!element.id) {
      element.id = `elem_${i + 1}`;
    }
    
    if (!element.vertices || !Array.isArray(element.vertices)) {
      throw new Error(`Invalid element ${element.id}: missing or invalid vertices`);
    }
    
    if (!element.faces || !Array.isArray(element.faces)) {
      throw new Error(`Invalid element ${element.id}: missing or invalid faces`);
    }
    
    // Validate vertex format
    for (const vertex of element.vertices) {
      if (!Array.isArray(vertex) || vertex.length !== 3) {
        throw new Error(`Invalid element ${element.id}: vertex must be [x, y, z] array`);
      }
    }
    
    // Validate face format
    for (const face of element.faces) {
      if (!Array.isArray(face) || face.length !== 3) {
        throw new Error(`Invalid element ${element.id}: face must be [i1, i2, i3] array`);
      }
      
      // Check face indices
      for (const index of face) {
        if (index < 0 || index >= element.vertices.length) {
          throw new Error(`Invalid element ${element.id}: face index ${index} out of bounds`);
        }
      }
    }
  }
  
  console.log(`✓ JSON validation passed: ${model.elements.length} elements`);
}

/**
 * Create a sample JSON file for testing
 */
async function createSampleJson(outputPath) {
  const sampleModel = {
    project: {
      name: "Sample JSON Building",
      description: "Generated sample for JSON to CHD conversion",
      units: "meters",
      coordinate_system: "local"
    },
    elements: [
      {
        id: "cube_001",
        name: "Sample Cube",
        type: "generic",
        level: "Level 1",
        materialId: "sample_material",
        vertices: [
          [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],  // bottom
          [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]   // top
        ],
        faces: [
          // Bottom
          [0, 1, 2], [0, 2, 3],
          // Top
          [4, 6, 5], [4, 7, 6],
          // Sides
          [0, 4, 5], [0, 5, 1],  // front
          [1, 5, 6], [1, 6, 2],  // right
          [2, 6, 7], [2, 7, 3],  // back
          [3, 7, 4], [3, 4, 0]   // left
        ],
        properties: {
          volume: 1.0,
          area: 6.0,
          material_cost: 50.0
        }
      },
      {
        id: "pyramid_001",
        name: "Sample Pyramid",
        type: "roof",
        level: "Level 2",
        materialId: "roof_material",
        vertices: [
          [0, 0, 1], [2, 0, 1], [2, 2, 1], [0, 2, 1],  // base
          [1, 1, 2]  // apex
        ],
        faces: [
          // Base
          [0, 2, 1], [0, 3, 2],
          // Sides
          [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]
        ],
        properties: {
          height: 1.0,
          base_area: 4.0,
          slope_angle: 45.0
        }
      }
    ],
    materials: {
      "sample_material": {
        name: "Sample Concrete",
        type: "concrete",
        properties: {
          density: 2400,
          strength: 30,
          color: [0.8, 0.8, 0.8, 1.0]
        }
      },
      "roof_material": {
        name: "Roof Tiles",
        type: "ceramic",
        properties: {
          density: 1800,
          color: [0.8, 0.3, 0.2, 1.0]
        }
      }
    }
  };
  
  await fs.writeFile(outputPath, JSON.stringify(sampleModel, null, 2));
  console.log(`✓ Sample JSON created: ${outputPath}`);
  return sampleModel;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    compression: 'zlib',
    compressionLevel: 6,
    chunkSize: 1000,
    createSpatialIndex: true,
    verbose: false,
    createSample: false
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
      case '--compression':
      case '-c':
        options.compression = args[++i];
        break;
      case '--compression-level':
        options.compressionLevel = parseInt(args[++i]);
        break;
      case '--chunk-size':
        options.chunkSize = parseInt(args[++i]);
        break;
      case '--no-spatial-index':
        options.createSpatialIndex = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--create-sample':
        options.createSample = true;
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
JSON to CHD Converter

Usage:
  node json-to-chd.js [options] <input.json> <output.chd>

Options:
  -i, --input <file>           Input JSON file
  -o, --output <file>          Output CHD directory
  -c, --compression <type>     Compression type (none, zlib) [default: zlib]
  --compression-level <level>  Compression level 1-9 [default: 6]
  --chunk-size <size>          Elements per chunk [default: 1000]
  --no-spatial-index          Disable spatial index creation
  -v, --verbose               Verbose output
  --create-sample             Create sample JSON file
  -h, --help                  Show this help

Examples:
  node json-to-chd.js building.json building.chd
  node json-to-chd.js --verbose --compression none input.json output.chd
  node json-to-chd.js --create-sample sample.json
`);
}

/**
 * Main CLI function
 */
async function main() {
  const options = parseArgs();
  
  try {
    if (options.createSample) {
      const samplePath = options.input || 'sample-building.json';
      await createSampleJson(samplePath);
      return;
    }
    
    if (!options.input) {
      console.error('Error: Input file required');
      printUsage();
      process.exit(1);
    }
    
    if (!options.output) {
      // Generate output path from input path
      const inputDir = path.dirname(options.input);
      const inputName = path.basename(options.input, '.json');
      options.output = path.join(inputDir, `${inputName}.chd`);
    }
    
    await convertJsonToChd(options.input, options.output, options);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertJsonToChd, validateJsonModel, createSampleJson };