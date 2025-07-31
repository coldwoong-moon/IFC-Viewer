import fs from 'fs/promises';
import path from 'path';
import { IFCToCHDConverter } from '../../src/converters/IFCToCHDConverter.js';

/**
 * IFC to CHD converter using the improved IFCToCHDConverter
 * Now with enhanced logging and better geometry processing
 */

/**
 * Convert IFC file to CHD format
 */
async function convertIfcToChd(inputPath, outputPath, options = {}) {
  try {
    // Use the new IFCToCHDConverter with improved logging
    const converter = new IFCToCHDConverter({
      verbose: options.verbose || false,
      logFile: options.logFile || path.join(path.dirname(outputPath), 'ifc-conversion.log')
    });

    const result = await converter.convert(inputPath, outputPath);
    return result;

  } catch (error) {
    console.error('❌ IFC to CHD conversion failed:', error.message);
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
    compression: 'zlib',
    compressionLevel: 6,
    chunkSize: 100,
    createSpatialIndex: true,
    verbose: false,
    logFile: null
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
      case '--log-file':
        options.logFile = args[++i];
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
IFC to CHD Converter (Enhanced)

Usage:
  node ifc-to-chd.js [options] <input.ifc> <output.chd>

Options:
  -i, --input <file>           Input IFC file
  -o, --output <file>          Output CHD directory
  -c, --compression <type>     Compression type (none, zlib) [default: zlib]
  --compression-level <level>  Compression level 1-9 [default: 6]
  --chunk-size <size>          Elements per chunk [default: 100]
  --no-spatial-index          Disable spatial index creation
  -v, --verbose               Verbose output (debug logs to file)
  --log-file <file>           Custom log file path
  -h, --help                  Show this help

Examples:
  node ifc-to-chd.js building.ifc building.chd
  node ifc-to-chd.js --verbose --log-file conversion.log input.ifc output.chd
  node ifc-to-chd.js -v --compression none input.ifc output.chd

Logging:
  - Console: Shows progress, warnings, and errors only
  - Log file: Contains all debug information including detailed geometry processing
  - Use --verbose for detailed console output and debug logging to file
`);
}

/**
 * Main CLI function
 */
async function main() {
  const options = parseArgs();

  try {
    if (!options.input) {
      console.error('Error: Input IFC file required');
      printUsage();
      process.exit(1);
    }

    if (!options.output) {
      // Generate output path from input path
      const inputDir = path.dirname(options.input);
      const inputName = path.basename(options.input, '.ifc');
      options.output = path.join(inputDir, `${inputName}.chd`);
    }

    console.log(`🔄 Starting IFC to CHD conversion...`);
    console.log(`   Input: ${options.input}`);
    console.log(`   Output: ${options.output}`);
    if (options.verbose) {
      console.log(`   Log file: ${options.logFile || path.join(path.dirname(options.output), 'ifc-conversion.log')}`);
      console.log(`   Verbose mode: ON (detailed logs will be written to file)`);
    }
    console.log('');

    await convertIfcToChd(options.input, options.output, options);

    console.log(`\n🎉 Conversion completed successfully!`);
    if (options.verbose) {
      console.log(`📄 Check the log file for detailed processing information.`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertIfcToChd };