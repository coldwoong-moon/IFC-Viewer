import { CHDWriter } from '../src/writers/CHDWriter.js';

/**
 * Create a simple building example with basic elements
 */
function createSimpleBuildingModel() {
  const elements = [];
  
  // Create a simple rectangular slab (ground floor)
  elements.push({
    id: 'slab_001',
    name: 'Ground Floor Slab',
    type: 'slab',
    level: 'Level 0',
    materialId: 'concrete_c30',
    vertices: [
      [0, 0, 0],      // 0: bottom-left
      [10, 0, 0],     // 1: bottom-right
      [10, 8, 0],     // 2: top-right
      [0, 8, 0],      // 3: top-left
      [0, 0, 0.2],    // 4: bottom-left top
      [10, 0, 0.2],   // 5: bottom-right top
      [10, 8, 0.2],   // 6: top-right top
      [0, 8, 0.2]     // 7: top-left top
    ],
    faces: [
      // Bottom face
      [0, 1, 2], [0, 2, 3],
      // Top face
      [4, 6, 5], [4, 7, 6],
      // Sides
      [0, 4, 5], [0, 5, 1],  // front
      [1, 5, 6], [1, 6, 2],  // right
      [2, 6, 7], [2, 7, 3],  // back
      [3, 7, 4], [3, 4, 0]   // left
    ],
    properties: {
      thickness: 0.2,
      area: 80.0,
      volume: 16.0,
      fire_rating: 'REI 120',
      load_bearing: true
    }
  });

  // Create exterior walls
  const wallHeight = 3.0;
  const wallThickness = 0.2;
  
  // South wall (front)
  elements.push({
    id: 'wall_001',
    name: 'South Exterior Wall',
    type: 'wall',
    level: 'Level 1',
    materialId: 'brick_exterior',
    vertices: [
      [0, 0, 0.2],                    // 0: bottom-left
      [10, 0, 0.2],                   // 1: bottom-right
      [10, 0, wallHeight + 0.2],      // 2: top-right
      [0, 0, wallHeight + 0.2],       // 3: top-left
      [0, wallThickness, 0.2],        // 4: bottom-left inner
      [10, wallThickness, 0.2],       // 5: bottom-right inner
      [10, wallThickness, wallHeight + 0.2],  // 6: top-right inner
      [0, wallThickness, wallHeight + 0.2]    // 7: top-left inner
    ],
    faces: [
      // Exterior face
      [0, 2, 1], [0, 3, 2],
      // Interior face
      [4, 5, 6], [4, 6, 7],
      // Top
      [3, 6, 2], [3, 7, 6],
      // Bottom
      [0, 1, 5], [0, 5, 4],
      // Ends
      [0, 4, 7], [0, 7, 3],  // left
      [1, 2, 6], [1, 6, 5]   // right
    ],
    properties: {
      height: wallHeight,
      length: 10.0,
      thickness: wallThickness,
      area: wallHeight * 10.0,
      volume: wallHeight * 10.0 * wallThickness,
      fire_rating: 'REI 90',
      load_bearing: true,
      thermal_resistance: 2.5
    }
  });

  // East wall (right)
  elements.push({
    id: 'wall_002',
    name: 'East Exterior Wall',
    type: 'wall',
    level: 'Level 1',
    materialId: 'brick_exterior',
    vertices: [
      [10, 0, 0.2],                   // 0: bottom-front
      [10, 8, 0.2],                   // 1: bottom-back
      [10, 8, wallHeight + 0.2],      // 2: top-back
      [10, 0, wallHeight + 0.2],      // 3: top-front
      [10 - wallThickness, 0, 0.2],   // 4: bottom-front inner
      [10 - wallThickness, 8, 0.2],   // 5: bottom-back inner
      [10 - wallThickness, 8, wallHeight + 0.2],  // 6: top-back inner
      [10 - wallThickness, 0, wallHeight + 0.2]   // 7: top-front inner
    ],
    faces: [
      [0, 1, 2], [0, 2, 3],  // exterior
      [4, 6, 5], [4, 7, 6],  // interior
      [3, 2, 6], [3, 6, 7],  // top
      [0, 5, 1], [0, 4, 5],  // bottom
      [0, 3, 7], [0, 7, 4],  // front
      [1, 5, 6], [1, 6, 2]   // back
    ],
    properties: {
      height: wallHeight,
      length: 8.0,
      thickness: wallThickness,
      area: wallHeight * 8.0,
      volume: wallHeight * 8.0 * wallThickness,
      fire_rating: 'REI 90',
      load_bearing: true,
      thermal_resistance: 2.5
    }
  });

  // Add a simple column
  elements.push({
    id: 'column_001',
    name: 'Interior Column',
    type: 'column',
    level: 'Level 1',
    materialId: 'concrete_c30',
    vertices: [
      [4.8, 3.8, 0.2],      // 0: bottom face
      [5.2, 3.8, 0.2],      // 1
      [5.2, 4.2, 0.2],      // 2
      [4.8, 4.2, 0.2],      // 3
      [4.8, 3.8, wallHeight + 0.2],  // 4: top face
      [5.2, 3.8, wallHeight + 0.2],  // 5
      [5.2, 4.2, wallHeight + 0.2],  // 6
      [4.8, 4.2, wallHeight + 0.2]   // 7
    ],
    faces: [
      // Bottom
      [0, 2, 1], [0, 3, 2],
      // Top
      [4, 5, 6], [4, 6, 7],
      // Sides
      [0, 1, 5], [0, 5, 4],  // front
      [1, 2, 6], [1, 6, 5],  // right
      [2, 3, 7], [2, 7, 6],  // back
      [3, 0, 4], [3, 4, 7]   // left
    ],
    properties: {
      height: wallHeight,
      cross_section: 'rectangular',
      width: 0.4,
      depth: 0.4,
      area: 0.16,
      volume: 0.16 * wallHeight,
      fire_rating: 'REI 120',
      load_bearing: true
    }
  });

  // Add a simple beam
  elements.push({
    id: 'beam_001',
    name: 'Main Beam',
    type: 'beam',
    level: 'Level 1',
    materialId: 'concrete_c30',
    vertices: [
      [2, 3.8, wallHeight + 0.2],      // 0: start bottom
      [8, 3.8, wallHeight + 0.2],      // 1: end bottom
      [8, 4.2, wallHeight + 0.2],      // 2: end bottom back
      [2, 4.2, wallHeight + 0.2],      // 3: start bottom back
      [2, 3.8, wallHeight + 0.6],      // 4: start top
      [8, 3.8, wallHeight + 0.6],      // 5: end top
      [8, 4.2, wallHeight + 0.6],      // 6: end top back
      [2, 4.2, wallHeight + 0.6]       // 7: start top back
    ],
    faces: [
      // Bottom
      [0, 2, 1], [0, 3, 2],
      // Top
      [4, 5, 6], [4, 6, 7],
      // Sides
      [0, 1, 5], [0, 5, 4],  // front
      [1, 2, 6], [1, 6, 5],  // right
      [2, 3, 7], [2, 7, 6],  // back
      [3, 0, 4], [3, 4, 7]   // left
    ],
    properties: {
      length: 6.0,
      cross_section: 'rectangular',
      width: 0.4,
      height: 0.4,
      area: 0.16,
      volume: 0.16 * 6.0,
      fire_rating: 'REI 120',
      load_bearing: true
    }
  });

  return elements;
}

/**
 * Create materials for the building
 */
function createMaterials() {
  return {
    'concrete_c30': {
      name: 'Concrete C30/37',
      type: 'concrete',
      properties: {
        density: 2400,
        strength: 37,
        color: [0.7, 0.7, 0.7, 1.0]
      },
      thermal: {
        conductivity: 2.3,
        capacity: 1000
      },
      cost: {
        unit: 'EUR/m3',
        value: 95.0
      }
    },
    'brick_exterior': {
      name: 'Exterior Brick Wall',
      type: 'masonry',
      properties: {
        density: 1800,
        strength: 15,
        color: [0.8, 0.4, 0.2, 1.0]
      },
      thermal: {
        conductivity: 0.8,
        capacity: 840
      },
      cost: {
        unit: 'EUR/m2',
        value: 45.0
      }
    },
    'steel_rebar': {
      name: 'Steel Reinforcement',
      type: 'steel',
      properties: {
        density: 7850,
        strength: 500,
        color: [0.3, 0.3, 0.3, 1.0]
      },
      thermal: {
        conductivity: 50,
        capacity: 460
      },
      cost: {
        unit: 'EUR/kg',
        value: 0.85
      }
    }
  };
}

/**
 * Main function to create and save the building
 */
async function createSimpleBuilding() {
  console.log('Creating simple building model...');
  
  const elements = createSimpleBuildingModel();
  const materials = createMaterials();
  
  const model = {
    project: {
      name: 'Simple Building Example',
      description: 'A basic building with slab, walls, column, and beam',
      units: 'meters',
      coordinate_system: 'local',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'San Francisco, CA'
      }
    },
    elements: elements,
    materials: materials,
    hierarchy: null,
    references: {}
  };

  console.log(`Model contains ${elements.length} elements and ${Object.keys(materials).length} materials`);

  // Create CHD writer with compression
  const writer = new CHDWriter({
    compression: 'zlib',
    compressionLevel: 6,
    chunkSize: 10,
    createSpatialIndex: true,
    progressCallback: (progress) => {
      console.log(`Progress: ${progress.stage} - ${progress.percentage}%`);
    }
  });

  try {
    const outputPath = './examples/simple/simple-building.chd';
    const result = await writer.write(model, outputPath);
    
    console.log('Successfully created CHD file!');
    console.log('Statistics:', result.statistics);
    console.log(`Output: ${result.outputPath}`);
    
    return result;
  } catch (error) {
    console.error('Failed to create CHD file:', error.message);
    throw error;
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSimpleBuilding()
    .then(() => console.log('Done!'))
    .catch(console.error);
}

export { createSimpleBuilding, createSimpleBuildingModel, createMaterials };