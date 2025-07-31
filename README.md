# CHD Format (Construction Hybrid Data)

A modern, efficient file format for construction design that combines the performance of binary data with the flexibility of structured text.

## Features

🚀 **Performance**: Optimized for fast read/write operations  
📦 **Compact**: Efficient compression and storage  
🔧 **Flexible**: Supports both 2D drawings and 3D models  
🌐 **Web-friendly**: Progressive loading and streaming support  
👥 **Collaborative**: Built-in version control and conflict resolution  
🔄 **Interoperable**: Convert from/to IFC, DWG, Revit formats  

## Format Structure

```
project.chd/
├── manifest.json       # Project metadata and index
├── spatial.idx         # 3D spatial indexing data
├── geometry/           # Compressed mesh and geometry data
│   ├── chunk_001.bin
│   └── chunk_002.bin
├── attributes/         # Material and property data
│   ├── materials.cbor
│   └── properties.cbor
└── relations/          # Element relationships
    └── hierarchy.json
```

## Quick Start

```bash
# Install dependencies
npm install

# Convert an existing file
npm run convert input.ifc output.chd

# View a CHD file
npm run serve example.chd
```

## API Usage

```javascript
import { CHDParser, CHDWriter } from './src/index.js';

// Read CHD file
const parser = new CHDParser();
const model = await parser.parse('building.chd');

// Write CHD file
const writer = new CHDWriter();
await writer.write(model, 'output.chd');
```

## Development

```bash
# Run tests
npm test

# Development mode with hot reload
npm run dev

# Build optimized version
npm run build
```

## Format Specification

See [spec/CHD-Format-v1.0.md](spec/CHD-Format-v1.0.md) for detailed format specification.