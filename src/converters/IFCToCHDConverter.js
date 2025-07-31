import fs from 'fs/promises';
import path from 'path';
import { CHDWriter } from '../writers/CHDWriter.js';
import { createIFCLogger } from '../utils/Logger.js';

/**
 * IFC to CHD Converter with Proper Placement Handling
 * Converts IFC files to CHD format while preserving placement transformations
 */
export class IFCToCHDConverter {
  constructor(options = {}) {
    this.options = {
      preserveTransformations: true,
      parseGeometry: true,
      parseAttributes: true,
      parseHierarchy: true,
      coordinateUnits: 'millimeters',
      precision: 1e-6,
      verbose: false, // 상세 로깅 제어
      ...options
    };
    
    // Initialize logger
    this.logger = createIFCLogger({
      verbose: this.options.verbose,
      logFile: options.logFile || 'logs/ifc-conversion.log'
    });
    
    this.ifcData = {};
    this.elements = new Map();
    this.placements = new Map();
    this.axes = new Map();
    this.points = new Map();
    this.directions = new Map();
    this.materials = new Map();
    this.boundingBox = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity]
    };
  }

  /**
   * Convert IFC file to CHD format
   * @param {string} ifcPath - Path to IFC file
   * @param {string} outputPath - Output CHD directory path
   * @returns {Promise<Object>} Conversion result
   */
  async convert(ifcPath, outputPath) {
    this.logger.info('🔄 Starting IFC to CHD conversion...');
    this.logger.info(`   Input: ${ifcPath}`);
    this.logger.info(`   Output: ${outputPath}`);
    
    try {
      // Step 1: Parse IFC file
      this.logger.info('\n📖 Step 1: Parsing IFC file...');
      await this.parseIFCFile(ifcPath);
      
      // Step 2: Process geometric entities
      this.logger.info('\n🔧 Step 2: Processing geometric entities...');
      await this.processGeometricEntities();
      
      // Step 3: Process placement transformations
      this.logger.info('\n📍 Step 3: Processing placement transformations...');
      await this.processPlacementTransformations();
      
      // Step 4: Apply transformations to geometry
      this.logger.info('\n🎯 Step 4: Applying transformations to geometry...');
      await this.applyTransformationsToGeometry();
      
      // Step 5: Write CHD format
      this.logger.info('\n💾 Step 5: Writing CHD format...');
      const result = await this.writeCHDFormat(outputPath);
      
      this.logger.info('\n✅ Conversion completed successfully!');
      this.logger.info(`   Elements processed: ${this.elements.size}`);
      this.logger.info(`   Placements processed: ${this.placements.size}`);
      this.logger.info(`   Final bounding box:`, this.boundingBox);
      
      return result;
      
    } catch (error) {
      this.logger.error('❌ Conversion failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse IFC file and extract entities
   */
  async parseIFCFile(ifcPath) {
    const content = await fs.readFile(ifcPath, 'utf-8');
    const lines = content.split('\n');
    
    let inDataSection = false;
    let entityCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === 'DATA;') {
        inDataSection = true;
        continue;
      }
      
      if (trimmed === 'ENDSEC;' && inDataSection) {
        break;
      }
      
      if (inDataSection && trimmed.startsWith('#')) {
        this.parseIFCEntity(trimmed);
        entityCount++;
      }
    }
    
    this.logger.info(`   Parsed ${entityCount} IFC entities`);
    this.logger.debug(`   Found ${this.points.size} points`);
    this.logger.debug(`   Found ${this.directions.size} directions`);
    this.logger.debug(`   Found ${this.axes.size} axes`);
    this.logger.debug(`   Found ${this.placements.size} placements`);
  }

  /**
   * Parse individual IFC entity line
   */
  parseIFCEntity(line) {
    try {
      // Extract entity ID and type
      const match = line.match(/^#(\d+)=\s*([A-Z][A-Z_0-9]*)\((.*)\);?$/);
      if (!match) return;
      
      const [, id, type, params] = match;
      const entityId = parseInt(id);
      
      // Store entity data
      this.ifcData[entityId] = {
        id: entityId,
        type,
        params: this.parseParameters(params)
      };
      
      // Process specific entity types
      switch (type) {
        case 'IFCCARTESIANPOINT':
          this.parseCartesianPoint(entityId, params);
          break;
        case 'IFCDIRECTION':
          this.parseDirection(entityId, params);
          break;
        case 'IFCAXIS2PLACEMENT3D':
          this.parseAxis2Placement3D(entityId, params);
          break;
        case 'IFCLOCALPLACEMENT':
          this.parseLocalPlacement(entityId, params);
          break;
        case 'IFCBEAM':
        case 'IFCCOLUMN':
        case 'IFCSLAB':
        case 'IFCWALL':
        case 'IFCPLATE':
          this.parseBuildingElement(entityId, type, params);
          break;
      }
    } catch (error) {
      this.logger.warn(`Failed to parse entity ${line.substring(0, 50)}...`);
    }
  }

  /**
   * Parse IFC parameters (improved parser)
   */
  parseParameters(params) {
    const result = [];
    let current = '';
    let depth = 0;
    let inString = false;
    
    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      
      if (char === "'" && params[i-1] !== '\\') {
        inString = !inString;
        current += char;
        continue;
      }
      
      if (!inString) {
        if (char === '(') {
          depth++;
          current += char;
          continue;
        }
        
        if (char === ')') {
          depth--;
          current += char;
          continue;
        }
        
        if (char === ',' && depth === 0) {
          result.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
  }

  /**
   * Parse IFCCARTESIANPOINT
   */
  parseCartesianPoint(entityId, params) {
    // Handle pattern like ((142800.,90410.,19928.))
    let coordMatch = params.match(/\(\(([\d.,\-E\s]+)\)\)/);
    if (!coordMatch) {
      // Handle single parentheses pattern like (142800.,90410.,19928.)
      coordMatch = params.match(/\(([\d.,\-E\s]+)\)/);
    }
    
    if (coordMatch) {
      const coords = coordMatch[1].split(',').map(s => parseFloat(s.trim()));
      this.points.set(entityId, coords);
      this.logger.debug(`Parsed point #${entityId}: [${coords.join(', ')}]`);
    } else {
      this.logger.warn(`Failed to parse point #${entityId}: ${params}`);
    }
  }

  /**
   * Parse IFCDIRECTION
   */
  parseDirection(entityId, params) {
    // Handle pattern like ((1.,0.,0.)) or (1.,0.,0.)
    let coordMatch = params.match(/\(\(([\d.,\-E\s]+)\)\)/);
    if (!coordMatch) {
      coordMatch = params.match(/\(([\d.,\-E\s]+)\)/);
    }
    
    if (coordMatch) {
      const coords = coordMatch[1].split(',').map(s => parseFloat(s.trim()));
      this.directions.set(entityId, coords);
      this.logger.debug(`Parsed direction #${entityId}: [${coords.join(', ')}]`);
    } else {
      this.logger.warn(`Failed to parse direction #${entityId}: ${params}`);
    }
  }

  /**
   * Parse IFCAXIS2PLACEMENT3D
   */
  parseAxis2Placement3D(entityId, params) {
    const parts = this.parseParameters(params);
    const locationRef = this.parseReference(parts[0]);
    const axisRef = parts[1] ? this.parseReference(parts[1]) : null;
    const refDirectionRef = parts[2] ? this.parseReference(parts[2]) : null;
    
    this.axes.set(entityId, {
      location: locationRef,
      axis: axisRef,
      refDirection: refDirectionRef
    });
  }

  /**
   * Parse IFCLOCALPLACEMENT
   */
  parseLocalPlacement(entityId, params) {
    const parts = this.parseParameters(params);
    const placementRelToRef = parts[0] !== '$' ? this.parseReference(parts[0]) : null;
    const relativePlacementRef = this.parseReference(parts[1]);
    
    this.placements.set(entityId, {
      placementRelTo: placementRelToRef,
      relativePlacement: relativePlacementRef
    });
  }

  /**
   * Parse building element
   */
  parseBuildingElement(entityId, type, params) {
    const parts = this.parseParameters(params);
    const globalId = parts[0] ? parts[0].replace(/'/g, '') : `element_${entityId}`;
    const name = parts[2] ? parts[2].replace(/'/g, '') : undefined;
    const objectPlacementRef = parts[5] ? this.parseReference(parts[5]) : null;
    const representationRef = parts[6] ? this.parseReference(parts[6]) : null; // Add representation reference
    
    this.elements.set(entityId, {
      id: entityId,
      globalId,
      type: type.replace('IFC', '').toLowerCase(),
      name,
      objectPlacement: objectPlacementRef,
      representation: representationRef, // Store representation reference
      geometry: null,
      transformedGeometry: null,
      transformation: null
    });
  }

  /**
   * Parse entity reference (#123)
   */
  parseReference(ref) {
    if (!ref || ref === '$') return null;
    const match = ref.match(/#(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Process geometric entities with real IFC geometry parsing
   */
  async processGeometricEntities() {
    this.logger.info('   Processing IFC geometry representations...');
    
    // First, find all shape representations
    this.shapeRepresentations = new Map();
    this.facetedBreps = new Map();
    this.faces = new Map();
    this.polyloops = new Map();
    
    // Parse geometry entities
    for (const [entityId, entity] of Object.entries(this.ifcData)) {
      switch (entity.type) {
        case 'IFCSHAPEREPRESENTATION':
          this.parseShapeRepresentation(entityId, entity.params);
          break;
        case 'IFCFACETEDBREP':
          this.parseFacetedBrep(entityId, entity.params);
          break;
        case 'IFCFACE':
          this.parseFace(entityId, entity.params);
          break;
        case 'IFCPOLYLOOP':
          this.parsePolyLoop(entityId, entity.params);
          break;
        case 'IFCPRODUCTDEFINITIONSHAPE':
          this.parseProductDefinitionShape(entityId, entity.params);
          break;
      }
    }
    
    this.logger.info(`   Found ${this.shapeRepresentations.size} shape representations`);
    this.logger.debug(`   Found ${this.facetedBreps.size} faceted BREPs`);
    this.logger.debug(`   Found ${this.faces.size} faces`);
    this.logger.debug(`   Found ${this.polyloops.size} polyloops`);
    
    // Now process each building element and extract its geometry
    for (const [entityId, element] of this.elements) {
      const geometry = await this.extractElementGeometry(entityId, element);
      element.geometry = geometry;
    }
    
    this.logger.info(`   Generated geometry for ${this.elements.size} elements`);
  }

  /**
   * Create simple geometry for visualization
   */
  createSimpleGeometry(elementType) {
    // Create different sizes based on element type
    let dimensions;
    switch (elementType) {
      case 'beam':
        dimensions = [8000, 350, 350]; // 8m x 350mm x 350mm
        break;
      case 'column':
        dimensions = [350, 350, 3000]; // 350mm x 350mm x 3m
        break;
      case 'slab':
        dimensions = [5000, 5000, 200]; // 5m x 5m x 200mm
        break;
      default:
        dimensions = [1000, 1000, 1000]; // 1m cube
    }
    
    // Create box vertices
    const [w, h, d] = dimensions.map(d => d / 2); // Half dimensions
    
    const vertices = [
      // Bottom face
      [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d],
      // Top face  
      [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]
    ];
    
    const faces = [
      // Bottom
      [0, 1, 2], [0, 2, 3],
      // Top
      [4, 6, 5], [4, 7, 6],
      // Sides
      [0, 4, 5], [0, 5, 1],
      [1, 5, 6], [1, 6, 2],
      [2, 6, 7], [2, 7, 3],
      [3, 7, 4], [3, 4, 0]
    ];
    
    return { vertices, faces };
  }

  /**
   * Process placement transformations
   */
  async processPlacementTransformations() {
    for (const [entityId, element] of this.elements) {
      if (element.objectPlacement) {
        const transformation = this.calculateTransformation(element.objectPlacement);
        element.transformation = transformation;
      }
    }
    
    console.log(`   Calculated transformations for ${this.elements.size} elements`);
  }

  /**
   * Calculate transformation matrix from placement hierarchy
   */
  calculateTransformation(placementId) {
    const matrices = [];
    let currentPlacement = placementId;
    
    // Walk up the placement hierarchy
    while (currentPlacement) {
      const placement = this.placements.get(currentPlacement);
      if (!placement) break;
      
      // Get the axis placement
      const axis = this.axes.get(placement.relativePlacement);
      if (axis) {
        const matrix = this.createTransformationMatrix(axis);
        matrices.unshift(matrix); // Add to beginning for correct order
      }
      
      currentPlacement = placement.placementRelTo;
    }
    
    // Multiply matrices to get final transformation
    return this.multiplyMatrices(matrices);
  }

  /**
   * Create transformation matrix from axis placement
   */
  createTransformationMatrix(axis) {
    // Get location point
    const location = this.points.get(axis.location) || [0, 0, 0];
    
    // Get axis direction (Z-axis)
    const zAxis = axis.axis ? this.getDirection(axis.axis) : [0, 0, 1];
    
    // Get reference direction (X-axis)  
    const xAxis = axis.refDirection ? this.getDirection(axis.refDirection) : [1, 0, 0];
    
    // Calculate Y-axis as cross product of Z and X
    const yAxis = this.crossProduct(zAxis, xAxis);
    
    // Normalize axes
    const xNorm = this.normalize(xAxis);
    const yNorm = this.normalize(yAxis);
    const zNorm = this.normalize(zAxis);
    
    // Create 4x4 transformation matrix
    return [
      [xNorm[0], yNorm[0], zNorm[0], location[0]],
      [xNorm[1], yNorm[1], zNorm[1], location[1]],
      [xNorm[2], yNorm[2], zNorm[2], location[2]],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Get direction vector from IFC direction entity
   */
  getDirection(directionId) {
    const direction = this.directions.get(directionId);
    if (direction) {
      return direction;
    }
    return [1, 0, 0]; // Default X direction
  }

  /**
   * Apply transformations to geometry
   */
  async applyTransformationsToGeometry() {
    for (const [entityId, element] of this.elements) {
      if (element.geometry && element.transformation) {
        const transformedVertices = element.geometry.vertices.map(vertex => 
          this.transformPoint(vertex, element.transformation)
        );
        
        element.transformedGeometry = {
          vertices: transformedVertices,
          faces: element.geometry.faces
        };
        
        // Update bounding box
        this.updateBoundingBox(transformedVertices);
      }
    }
    
    console.log(`   Applied transformations to ${this.elements.size} elements`);
  }

  /**
   * Transform point by matrix
   */
  transformPoint(point, matrix) {
    const [x, y, z] = point;
    const result = [
      matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z + matrix[0][3],
      matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z + matrix[1][3],
      matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z + matrix[2][3]
    ];
    return result;
  }

  /**
   * Update bounding box with vertices
   */
  updateBoundingBox(vertices) {
    for (const vertex of vertices) {
      for (let i = 0; i < 3; i++) {
        this.boundingBox.min[i] = Math.min(this.boundingBox.min[i], vertex[i]);
        this.boundingBox.max[i] = Math.max(this.boundingBox.max[i], vertex[i]);
      }
    }
  }

  /**
   * Write CHD format
   */
  async writeCHDFormat(outputPath) {
    const writer = new CHDWriter({
      compression: true,
      validate: true
    });
    
    // Prepare CHD data structure
    const chdData = {
      project: {
        name: path.basename(outputPath, '.chd'),
        description: 'Converted from IFC with proper placement transformations',
        units: this.options.coordinateUnits,
        coordinate_system: 'world',
        source: {
          format: 'IFC',
          schema: 'IFC2X3'
        },
        bounding_box: this.boundingBox
      },
      elements: []
    };
    
    // Convert elements to CHD format
    for (const [entityId, element] of this.elements) {
      const geometry = element.transformedGeometry || element.geometry;
      if (geometry) {
        chdData.elements.push({
          id: element.globalId,
          type: element.type,
          name: element.name,
          vertices: geometry.vertices,
          faces: geometry.faces,
          attributes: {
            originalId: entityId,
            hasTransformation: !!element.transformation
          }
        });
      }
    }
    
    // Write CHD file
    await writer.write(chdData, outputPath);
    
    return {
      success: true,
      elementsProcessed: this.elements.size,
      outputPath,
      boundingBox: this.boundingBox
    };
  }

  // Utility functions
  crossProduct(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  normalize(vector) {
    const length = Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2);
    return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 0, 0];
  }

  multiplyMatrices(matrices) {
    if (matrices.length === 0) return this.identityMatrix();
    if (matrices.length === 1) return matrices[0];
    
    let result = matrices[0];
    for (let i = 1; i < matrices.length; i++) {
      result = this.multiplyMatrix4x4(result, matrices[i]);
    }
    return result;
  }

  multiplyMatrix4x4(a, b) {
    const result = Array(4).fill(null).map(() => Array(4).fill(0));
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    
    return result;
  }

  identityMatrix() {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  // ============= IFC Geometry Parsing Methods =============

  /**
   * Parse IFCSHAPEREPRESENTATION
   */
  parseShapeRepresentation(entityId, params) {
    this.logger.debug(`Parsing IFCSHAPEREPRESENTATION ${entityId}`);
    
    // params is already parsed array from parseIFCEntity
    const parts = Array.isArray(params) ? params : this.parseParameters(params);
    this.logger.debug(`   Parts: [${parts.map((p, i) => `${i}:"${p}"`).join(', ')}]`);
    
    // Format: IFCSHAPEREPRESENTATION(ContextOfItems,RepresentationIdentifier?,RepresentationType?,Items)
    const contextRef = this.parseReference(parts[0]);
    const identifier = parts[1] ? parts[1].replace(/'/g, '') : null;
    const type = parts[2] ? parts[2].replace(/'/g, '') : null;
    const itemsParam = parts[3];
    
    this.logger.debug(`   Type: "${type}", Items param: "${itemsParam}"`);
    
    // Parse items list
    const items = [];
    if (itemsParam && itemsParam.startsWith('(') && itemsParam.endsWith(')')) {
      const itemsStr = itemsParam.slice(1, -1);
      const itemRefs = itemsStr.split(',').map(ref => this.parseReference(ref.trim()));
      items.push(...itemRefs.filter(ref => ref !== null));
      this.logger.debug(`   Parsed ${items.length} item refs: [${items.join(', ')}]`);
    } else {
      this.logger.debug(`   No valid items param found`);
    }
    
    this.shapeRepresentations.set(parseInt(entityId), {
      context: contextRef,
      identifier,
      type,
      items
    });
    
    this.logger.debug(`   Stored shape representation ${entityId} with type "${type}" and ${items.length} items`);
  }

  /**
   * Parse IFCPRODUCTDEFINITIONSHAPE
   */
  parseProductDefinitionShape(entityId, params) {
    this.logger.debug(`Parsing IFCPRODUCTDEFINITIONSHAPE ${entityId}`);
    
    // params is already parsed array from parseIFCEntity
    const parts = Array.isArray(params) ? params : this.parseParameters(params);
    this.logger.debug(`   Parts: [${parts.map((p, i) => `${i}:"${p}"`).join(', ')}]`);
    
    // Format: IFCPRODUCTDEFINITIONSHAPE(Name?,Description?,Representations)
    const representationsParam = parts[2] || parts[1] || parts[0];
    this.logger.debug(`   Representations param: "${representationsParam}"`);
    
    const representations = [];
    if (representationsParam && representationsParam.startsWith('(') && representationsParam.endsWith(')')) {
      const repsStr = representationsParam.slice(1, -1);
      const repRefs = repsStr.split(',').map(ref => this.parseReference(ref.trim()));
      representations.push(...repRefs.filter(ref => ref !== null));
      console.log(`   Parsed ${representations.length} representation refs: [${representations.join(', ')}]`);
    } else {
      console.log(`   No valid representations param found`);
    }
    
    this.productDefinitionShapes = this.productDefinitionShapes || new Map();
    this.productDefinitionShapes.set(parseInt(entityId), {
      representations
    });
    
    console.log(`   Stored product definition shape ${entityId} with ${representations.length} representations`);
  }

  /**
   * Parse IFCFACETEDBREP
   */
  parseFacetedBrep(entityId, params) {
    // params is already parsed array from parseIFCEntity
    const parts = Array.isArray(params) ? params : this.parseParameters(params);
    // Format: IFCFACETEDBREP(Outer)
    const outerRef = this.parseReference(parts[0]);
    
    this.facetedBreps.set(parseInt(entityId), {
      outer: outerRef
    });
  }

  /**
   * Parse IFCFACE
   */
  parseFace(entityId, params) {
    // params is already parsed array from parseIFCEntity
    const parts = Array.isArray(params) ? params : this.parseParameters(params);
    // Format: IFCFACE(Bounds)
    const boundsParam = parts[0];
    
    const bounds = [];
    if (boundsParam && boundsParam.startsWith('(') && boundsParam.endsWith(')')) {
      const boundsStr = boundsParam.slice(1, -1);
      const boundRefs = boundsStr.split(',').map(ref => this.parseReference(ref.trim()));
      bounds.push(...boundRefs.filter(ref => ref !== null));
    }
    
    this.faces.set(parseInt(entityId), {
      bounds
    });
  }

  /**
   * Parse IFCPOLYLOOP
   */
  parsePolyLoop(entityId, params) {
    // params is already parsed array from parseIFCEntity
    const parts = Array.isArray(params) ? params : this.parseParameters(params);
    // Format: IFCPOLYLOOP(Polygon)
    const polygonParam = parts[0];
    
    const polygon = [];
    if (polygonParam && polygonParam.startsWith('(') && polygonParam.endsWith(')')) {
      const polygonStr = polygonParam.slice(1, -1);
      const pointRefs = polygonStr.split(',').map(ref => this.parseReference(ref.trim()));
      polygon.push(...pointRefs.filter(ref => ref !== null));
    }
    
    this.polyloops.set(parseInt(entityId), {
      polygon
    });
  }

  /**
   * Extract geometry from building element
   */
  async extractElementGeometry(entityId, element) {
    console.log(`\n🔍 Extracting geometry for element ${entityId} (${element.type})`);
    
    // Use the stored representation reference
    const representationRef = element.representation;
    
    if (!representationRef) {
      this.logger.warn(`No representation found for element ${entityId} (${element.type})`);
      return this.createSimpleGeometry(element.type);
    }

    this.logger.debug(`   Representation reference: ${representationRef}`);

    // Get the product definition shape
    const productDefShape = this.productDefinitionShapes?.get(representationRef);
    if (!productDefShape) {
      this.logger.warn(`No product definition shape found for element ${entityId} (${element.type}), ref: ${representationRef}`);
      console.log(`   Available product definition shapes: ${Array.from(this.productDefinitionShapes?.keys() || []).join(', ')}`);
      return this.createSimpleGeometry(element.type);
    }

    console.log(`   Product definition shape found with ${productDefShape.representations.length} representations`);

    // Extract geometry from shape representations
    for (const shapeRepRef of productDefShape.representations) {
      console.log(`   Checking shape representation ${shapeRepRef}`);
      const shapeRep = this.shapeRepresentations.get(shapeRepRef);
      if (shapeRep) {
        console.log(`   Shape representation type: "${shapeRep.type}", items: ${shapeRep.items.length}`);
        if (shapeRep.type === 'Brep') {
          for (const itemRef of shapeRep.items) {
            console.log(`     Processing BREP item ${itemRef}`);
            const geometry = this.extractBrepGeometry(itemRef);
            if (geometry && geometry.vertices.length > 0) {
              console.log(`✅ Extracted BREP geometry for ${element.type} ${entityId}: ${geometry.vertices.length} vertices, ${geometry.faces.length} faces`);
              return geometry;
            }
          }
        } else {
          console.log(`   Skipping non-BREP representation type: "${shapeRep.type}"`);
        }
      } else {
        console.log(`   Shape representation ${shapeRepRef} not found`);
      }
    }

    this.logger.warn(`Could not extract BREP geometry for element ${entityId} (${element.type}), using simple geometry`);
    return this.createSimpleGeometry(element.type);
  }

  /**
   * Extract geometry from BREP
   */
  extractBrepGeometry(brepRef) {
    console.log(`       🔧 Extracting BREP geometry from ref ${brepRef}`);
    
    const brep = this.facetedBreps.get(brepRef);
    if (!brep) {
      console.log(`       ❌ No faceted BREP found for ref ${brepRef}`);
      console.log(`       Available faceted BREPs: ${Array.from(this.facetedBreps.keys()).join(', ')}`);
      return null;
    }

    console.log(`       Found faceted BREP with outer shell: ${brep.outer}`);

    const vertices = [];
    const faces = [];
    const vertexMap = new Map(); // Map point ref to vertex index

    // Process outer shell (simplified - assuming IFCCLOSEDSHELL)
    const shell = this.ifcData[brep.outer];
    if (!shell) {
      console.log(`       ❌ No shell entity found for ref ${brep.outer}`);
      return null;
    }
    
    if (shell.type !== 'IFCCLOSEDSHELL') {
      console.log(`       ❌ Shell type is ${shell.type}, expected IFCCLOSEDSHELL`);
      return null;
    }

    console.log(`       Processing closed shell ${brep.outer}`);

    // Get faces from shell
    const shellParam = shell.params[0];
    const faceRefs = [];
    if (shellParam && shellParam.startsWith('(') && shellParam.endsWith(')')) {
      const facesStr = shellParam.slice(1, -1);
      const refs = facesStr.split(',').map(ref => this.parseReference(ref.trim()));
      faceRefs.push(...refs.filter(ref => ref !== null));
    }

    console.log(`       Found ${faceRefs.length} face references`);

    let vertexIndex = 0;

    // Process each face
    for (const faceRef of faceRefs) {
      const face = this.faces.get(faceRef);
      if (!face) {
        console.log(`       ❌ No face found for ref ${faceRef}`);
        continue;
      }

      const faceVertices = [];

      // Process face bounds (outer boundary)
      for (const boundRef of face.bounds) {
        const bound = this.ifcData[boundRef];
        if (!bound || bound.type !== 'IFCFACEOUTERBOUND') {
          console.log(`       ❌ Bound ${boundRef} is not IFCFACEOUTERBOUND (type: ${bound?.type})`);
          continue;
        }

        const loopRef = this.parseReference(bound.params[0]);
        const polyloop = this.polyloops.get(loopRef);
        if (!polyloop) {
          console.log(`       ❌ No polyloop found for ref ${loopRef}`);
          continue;
        }

        this.logger.debug(`Processing polyloop with ${polyloop.polygon.length} points`);

        // Extract vertices from polyloop
        for (const pointRef of polyloop.polygon) {
          const point = this.points.get(pointRef);
          if (!point) {
            console.log(`       ❌ No point found for ref ${pointRef}`);
            continue;
          }

          // Check if we already have this vertex
          if (!vertexMap.has(pointRef)) {
            vertices.push([...point]);
            vertexMap.set(pointRef, vertexIndex);
            faceVertices.push(vertexIndex);
            vertexIndex++;
          } else {
            faceVertices.push(vertexMap.get(pointRef));
          }
        }

        // Create triangular faces from polygon (fan triangulation)
        if (faceVertices.length >= 3) {
          for (let i = 1; i < faceVertices.length - 1; i++) {
            faces.push([faceVertices[0], faceVertices[i], faceVertices[i + 1]]);
          }
        }
      }
    }

    console.log(`       Extracted ${vertices.length} vertices, ${faces.length} faces`);

    if (vertices.length === 0) return null;

    return { vertices, faces };
  }
}