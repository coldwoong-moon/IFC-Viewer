import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { encode as cborEncode } from 'cbor-x';
import { BinaryWriter } from '../utils/BinaryWriter.js';

const deflate = promisify(zlib.deflate);

/**
 * CHD Format Writer
 * Creates Construction Hybrid Data files efficiently with compression support
 */
export class CHDWriter {
  constructor(options = {}) {
    this.options = {
      compression: 'zlib', // 'none', 'zlib'
      compressionLevel: 6,
      chunkSize: 10000, // elements per chunk
      createSpatialIndex: true,
      progressCallback: null,
      ...options
    };
    
    this.manifest = null;
    this.chunks = [];
    this.materials = new Map();
    this.properties = new Map();
    this.idMapping = new Map(); // Maps numeric IDs back to original string IDs
  }

  /**
   * Write a CHD file from model data
   * @param {Object} model - Model data to write
   * @param {string} outputPath - Output path for .chd directory
   */
  async write(model, outputPath) {
    try {
      // Step 1: Prepare output directory
      await this.prepareOutputDirectory(outputPath);
      this.reportProgress('prepare', 5);

      // Step 2: Process model data and create chunks
      await this.processModelData(model);
      this.reportProgress('process', 20);

      // Step 3: Write geometry chunks
      await this.writeGeometryChunks(outputPath);
      this.reportProgress('geometry', 50);

      // Step 4: Write attributes
      await this.writeAttributes(outputPath);
      this.reportProgress('attributes', 70);

      // Step 5: Create spatial index
      if (this.options.createSpatialIndex) {
        await this.createSpatialIndex(outputPath);
        this.reportProgress('spatial_index', 85);
      }

      // Step 6: Write manifest
      await this.writeManifest(outputPath);
      this.reportProgress('manifest', 95);

      // Step 7: Write relations
      await this.writeRelations(outputPath, model);
      this.reportProgress('complete', 100);

      return {
        success: true,
        outputPath,
        statistics: this.getWriteStatistics()
      };
    } catch (error) {
      throw new Error(`CHD writing failed: ${error.message}`);
    }
  }

  /**
   * Prepare output directory structure
   */
  async prepareOutputDirectory(outputPath) {
    await fs.mkdir(outputPath, { recursive: true });
    await fs.mkdir(path.join(outputPath, 'geometry'), { recursive: true });
    await fs.mkdir(path.join(outputPath, 'attributes'), { recursive: true });
    await fs.mkdir(path.join(outputPath, 'relations'), { recursive: true });
  }

  /**
   * Process model data and organize into chunks
   */
  async processModelData(model) {
    if (!model.elements || !Array.isArray(model.elements)) {
      throw new Error('Model must contain an elements array');
    }

    // Initialize manifest
    this.manifest = {
      format: 'CHD',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      project: model.project || {
        name: 'Untitled Project',
        description: 'Generated CHD file',
        units: 'meters',
        coordinate_system: 'local'
      },
      index: {
        geometry_chunks: [],
        attribute_files: [],
        spatial_index: null
      },
      statistics: {
        total_elements: model.elements.length,
        total_vertices: 0,
        total_faces: 0,
        file_size: 0,
        compression_ratio: 0
      }
    };

    // Calculate project bounding box
    this.manifest.project.bounding_box = this.calculateProjectBoundingBox(model.elements);

    // Organize elements into chunks
    this.organizeElementsIntoChunks(model.elements);

    // Process materials and properties
    this.processMaterials(model.materials || {});
    this.processProperties(model.elements);
  }

  /**
   * Calculate bounding box for entire project
   */
  calculateProjectBoundingBox(elements) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const element of elements) {
      if (element.vertices) {
        for (const vertex of element.vertices) {
          minX = Math.min(minX, vertex[0]);
          minY = Math.min(minY, vertex[1]);
          minZ = Math.min(minZ, vertex[2]);
          maxX = Math.max(maxX, vertex[0]);
          maxY = Math.max(maxY, vertex[1]);
          maxZ = Math.max(maxZ, vertex[2]);
        }
      }
    }

    // Handle empty project
    if (minX === Infinity) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    };
  }

  /**
   * Organize elements into chunks for efficient processing
   */
  organizeElementsIntoChunks(elements) {
    const chunkSize = this.options.chunkSize;
    
    for (let i = 0; i < elements.length; i += chunkSize) {
      const chunkElements = elements.slice(i, i + chunkSize);
      const chunkId = String(Math.floor(i / chunkSize) + 1).padStart(3, '0');
      
      const chunk = {
        id: chunkId,
        elements: chunkElements,
        vertices: [],
        faces: [],
        elementTable: []
      };

      this.processChunkGeometry(chunk);
      this.chunks.push(chunk);
    }
  }

  /**
   * Process geometry data for a chunk
   */
  processChunkGeometry(chunk) {
    let vertexOffset = 0;
    let faceOffset = 0;

    for (const element of chunk.elements) {
      if (!element.vertices || !element.faces) {
        continue;
      }

      // Add vertices to chunk
      const elementVertexCount = element.vertices.length;
      chunk.vertices.push(...element.vertices);

      // Add faces to chunk (adjust indices)
      const elementFaces = element.faces.map(face => [
        face[0] + vertexOffset,
        face[1] + vertexOffset,
        face[2] + vertexOffset
      ]);
      chunk.faces.push(...elementFaces);

      // Create element table entry
      const elementId = element.id || `elem_${element.index || 0}`;
      const numericId = this.convertToNumericId(elementId);
      
      chunk.elementTable.push({
        id: numericId,
        originalId: elementId,
        type: this.getElementTypeCode(element.type || 'generic'),
        materialId: element.materialId || 0,
        vertexOffset: vertexOffset,
        vertexCount: elementVertexCount,
        faceOffset: faceOffset,
        faceCount: element.faces.length
      });

      vertexOffset += elementVertexCount;
      faceOffset += element.faces.length;
    }

    // Update statistics
    this.manifest.statistics.total_vertices += chunk.vertices.length;
    this.manifest.statistics.total_faces += chunk.faces.length;
  }

  /**
   * Get numeric type code for element type
   */
  getElementTypeCode(type) {
    const typeMap = {
      'wall': 1,
      'slab': 2,
      'beam': 3,
      'column': 4,
      'door': 5,
      'window': 6,
      'roof': 7,
      'stair': 8,
      'railing': 9,
      'furniture': 10,
      'generic': 99
    };
    
    return typeMap[type.toLowerCase()] || 99;
  }

  /**
   * Convert string ID to numeric ID using simple hash
   */
  convertToNumericId(id) {
    if (typeof id === 'number') {
      return id;
    }
    
    // Simple hash function for string IDs
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Ensure positive number
    const numericId = Math.abs(hash);
    
    // Store mapping for later reference
    this.idMapping.set(numericId, id);
    
    return numericId;
  }

  /**
   * Process materials from model
   */
  processMaterials(materials) {
    for (const [id, material] of Object.entries(materials)) {
      this.materials.set(id, material);
    }
  }

  /**
   * Process properties from elements
   */
  processProperties(elements) {
    for (const element of elements) {
      if (element.properties) {
        this.properties.set(element.id || `elem_${element.index || 0}`, {
          guid: element.guid || this.generateGUID(),
          name: element.name || 'Unnamed Element',
          type: element.type || 'generic',
          level: element.level || 'Level 0',
          material_id: element.materialId || null,
          dimensions: element.dimensions || {},
          custom_properties: element.properties || {}
        });
      }
    }
  }

  /**
   * Write geometry chunks to files
   */
  async writeGeometryChunks(outputPath) {
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const chunkFileName = `chunk_${chunk.id}.bin`;
      const chunkPath = path.join(outputPath, 'geometry', chunkFileName);

      const binaryData = await this.createGeometryChunkBinary(chunk);
      await fs.writeFile(chunkPath, binaryData);

      // Add to manifest
      this.manifest.index.geometry_chunks.push({
        id: chunk.id,
        file: `geometry/${chunkFileName}`,
        elements: chunk.elementTable.length,
        size: binaryData.length
      });

      this.reportProgress('chunk', 20 + (30 * (i + 1) / this.chunks.length));
    }
  }

  /**
   * Create binary data for geometry chunk
   */
  async createGeometryChunkBinary(chunk) {
    const writer = new BinaryWriter();

    // Calculate bounding box for chunk
    const boundingBox = this.calculateChunkBoundingBox(chunk.vertices);

    // Write header
    writer.writeMagic('CHDG');
    writer.writeUInt32(1); // version
    writer.writeUInt8(this.options.compression === 'zlib' ? 1 : 0); // compression
    writer.writeUInt32(chunk.elementTable.length); // element count
    writer.writeUInt32(chunk.vertices.length); // vertex count
    writer.writeUInt32(chunk.faces.length); // face count
    writer.writeBoundingBox(boundingBox);
    writer.writePadding(8); // reserved

    // Write element table
    for (const element of chunk.elementTable) {
      writer.writeUInt32(element.id);
      writer.writeUInt16(element.type);
      writer.writeUInt16(element.materialId);
      writer.writeUInt32(element.vertexOffset);
      writer.writeUInt32(element.vertexCount);
      writer.writeUInt32(element.faceOffset);
      writer.writeUInt32(element.faceCount);
    }

    // Write geometry data
    if (this.options.compression === 'zlib') {
      await this.writeCompressedGeometry(writer, chunk);
    } else {
      this.writeUncompressedGeometry(writer, chunk);
    }

    return writer.getUint8Array();
  }

  /**
   * Write compressed geometry data
   */
  async writeCompressedGeometry(writer, chunk) {
    // Compress vertices
    const vertexData = new Float32Array(chunk.vertices.length * 3);
    for (let i = 0; i < chunk.vertices.length; i++) {
      vertexData[i * 3] = chunk.vertices[i][0];
      vertexData[i * 3 + 1] = chunk.vertices[i][1];
      vertexData[i * 3 + 2] = chunk.vertices[i][2];
    }
    
    const compressedVertices = await deflate(Buffer.from(vertexData.buffer), {
      level: this.options.compressionLevel
    });
    writer.writeUInt32(compressedVertices.length);
    writer.writeBytes(compressedVertices);

    // Compress faces
    const faceData = new Uint32Array(chunk.faces.length * 3);
    for (let i = 0; i < chunk.faces.length; i++) {
      faceData[i * 3] = chunk.faces[i][0];
      faceData[i * 3 + 1] = chunk.faces[i][1];
      faceData[i * 3 + 2] = chunk.faces[i][2];
    }
    
    const compressedFaces = await deflate(Buffer.from(faceData.buffer), {
      level: this.options.compressionLevel
    });
    writer.writeUInt32(compressedFaces.length);
    writer.writeBytes(compressedFaces);
  }

  /**
   * Write uncompressed geometry data
   */
  writeUncompressedGeometry(writer, chunk) {
    // Write vertices
    for (const vertex of chunk.vertices) {
      writer.writeFloat32(vertex[0]);
      writer.writeFloat32(vertex[1]);
      writer.writeFloat32(vertex[2]);
    }

    // Write faces
    for (const face of chunk.faces) {
      writer.writeUInt32(face[0]);
      writer.writeUInt32(face[1]);
      writer.writeUInt32(face[2]);
    }
  }

  /**
   * Calculate bounding box for chunk vertices
   */
  calculateChunkBoundingBox(vertices) {
    if (vertices.length === 0) {
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
   * Write attribute files
   */
  async writeAttributes(outputPath) {
    // Write materials
    if (this.materials.size > 0) {
      const materialsData = cborEncode({
        materials: Object.fromEntries(this.materials)
      });
      
      const materialsPath = path.join(outputPath, 'attributes', 'materials.cbor');
      await fs.writeFile(materialsPath, materialsData);
      
      this.manifest.index.attribute_files.push({
        type: 'materials',
        file: 'attributes/materials.cbor',
        count: this.materials.size
      });
    }

    // Write properties
    if (this.properties.size > 0) {
      const propertiesData = cborEncode({
        elements: Object.fromEntries(this.properties)
      });
      
      const propertiesPath = path.join(outputPath, 'attributes', 'properties.cbor');
      await fs.writeFile(propertiesPath, propertiesData);
      
      this.manifest.index.attribute_files.push({
        type: 'properties',
        file: 'attributes/properties.cbor',
        count: this.properties.size
      });
    }
  }

  /**
   * Create spatial index (simplified implementation)
   */
  async createSpatialIndex(outputPath) {
    if (this.chunks.length === 0) return;

    // This is a simplified spatial index implementation
    // A full implementation would build a proper R-tree
    const writer = new BinaryWriter();

    // Write header
    writer.writeMagic('CHDS');
    writer.writeUInt32(1); // version
    writer.writeUInt8(1); // R-tree type
    writer.writeUInt8(2); // max depth
    writer.writeUInt32(this.chunks.length); // node count
    writer.writeUInt32(this.chunks.length); // leaf count
    writer.writeBoundingBox(this.manifest.project.bounding_box);
    writer.writePadding(20); // reserved

    // Write simplified leaf nodes (one per chunk)
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const boundingBox = this.calculateChunkBoundingBox(chunk.vertices);

      writer.writeUInt32(i + 1); // node ID
      writer.writeUInt32(0); // parent ID (root)
      writer.writeUInt16(0); // child count
      writer.writeUInt8(1); // is leaf
      writer.writeUInt8(0); // reserved
      writer.writeBoundingBox(boundingBox);

      // Element IDs in this chunk
      writer.writeUInt32(chunk.elementTable.length);
      for (const element of chunk.elementTable) {
        writer.writeUInt32(element.id);
      }
      
      // Chunk ID
      writer.writeUInt32(chunk.id);
    }

    const indexPath = path.join(outputPath, 'spatial.idx');
    await fs.writeFile(indexPath, writer.getUint8Array());

    this.manifest.index.spatial_index = {
      file: 'spatial.idx',
      type: 'r_tree',
      levels: 2,
      nodes: this.chunks.length
    };
  }

  /**
   * Write manifest file
   */
  async writeManifest(outputPath) {
    // Calculate final statistics
    let totalSize = 0;
    for (const chunk of this.manifest.index.geometry_chunks) {
      totalSize += chunk.size;
    }
    
    this.manifest.statistics.file_size = totalSize;
    this.manifest.statistics.compression_ratio = this.calculateCompressionRatio();

    const manifestPath = path.join(outputPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  /**
   * Write relations files
   */
  async writeRelations(outputPath, model) {
    // Write hierarchy (simplified)
    const hierarchy = model.hierarchy || this.buildSimpleHierarchy();
    const hierarchyPath = path.join(outputPath, 'relations', 'hierarchy.json');
    await fs.writeFile(hierarchyPath, JSON.stringify(hierarchy, null, 2));

    // Write references (simplified)
    const references = model.references || {};
    const referencesPath = path.join(outputPath, 'relations', 'references.json');
    await fs.writeFile(referencesPath, JSON.stringify(references, null, 2));
  }

  /**
   * Build simple hierarchy from elements
   */
  buildSimpleHierarchy() {
    const hierarchy = {
      root: {
        id: 'root',
        name: 'Project Root',
        children: []
      }
    };

    // Group elements by level
    const levels = new Map();
    for (const [elementId, properties] of this.properties.entries()) {
      const level = properties.level || 'Level 0';
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level).push(elementId);
    }

    // Create level nodes
    for (const [levelName, elementIds] of levels.entries()) {
      const levelId = levelName.toLowerCase().replace(/\s+/g, '_');
      hierarchy[levelId] = {
        id: levelId,
        name: levelName,
        parent: 'root',
        children: elementIds
      };
      hierarchy.root.children.push(levelId);
    }

    return hierarchy;
  }

  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio() {
    // Estimate uncompressed size
    const uncompressedSize = 
      this.manifest.statistics.total_vertices * 3 * 4 + // vertices
      this.manifest.statistics.total_faces * 3 * 4; // faces
    
    const compressedSize = this.manifest.statistics.file_size;
    
    return uncompressedSize > 0 ? compressedSize / uncompressedSize : 1.0;
  }

  /**
   * Generate a simple GUID
   */
  generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Report writing progress
   */
  reportProgress(stage, percentage) {
    if (this.options.progressCallback) {
      this.options.progressCallback({
        stage,
        percentage: Math.round(percentage),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get write statistics
   */
  getWriteStatistics() {
    return {
      chunks: this.chunks.length,
      elements: this.manifest.statistics.total_elements,
      vertices: this.manifest.statistics.total_vertices,
      faces: this.manifest.statistics.total_faces,
      materials: this.materials.size,
      properties: this.properties.size,
      fileSize: this.manifest.statistics.file_size,
      compressionRatio: this.manifest.statistics.compression_ratio
    };
  }

  /**
   * Create CHD from simple model data
   */
  static async createFromSimpleModel(elements, outputPath, options = {}) {
    const writer = new CHDWriter(options);
    
    const model = {
      project: {
        name: 'Generated Model',
        description: 'Created from simple elements',
        units: 'meters'
      },
      elements: elements,
      materials: {},
      hierarchy: null,
      references: {}
    };

    return await writer.write(model, outputPath);
  }
}