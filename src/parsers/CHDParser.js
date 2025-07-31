import fs from 'fs/promises';
import path from 'path';
import { decode as cborDecode } from 'cbor-x';
import { BinaryReader } from '../utils/BinaryReader.js';
import { SpatialIndex } from '../core/SpatialIndex.js';
import { GeometryChunk } from '../core/GeometryChunk.js';

/**
 * CHD Format Parser
 * Reads Construction Hybrid Data files efficiently with streaming support
 */
export class CHDParser {
  constructor(options = {}) {
    this.options = {
      loadGeometry: true,
      loadAttributes: true,
      loadSpatialIndex: true,
      compressionSupport: ['zlib'],
      progressCallback: null,
      verbose: false, // 상세 로깅 제어
      ...options
    };
    
    this.manifest = null;
    this.basePath = null;
    this.loadedChunks = new Map();
    this.spatialIndex = null;
  }

  /**
   * Parse a CHD file/directory
   * @param {string} filePath - Path to .chd directory or file
   * @returns {Promise<Object>} Parsed CHD model
   */
  async parse(filePath) {
    this.basePath = await this.validateAndPreparePath(filePath);
    
    try {
      // Step 1: Load and validate manifest
      this.manifest = await this.loadManifest();
      this.reportProgress('manifest', 10);

      // Step 2: Load spatial index if requested
      if (this.options.loadSpatialIndex) {
        this.spatialIndex = await this.loadSpatialIndex();
        this.reportProgress('spatial_index', 20);
      }

      // Step 3: Load geometry chunks if requested
      let geometryData = null;
      if (this.options.loadGeometry) {
        geometryData = await this.loadGeometryChunks();
        this.reportProgress('geometry', 60);
      }

      // Step 4: Load attributes if requested
      let attributeData = null;
      if (this.options.loadAttributes) {
        attributeData = await this.loadAttributes();
        this.reportProgress('attributes', 80);
      }

      // Step 5: Assemble final model
      const model = this.assembleModel(geometryData, attributeData);
      this.reportProgress('complete', 100);

      return model;
    } catch (error) {
      throw new Error(`CHD parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate and prepare the file path
   */
  async validateAndPreparePath(filePath) {
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      // Direct .chd directory
      return filePath;
    } else if (path.extname(filePath) === '.chd') {
      // Single file - treat as directory
      return filePath;
    } else {
      throw new Error('Invalid CHD file path. Expected .chd directory or file.');
    }
  }

  /**
   * Load and validate the manifest file
   */
  async loadManifest() {
    const manifestPath = path.join(this.basePath, 'manifest.json');
    
    try {
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);
      
      // Validate format and version
      if (manifest.format !== 'CHD') {
        throw new Error('Invalid format. Expected CHD format.');
      }
      
      if (!manifest.version || !this.isVersionSupported(manifest.version)) {
        throw new Error(`Unsupported CHD version: ${manifest.version}`);
      }
      
      return manifest;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Manifest file not found. Invalid CHD structure.');
      }
      throw error;
    }
  }

  /**
   * Check if CHD version is supported
   */
  isVersionSupported(version) {
    const supportedVersions = ['1.0'];
    return supportedVersions.includes(version);
  }

  /**
   * Load spatial index for efficient spatial queries
   */
  async loadSpatialIndex() {
    if (!this.manifest.index.spatial_index) {
      return null;
    }

    const indexPath = path.join(this.basePath, this.manifest.index.spatial_index.file);
    
    try {
      const indexData = await fs.readFile(indexPath);
      const spatialIndex = new SpatialIndex();
      await spatialIndex.loadFromBinary(indexData);
      return spatialIndex;
    } catch (error) {
      console.warn('Failed to load spatial index:', error.message);
      return null;
    }
  }

  /**
   * Load geometry chunks
   */
  async loadGeometryChunks() {
    if (!this.manifest.index.geometry_chunks) {
      return {};
    }

    const geometryData = {};
    const chunks = this.manifest.index.geometry_chunks;

    for (let i = 0; i < chunks.length; i++) {
      const chunkInfo = chunks[i];
      const chunkPath = path.join(this.basePath, chunkInfo.file);
      
      try {
        const chunkData = await fs.readFile(chunkPath);
        const chunk = new GeometryChunk();
        const parsedChunk = await chunk.parseFromBinary(chunkData);
        
        geometryData[chunkInfo.id] = parsedChunk;
        this.loadedChunks.set(chunkInfo.id, parsedChunk);
        
        // Update progress
        const progress = 20 + (40 * (i + 1) / chunks.length);
        this.reportProgress('geometry_chunk', progress);
        
      } catch (error) {
        console.warn(`Failed to load geometry chunk ${chunkInfo.id}:`, error.message);
      }
    }

    return geometryData;
  }

  /**
   * Load attribute data (materials, properties, etc.)
   */
  async loadAttributes() {
    if (!this.manifest.index.attribute_files) {
      return {};
    }

    const attributeData = {};
    const attributeFiles = this.manifest.index.attribute_files;

    for (const fileInfo of attributeFiles) {
      const filePath = path.join(this.basePath, fileInfo.file);
      
      try {
        const fileData = await fs.readFile(filePath);
        const decodedData = cborDecode(fileData);
        attributeData[fileInfo.type] = decodedData;
      } catch (error) {
        console.warn(`Failed to load attribute file ${fileInfo.type}:`, error.message);
      }
    }

    return attributeData;
  }

  /**
   * Load hierarchy and relationships
   */
  async loadRelations() {
    const relations = {};
    
    try {
      // Load hierarchy
      const hierarchyPath = path.join(this.basePath, 'relations/hierarchy.json');
      const hierarchyData = await fs.readFile(hierarchyPath, 'utf8');
      relations.hierarchy = JSON.parse(hierarchyData);
    } catch (error) {
      console.warn('Failed to load hierarchy:', error.message);
    }

    try {
      // Load references
      const referencesPath = path.join(this.basePath, 'relations/references.json');
      const referencesData = await fs.readFile(referencesPath, 'utf8');
      relations.references = JSON.parse(referencesData);
    } catch (error) {
      console.warn('Failed to load references:', error.message);
    }

    return relations;
  }

  /**
   * Convert string ID to numeric ID using same algorithm as CHDWriter
   */
  convertToNumericId(id) {
    if (typeof id === 'number') return id;
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  /**
   * Assemble the final model from loaded components
   */
  assembleModel(geometryData, attributeData) {
    // Flatten attributes structure: move from attributeData.properties.elements to direct access
    let flattenedAttributes = {};
    if (attributeData && attributeData.properties && attributeData.properties.elements) {
      const originalAttributes = attributeData.properties.elements;
      
      // Create mapping from GUID-based keys to numeric IDs used in geometry
      for (const [guidKey, attrs] of Object.entries(originalAttributes)) {
        const numericId = this.convertToNumericId(guidKey);
        flattenedAttributes[numericId] = attrs;
      }
    }

    const model = {
      format: 'CHD',
      version: this.manifest.version,
      project: this.manifest.project,
      statistics: this.manifest.statistics,
      spatialIndex: this.spatialIndex,
      geometry: geometryData || {},
      attributes: flattenedAttributes,
      timestamp: new Date().toISOString()
    };

    return model;
  }

  /**
   * Report parsing progress
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
   * Get element by ID with lazy loading
   */
  async getElement(elementId) {
    // First check if we have it in loaded chunks
    for (const [chunkId, chunk] of this.loadedChunks.entries()) {
      if (chunk.elements && chunk.elements[elementId]) {
        return chunk.elements[elementId];
      }
    }

    // If not found and we have spatial index, try to locate the chunk
    if (this.spatialIndex) {
      const chunkId = this.spatialIndex.findChunkForElement(elementId);
      if (chunkId && !this.loadedChunks.has(chunkId)) {
        // Lazy load the chunk
        await this.loadSpecificChunk(chunkId);
        const chunk = this.loadedChunks.get(chunkId);
        if (chunk && chunk.elements && chunk.elements[elementId]) {
          return chunk.elements[elementId];
        }
      }
    }

    return null;
  }

  /**
   * Load a specific geometry chunk on demand
   */
  async loadSpecificChunk(chunkId) {
    const chunkInfo = this.manifest.index.geometry_chunks.find(c => c.id === chunkId);
    if (!chunkInfo) {
      throw new Error(`Chunk ${chunkId} not found in manifest`);
    }

    const chunkPath = path.join(this.basePath, chunkInfo.file);
    const chunkData = await fs.readFile(chunkPath);
    const chunk = new GeometryChunk();
    const parsedChunk = await chunk.parseFromBinary(chunkData);
    
    this.loadedChunks.set(chunkId, parsedChunk);
    return parsedChunk;
  }

  /**
   * Query elements by spatial bounds
   */
  async queryByBounds(minX, minY, minZ, maxX, maxY, maxZ) {
    if (!this.spatialIndex) {
      throw new Error('Spatial index not loaded. Enable loadSpatialIndex option.');
    }

    const elementIds = this.spatialIndex.queryBounds(minX, minY, minZ, maxX, maxY, maxZ);
    const elements = [];

    for (const elementId of elementIds) {
      const element = await this.getElement(elementId);
      if (element) {
        elements.push(element);
      }
    }

    return elements;
  }

  /**
   * Get model statistics
   */
  getStatistics() {
    return {
      ...this.manifest.statistics,
      chunksLoaded: this.loadedChunks.size,
      spatialIndexLoaded: !!this.spatialIndex
    };
  }
}