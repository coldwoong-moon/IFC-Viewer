import { BinaryReader } from '../utils/BinaryReader.js';
import zlib from 'zlib';
import { promisify } from 'util';

const inflate = promisify(zlib.inflate);

/**
 * Geometry chunk handler for CHD format
 * Parses compressed geometry data including vertices, faces, and element information
 */
export class GeometryChunk {
  constructor() {
    this.header = null;
    this.elements = {};
    this.vertices = null;
    this.faces = null;
    this.elementTable = [];
  }

  /**
   * Parse geometry chunk from binary data
   */
  async parseFromBinary(binaryData) {
    const reader = new BinaryReader(binaryData.buffer || binaryData);
    
    try {
      // Parse header
      this.header = this.parseHeader(reader);
      
      // Parse element table
      this.elementTable = this.parseElementTable(reader);
      
      // Parse geometry data (potentially compressed)
      const vertexData = await this.parseVertexData(reader);
      const faceData = await this.parseFaceData(reader);
      
      // Process and organize the data
      this.organizeGeometryData(vertexData, faceData);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to parse geometry chunk: ${error.message}`);
    }
  }

  /**
   * Parse chunk header
   */
  parseHeader(reader) {
    // Validate magic number
    reader.validateMagic('CHDG');
    
    const header = {
      version: reader.readUInt32(),
      compression: reader.readUInt8(), // 0=none, 1=zlib, 2=lz4
      elementCount: reader.readUInt32(),
      vertexCount: reader.readUInt32(),
      faceCount: reader.readUInt32(),
      boundingBox: reader.readBoundingBox(),
      reserved: reader.readBytes(8)
    };
    
    if (header.version !== 1) {
      throw new Error(`Unsupported geometry chunk version: ${header.version}`);
    }
    
    return header;
  }

  /**
   * Parse element table
   */
  parseElementTable(reader) {
    const elements = [];
    
    for (let i = 0; i < this.header.elementCount; i++) {
      const element = {
        id: reader.readUInt32(),
        type: reader.readUInt16(),
        materialId: reader.readUInt16(),
        vertexOffset: reader.readUInt32(),
        vertexCount: reader.readUInt32(),
        faceOffset: reader.readUInt32(),
        faceCount: reader.readUInt32()
      };
      
      elements.push(element);
    }
    
    return elements;
  }

  /**
   * Parse vertex data (potentially compressed)
   */
  async parseVertexData(reader) {
    const vertexDataSize = this.header.vertexCount * 3 * 4; // 3 floats per vertex
    let vertexData;
    
    if (this.header.compression === 0) {
      // No compression
      vertexData = reader.readFloat32Array(this.header.vertexCount * 3);
    } else if (this.header.compression === 1) {
      // zlib compression
      const compressedSize = reader.readUInt32();
      const compressedData = reader.readBytes(compressedSize);
      const decompressed = await inflate(compressedData);
      const decompressedReader = new BinaryReader(decompressed.buffer);
      vertexData = decompressedReader.readFloat32Array(this.header.vertexCount * 3);
    } else {
      throw new Error(`Unsupported compression type: ${this.header.compression}`);
    }
    
    // Convert flat array to array of [x, y, z] vectors
    const vertices = [];
    for (let i = 0; i < vertexData.length; i += 3) {
      vertices.push([vertexData[i], vertexData[i + 1], vertexData[i + 2]]);
    }
    
    return vertices;
  }

  /**
   * Parse face data (potentially compressed)
   */
  async parseFaceData(reader) {
    let faceData;
    
    if (this.header.compression === 0) {
      // No compression
      faceData = reader.readUInt32Array(this.header.faceCount * 3);
    } else if (this.header.compression === 1) {
      // zlib compression
      const compressedSize = reader.readUInt32();
      const compressedData = reader.readBytes(compressedSize);
      const decompressed = await inflate(compressedData);
      const decompressedReader = new BinaryReader(decompressed.buffer);
      faceData = decompressedReader.readUInt32Array(this.header.faceCount * 3);
    } else {
      throw new Error(`Unsupported compression type: ${this.header.compression}`);
    }
    
    // Convert flat array to array of [v1, v2, v3] triangles
    const faces = [];
    for (let i = 0; i < faceData.length; i += 3) {
      faces.push([faceData[i], faceData[i + 1], faceData[i + 2]]);
    }
    
    return faces;
  }

  /**
   * Organize geometry data by elements
   */
  organizeGeometryData(vertices, faces) {
    this.vertices = vertices;
    this.faces = faces;
    
    // Create element geometry objects
    for (const elementInfo of this.elementTable) {
      const element = {
        id: elementInfo.id,
        type: this.getElementTypeName(elementInfo.type),
        materialId: elementInfo.materialId,
        vertices: vertices.slice(
          elementInfo.vertexOffset,
          elementInfo.vertexOffset + elementInfo.vertexCount
        ),
        faces: faces.slice(
          elementInfo.faceOffset,
          elementInfo.faceOffset + elementInfo.faceCount
        ).map(face => [
          face[0] - elementInfo.vertexOffset,
          face[1] - elementInfo.vertexOffset,
          face[2] - elementInfo.vertexOffset
        ]),
        boundingBox: null
      };
      
      // Calculate bounding box for element
      element.boundingBox = this.calculateElementBoundingBox(element.vertices);
      
      this.elements[elementInfo.id] = element;
    }
  }

  /**
   * Get element type name from numeric type
   */
  getElementTypeName(type) {
    const typeMap = {
      1: 'wall',
      2: 'slab',
      3: 'beam',
      4: 'column',
      5: 'door',
      6: 'window',
      7: 'roof',
      8: 'stair',
      9: 'railing',
      10: 'furniture',
      99: 'generic'
    };
    
    return typeMap[type] || 'unknown';
  }

  /**
   * Calculate bounding box for an element's vertices
   */
  calculateElementBoundingBox(vertices) {
    if (!vertices || vertices.length === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const vertex of vertices) {
      minX = Math.min(minX, vertex[0]);
      minY = Math.min(minY, vertex[1]);
      minZ = Math.min(minZ, vertex[2]);
      maxX = Math.max(maxX, vertex[0]);
      maxY = Math.max(maxY, vertex[1]);
      maxZ = Math.max(maxZ, vertex[2]);
    }
    
    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    };
  }

  /**
   * Get element by ID
   */
  getElement(elementId) {
    return this.elements[elementId] || null;
  }

  /**
   * Get all elements
   */
  getAllElements() {
    return Object.values(this.elements);
  }

  /**
   * Get elements by type
   */
  getElementsByType(type) {
    return Object.values(this.elements).filter(element => element.type === type);
  }

  /**
   * Get chunk statistics
   */
  getStatistics() {
    return {
      elementCount: Object.keys(this.elements).length,
      vertexCount: this.vertices ? this.vertices.length : 0,
      faceCount: this.faces ? this.faces.length : 0,
      boundingBox: this.header ? this.header.boundingBox : null,
      compression: this.header ? this.header.compression : 0,
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  /**
   * Calculate approximate memory usage
   */
  calculateMemoryUsage() {
    let usage = 0;
    
    // Vertices (3 floats * 4 bytes each)
    if (this.vertices) {
      usage += this.vertices.length * 3 * 4;
    }
    
    // Faces (3 integers * 4 bytes each)
    if (this.faces) {
      usage += this.faces.length * 3 * 4;
    }
    
    // Element data (rough estimate)
    usage += Object.keys(this.elements).length * 1024; // 1KB per element average
    
    return usage;
  }

  /**
   * Export element to common 3D format
   */
  exportElementToOBJ(elementId) {
    const element = this.elements[elementId];
    if (!element) {
      throw new Error(`Element ${elementId} not found`);
    }
    
    let obj = `# CHD exported element ${elementId}\n`;
    obj += `# Type: ${element.type}\n\n`;
    
    // Export vertices
    for (const vertex of element.vertices) {
      obj += `v ${vertex[0]} ${vertex[1]} ${vertex[2]}\n`;
    }
    
    obj += '\n';
    
    // Export faces (OBJ uses 1-based indexing)
    for (const face of element.faces) {
      obj += `f ${face[0] + 1} ${face[1] + 1} ${face[2] + 1}\n`;
    }
    
    return obj;
  }

  /**
   * Convert element to glTF-compatible format
   */
  exportElementToGLTF(elementId) {
    const element = this.elements[elementId];
    if (!element) {
      throw new Error(`Element ${elementId} not found`);
    }
    
    // Flatten vertices for glTF
    const positions = [];
    for (const vertex of element.vertices) {
      positions.push(...vertex);
    }
    
    // Flatten faces for glTF
    const indices = [];
    for (const face of element.faces) {
      indices.push(...face);
    }
    
    return {
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
      boundingBox: element.boundingBox,
      type: element.type,
      materialId: element.materialId
    };
  }

  /**
   * Validate geometry data integrity
   */
  validate() {
    const errors = [];
    
    // Check if all face indices are valid
    if (this.faces && this.vertices) {
      for (let i = 0; i < this.faces.length; i++) {
        const face = this.faces[i];
        for (const vertexIndex of face) {
          if (vertexIndex >= this.vertices.length) {
            errors.push(`Face ${i} references invalid vertex index: ${vertexIndex}`);
          }
        }
      }
    }
    
    // Check element data consistency
    for (const element of Object.values(this.elements)) {
      if (element.faces) {
        for (let i = 0; i < element.faces.length; i++) {
          const face = element.faces[i];
          for (const vertexIndex of face) {
            if (vertexIndex >= element.vertices.length) {
              errors.push(`Element ${element.id} face ${i} references invalid vertex index: ${vertexIndex}`);
            }
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}