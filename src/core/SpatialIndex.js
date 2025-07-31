import { BinaryReader } from '../utils/BinaryReader.js';

/**
 * Spatial Index for efficient 3D spatial queries
 * Implements R-tree structure for fast bounding box queries
 */
export class SpatialIndex {
  constructor() {
    this.type = 'r_tree';
    this.maxDepth = 0;
    this.nodeCount = 0;
    this.leafCount = 0;
    this.boundingBox = null;
    this.nodes = new Map();
    this.elementToChunk = new Map();
  }

  /**
   * Load spatial index from binary data
   */
  async loadFromBinary(binaryData) {
    const reader = new BinaryReader(binaryData.buffer || binaryData);
    
    try {
      // Read and validate header
      this.parseHeader(reader);
      
      // Read all nodes
      await this.parseNodes(reader);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to load spatial index: ${error.message}`);
    }
  }

  /**
   * Parse spatial index header
   */
  parseHeader(reader) {
    // Validate magic number
    reader.validateMagic('CHDS');
    
    // Read header data
    const version = reader.readUInt32();
    if (version !== 1) {
      throw new Error(`Unsupported spatial index version: ${version}`);
    }
    
    this.type = reader.readUInt8(); // 1=R-tree, 2=Octree
    this.maxDepth = reader.readUInt8();
    this.nodeCount = reader.readUInt32();
    this.leafCount = reader.readUInt32();
    this.boundingBox = reader.readBoundingBox();
    
    // Skip reserved bytes
    reader.skip(20);
  }

  /**
   * Parse all nodes from binary data
   */
  async parseNodes(reader) {
    for (let i = 0; i < this.nodeCount; i++) {
      const node = this.parseNode(reader);
      this.nodes.set(node.id, node);
      
      // Build element to chunk mapping for leaf nodes
      if (node.isLeaf && node.elementIds) {
        for (const elementId of node.elementIds) {
          this.elementToChunk.set(elementId, node.chunkId);
        }
      }
    }
  }

  /**
   * Parse a single node from binary data
   */
  parseNode(reader) {
    const node = {
      id: reader.readUInt32(),
      parentId: reader.readUInt32(),
      childCount: reader.readUInt16(),
      isLeaf: reader.readUInt8() === 1,
      reserved: reader.readUInt8(),
      boundingBox: reader.readBoundingBox(),
      childIds: [],
      elementIds: []
    };
    
    // Read child IDs
    for (let i = 0; i < node.childCount; i++) {
      node.childIds.push(reader.readUInt32());
    }
    
    // For leaf nodes, read element IDs
    if (node.isLeaf) {
      const elementCount = reader.readUInt32();
      for (let i = 0; i < elementCount; i++) {
        node.elementIds.push(reader.readUInt32());
      }
      
      // Read chunk ID for this leaf
      node.chunkId = reader.readUInt32();
    }
    
    return node;
  }

  /**
   * Query elements within bounding box
   */
  queryBounds(minX, minY, minZ, maxX, maxY, maxZ) {
    const queryBox = {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    };
    
    const results = new Set();
    this.queryNode(1, queryBox, results); // Start from root node (ID=1)
    
    return Array.from(results);
  }

  /**
   * Recursively query a node and its children
   */
  queryNode(nodeId, queryBox, results) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Check if node's bounding box intersects with query box
    if (!this.boundingBoxIntersects(node.boundingBox, queryBox)) {
      return;
    }
    
    if (node.isLeaf) {
      // Add all elements in this leaf node
      for (const elementId of node.elementIds) {
        results.add(elementId);
      }
    } else {
      // Recursively query child nodes
      for (const childId of node.childIds) {
        this.queryNode(childId, queryBox, results);
      }
    }
  }

  /**
   * Check if two bounding boxes intersect
   */
  boundingBoxIntersects(box1, box2) {
    return (
      box1.min[0] <= box2.max[0] && box1.max[0] >= box2.min[0] &&
      box1.min[1] <= box2.max[1] && box1.max[1] >= box2.min[1] &&
      box1.min[2] <= box2.max[2] && box1.max[2] >= box2.min[2]
    );
  }

  /**
   * Find which chunk contains a specific element
   */
  findChunkForElement(elementId) {
    return this.elementToChunk.get(elementId);
  }

  /**
   * Query elements by point (returns elements whose bounding box contains the point)
   */
  queryPoint(x, y, z) {
    return this.queryBounds(x, y, z, x, y, z);
  }

  /**
   * Query elements within radius of a point
   */
  queryRadius(centerX, centerY, centerZ, radius) {
    return this.queryBounds(
      centerX - radius, centerY - radius, centerZ - radius,
      centerX + radius, centerY + radius, centerZ + radius
    );
  }

  /**
   * Get all leaf nodes
   */
  getLeafNodes() {
    const leafNodes = [];
    for (const node of this.nodes.values()) {
      if (node.isLeaf) {
        leafNodes.push(node);
      }
    }
    return leafNodes;
  }

  /**
   * Get statistics about the spatial index
   */
  getStatistics() {
    return {
      type: this.type === 1 ? 'R-tree' : 'Octree',
      maxDepth: this.maxDepth,
      nodeCount: this.nodeCount,
      leafCount: this.leafCount,
      boundingBox: this.boundingBox,
      totalElements: this.elementToChunk.size
    };
  }

  /**
   * Find the optimal chunks to load for a given viewport
   */
  getChunksForViewport(viewportBounds, maxChunks = 10) {
    const elementIds = this.queryBounds(
      viewportBounds.min[0], viewportBounds.min[1], viewportBounds.min[2],
      viewportBounds.max[0], viewportBounds.max[1], viewportBounds.max[2]
    );
    
    // Count elements per chunk
    const chunkCounts = new Map();
    for (const elementId of elementIds) {
      const chunkId = this.findChunkForElement(elementId);
      if (chunkId) {
        chunkCounts.set(chunkId, (chunkCounts.get(chunkId) || 0) + 1);
      }
    }
    
    // Sort chunks by element count (descending)
    const sortedChunks = Array.from(chunkCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxChunks)
      .map(([chunkId]) => chunkId);
    
    return sortedChunks;
  }

  /**
   * Build spatial index from elements (for creating new indexes)
   */
  static buildFromElements(elements, options = {}) {
    const index = new SpatialIndex();
    
    // Implementation would go here for building R-tree from scratch
    // This is complex and would require a full R-tree construction algorithm
    
    throw new Error('Building spatial index from elements not yet implemented');
  }

  /**
   * Calculate bounding box for a set of points
   */
  static calculateBoundingBox(points) {
    if (!points || points.length === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const point of points) {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      minZ = Math.min(minZ, point[2]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
      maxZ = Math.max(maxZ, point[2]);
    }
    
    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    };
  }
}