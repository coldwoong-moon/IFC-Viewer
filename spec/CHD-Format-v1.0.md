# CHD Format Specification v1.0
## Construction Hybrid Data Format

### Overview

CHD (Construction Hybrid Data) is a hybrid file format designed for efficient storage and transmission of construction design data, combining 2D drawings and 3D models with optimal performance characteristics.

### Design Principles

1. **Hybrid Architecture**: JSON metadata + Binary payloads for optimal balance
2. **Streaming Support**: Progressive loading of large models
3. **Compression**: Efficient geometry and attribute compression
4. **Modularity**: Separable components for partial loading
5. **Interoperability**: Easy conversion to/from existing formats

## File Structure

### Container Format
CHD files use a directory-based container structure (similar to modern office formats):

```
project.chd/
├── manifest.json       # Core metadata and file index
├── spatial.idx         # Binary spatial indexing data
├── geometry/           # Compressed geometry chunks
│   ├── chunk_[id].bin  # Binary mesh data
│   └── lod_[level].bin # Level-of-detail variants
├── attributes/         # Property and material data
│   ├── materials.cbor  # Material definitions
│   ├── properties.cbor # Element properties
│   └── metadata.cbor   # Additional metadata
└── relations/          # Relationships and hierarchy
    ├── hierarchy.json  # Element parent-child relationships
    └── references.json # Cross-references and links
```

## Core Data Structures

### 1. Manifest (manifest.json)
```json
{
  "format": "CHD",
  "version": "1.0",
  "created": "2024-01-01T00:00:00Z",
  "modified": "2024-01-01T00:00:00Z",
  "project": {
    "name": "Sample Building",
    "description": "Example construction project",
    "units": "meters",
    "coordinate_system": "WGS84",
    "bounding_box": {
      "min": [-50, -30, 0],
      "max": [50, 30, 20]
    }
  },
  "index": {
    "geometry_chunks": [
      {"id": "001", "file": "geometry/chunk_001.bin", "elements": 1250, "size": 45678},
      {"id": "002", "file": "geometry/chunk_002.bin", "elements": 890, "size": 34567}
    ],
    "attribute_files": [
      {"type": "materials", "file": "attributes/materials.cbor", "count": 45},
      {"type": "properties", "file": "attributes/properties.cbor", "count": 2140}
    ],
    "spatial_index": {
      "file": "spatial.idx",
      "type": "r_tree",
      "levels": 4,
      "nodes": 256
    }
  },
  "statistics": {
    "total_elements": 2140,
    "total_vertices": 125670,
    "total_faces": 234560,
    "file_size": 2456789,
    "compression_ratio": 0.23
  }
}
```

### 2. Geometry Data Structure
Binary format for each geometry chunk:

```
CHUNK HEADER (32 bytes):
- Magic Number: 'CHDG' (4 bytes)
- Version: uint32 (4 bytes)
- Compression: uint8 (1 byte) [0=none, 1=zlib, 2=lz4]
- Element Count: uint32 (4 bytes)
- Vertex Count: uint32 (4 bytes)
- Face Count: uint32 (4 bytes)
- Bounding Box: float32[6] (24 bytes) [minX,minY,minZ,maxX,maxY,maxZ]
- Reserved: (8 bytes)

ELEMENT TABLE:
- Element ID: uint32 (4 bytes)
- Element Type: uint16 (2 bytes) [wall=1, slab=2, beam=3, column=4, etc.]
- Material ID: uint16 (2 bytes)
- Vertex Offset: uint32 (4 bytes)
- Vertex Count: uint32 (4 bytes)
- Face Offset: uint32 (4 bytes)
- Face Count: uint32 (4 bytes)

COMPRESSED VERTEX DATA:
- Vertices: float32[3] * vertex_count (quantized and compressed)

COMPRESSED FACE DATA:
- Faces: uint32[3] * face_count (triangle indices)
```

### 3. Spatial Index (spatial.idx)
Binary R-tree structure for efficient spatial queries:

```
INDEX HEADER (64 bytes):
- Magic Number: 'CHDS' (4 bytes)
- Version: uint32 (4 bytes)
- Tree Type: uint8 (1 byte) [1=R-tree, 2=Octree]
- Max Depth: uint8 (1 byte)
- Node Count: uint32 (4 bytes)
- Leaf Count: uint32 (4 bytes)
- Bounding Box: float32[6] (24 bytes)
- Reserved: (20 bytes)

R-TREE NODES:
- Node ID: uint32 (4 bytes)
- Parent ID: uint32 (4 bytes)
- Child Count: uint16 (2 bytes)
- Is Leaf: uint8 (1 byte)
- Reserved: uint8 (1 byte)
- Bounding Box: float32[6] (24 bytes)
- Child IDs: uint32[child_count]
- Element IDs: uint32[] (if leaf node)
```

### 4. Attributes (CBOR Format)
Using CBOR for efficient binary encoding of structured data:

#### Materials (materials.cbor)
```cbor
{
  "materials": {
    "mat_001": {
      "name": "Concrete C30/37",
      "type": "concrete",
      "properties": {
        "density": 2400,
        "strength": 37,
        "color": [0.7, 0.7, 0.7, 1.0]
      },
      "thermal": {
        "conductivity": 2.3,
        "capacity": 1000
      }
    }
  }
}
```

#### Properties (properties.cbor)
```cbor
{
  "elements": {
    "elem_001": {
      "guid": "2O2Fr$t4X7Zf8NOew3FLOH",
      "name": "Ground Floor Slab",
      "type": "IfcSlab",
      "level": "Level 0",
      "material_id": "mat_001",
      "dimensions": {
        "length": 10.0,
        "width": 8.0,
        "thickness": 0.2
      },
      "custom_properties": {
        "fire_rating": "REI 120",
        "load_bearing": true
      }
    }
  }
}
```

## Compression Strategies

### Geometry Compression
1. **Vertex Quantization**: Reduce precision to 16-bit integers
2. **Mesh Compression**: Use indexed triangle strips
3. **Level-of-Detail**: Generate multiple resolution levels
4. **Spatial Coherence**: Group spatially close elements

### Attribute Compression
1. **CBOR Encoding**: Binary JSON-like format
2. **String Deduplication**: Shared string table
3. **Property Templates**: Reusable property schemas
4. **Delta Encoding**: Store only differences from templates

## Streaming and Progressive Loading

### Chunk-Based Loading
- Load manifest first for overview
- Load spatial index for navigation
- Load geometry chunks on-demand based on viewport
- Load attributes as needed for selected elements

### Network Optimization
- Support HTTP Range requests for partial downloads
- Enable compression at transport layer (gzip/brotli)
- Implement client-side caching strategies
- Progressive mesh refinement

## Version Control and Collaboration

### Change Tracking
- Element-level versioning with timestamps
- Diff generation between versions
- Conflict detection and resolution
- Merge strategies for concurrent edits

### Multi-User Support
- Pessimistic locking for active edits
- Optimistic updates for passive views
- Real-time synchronization protocols
- User permission and access control

## Interoperability

### Import Support
- IFC (Industry Foundation Classes)
- DWG/DXF (AutoCAD formats)
- 3DS/OBJ (Generic 3D formats)
- JSON-based CAD formats

### Export Support
- glTF 2.0 for web visualization
- IFC for BIM software integration
- DXF for 2D CAD software
- STL for 3D printing

## Error Handling and Validation

### File Integrity
- CRC32 checksums for each chunk
- Magic number validation
- Version compatibility checks
- Structural validation against schema

### Graceful Degradation
- Continue loading if non-critical chunks fail
- Fallback to lower LOD if high-res chunks unavailable
- Partial model display with missing elements indicated
- Recovery suggestions for corrupted files

## Performance Targets

### File Size
- 60-80% smaller than equivalent IFC files
- 30-50% smaller than equivalent DWG files
- Compression ratio: 0.2-0.4 depending on model complexity

### Loading Performance
- Initial metadata load: <100ms for typical projects
- First visual render: <500ms for 50MB+ files
- Interactive navigation: <16ms frame time
- Memory usage: <2x final geometry size during parsing

### Network Efficiency
- Progressive enhancement: usable at 10% download
- Bandwidth utilization: >80% useful data
- Concurrent chunk downloads: up to 8 parallel streams
- Cache hit ratio: >70% for repeated sessions

---

*CHD Format Specification v1.0 - Construction Hybrid Data*  
*Last updated: 2024*